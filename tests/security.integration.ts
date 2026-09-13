import { after, before, test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { initializeTestEnvironment, assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';
import { adminAuth, adminDb } from '../src/lib/server/admin';
import { POST as review } from '../src/app/api/reviews/route';
import { POST as deleteAccount } from '../src/app/api/account/delete/route';
import { POST as ai } from '../src/app/api/ai/route';
import { reserveAiQuota } from '../src/lib/server/aiQuota';
import { readJson } from '../src/lib/server/http';
import { NextRequest } from 'next/server';

const projectId = 'demo-koreading';
process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = projectId;
process.env.AI_GUEST_SECRET = 'emulator-only-secret';
process.env.AI_DAILY_BUDGET = '10000';
let env: RulesTestEnvironment;
const tokens: Record<string, string> = {};
const request = (uid: string, body: unknown) => new Request('http://localhost/api', { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${tokens[uid]}` }, body: JSON.stringify(body) });

before(async () => {
  assert.ok(process.env.FIRESTORE_EMULATOR_HOST && process.env.FIREBASE_AUTH_EMULATOR_HOST, 'Run only through emulators:exec');
  env = await initializeTestEnvironment({ projectId, firestore: { rules: await readFile('firestore.rules', 'utf8') } });
  await env.clearFirestore();
  for (const uid of ['alice', 'bob', 'delete-me']) {
    try { await adminAuth().deleteUser(uid); } catch { /* Fresh emulator. */ }
    await adminAuth().createUser({ uid, email: `${uid}@example.test`, password: 'test-password-123' });
    const response = await fetch(`http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=emulator`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: `${uid}@example.test`, password: 'test-password-123', returnSecureToken: true }) });
    tokens[uid] = (await response.json()).idToken;
    assert.ok(tokens[uid]);
  }
  await adminDb().doc('articles/example').set({ title: '예시', averageRating: 0, ratingCount: 0, ratingSum: 0 });
});
after(async () => { await env?.cleanup(); await adminDb().terminate(); });

test('rules keep public reads, isolate user data and prevent forged writes', async () => {
  const alice = env.authenticatedContext('alice').firestore();
  const bob = env.authenticatedContext('bob').firestore();
  await assertSucceeds(getDoc(doc(env.unauthenticatedContext().firestore(), 'articles/example')));
  await assertSucceeds(setDoc(doc(alice, 'users/alice/vocabulary/word'), { word: '눈' }));
  await assertFails(getDoc(doc(bob, 'users/alice/vocabulary/word')));
  await assertFails(setDoc(doc(alice, 'articles/spam'), { title: 'Forged article' }));
  await assertFails(updateDoc(doc(alice, 'articles/example'), { averageRating: 5 }));
  await assertFails(setDoc(doc(alice, 'articles/example/reviews/forged'), { userId: 'bob', rating: 5 }));
  await assertFails(setDoc(doc(alice, 'aiUsage/global'), { used: 0 }));
});
test('concurrent and repeated server reviews preserve an atomic accurate aggregate', async () => {
  const [a, b] = await Promise.all([review(request('alice', { articleId: 'example', rating: 3, pros: '', cons: '' })), review(request('bob', { articleId: 'example', rating: 4, pros: '', cons: '' }))]);
  assert.equal(a.status, 200); assert.equal(b.status, 200);
  for (let i = 0; i < 2; i++) assert.equal((await review(request('alice', { articleId: 'example', rating: 5, pros: 'Good', cons: '' }))).status, 200);
  const data = (await adminDb().doc('articles/example').get()).data()!;
  assert.equal(data.ratingCount, 2); assert.equal(data.ratingSum, 9); assert.equal(data.averageRating, 4.5);
  assert.equal((await adminDb().doc('articles/example/reviews/alice').get()).data()?.userId, 'alice');
});
test('invalid review does not create a partial document', async () => {
  assert.equal((await review(request('alice', { articleId: 'missing', rating: 5, pros: '', cons: '' }))).status, 404);
  assert.equal((await adminDb().doc('articles/missing/reviews/alice').get()).exists, false);
  assert.equal((await review(request('alice', { articleId: 'example', rating: 99, pros: '', cons: '' }))).status, 400);
  assert.equal((await review(new Request('http://localhost', { method: 'POST' }))).status, 401);
});
test('failed cleanup leaves Auth available for retry, blocks writes and deletes all nested data on retry', async () => {
  const uid = 'delete-me';
  await adminDb().doc(`users/${uid}`).set({ name: 'Private' });
  await adminDb().doc(`users/${uid}/vocabulary/a`).set({ word: '눈' });
  await adminDb().doc(`users/${uid}/customCategories/a`).set({ name: 'Private' });
  await adminDb().doc(`users/${uid}/readArticles/example`).set({ readAt: 'today' });
  await review(request(uid, { articleId: 'example', rating: 5, pros: 'Personal text', cons: '' }));
  const failure = mock.method(adminDb(), 'recursiveDelete', async () => { throw new Error('simulated storage failure'); });
  assert.equal((await deleteAccount(request(uid, {}))).status, 503);
  failure.mock.restore();
  assert.equal((await adminAuth().getUser(uid)).uid, uid);
  await assertFails(setDoc(doc(env.authenticatedContext(uid).firestore(), `users/${uid}/vocabulary/new`), { word: '책' }));
  assert.equal((await review(request(uid, { articleId: 'example', rating: 1, pros: '', cons: '' }))).status, 409);
  assert.equal((await deleteAccount(request(uid, {}))).status, 200);
  await assert.rejects(adminAuth().getUser(uid));
  assert.equal((await adminDb().doc(`users/${uid}`).get()).exists, false);
  assert.equal((await adminDb().collection(`users/${uid}/vocabulary`).get()).size, 0);
  assert.equal((await adminDb().collection(`users/${uid}/customCategories`).get()).size, 0);
  assert.equal((await adminDb().collection(`users/${uid}/readArticles`).get()).size, 0);
  const r = (await adminDb().doc(`articles/example/reviews/${uid}`).get()).data()!;
  assert.equal(r.userId, undefined); assert.equal(r.pros, ''); assert.equal(r.userDisplayName, 'Deleted account');
});
test('shared guest quota cannot overshoot under concurrent requests', async () => {
  const req = new Request('http://localhost', { headers: { 'x-forwarded-for': '192.0.2.88' } });
  const results = await Promise.allSettled(Array.from({ length: 10 }, () => reserveAiQuota(req, 'lookupWord')));
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 4);
  assert.ok(results.filter(r => r.status === 'rejected').every(r => r.status === 'rejected' && r.reason.status === 429));
});
test('invalid AI request fails before provider calls; oversized stream gets 413', async () => {
  const response = await ai(new NextRequest('http://localhost/api/ai', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'lookupWord', word: 12 }) }));
  assert.equal(response.status, 400);
  await assert.rejects(readJson(new Request('http://localhost', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ data: 'x'.repeat(25000) }) })), (e: unknown) => (e as { status: number }).status === 413);
});
