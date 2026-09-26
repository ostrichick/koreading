import test from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { POST } from '../src/app/api/ai/route';
import { aiQuotaIdentity, checkAiQuota } from '../src/lib/aiQuota';
import { AiDeadlineError, createAiBudget, withinSignal } from '../src/lib/aiBudget';

test('untrusted forwarding headers cannot create unique quota identities', () => {
  const headers = new Headers({ 'x-forwarded-for': '203.0.113.41', 'x-vercel-forwarded-for': '198.51.100.20' });
  assert.equal(aiQuotaIdentity(headers, undefined), 'unverified-client');
  assert.equal(aiQuotaIdentity(headers, 'development'), 'unverified-client');
  assert.equal(aiQuotaIdentity(new Headers({ 'x-forwarded-for': '203.0.113.99' }), undefined), 'unverified-client');
  assert.equal(aiQuotaIdentity(headers, 'production'), '203.0.113.41');
  assert.equal(aiQuotaIdentity(new Headers({ 'x-forwarded-for': 'forged, 203.0.113.41' }), 'preview'), 'unverified-client');
  assert.equal(aiQuotaIdentity(new Headers({ 'x-forwarded-for': '203.0.113.41:8181' }), 'production'), 'unverified-client');
  assert.equal(aiQuotaIdentity(new Headers({ 'x-vercel-forwarded-for': '203.0.113.41' }), 'production'), 'unverified-client');
  assert.equal(aiQuotaIdentity(new Headers({ 'x-forwarded-for': '2001:0db8:0:0:0:0:0:1' }), 'preview'), '2001:db8::1');
  assert.equal(aiQuotaIdentity(new Headers({ 'x-forwarded-for': '2001:db8::1' }), 'preview'), '2001:db8::1');
});

test('attempt budget is shared across branches and emits only fixed telemetry fields', () => {
  const controller = new AbortController();
  const budget = createAiBudget('lookupWord', controller.signal, Date.now(), 2);
  const first = budget.reserve('groq', 3000)!;
  const second = budget.reserve('gemini', 9000)!;
  assert.equal(budget.reserve('gemini', 9000), null);
  assert.equal(first.ordinal, 1);
  assert.equal(second.ordinal, 2);
  assert.equal(budget.attemptsUsed, 2);
  assert.ok(first.timeoutMs <= 3000 && second.timeoutMs <= 9000);
  const messages: string[] = [];
  const original = console.info;
  console.info = (message?: unknown) => { messages.push(String(message)); };
  try { budget.record(first, 'failure'); budget.record(second, 'success'); }
  finally { console.info = original; }
  assert.deepEqual(messages.map(line => Object.keys(JSON.parse(line)).sort()), [
    ['action', 'durationMs', 'event', 'ordinal', 'outcome', 'provider'],
    ['action', 'durationMs', 'event', 'ordinal', 'outcome', 'provider'],
  ]);
  controller.abort();
  assert.equal(budget.reserve('gemini', 1000), null);
});

test('deadline aborts pending work and blocks attempts without waiting for the promise', async () => {
  const controller = new AbortController();
  const pending = new Promise<string>(() => {});
  const waiting = withinSignal(pending, controller.signal);
  controller.abort();
  await assert.rejects(waiting, AiDeadlineError);
  await assert.rejects(withinSignal(Promise.resolve('late'), controller.signal), AiDeadlineError);
  assert.equal(createAiBudget('tutorChat', controller.signal, Date.now()).reserve('gemini', 9000), null);
});

test('production requires shared Redis and never falls back to local quota', async () => {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  const vercel = process.env.VERCEL_ENV;
  const originalFetch = globalThis.fetch;
  let requests = 0;
  try {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    process.env.VERCEL_ENV = 'preview';
    globalThis.fetch = async () => { requests++; throw new Error('Unexpected external request'); };
    await assert.rejects(checkAiQuota('test', Date.now(), true), /Shared AI quota storage required/);
    const req = new NextRequest('http://localhost/api/ai', {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.10' },
      body: JSON.stringify({ action: 'generateTest', nativeLang: 'en' }),
    });
    const response = await POST(req);
    assert.equal(response.status, 503);
    assert.equal(requests, 0);
    assert.deepEqual(await response.json(), { error: 'AI response unavailable. Please retry.' });
  } finally {
    if (url === undefined) delete process.env.UPSTASH_REDIS_REST_URL;
    else process.env.UPSTASH_REDIS_REST_URL = url;
    if (token === undefined) delete process.env.UPSTASH_REDIS_REST_TOKEN;
    else process.env.UPSTASH_REDIS_REST_TOKEN = token;
    if (vercel === undefined) delete process.env.VERCEL_ENV;
    else process.env.VERCEL_ENV = vercel;
    globalThis.fetch = originalFetch;
  }
});

test('mock provider failures cannot leak keys, prompts or provider errors in output or telemetry', async () => {
  const originalFetch = globalThis.fetch;
  const originalInfo = console.info;
  const groq = process.env.GROQ_API_KEY;
  const vercel = process.env.VERCEL_ENV;
  const logs: string[] = [];
  let calls = 0;
  try {
    delete process.env.GROQ_API_KEY;
    delete process.env.VERCEL_ENV;
    console.info = (message?: unknown) => { logs.push(String(message)); };
    globalThis.fetch = async (input: RequestInfo | URL) => {
      calls++;
      const url = String(input);
      if (url.includes('/v1beta/models?')) {
        return Response.json({ models: [{ name: 'models/gemini-3.5-flash-lite', supportedGenerationMethods: ['generateContent'] }] });
      }
      return new Response('private provider error TEST_API_KEY_SECRET learner prompt PRIVATE_QUESTION', { status: 429 });
    };
    const request = new NextRequest('http://localhost/api/ai', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'tutorChat', level: 'A1', paragraph: '안녕하세요.', userMessage: 'PRIVATE_QUESTION', customApiKey: 'TEST_API_KEY_SECRET' }),
    });
    const response = await POST(request);
    const output = JSON.stringify(await response.json());
    assert.equal(response.status, 503);
    assert.ok(calls >= 2);
    assert.ok(logs.length >= 1);
    for (const text of [output, ...logs]) {
      assert.equal(text.includes('TEST_API_KEY_SECRET'), false);
      assert.equal(text.includes('PRIVATE_QUESTION'), false);
      assert.equal(text.includes('private provider error'), false);
    }
  } finally {
    globalThis.fetch = originalFetch;
    console.info = originalInfo;
    if (groq === undefined) delete process.env.GROQ_API_KEY;
    else process.env.GROQ_API_KEY = groq;
    if (vercel === undefined) delete process.env.VERCEL_ENV;
    else process.env.VERCEL_ENV = vercel;
  }
});

test('request aborted during optional photo lookup returns timeout, not JSON-parse error', async () => {
  const originalFetch = globalThis.fetch;
  const vercel = process.env.VERCEL_ENV;
  const groq = process.env.GROQ_API_KEY;
  const controller = new AbortController();
  let photos = 0;
  try {
    delete process.env.VERCEL_ENV;
    delete process.env.GROQ_API_KEY;
    globalThis.fetch = async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/v1beta/models?')) {
        return Response.json({ models: [{ name: 'models/gemini-3.5-flash-lite', supportedGenerationMethods: ['generateContent'] }] });
      }
      if (url.includes(':generateContent')) {
        const content = { title: '시장에 가요', content: '시장에 가요. 사과를 사요. '.repeat(8),
          summary: 'Market', level: 'A1', topicCategory: 'food', keyVocabulary: ['시장', '사과'], estimatedMinutes: 1,
          discussionPrompt: '당신이라면 시장에서 무엇을 먼저 살까요?',
          continuationChoices: ['친구와 다른 가게를 찾아봅니다.', '집에 가서 가족에게 이야기합니다.'],
          writingPrompt: '본문의 단어 하나를 사용해서 짧은 문장을 만들어 보세요.',
          comprehensionQuiz: [
            { kind: 'main', question: '글의 중심 내용은 무엇인가요?', options: ['시장 이야기', '학교 이야기', '여행 이야기', '운동 이야기'], correct: 0, explanation: '시장에 가서 사과를 사는 이야기입니다.', paragraphIndex: 0 },
            { kind: 'detail', question: '무엇을 샀나요?', options: ['책', '사과', '신발', '우산'], correct: 1, explanation: '사과를 샀습니다.', paragraphIndex: 0 },
            { kind: 'vocabulary', question: '시장에서는 무엇을 하나요?', options: ['물건을 사고팝니다', '잠을 잡니다', '수영을 합니다', '시험을 봅니다'], correct: 0, explanation: '시장에서는 여러 물건을 사고팝니다.', paragraphIndex: 0 },
          ] };
        return Response.json({ candidates: [{ content: { role: 'model', parts: [{ text: JSON.stringify(content) }] }, finishReason: 'STOP' }] });
      }
      if (url.includes('wikipedia.org')) {
        photos++;
        controller.abort();
        throw new Error('Photo cancelled');
      }
      throw new Error('Unexpected mocked request');
    };
    const request = new NextRequest('http://localhost/api/ai', {
      method: 'POST', signal: controller.signal, headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'generateArticle', level: 'A1', topic: 'food', customApiKey: 'PHOTO_TEST_KEY' }),
    });
    const response = await POST(request);
    assert.equal(photos, 1);
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { error: 'AI request timed out. Please retry.' });
  } finally {
    globalThis.fetch = originalFetch;
    if (vercel === undefined) delete process.env.VERCEL_ENV;
    else process.env.VERCEL_ENV = vercel;
    if (groq === undefined) delete process.env.GROQ_API_KEY;
    else process.env.GROQ_API_KEY = groq;
  }
});
