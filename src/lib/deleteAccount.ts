import { collection, collectionGroup, documentId, orderBy, startAfter, type QueryDocumentSnapshot, doc, getDocs, limit, query, serverTimestamp, setDoc, deleteDoc, writeBatch, type Firestore } from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { deleteAccountReview, deleteMappedAccountReview } from './reviewStore';

/** Deletion marker prevents all new personal writes, including in other signed-in tabs. */
export async function removeAccount(db: Firestore, user: Pick<User, 'uid' | 'getIdTokenResult' | 'delete'>) {
  const token = await user.getIdTokenResult();
  if (Date.now() - Date.parse(token.authTime) > 300000) {
    throw Object.assign(new Error('Sign in again before deleting your account'), { code: 'auth/requires-recent-login' });
  }
  await setDoc(doc(db, 'accountDeletions', user.uid), { startedAt: serverTimestamp() });

  // New reviews keep ownership only in this private per-user mapping. Delete each
  // mapping together with its public review and aggregate update.
  while (true) {
    const page = await getDocs(query(collection(db, 'users', user.uid, 'reviewOwnership'), limit(200)));
    if (page.empty) break;
    for (const ownership of page.docs) {
      const reviewId = ownership.data().reviewId;
      if (typeof reviewId !== 'string' || !reviewId || reviewId === user.uid) {
        throw new Error('Invalid review ownership mapping; account deletion stopped');
      }
      await deleteMappedAccountReview(db, user.uid, ownership.id, reviewId);
    }
  }

  // Do not guess ownership from a legacy display name. Historical anonymization removed
  // userId but retained the UID document ID, so check that ID as well.
  // Scan in bounded pages without requiring a new collection-group index.
  let cursor: QueryDocumentSnapshot | undefined;
  do {
    const page = await getDocs(query(collectionGroup(db, 'reviews'), orderBy(documentId()), ...(cursor ? [startAfter(cursor)] : []), limit(200)));
    if (page.empty) break;
    for (const review of page.docs) {
      const parts = review.ref.path.split('/');
      if (parts.length !== 4 || parts[0] !== 'articles' || parts[2] !== 'reviews') continue;
      if (review.id !== user.uid) {
        if (review.data().userId === user.uid) {
          throw new Error('Legacy review has an unexpected document ID; account deletion stopped');
        }
        continue;
      }
      // A malicious/modified client can choose an arbitrary opaque document ID.
      // schemaVersion 2 proves this is a mapped review, not a legacy UID-owned one.
      if (review.data().schemaVersion === 2) continue;
      await deleteAccountReview(db, user.uid, review.ref);
    }
    cursor = page.docs[page.docs.length - 1];
  } while (cursor);
  for (const name of ['readArticles', 'vocabulary', 'customCategories', 'drafts', 'articleProgress', 'quizAttempts']) {
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
