import { doc, runTransaction, serverTimestamp, type Firestore } from 'firebase/firestore';
import { reviewSchema } from './schemas';

export async function writeReview(db: Firestore, uid: string, displayName: string, articleId: string, input: { rating: number; pros: string; cons: string }) {
  const { rating, pros, cons } = reviewSchema.parse({ articleId, ...input });
  const article = doc(db, 'articles', articleId);
  const review = doc(db, 'articles', articleId, 'reviews', uid);
  for (let attempt = 0; ; attempt++) {
    try {
      await runTransaction(db, async tx => {
    const [parent, previous] = await Promise.all([tx.get(article), tx.get(review)]);
    if (!parent.exists()) throw new Error('Article not found');
    const data = parent.data();
    const count = (data.ratingCount || 0) + (previous.exists() ? 0 : 1);
    const sum = (data.ratingSum ?? (data.averageRating || 0) * (data.ratingCount || 0)) - (previous.data()?.rating || 0) + rating;
    tx.set(review, { rating, pros, cons, userId: uid, userDisplayName: displayName.slice(0, 100), createdAt: previous.data()?.createdAt || serverTimestamp(), updatedAt: serverTimestamp() });
    tx.update(article, { ratingCount: count, ratingSum: sum, averageRating: sum / count, lastReviewUid: uid, reviewUpdatedAt: serverTimestamp() });
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
