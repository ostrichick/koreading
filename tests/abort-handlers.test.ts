import test from 'node:test';
import assert from 'node:assert/strict';
import { getPrioritizedGeminiModels } from '../src/lib/geminiModels';
import { getRealKoreanPhoto } from '../src/lib/koreanVisuals';

test('an already-aborted AI request does not start a model listing or image lookup', async () => {
  const controller = new AbortController();
  controller.abort(new Error('Request deadline reached'));
  const originalFetch = globalThis.fetch;
  let fetches = 0;
  globalThis.fetch = async () => { fetches++; throw new Error('Unexpected network request'); };
  try {
    await assert.rejects(getPrioritizedGeminiModels('test-key', controller.signal), /Request deadline reached/);
    await assert.rejects(getRealKoreanPhoto('food', '김치', ['김치'], undefined, controller.signal), /Request deadline reached/);
    assert.equal(fetches, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
