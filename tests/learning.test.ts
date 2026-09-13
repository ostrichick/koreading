import test from 'node:test';
import assert from 'node:assert/strict';
import { recommendLevel, reviewAggregate, wordCacheKey, articleSummary } from '../src/lib/learning';
import { aiRequestSchema, articleSchema, parseModelJson, placementSchema, levels } from '../src/lib/schemas';
import { validateArticleQuality } from '../src/lib/articleQuality';
import { isAuthorizedCron } from '../src/lib/cronAuth';
import { KOREAN_CURRICULUM } from '../src/lib/koreanCurriculum';

test('cron rejects missing secrets, spoofed user agents and incorrect tokens', () => {
  assert.equal(isAuthorizedCron(new Headers({ 'user-agent': 'vercel-cron/1.0' }), 'secret'), false);
  assert.equal(isAuthorizedCron(new Headers({ authorization: 'Bearer undefined' }), undefined), false);
  assert.equal(isAuthorizedCron(new Headers({ authorization: 'Bearer wrong' }), 'secret'), false);
  assert.equal(isAuthorizedCron(new Headers({ authorization: 'Bearer secret' }), 'secret'), true);
});
test('placement recommends a demonstrated level, not an untested next level', () => {
  assert.equal(recommendLevel({}), 'A1');
  assert.equal(recommendLevel({ A1: [1, 1], A2: [1, 0] }), 'A1');
  assert.equal(recommendLevel({ A1: [1, 1], A2: [1, 1] }), 'A2');
  assert.equal(recommendLevel({ A1: [0, 0], C2: [1, 1] }), 'A1');
  assert.equal(recommendLevel(Object.fromEntries(levels.map(l => [l, [1, 1]]))), 'C2');
});
test('placement rejects missing, duplicate, reordered levels and invalid answers', () => {
  const data = { levels: levels.map(level => ({ level, text: '한국어 지문', questions: [0, 1].map(correct => ({ question: 'Question', options: ['a','b','c','d'], correct })) })) };
  assert.equal(placementSchema.safeParse(data).success, true);
  assert.equal(placementSchema.safeParse({ levels: data.levels.slice(0, 5) }).success, false);
  assert.equal(placementSchema.safeParse({ levels: [...data.levels].reverse() }).success, false);
  data.levels[0].questions[0].correct = 4;
  assert.equal(placementSchema.safeParse(data).success, false);
});
test('AI schema rejects oversized nested inputs, wrong types and invalid actions', () => {
  assert.equal(aiRequestSchema.safeParse({ action: 'generateTest', nativeLang: 'ja' }).success, true);
  assert.equal(aiRequestSchema.safeParse({ action: 'generateTest', nativeLang: 'xx' }).success, false);
  assert.equal(aiRequestSchema.safeParse({ action: 'deleteEverything' }).success, false);
  assert.equal(aiRequestSchema.safeParse({ action: 'generateArticle', level: 'A1', topic: 'food', recentTitles: Array(11).fill('title') }).success, false);
  assert.equal(aiRequestSchema.safeParse({ action: 'tutorChat', level: 'A1', paragraph: '글', userMessage: '질문', chatHistory: [{ role: 'user', parts: [{ text: 'x'.repeat(2501) }] }] }).success, false);
  assert.equal(aiRequestSchema.safeParse({ action: 'lookupWord', word: 9, sentence: '문장' }).success, false);
});
test('word cache isolates senses and languages', () => {
  assert.notEqual(wordCacheKey('눈', '눈이 와요.', 'en'), wordCacheKey('눈', '눈이 아파요.', 'en'));
  assert.notEqual(wordCacheKey('눈', '눈이 와요.', 'en'), wordCacheKey('눈', '눈이 와요.', 'ja'));
});
test('review replacement does not inflate counts or repeatedly round the sum', () => {
  let data = reviewAggregate({}, undefined, 1);
  data = reviewAggregate(data, undefined, 2);
  data = reviewAggregate(data, undefined, 2);
  assert.deepEqual(data, { ratingCount: 3, ratingSum: 5, averageRating: 1.7 });
  assert.deepEqual(reviewAggregate(data, 1, 5), { ratingCount: 3, ratingSum: 9, averageRating: 3 });
});
test('shared summaries do not silently show another learners language', () => {
  assert.equal(articleSummary({ summary: 'Hello', summaryLanguage: 'en' }, 'ja'), '');
  assert.equal(articleSummary({ summary: 'Hello', summaries: { ja: 'こんにちは' } }, 'ja'), 'こんにちは');
});
test('article validator rejects malformed, off-topic and educationally incomplete output', () => {
  const article = articleSchema.parse({ title: '시장에 가요', content: '시장 사과 가게 사람 친구 '.repeat(25), summary: 'Market', summaries: { en: 'Market', es: 'Mercado', ja: '市場', zh: '市场' }, topicCategory: 'food', level: 'A1', estimatedMinutes: 2, keyVocabulary: ['시장','사과','가게','사람','친구'] });
  article.grammarEvidence = KOREAN_CURRICULUM.A1.targetGrammar.slice(0, 2).map(pattern => ({ pattern, quote: '시장 사과' }));
  assert.doesNotThrow(() => validateArticleQuality(article, 'A1', 'food'));
  assert.throws(() => validateArticleQuality({ ...article, grammarEvidence: [{ pattern: 'invented', quote: '시장' }] }, 'A1', 'food'));
  assert.throws(() => validateArticleQuality(article, 'B2', 'food'));
  assert.throws(() => validateArticleQuality({ ...article, content: 'short' }, 'A1', 'food'));
  assert.throws(() => validateArticleQuality({ ...article, keyVocabulary: ['없는말', ...article.keyVocabulary.slice(1)] }, 'A1', 'food'));
  assert.throws(() => validateArticleQuality({ ...article, content: article.content + 'English' }, 'A1', 'food'));
  assert.deepEqual(parseModelJson('```json\n{"ok":true}\n```'), { ok: true });
});
