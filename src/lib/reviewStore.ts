import { collection, deleteField, doc, runTransaction, serverTimestamp, type DocumentReference, type Firestore } from 'firebase/firestore';
import { reviewSchema } from './schemas';

export async function writeReview(db: Firestore, uid: string, displayName: string, articleId: string, input: { rating: number; pros: string; cons: string }) {
  const { rating, pros, cons } = reviewSchema.parse({ articleId, ...input });
  const article = doc(db, 'articles', articleId);
  const ownership = doc(db, 'users', uid, 'reviewOwnership', articleId);
  const legacyReview = doc(db, 'articles', articleId, 'reviews', uid);
  const candidateReview = doc(collection(db, 'articles', articleId, 'reviews'));
  for (let attempt = 0; ; attempt++) {
    try {
      await runTransaction(db, async tx => {
        const [parent, mapped, legacy] = await Promise.all([tx.get(article), tx.get(ownership), tx.get(legacyReview)]);
        if (!parent.exists()) throw new Error('Article not found');

        let review: DocumentReference;
        let previous;
        let legacyMode = false;
        const legacyOwnedFormat = legacy.exists() && legacy.data().schemaVersion !== 2;
        if (mapped.exists()) {
          const reviewId = mapped.data().reviewId;
          if (typeof reviewId !== 'string' || !reviewId || reviewId === uid) {
            throw new Error('Review ownership mapping is invalid');
          }
          if (legacyOwnedFormat) throw new Error('Conflicting legacy and mapped reviews; review update stopped');
          review = doc(db, 'articles', articleId, 'reviews', reviewId);
          previous = await tx.get(review);
          if (!previous.exists()) throw new Error('Owned review is missing; review update stopped');
          if (previous.data().userId !== undefined) throw new Error('Mapped review unexpectedly contains a public user ID');
          if (previous.data().schemaVersion !== 2) throw new Error('Mapped review schema is invalid; review update stopped');
        } else if (legacyOwnedFormat) {
          const legacyUserId = legacy.data().userId;
          if (legacyUserId !== undefined && legacyUserId !== uid) {
            throw new Error('Legacy review ownership conflict; review update stopped');
          }
          review = legacyReview;
          previous = legacy;
          legacyMode = true;
        } else {
          review = candidateReview;
          previous = await tx.get(candidateReview);
          if (previous.exists()) throw new Error('Generated review ID collision');
        }

        const data = parent.data();
        const count = (data.ratingCount || 0) + (previous.exists() ? 0 : 1);
        const sum = (data.ratingSum ?? (data.averageRating || 0) * (data.ratingCount || 0)) - (previous.data()?.rating || 0) + rating;
        const publicReview = {
          ...(legacyMode ? {} : { schemaVersion: 2 as const }),
          rating,
          pros,
          cons,
          userDisplayName: displayName.slice(0, 100),
          createdAt: previous.data()?.createdAt || serverTimestamp(),
          updatedAt: serverTimestamp(),
          ...(legacyMode && previous.data()?.userId !== undefined ? { userId: uid } : {}),
        };
        tx.set(review, publicReview);
        if (!mapped.exists() && !legacyMode) tx.set(ownership, { reviewId: review.id });
        tx.update(article, {
          ratingCount: count,
          ratingSum: sum,
          averageRating: sum / count,
          reviewUpdatedAt: serverTimestamp(),
          ...(legacyMode ? {} : { lastReviewId: review.id, lastReviewUid: deleteField() }),
        });
      });
      return;
    } catch (error) {
      // Rules may observe a newer aggregate before the SDK reports contention.
      // Re-read in a fresh transaction; permanent permission failures still fail.
      if (attempt >= 2 || (error as { code?: string }).code !== 'permission-denied') throw error;
      await new Promise(resolve => setTimeout(resolve, 50 * (attempt + 1)));
    }
  }
}

async function deleteReviewAndAggregate(
  db: Firestore,
  uid: string,
  review: DocumentReference,
  ownership?: DocumentReference,
): Promise<boolean> {
  const parts = review.path.split('/');
  if (parts.length !== 4 || parts[0] !== 'articles' || parts[2] !== 'reviews') throw new Error('Invalid review path');
  const article = doc(db, 'articles', parts[1]);
  const legacyReview = doc(db, 'articles', parts[1], 'reviews', uid);
  for (let attempt = 0; ; attempt++) {
    try {
      return await runTransaction(db, async tx => {
        const [parent, existing, mapped, legacy] = await Promise.all([
          tx.get(article),
          tx.get(review),
          ...(ownership ? [tx.get(ownership)] : []),
          ...(ownership ? [tx.get(legacyReview)] : []),
        ]);
        if (ownership) {
          if (!mapped?.exists()) {
            if (!existing.exists()) return false;
            throw new Error('Review ownership mapping is missing; account deletion stopped');
          }
          if (mapped.data().reviewId !== review.id || review.id === uid) {
            throw new Error('Review ownership mapping conflict; account deletion stopped');
          }
          if (legacy?.exists() && legacy.data().schemaVersion !== 2) {
            throw new Error('Conflicting legacy and mapped reviews; account deletion stopped');
          }
          if (!existing.exists()) throw new Error('Owned review is missing; account deletion stopped');
          if (existing.data().userId !== undefined) throw new Error('Mapped review unexpectedly contains a public user ID');
          if (existing.data().schemaVersion !== 2) throw new Error('Mapped review schema is invalid; account deletion stopped');
        } else {
          if (review.id !== uid) throw new Error('Review ownership cannot be verified from its document ID');
          if (!existing.exists()) return false; // Retry after successful deletion must not double-decrement.
          if (existing.data().schemaVersion === 2) throw new Error('New-schema review cannot be treated as a legacy owned review');
          const legacyUserId = existing.data().userId;
          if (legacyUserId !== undefined && legacyUserId !== uid) {
            throw new Error('Review ownership conflict; account deletion stopped');
          }
        }

        const data = existing.data();
        if (!parent.exists()) {
          tx.delete(review);
          if (ownership) tx.delete(ownership);
          return true;
        }

        const old = parent.data();
        const count = old.ratingCount;
        const rating = data.rating;
        const sum = old.ratingSum ?? old.averageRating * count;
        if (!Number.isSafeInteger(count) || count < 1 || !Number.isInteger(rating) || rating < 1 || rating > 5 ||
            typeof sum !== 'number' || !Number.isFinite(sum) || sum - rating < -0.000001) {
          throw new Error('Inconsistent review aggregate; account deletion stopped');
        }
        const nextCount = count - 1;
        const nextSum = nextCount === 0 ? 0 : sum - rating;
        if (nextCount === 0 && Math.abs(sum - rating) > 0.000001) {
          throw new Error('Inconsistent final review aggregate; account deletion stopped');
        }

        tx.delete(review);
        if (ownership) tx.delete(ownership);
        tx.update(article, {
          ratingCount: nextCount,
          ratingSum: nextSum,
          averageRating: nextCount === 0 ? 0 : nextSum / nextCount,
          reviewUpdatedAt: serverTimestamp(),
          ...(ownership && old.lastReviewId === review.id ? { lastReviewId: deleteField() } : {}),
          ...(!ownership && old.lastReviewUid === uid ? { lastReviewUid: deleteField() } : {}),
        });
        return true;
      });
    } catch (error: unknown) {
      if (attempt >= 2 || !(error instanceof Error && 'code' in error && error.code === 'permission-denied')) throw error;
      await new Promise(resolve => setTimeout(resolve, 50 * (attempt + 1)));
    }
  }
}

/** Delete a new private-mapped review and its aggregate atomically. */
export async function deleteMappedAccountReview(db: Firestore, uid: string, articleId: string, reviewId: string): Promise<boolean> {
  if (!reviewId || reviewId === uid) throw new Error('Review ownership mapping is invalid');
  return deleteReviewAndAggregate(
    db,
    uid,
    doc(db, 'articles', articleId, 'reviews', reviewId),
    doc(db, 'users', uid, 'reviewOwnership', articleId),
  );
}

/** Delete a legacy UID-keyed review without guessing ownership from mutable public fields. */
export async function deleteAccountReview(db: Firestore, uid: string, review: DocumentReference): Promise<boolean> {
  return deleteReviewAndAggregate(db, uid, review);
}
