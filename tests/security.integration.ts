import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { initializeTestEnvironment, assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { type Firestore, doc, getDoc, getDocs, collection, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { writeReview } from '../src/lib/reviewStore';
import { removeAccount } from '../src/lib/deleteAccount';
import type { IdTokenResult } from 'firebase/auth';

let env: RulesTestEnvironment;
const dbFor = (uid: string): Firestore => (env.authenticatedContext(uid).firestore() as unknown as { _delegate: Firestore })._delegate;
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
  await assertFails(getDoc(doc(b,'users/alice/vocabulary/word')));
  await assertFails(updateDoc(doc(a,'articles/example'), { averageRating: 5, ratingCount: 99 }));
  await assertFails(setDoc(doc(a,'articles/example/reviews/bob'), { userId:'bob', rating:5 }));
});
test('concurrent reviews and repeated submissions remain atomic and idempotent', async () => {
  const a = dbFor('alice'); const b = dbFor('bob');
  await Promise.all([writeReview(a,'alice','Alice','example',{rating:3,pros:'',cons:''}), writeReview(b,'bob','Bob','example',{rating:4,pros:'',cons:''})]);
  await writeReview(a,'alice','Alice','example',{rating:5,pros:'Good',cons:''});
  await writeReview(a,'alice','Alice','example',{rating:5,pros:'Good',cons:''});
  const data=(await getDoc(doc(a,'articles/example'))).data()!;
  assert.equal(data.ratingCount,2); assert.equal(data.ratingSum,9); assert.equal(data.averageRating,4.5);
  assert.equal((await getDocs(collection(a,'articles/example/reviews'))).size,2);
});
test('standalone review writes and invalid rating never leave partial documents', async () => {
  const c=dbFor('mallory');
  await assertFails(setDoc(doc(c,'articles/example/reviews/mallory'),{userId:'mallory',rating:5,pros:'',cons:'',userDisplayName:'M',createdAt:serverTimestamp(),updatedAt:serverTimestamp()}));
  await assert.rejects(writeReview(c,'mallory','M','example',{rating:99,pros:'',cons:''}));
  assert.equal((await getDoc(doc(c,'articles/example/reviews/mallory'))).exists(),false);
});
test('account cleanup blocks concurrent writes, anonymizes reviews and can retry Auth failure', async () => {
  const db=dbFor('alice');
  await setDoc(doc(db,'users/alice'),{name:'Alice'});
  await setDoc(doc(db,'users/alice/customCategories/a'),{name:'Private'});
  let deletes=0;
  const user={uid:'alice',getIdTokenResult:async()=>({authTime:new Date().toISOString()} as IdTokenResult),delete:async()=>{deletes++;if(deletes===1)throw new Error('temporary auth failure');}};
  await assert.rejects(removeAccount(db,user));
  await assertFails(setDoc(doc(db,'users/alice/vocabulary/new'),{word:'책'}));
  await assertFails(writeReview(db,'alice','Alice','example',{rating:1,pros:'',cons:''}));
  assert.equal((await getDocs(collection(db,'users/alice/vocabulary'))).size,0);
  assert.equal((await getDocs(collection(db,'users/alice/customCategories'))).size,0);
  const review=(await getDoc(doc(db,'articles/example/reviews/alice'))).data()!;
  assert.equal(review.userId,undefined);assert.equal(review.userDisplayName,'Deleted account');
  await removeAccount(db,user);assert.equal(deletes,2);
});
test('old authentication requires reauthentication before any deletion', async () => {
  const user={uid:'bob',getIdTokenResult:async()=>({authTime:new Date(0).toISOString()} as IdTokenResult),delete:async()=>{throw new Error('should not execute');}};
  await assert.rejects(removeAccount(dbFor('bob'),user), (e:unknown)=>(e as {code:string}).code==='auth/requires-recent-login');
});
