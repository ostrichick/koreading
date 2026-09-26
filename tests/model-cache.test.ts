import test from 'node:test';
import assert from 'node:assert/strict';
import { getPrioritizedGeminiModels } from '../src/lib/geminiModels';

test('model catalogs are isolated by API key and cached only for that key', async () => {
  const original = globalThis.fetch;
  const calls: string[] = [];
  globalThis.fetch = async input => {
    const url = new URL(String(input));
    const key = url.searchParams.get('key') || '';
    calls.push(key);
    return Response.json({ models: [{ name: key === 'key-a' ? 'models/gemini-3.1-flash-lite' : 'models/gemini-3.6-flash', supportedGenerationMethods: ['generateContent'] }] });
  };
  try {
    const a = await getPrioritizedGeminiModels('key-a');
    const b = await getPrioritizedGeminiModels('key-b');
    const again = await getPrioritizedGeminiModels('key-a');
    assert.equal(a.articleModels[0].id, 'gemini-3.1-flash-lite');
    assert.equal(b.articleModels[0].id, 'gemini-3.6-flash');
    assert.deepEqual(again, a);
    assert.deepEqual(calls, ['key-a', 'key-b']);
  } finally {
    globalThis.fetch = original;
  }
});

test('a failed model listing never leaks a different credential catalog', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => new Response('', { status: 503 });
  try {
    const result = await getPrioritizedGeminiModels('key-c');
    assert.equal(result.articleModels[0].id, 'gemini-3.5-flash-lite');
  } finally {
    globalThis.fetch = original;
  }
});
