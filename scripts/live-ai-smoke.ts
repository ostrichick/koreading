// Optional live provider verification. Writes only to the demo emulator, never production.
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';

async function main() {
  assert.ok(process.env.FIRESTORE_EMULATOR_HOST, 'Run through the demo Firestore emulator');
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = 'demo-koreading';
  process.env.AI_GUEST_SECRET = 'emulator-smoke-only';
  for (const line of (await readFile('.env.local', 'utf8')).split(/\r?\n/)) {
    const i = line.indexOf('=');
    const name = line.slice(0, i);
    if (['GEMINI_API_KEY', 'GROQ_API_KEY'].includes(name)) process.env[name] = line.slice(i + 1).replace(/^['"]|['"]$/g, '');
  }
  const { POST } = await import('../src/app/api/ai/route');
  const { adminDb } = await import('../src/lib/server/admin');
  const originalFetch = globalThis.fetch;
  let captured = 0;
  globalThis.fetch = async (...args) => {
    const response = await originalFetch(...args);
    const url = String(args[0]);
    if (response.ok && (url.includes('generativelanguage.googleapis.com') || url.includes('api.groq.com'))) {
      await writeFile(`.verification/provider-${++captured}.json`, await response.clone().text());
    }
    return response;
  };
  const requests = [
    { action: 'generateArticle', level: 'A1', topic: 'food', nativeLang: 'ja', genre: 'dialogue', customKeyword: '시장 사과' },
    { action: 'lookupWord', type: 'all', word: '눈', sentence: '눈이 와요.', nativeLang: 'ja' },
    { action: 'generateTest', nativeLang: 'ja' },
  ];
  await mkdir('.verification', { recursive: true });
  for (const body of requests) {
    const started = Date.now();
    const response = await POST(new NextRequest('http://localhost/api/ai', { method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': '192.0.2.99' }, body: JSON.stringify(body) }));
    const data = await response.json();
    console.log(JSON.stringify({ action: body.action, status: response.status, durationMs: Date.now() - started, model: data.generatorModel || data._modelBasic, contentLength: data.content?.length, levels: data.levels?.length }));
    assert.equal(response.status, 200, JSON.stringify({ error: data.error, logs: data._logs }));
    const { _signature, _expires, _logs, ...safe } = data;
    await writeFile(`.verification/${body.action}.json`, JSON.stringify(safe, null, 2));
  }
  await adminDb().terminate();
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
