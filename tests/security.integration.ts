import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { initializeTestEnvironment, assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { type Firestore, doc, getDoc, getDocs, collection, setDoc, updateDoc, deleteDoc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { writeReview } from '../src/lib/reviewStore';
import { removeAccount } from '../src/lib/deleteAccount';
import { approvedImageUrls } from '../src/lib/articlePublishing';
import type { IdTokenResult } from 'firebase/auth';

let env: RulesTestEnvironment;
const dbFor = (uid: string): Firestore => (env.authenticatedContext(uid).firestore() as unknown as { _delegate: Firestore })._delegate;
const adminDb = (): Firestore => (env.authenticatedContext('admin', { email: 'asulchoi@gmail.com', email_verified: true }).firestore() as unknown as { _delegate: Firestore })._delegate;
const newArticle = () => ({
  title: '시장 이야기', content: '시장에 가요. 과일을 샀어요. '.repeat(8), summary: 'A market story',
  topicCategory: 'food', level: 'A1', estimatedMinutes: 2, keyVocabulary: ['시장', '과일'],
  averageRating: 0, ratingCount: 0, ratingSum: 0, createdAt: serverTimestamp(),
  imageUrls: ['https://images.unsplash.com/photo-test?auto=format'],
});
before(async () => {
  assert.ok(process.env.FIRESTORE_EMULATOR_HOST, 'Emulator required');
  env = await initializeTestEnvironment({ projectId: 'demo-koreading', firestore: { rules: await readFile('firestore.rules','utf8') } });
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async c => { await setDoc(doc(c.firestore(),'articles/example'), { title:'예시', ratingCount:0, averageRating:0 }); });
});
after(async () => { await env.cleanup(); });
test('public reads, private isolation and forged aggregate prevention', async () => {
  const a = dbFor('alice'); const b = dbFor('bob');
  await assertSucceeds(getDoc(doc(env.unauthenticatedContext().firestore(), 'articles/example')));
  await assertSucceeds(setDoc(doc(a,'users/alice/vocabulary/word'), { word: '눈' }));
  await assertSucceeds(updateDoc(doc(a,'users/alice/vocabulary/word'), { reviewIntervalDays: 3, successCount: 1 }));
  await assertFails(getDoc(doc(b,'users/alice/vocabulary/word')));
  await assertFails(updateDoc(doc(b,'users/alice/vocabulary/word'), { reviewIntervalDays: 90 }));
  await assertFails(updateDoc(doc(a,'articles/example'), { averageRating: 5, ratingCount: 99 }));
  await assertFails(setDoc(doc(a,'articles/example/reviews/bob'), { userId:'bob', rating:5 }));
});
test('ordinary members cannot publish, and admin publication validates initial aggregate, content and image hosts', async () => {
  const member = dbFor('mallory'); const admin = adminDb();
  const publicDoc = doc(member, 'articles/mallory-published');
  await assertFails(setDoc(publicDoc, newArticle()));
  await assertFails(setDoc(doc(admin, 'articles/forged-sum'), { ...newArticle(), ratingSum: 123 }));
  await assertFails(setDoc(doc(admin, 'articles/forged-count'), { ...newArticle(), ratingCount: 1 }));
  await assertFails(setDoc(doc(admin, 'articles/forged-average'), { ...newArticle(), averageRating: 5 }));
  await assertFails(setDoc(doc(admin, 'articles/external-image'), { ...newArticle(), imageUrls: ['https://tracker.example/pixel?uid=someone'] }));
  await assertFails(setDoc(doc(admin, 'articles/lookalike-image'), { ...newArticle(), imageUrls: ['https://images.unsplash.com.evil.example/pixel'] }));
  await assertFails(setDoc(doc(admin, 'articles/mystery-field'), { ...newArticle(), customPublicFlag: true }));
  await assertFails(setDoc(doc(admin, 'articles/bad-time'), { ...newArticle(), createdAt: new Date(0) }));
  const unverified = (env.authenticatedContext('unverified', { email: 'asulchoi@gmail.com', email_verified: false }).firestore() as unknown as { _delegate: Firestore })._delegate;
  await assertFails(setDoc(doc(unverified, 'articles/unverified'), newArticle()));
  await assertSucceeds(setDoc(doc(admin, 'articles/admin-published'), newArticle()));
  assert.equal((await getDoc(doc(env.unauthenticatedContext().firestore(), 'articles/admin-published'))).data()?.ratingSum, 0);
  await assertFails(updateDoc(publicDoc, { imageUrls: ['https://tracker.example/pixel'] }));
  await assertFails(updateDoc(doc(admin, 'articles/admin-published'), { imageUrls: ['https://tracker.example/pixel'] }));
});
test('private drafts persist only for their owner and require explicit admin publication', async () => {
  const alice = dbFor('draft-author'); const bob = dbFor('draft-reader'); const admin = adminDb();
  const draft = doc(alice, 'users/draft-author/drafts/draft-a');
  await assertSucceeds(setDoc(draft, { ...newArticle(), imageUrls: ['https://upload.wikimedia.org/wikipedia/commons/example.jpg'] }));
  assert.equal((await getDoc(draft)).data()?.title, '시장 이야기');
  await assertFails(getDoc(doc(bob, 'users/draft-author/drafts/draft-a')));
  await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'users/draft-author/drafts/draft-a')));
  await assertFails(getDocs(collection(bob, 'users/draft-author/drafts')));
  await assertFails(deleteDoc(doc(bob, 'users/draft-author/drafts/draft-a')));
  await assertFails(setDoc(doc(alice, 'users/draft-author/drafts/external'), { ...newArticle(), imageUrls: ['https://tracker.example/a'] }));
  await assertFails(setDoc(doc(alice, 'users/draft-author/drafts/poison'), { ...newArticle(), ratingSum: 5 }));
  await assertFails(setDoc(doc(admin, 'articles/draft-a'), { ...newArticle(), createdAt: new Date(0) }));
  // An administrator can explicitly create a public article; the owner draft is unaffected until removed.
  await assertSucceeds(setDoc(doc(admin, 'articles/draft-a'), newArticle()));
  assert.equal((await getDoc(draft)).exists(), true);
  await assertSucceeds(deleteDoc(draft));
  assert.equal((await getDoc(draft)).exists(), false);
  assert.equal((await getDoc(doc(env.unauthenticatedContext().firestore(), 'articles/draft-a'))).exists(), true);
  const ownAdminDraft = doc(admin, 'users/admin/drafts/admin-original');
  const published = doc(admin, 'articles/admin-original');
  await assertSucceeds(setDoc(ownAdminDraft, newArticle()));
  await assertSucceeds(runTransaction(admin, async tx => {
    const [source, existing] = await Promise.all([tx.get(ownAdminDraft), tx.get(published)]);
    assert.equal(source.exists(), true); assert.equal(existing.exists(), false);
    tx.set(published, newArticle());
    tx.delete(ownAdminDraft);
  }));
  assert.equal((await getDoc(ownAdminDraft)).exists(), false);
  assert.equal((await getDoc(doc(env.unauthenticatedContext().firestore(), 'articles/admin-original'))).exists(), true);
  assert.deepEqual(approvedImageUrls(['https://tracker.example/track', 'https://images.unsplash.com/photo-safe']), ['https://images.unsplash.com/photo-safe']);
});
test('learning progress and quiz attempts are private, bounded and owner-only', async () => {
  const alice = dbFor('learning-alice');
  const bob = dbFor('learning-bob');
  const progress = doc(alice, 'users/learning-alice/articleProgress/article-a');
  await assertSucceeds(setDoc(progress, { startedAt: serverTimestamp(), lastOpenedAt: serverTimestamp(), updatedAt: serverTimestamp() }));
  await assertSucceeds(getDoc(progress));
  await assertFails(getDoc(doc(bob, 'users/learning-alice/articleProgress/article-a')));
  await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'users/learning-alice/articleProgress/article-a')));
  await assertSucceeds(setDoc(doc(alice, 'users/learning-alice/quizAttempts/attempt-a'), {
    articleId: 'article-a', answers: [0, 1, 2], score: 2, total: 3, submittedAt: serverTimestamp(),
  }));
  await assertFails(setDoc(doc(bob, 'users/learning-alice/quizAttempts/attempt-b'), {
    articleId: 'article-a', answers: [0, 1, 2], score: 2, total: 3, submittedAt: serverTimestamp(),
  }));
  await assertFails(setDoc(doc(alice, 'users/learning-alice/quizAttempts/attempt-bad'), {
    articleId: 'article-a', answers: [0, 1, 9], score: 3, total: 3, submittedAt: serverTimestamp(),
  }));
  await assertFails(updateDoc(progress, { startedAt: serverTimestamp(), updatedAt: serverTimestamp() }));
  const lateStart = doc(alice, 'users/learning-alice/articleProgress/article-b');
  await assertSucceeds(setDoc(lateStart, { difficultyFeedback: 'hard', updatedAt: serverTimestamp() }));
  await assertSucceeds(updateDoc(lateStart, { startedAt: serverTimestamp(), lastOpenedAt: serverTimestamp(), updatedAt: serverTimestamp() }));
  await assertSucceeds(updateDoc(progress, { seriesChoiceIndex: 1, updatedAt: serverTimestamp() }));
  await assertFails(updateDoc(progress, { seriesChoiceIndex: 2, updatedAt: serverTimestamp() }));
  await assertFails(updateDoc(doc(bob, 'users/learning-alice/articleProgress/article-a'), { seriesChoiceIndex: 0, updatedAt: serverTimestamp() }));
});
test('article drafts and publications accept valid comprehension quizzes and reject malformed quiz data', async () => {
  const ownerDb = dbFor('quiz-draft-owner');
  const admin = adminDb();
  const quiz = [
    { kind: 'main', question: '중심 내용은 무엇인가요?', options: ['시장 이야기', '학교 이야기', '여행 이야기', '운동 이야기'], correct: 0, explanation: '시장에 대한 이야기입니다.', paragraphIndex: 0 },
    { kind: 'detail', question: '무엇을 샀나요?', options: ['사과', '책', '신발', '우산'], correct: 0, explanation: '사과를 샀습니다.', paragraphIndex: 0 },
    { kind: 'vocabulary', question: '시장에서는 무엇을 하나요?', options: ['물건을 사고팝니다', '잠을 잡니다', '수영을 합니다', '시험을 봅니다'], correct: 0, explanation: '시장에서는 물건을 사고팝니다.', paragraphIndex: 0 },
  ];
  await assertSucceeds(setDoc(doc(ownerDb, 'users/quiz-draft-owner/drafts/quiz-good'), { ...newArticle(), comprehensionQuiz: quiz }));
  await assertSucceeds(setDoc(doc(admin, 'articles/quiz-good'), { ...newArticle(), comprehensionQuiz: quiz }));
  await assertFails(setDoc(doc(ownerDb, 'users/quiz-draft-owner/drafts/quiz-bad'), { ...newArticle(), comprehensionQuiz: quiz.slice(0, 2) }));
  await assertFails(setDoc(doc(admin, 'articles/quiz-bad'), { ...newArticle(), comprehensionQuiz: quiz.slice(0, 2) }));
});
test('series and writing metadata stay bounded while weekly goal remains a private owner setting', async () => {
  const ownerDb = dbFor('series-owner');
  const admin = adminDb();
  const seriesFields = {
    discussionPrompt: '다음에는 무엇을 선택할까요?',
    continuationChoices: ['친구와 함께 갑니다.', '혼자 먼저 갑니다.'],
    writingPrompt: '오늘 읽은 내용에 대해 한 문장을 써 보세요.',
    seriesId: 'market-series',
    seriesTitle: '시장 이야기',
    episodeNumber: 2,
    previousEpisodeId: 'episode-1',
  };
  await assertSucceeds(setDoc(doc(ownerDb, 'users/series-owner/drafts/series-good'), { ...newArticle(), ...seriesFields }));
  await assertSucceeds(setDoc(doc(admin, 'articles/series-good'), { ...newArticle(), ...seriesFields }));
  await assertFails(setDoc(doc(ownerDb, 'users/series-owner/drafts/series-bad'), { ...newArticle(), ...seriesFields, continuationChoices: ['한 선택만'] }));
  await assertSucceeds(setDoc(doc(ownerDb, 'users/series-owner'), { weeklyReadingGoal: 4 }, { merge: true }));
  await assertFails(setDoc(doc(ownerDb, 'users/series-owner'), { weeklyReadingGoal: 8 }, { merge: true }));
  await assertFails(getDoc(doc(dbFor('series-other'), 'users/series-owner')));
});
test('concurrent reviews and repeated submissions remain atomic and idempotent', async () => {
  const a = dbFor('alice'); const b = dbFor('bob');
  await Promise.all([writeReview(a,'alice','Alice','example',{rating:3,pros:'',cons:''}), writeReview(b,'bob','Bob','example',{rating:4,pros:'',cons:''})]);
  await writeReview(a,'alice','Alice','example',{rating:5,pros:'Good',cons:''});
  await writeReview(a,'alice','Alice','example',{rating:5,pros:'Good',cons:''});
  const data=(await getDoc(doc(a,'articles/example'))).data()!;
  assert.equal(data.ratingCount,2); assert.equal(data.ratingSum,9); assert.equal(data.averageRating,4.5);
  assert.equal(data.lastReviewUid, undefined);
  const reviews = await getDocs(collection(a,'articles/example/reviews'));
  assert.equal(reviews.size,2);
  assert.equal(reviews.docs.some(review => ['alice','bob'].includes(review.id)), false);
  assert.equal(reviews.docs.some(review => review.data().userId !== undefined), false);
  const aliceOwnership = (await getDoc(doc(a,'users/alice/reviewOwnership/example'))).data()!;
  const bobOwnership = (await getDoc(doc(b,'users/bob/reviewOwnership/example'))).data()!;
  assert.ok(reviews.docs.some(review => review.id === aliceOwnership.reviewId));
  assert.ok(reviews.docs.some(review => review.id === bobOwnership.reviewId));
  assert.ok(reviews.docs.some(review => review.id === data.lastReviewId));
  await assertFails(getDoc(doc(b,'users/alice/reviewOwnership/example')));
  await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(),'users/alice/reviewOwnership/example')));
});
test('another account cannot claim, mutate or delete an existing opaque review', async () => {
  const alice = dbFor('alice');
  const attacker = dbFor('ownership-attacker');
  const aliceReviewId = (await getDoc(doc(alice, 'users/alice/reviewOwnership/example'))).data()!.reviewId as string;
  const aliceReview = doc(attacker, 'articles/example/reviews', aliceReviewId);

  await assertFails(setDoc(doc(attacker, 'users/ownership-attacker/reviewOwnership/example'), { reviewId: aliceReviewId }));
  await assertFails(updateDoc(aliceReview, { rating: 1, updatedAt: serverTimestamp() }));
  await setDoc(doc(attacker, 'accountDeletions/ownership-attacker'), { startedAt: serverTimestamp() });
  await assertFails(deleteDoc(aliceReview));
  assert.equal((await getDoc(doc(alice, 'articles/example/reviews', aliceReviewId))).exists(), true);
});
test('new-schema review ID collision cannot block another user from creating their own review', async () => {
  const attackerUid = 'collision-attacker';
  const victimUid = 'collision-victim';
  await env.withSecurityRulesDisabled(async context => {
    await setDoc(doc(context.firestore(), 'articles/id-collision'), {
      title: 'ID collision', ratingCount: 0, ratingSum: 0, averageRating: 0,
    });
  });
  const attacker = dbFor(attackerUid);
  const articleRef = doc(attacker, 'articles/id-collision');
  const reviewRef = doc(attacker, 'articles/id-collision/reviews', victimUid);
  const ownershipRef = doc(attacker, `users/${attackerUid}/reviewOwnership/id-collision`);
  await assertSucceeds(runTransaction(attacker, async tx => {
    tx.set(reviewRef, {
      schemaVersion: 2, rating: 5, pros: 'owned by attacker', cons: '', userDisplayName: 'Attacker',
      createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    });
    tx.set(ownershipRef, { reviewId: victimUid });
    tx.update(articleRef, {
      ratingCount: 1, ratingSum: 5, averageRating: 5, lastReviewId: victimUid, reviewUpdatedAt: serverTimestamp(),
    });
  }));

  const victim = dbFor(victimUid);
  await writeReview(victim, victimUid, 'Victim', 'id-collision', { rating: 1, pros: '', cons: '' });
  const victimOwnership = (await getDoc(doc(victim, `users/${victimUid}/reviewOwnership/id-collision`))).data()!;
  assert.notEqual(victimOwnership.reviewId, victimUid);
  assert.equal((await getDoc(reviewRef)).data()?.rating, 5);
  assert.equal((await getDoc(ownershipRef)).data()?.reviewId, victimUid);
  const reviews = await getDocs(collection(victim, 'articles/id-collision/reviews'));
  assert.equal(reviews.size, 2);
  assert.equal(reviews.docs.some(review => review.data().userId !== undefined), false);
  const article = (await getDoc(articleRef)).data()!;
  assert.equal(article.ratingCount, 2);
  assert.equal(article.ratingSum, 6);
  assert.equal(article.averageRating, 3);
});
test('legacy UID-keyed review is updated in place without creating a private mapping', async () => {
  await env.withSecurityRulesDisabled(async context => {
    const legacyDb = context.firestore();
    await setDoc(doc(legacyDb,'articles/legacy-review'), { title:'레거시', ratingCount:1, ratingSum:3, averageRating:3 });
    await setDoc(doc(legacyDb,'articles/legacy-review/reviews/legacy-user'), {
      rating:3, pros:'old', cons:'', userDisplayName:'Legacy', createdAt:serverTimestamp(), updatedAt:serverTimestamp()
    });
  });
  const legacyDb = dbFor('legacy-user');
  await writeReview(legacyDb,'legacy-user','Legacy','legacy-review',{rating:5,pros:'updated',cons:''});
  const legacy = (await getDoc(doc(legacyDb,'articles/legacy-review/reviews/legacy-user'))).data()!;
  assert.equal(legacy.rating,5); assert.equal(legacy.userId,undefined);
  assert.equal((await getDoc(doc(legacyDb,'users/legacy-user/reviewOwnership/legacy-review'))).exists(),false);
  assert.equal((await getDocs(collection(legacyDb,'articles/legacy-review/reviews'))).size,1);
  const article = (await getDoc(doc(legacyDb,'articles/legacy-review'))).data()!;
  assert.equal(article.ratingCount,1); assert.equal(article.ratingSum,5); assert.equal(article.averageRating,5);
});
test('standalone review writes and invalid rating never leave partial documents', async () => {
  const c=dbFor('mallory');
  await assertFails(setDoc(doc(c,'articles/example/reviews/mallory'),{userId:'mallory',rating:5,pros:'',cons:'',userDisplayName:'M',createdAt:serverTimestamp(),updatedAt:serverTimestamp()}));
  await assertFails(setDoc(doc(c,'articles/example/reviews/random-public-id'),{rating:5,pros:'',cons:'',userDisplayName:'M',createdAt:serverTimestamp(),updatedAt:serverTimestamp()}));
  await assert.rejects(writeReview(c,'mallory','M','example',{rating:99,pros:'',cons:''}));
  assert.equal((await getDoc(doc(c,'articles/example/reviews/mallory'))).exists(),false);
  assert.equal((await getDoc(doc(c,'users/mallory/reviewOwnership/example'))).exists(),false);
});
test('account cleanup blocks concurrent writes, removes owned reviews and can retry Auth failure', async () => {
  const db=dbFor('alice');
  const ownedReviewId=(await getDoc(doc(db,'users/alice/reviewOwnership/example'))).data()!.reviewId as string;
  await setDoc(doc(db,'users/alice'),{name:'Alice'});
  await setDoc(doc(db,'users/alice/customCategories/a'),{name:'Private'});
  let deletes=0;
  const user={uid:'alice',getIdTokenResult:async()=>({authTime:new Date().toISOString()} as IdTokenResult),delete:async()=>{deletes++;if(deletes===1)throw new Error('temporary auth failure');}};
  await assert.rejects(removeAccount(db,user));
  await assertFails(setDoc(doc(db,'users/alice/vocabulary/new'),{word:'책'}));
  await assertFails(writeReview(db,'alice','Alice','example',{rating:1,pros:'',cons:''}));
  assert.equal((await getDocs(collection(db,'users/alice/vocabulary'))).size,0);
  assert.equal((await getDocs(collection(db,'users/alice/customCategories'))).size,0);
  assert.equal((await getDoc(doc(db,'articles/example/reviews',ownedReviewId))).exists(), false);
  assert.equal((await getDoc(doc(db,'users/alice/reviewOwnership/example'))).exists(), false);
  const article = (await getDoc(doc(db, 'articles/example'))).data()!;
  assert.equal(article.ratingCount, 1); assert.equal(article.ratingSum, 4); assert.equal(article.averageRating, 4);
  await removeAccount(db,user);assert.equal(deletes,2);
});
test('old authentication requires reauthentication before any deletion', async () => {
  const user={uid:'bob',getIdTokenResult:async()=>({authTime:new Date(0).toISOString()} as IdTokenResult),delete:async()=>{throw new Error('should not execute');}};
  await assert.rejects(removeAccount(dbFor('bob'),user), (e:unknown)=>(e as {code:string}).code==='auth/requires-recent-login');
});
