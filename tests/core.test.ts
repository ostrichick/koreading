import test from 'node:test';
import assert from 'node:assert/strict';
import { isAuthorizedCron } from '../src/lib/cronAuth';
import { aiRequestSchema, articleSchema, placementSchema, levels, parseModelJson } from '../src/lib/schemas';
import { recommendLevel, wordCacheKey } from '../src/lib/learning';
import { boundedJson } from '../src/lib/readJson';
import { checkAiQuota } from '../src/lib/aiQuota';

test('cron refuses spoofed headers and absent secrets', () => {
  assert.equal(isAuthorizedCron(new Headers({ 'user-agent': 'vercel-cron' }), 'secret'), false);
  assert.equal(isAuthorizedCron(new Headers({ authorization: 'Bearer undefined' }), undefined), false);
  assert.equal(isAuthorizedCron(new Headers({ authorization: 'Bearer secret' }), 'secret'), true);
});
test('AI validates nested sizes, enumerations and actual types', () => {
  assert.equal(aiRequestSchema.safeParse({ action: 'generateTest', nativeLang: 'ja' }).success, true);
  assert.equal(aiRequestSchema.safeParse({ action: 'lookupWord', word: {}, sentence: '눈이 와요.' }).success, false);
  assert.equal(aiRequestSchema.safeParse({ action: 'generateArticle', level: 'A1', topic: 'food', recentTitles: Array(11).fill('title') }).success, false);
  assert.equal(aiRequestSchema.safeParse({ action: 'tutorChat', level: 'A1', paragraph: '글', userMessage: '질문', chatHistory: [{ role: 'model', parts: [{ text: 'x'.repeat(2501) }] }] }).success, false);
});
test('six levels and valid answer indices are required', () => {
  const data = { levels: levels.map(level => ({ level, text: '눈이 와요.', questions: [0,1].map(correct => ({ correct, question: 'Question', options: ['a','b','c','d'] })) })) };
  assert.equal(placementSchema.safeParse(data).success, true);
  assert.equal(placementSchema.safeParse({ levels: data.levels.slice(1) }).success, false);
  data.levels[0].questions[0].correct = 4;
  assert.equal(placementSchema.safeParse(data).success, false);
});
test('placement does not grant an untested higher level', () => {
  assert.equal(recommendLevel({ A1: [1,1], A2: [1,0] }), 'A1');
  assert.equal(recommendLevel({ A1: [1,1], A2: [1,1] }), 'A2');
  assert.equal(recommendLevel({ A1: [0,0], C2: [1,1] }), 'A1');
});
test('cache distinguishes word senses and output languages', () => {
  assert.notEqual(wordCacheKey('물었어요', '길을 물었어요.', 'en'), wordCacheKey('물었어요', '개가 물었어요.', 'en'));
  assert.notEqual(wordCacheKey('눈', '눈이 와요.', 'en'), wordCacheKey('눈', '눈이 와요.', 'ja'));
});
test('valid short readings are not rejected for approximate curriculum targets', () => {
  const a = { title: '시장에 가요', content: '시장에 가요. 사과를 사요. '.repeat(8), summary: 'Market', level: 'A1', topicCategory: 'food', keyVocabulary: ['시장','사과'], estimatedMinutes: 1 };
  assert.equal(articleSchema.safeParse(a).success, true);
  assert.equal(articleSchema.safeParse({ ...a, content: '' }).success, false);
  assert.deepEqual(parseModelJson('```json\n{"ok":true}\n```'), { ok: true });
});
test('body limit applies even without a Content-Length header', async () => {
  await assert.rejects(boundedJson(new Request('http://localhost', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text: 'x'.repeat(25000) }) })), (e: unknown) => (e as {status:number}).status === 413);
});
test('local limit bounds concurrent requests and resets with the window', async () => {
  const now = 100000;
  const results = await Promise.all(Array.from({ length: 25 }, () => checkAiQuota('test-local', now)));
  assert.equal(results.filter(Boolean).length, 20);
  assert.equal(await checkAiQuota('test-local', now + 60000), true);
});
test('configured shared limiter does not fall back to local state when unavailable', async () => {
  process.env.UPSTASH_REDIS_REST_URL = 'https://example.test';
  process.env.UPSTASH_REDIS_REST_TOKEN = 'test';
  const original = globalThis.fetch;
  globalThis.fetch = async () => new Response('', { status: 503 });
  try { await assert.rejects(checkAiQuota('shared')); }
  finally { globalThis.fetch = original; delete process.env.UPSTASH_REDIS_REST_URL; delete process.env.UPSTASH_REDIS_REST_TOKEN; }
});
