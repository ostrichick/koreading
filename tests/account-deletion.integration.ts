import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { initializeTestEnvironment, assertFails, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDoc, getDocs, serverTimestamp, setDoc, updateDoc, writeBatch, type Firestore } from 'firebase/firestore';
import type { IdTokenResult } from 'firebase/auth';
import { removeAccount } from '../src/lib/deleteAccount';
import { writeReview } from '../src/lib/reviewStore';

let env: RulesTestEnvironment;
const dbFor = (uid: string): Firestore => (env.authenticatedContext(uid).firestore() as unknown as { _delegate: Firestore })._delegate;
const userFor = (uid: string, onDelete: () => Promise<void> = async () => {}) => ({
  uid,
  getIdTokenResult: async () => ({ authTime: new Date().toISOString() } as IdTokenResult),
  delete: onDelete,
});
const article = (count: number, sum: number, lastReviewUid?: string) => ({
  title: '독해 글', content: '한국어 읽기 연습입니다. '.repeat(8), level: 'A1',
  ratingCount: count, ratingSum: sum, averageRating: count ? sum / count : 0,
  ...(lastReviewUid ? { lastReviewUid } : {}),
});
const review = (uid: string, rating: number) => ({
  userId: uid, userDisplayName: uid, rating, pros: '좋아요', cons: '',
});

before(async () => {
  assert.ok(process.env.FIRESTORE_EMULATOR_HOST, 'Emulator required');
  env = await initializeTestEnvironment({ projectId: 'demo-koreading', firestore: { rules: await readFile('firestore.rules', 'utf8') } });
});
after(async () => { await env.cleanup(); });

test('deletion removes private-mapped review, preserves other reviews and aggregates, and retries after Auth fails', async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await setDoc(doc(db, 'articles/one'), article(0, 0));
    await setDoc(doc(db, 'users/alice'), { displayName: 'Alice' });
    for (const sub of ['vocabulary', 'readArticles', 'customCategories', 'drafts', 'articleProgress', 'quizAttempts']) {
      await setDoc(doc(db, `users/alice/${sub}/entry`), { value: 'private' });
    }
  });

  await writeReview(dbFor('alice'), 'alice', 'Alice', 'one', { rating: 5, pros: 'A', cons: '' });
  await writeReview(dbFor('bob'), 'bob', 'Bob', 'one', { rating: 4, pros: 'B', cons: '' });
  await writeReview(dbFor('charlie'), 'charlie', 'Charlie', 'one', { rating: 3, pros: 'C', cons: '' });

  const db = dbFor('alice');
  const aliceReviewId = (await getDoc(doc(db, 'users/alice/reviewOwnership/one'))).data()!.reviewId as string;
  const charlieReviewId = (await getDoc(doc(dbFor('charlie'), 'users/charlie/reviewOwnership/one'))).data()!.reviewId as string;
  const publicDb = env.unauthenticatedContext().firestore();
  const publicReviewsBefore = await getDocs(collection(publicDb, 'articles/one/reviews'));
  assert.equal(publicReviewsBefore.size, 3);
  assert.equal(publicReviewsBefore.docs.some(d => ['alice', 'bob', 'charlie'].includes(d.id)), false);
  assert.equal(publicReviewsBefore.docs.some(d => d.data().userId !== undefined), false);
  await assertFails(getDoc(doc(publicDb, 'users/alice/reviewOwnership/one')));

  let attempts = 0;
  const user = userFor('alice', async () => {
    attempts++;
    if (attempts === 1) throw new Error('Temporary Auth failure');
  });
  await assert.rejects(removeAccount(db, user), /Temporary Auth failure/);

  const updated = (await getDoc(doc(publicDb, 'articles/one'))).data()!;
  assert.equal(updated.ratingCount, 2);
  assert.equal(updated.ratingSum, 7);
  assert.equal(updated.averageRating, 3.5);
  assert.equal(updated.lastReviewUid, undefined);
  assert.equal(updated.lastReviewId, charlieReviewId);
  const reviews = await getDocs(collection(publicDb, 'articles/one/reviews'));
  assert.equal(reviews.size, 2);
  assert.equal(reviews.docs.some(d => d.id === aliceReviewId), false);
  assert.equal(reviews.docs.some(d => d.data().userId !== undefined), false);
  await assertFails(getDoc(doc(publicDb, 'accountDeletions/alice')));
  await assertFails(getDoc(doc(dbFor('bob'), 'accountDeletions/alice')));
  assert.equal((await getDoc(doc(db, 'accountDeletions/alice'))).exists(), true);
  assert.equal((await getDoc(doc(db, 'users/alice/reviewOwnership/one'))).exists(), false);
  assert.equal((await getDoc(doc(db, 'users/alice'))).exists(), false);
  for (const sub of ['vocabulary', 'readArticles', 'customCategories', 'drafts', 'articleProgress', 'quizAttempts']) {
    assert.equal((await getDocs(collection(db, `users/alice/${sub}`))).size, 0);
  }
  await assertFails(setDoc(doc(db, 'users/alice/drafts/new'), { title: 'resurrected' }));

  await removeAccount(db, user);
  assert.equal(attempts, 2);
  assert.equal((await getDoc(doc(publicDb, 'articles/one'))).data()!.ratingCount, 2);
  assert.equal((await getDocs(collection(publicDb, 'articles/one/reviews'))).size, 2);
});

test('legacy review already stripped of userId can be deleted by exact UID document ID', async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await setDoc(doc(db, 'articles/legacy'), article(1, 2, 'alice'));
    await setDoc(doc(db, 'articles/legacy/reviews/alice'), { rating: 2, userDisplayName: 'Deleted account', pros: '', cons: '' });
  });
  await removeAccount(dbFor('alice'), userFor('alice'));
  const publicDb = env.unauthenticatedContext().firestore();
  assert.equal((await getDoc(doc(publicDb, 'articles/legacy/reviews/alice'))).exists(), false);
  const updated = (await getDoc(doc(publicDb, 'articles/legacy'))).data()!;
  assert.equal(updated.ratingCount, 0);
  assert.equal(updated.ratingSum, 0);
  assert.equal(updated.averageRating, 0);
  assert.equal(updated.lastReviewUid, undefined);
});

test('name-only unrelated historical review is not attributed to the deleting user', async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await setDoc(doc(db, 'articles/old'), article(1, 4));
    await setDoc(doc(db, 'articles/old/reviews/legacy-random-id'), { rating: 4, userDisplayName: 'Alice', pros: '', cons: '' });
  });
  await removeAccount(dbFor('alice'), userFor('alice'));
  const publicDb = env.unauthenticatedContext().firestore();
  assert.equal((await getDoc(doc(publicDb, 'articles/old/reviews/legacy-random-id'))).exists(), true);
  assert.equal((await getDoc(doc(publicDb, 'articles/old'))).data()!.ratingCount, 1);
});

test('new-schema review with a document ID equal to another user UID is ignored by legacy account cleanup', async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await setDoc(doc(db, 'articles/collision'), article(1, 5));
    await setDoc(doc(db, 'articles/collision/reviews/alice'), {
      schemaVersion: 2, rating: 5, userDisplayName: 'Other owner', pros: '', cons: '',
    });
    await setDoc(doc(db, 'users/other/reviewOwnership/collision'), { reviewId: 'alice' });
    await setDoc(doc(db, 'users/alice'), { displayName: 'Alice' });
  });
  let authDeleted = false;
  await removeAccount(dbFor('alice'), userFor('alice', async () => { authDeleted = true; }));
  const publicDb = env.unauthenticatedContext().firestore();
  assert.equal(authDeleted, true);
  assert.equal((await getDoc(doc(publicDb, 'articles/collision/reviews/alice'))).exists(), true);
  assert.equal((await getDoc(doc(publicDb, 'articles/collision'))).data()!.ratingCount, 1);
});
test('new-schema review ID collision does not block victim update or account deletion', async () => {
  await env.clearFirestore();
  const attackerUid = 'collision-owner';
  const victimUid = 'collision-delete-victim';
  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await setDoc(doc(db, 'articles/collision-delete'), article(1, 5));
    await setDoc(doc(db, `articles/collision-delete/reviews/${victimUid}`), {
      schemaVersion: 2, rating: 5, userDisplayName: 'Other owner', pros: '', cons: '',
    });
    await setDoc(doc(db, `users/${attackerUid}/reviewOwnership/collision-delete`), { reviewId: victimUid });
    await setDoc(doc(db, `users/${victimUid}`), { displayName: 'Victim' });
  });
  const victimDb = dbFor(victimUid);
  await writeReview(victimDb, victimUid, 'Victim', 'collision-delete', { rating: 1, pros: '', cons: '' });
  const victimReviewId = (await getDoc(doc(victimDb, `users/${victimUid}/reviewOwnership/collision-delete`))).data()!.reviewId as string;
  assert.notEqual(victimReviewId, victimUid);
  await writeReview(victimDb, victimUid, 'Victim', 'collision-delete', { rating: 2, pros: 'updated', cons: '' });
  let authDeleted = false;
  await removeAccount(victimDb, userFor(victimUid, async () => { authDeleted = true; }));
  const publicDb = env.unauthenticatedContext().firestore();
  assert.equal(authDeleted, true);
  assert.equal((await getDoc(doc(publicDb, `articles/collision-delete/reviews/${victimUid}`))).exists(), true);
  assert.equal((await getDoc(doc(publicDb, `articles/collision-delete/reviews/${victimReviewId}`))).exists(), false);
  assert.equal((await getDoc(doc(dbFor(attackerUid), `users/${attackerUid}/reviewOwnership/collision-delete`))).data()?.reviewId, victimUid);
  const updated = (await getDoc(doc(publicDb, 'articles/collision-delete'))).data()!;
  assert.equal(updated.ratingCount, 1);
  assert.equal(updated.ratingSum, 5);
  assert.equal(updated.averageRating, 5);
});

test('orphan reviews are removed and another active reviewer remains the last reviewer', async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await setDoc(doc(db, 'articles/active'), article(2, 9, 'bob'));
    await setDoc(doc(db, 'articles/active/reviews/alice'), review('alice', 5));
    await setDoc(doc(db, 'articles/active/reviews/bob'), review('bob', 4));
    // Firestore keeps subcollections after a parent document is removed.
    await setDoc(doc(db, 'articles/orphaned/reviews/alice'), review('alice', 3));
  });
  await removeAccount(dbFor('alice'), userFor('alice'));
  const publicDb = env.unauthenticatedContext().firestore();
  const active = (await getDoc(doc(publicDb, 'articles/active'))).data()!;
  assert.equal(active.ratingCount, 1);
  assert.equal(active.ratingSum, 4);
  assert.equal(active.averageRating, 4);
  assert.equal(active.lastReviewUid, 'bob');
  assert.equal((await getDoc(doc(publicDb, 'articles/orphaned/reviews/alice'))).exists(), false);
});

test('unsupported historical review ID stops deletion rather than leaving an identifiable public review', async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await setDoc(doc(db, 'articles/migrated'), article(1, 5, 'alice'));
    await setDoc(doc(db, 'articles/migrated/reviews/random-id'), review('alice', 5));
    await setDoc(doc(db, 'users/alice'), { displayName: 'Alice' });
  });
  let authDeleted = false;
  await assert.rejects(removeAccount(dbFor('alice'), userFor('alice', async () => { authDeleted = true; })), /unexpected document ID/);
  assert.equal(authDeleted, false);
  assert.equal((await getDoc(doc(dbFor('alice'), 'articles/migrated/reviews/random-id'))).exists(), true);
  assert.equal((await getDoc(doc(dbFor('alice'), 'users/alice'))).exists(), true);
});

test('more than one review-scan page is deleted even when the previous cursor document was deleted', async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    const batch = writeBatch(db);
    for (let i = 0; i < 201; i++) {
      const id = String(i).padStart(3, '0');
      batch.set(doc(db, `articles/${id}`), article(1, 5, 'alice'));
      batch.set(doc(db, `articles/${id}/reviews/alice`), review('alice', 5));
    }
    await batch.commit();
  });
  await removeAccount(dbFor('alice'), userFor('alice'));
  const publicDb = env.unauthenticatedContext().firestore();
  for (const id of ['000', '199', '200']) {
    assert.equal((await getDoc(doc(publicDb, `articles/${id}/reviews/alice`))).exists(), false);
    const data = (await getDoc(doc(publicDb, `articles/${id}`))).data()!;
    assert.equal(data.ratingCount, 0);
    assert.equal(data.ratingSum, 0);
    assert.equal(data.lastReviewUid, undefined);
  }
  assert.equal((await getDocs(collection(publicDb, 'articles/200/reviews'))).size, 0);
});

test('inconsistent aggregate blocks Auth deletion without deleting review or profile', async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await setDoc(doc(db, 'articles/bad'), article(0, 0, 'alice'));
    await setDoc(doc(db, 'articles/bad/reviews/alice'), review('alice', 5));
    await setDoc(doc(db, 'users/alice'), { displayName: 'Alice' });
  });
  let authDeleted = false;
  await assert.rejects(removeAccount(dbFor('alice'), userFor('alice', async () => { authDeleted = true; })), /Inconsistent review aggregate/);
  assert.equal(authDeleted, false);
  assert.equal((await getDoc(doc(dbFor('alice'), 'articles/bad/reviews/alice'))).exists(), true);
  assert.equal((await getDoc(doc(dbFor('alice'), 'users/alice'))).exists(), true);
});

test('review deletion cannot be forged before account deletion or against another user', async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await setDoc(doc(db, 'articles/protected'), article(2, 9, 'bob'));
    await setDoc(doc(db, 'articles/protected/reviews/alice'), review('alice', 5));
    await setDoc(doc(db, 'articles/protected/reviews/bob'), review('bob', 4));
  });
  const db = dbFor('alice');
  await assertFails(deleteDoc(doc(db, 'articles/protected/reviews/alice')));
  await setDoc(doc(db, 'accountDeletions/alice'), { startedAt: serverTimestamp() });
  await assertFails(deleteDoc(doc(db, 'articles/protected/reviews/bob')));
  await assertFails(updateDoc(doc(db, 'articles/protected'), { ratingCount: 0, ratingSum: 0, averageRating: 0 }));
});

test('orphan mapped cleanup cannot bypass a simultaneous legacy ownership conflict', async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await setDoc(doc(db, 'articles/orphan-conflict/reviews/opaque-review'), {
      schemaVersion: 2, rating: 5, userDisplayName: 'Alice', pros: '', cons: '',
    });
    await setDoc(doc(db, 'articles/orphan-conflict/reviews/alice'), review('alice', 4));
    await setDoc(doc(db, 'users/alice/reviewOwnership/orphan-conflict'), { reviewId: 'opaque-review' });
  });
  const db = dbFor('alice');
  await setDoc(doc(db, 'accountDeletions/alice'), { startedAt: serverTimestamp() });
  const batch = writeBatch(db);
  batch.delete(doc(db, 'articles/orphan-conflict/reviews/opaque-review'));
  batch.delete(doc(db, 'users/alice/reviewOwnership/orphan-conflict'));
  await assertFails(batch.commit());
  assert.equal((await getDoc(doc(db, 'articles/orphan-conflict/reviews/opaque-review'))).exists(), true);
  assert.equal((await getDoc(doc(db, 'users/alice/reviewOwnership/orphan-conflict'))).exists(), true);
});
