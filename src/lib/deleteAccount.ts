import { collection, collectionGroup, documentId, orderBy, startAfter, deleteField, type QueryDocumentSnapshot, doc, getDocs, limit, query, serverTimestamp, setDoc, deleteDoc, writeBatch, type Firestore } from 'firebase/firestore';
import type { User } from 'firebase/auth';

/** Deletion marker prevents all new personal writes, including in other signed-in tabs. */
export async function removeAccount(db: Firestore, user: Pick<User, 'uid' | 'getIdTokenResult' | 'delete'>) {
  const token = await user.getIdTokenResult();
  if (Date.now() - Date.parse(token.authTime) > 300000) {
    throw Object.assign(new Error('Sign in again before deleting your account'), { code: 'auth/requires-recent-login' });
  }
  await setDoc(doc(db, 'accountDeletions', user.uid), { startedAt: serverTimestamp() });
  // A name-only legacy review cannot be reliably attributed to a user.
  // Scan public reviews in bounded pages, avoiding a new collection-group index requirement.
  let cursor: QueryDocumentSnapshot | undefined;
  do {
    const page = await getDocs(query(collectionGroup(db, 'reviews'), orderBy(documentId()), ...(cursor ? [startAfter(cursor)] : []), limit(200)));
    if (page.empty) break;
    const batch = writeBatch(db);
    page.docs.filter(d => d.data().userId === user.uid).forEach(d => batch.update(d.ref, { userId: deleteField(), userDisplayName: 'Deleted account', pros: '', cons: '' }));
    await batch.commit();
    cursor = page.docs[page.docs.length - 1];
  } while (cursor);
  for (const name of ['readArticles', 'vocabulary', 'customCategories']) {
    while (true) {
      const page = await getDocs(query(collection(db, 'users', user.uid, name), limit(200)));
      if (page.empty) break;
      const batch = writeBatch(db);
      page.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
    }
  }
  await deleteDoc(doc(db, 'users', user.uid));
  // Failed database cleanup leaves Auth intact so the user can retry.
  await user.delete();
}
