import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/server/admin';
import { apiError, HttpError, readJson, requireActiveUser } from '@/lib/server/http';
import { reviewSchema } from '@/lib/schemas';
import { reviewAggregate } from '@/lib/learning';

export async function POST(req: Request) {
  try {
    const user = await requireActiveUser(req);
    const result = reviewSchema.safeParse(await readJson(req));
    if (!result.success) throw new HttpError(400, 'Invalid review');
    const { articleId, ...review } = result.data;
    const db = adminDb();
    const article = db.doc(`articles/${articleId}`);
    const ref = article.collection('reviews').doc(user.uid);
    await db.runTransaction(async tx => {
      const [a, old, deletion] = await tx.getAll(article, ref, db.doc(`accountDeletions/${user.uid}`));
      if (deletion.exists) throw new HttpError(409, 'Account deletion is in progress');
      if (!a.exists) throw new HttpError(404, 'Article not found');
      tx.set(ref, { ...review, userId: user.uid, userDisplayName: user.name || 'Learner', createdAt: old.data()?.createdAt || FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
      tx.update(article, reviewAggregate(a.data()!, old.data()?.rating, review.rating));
    });
    return NextResponse.json({ ok: true });
  } catch (error) { return apiError(error); }
}
