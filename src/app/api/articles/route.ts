import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { revalidatePath } from 'next/cache';
import { adminDb } from '@/lib/server/admin';
import { apiError, HttpError, readJson, requireActiveUser } from '@/lib/server/http';
import { articleSchema } from '@/lib/schemas';
import { createHmac, timingSafeEqual } from 'node:crypto';

export async function POST(req: Request) {
  try {
    const user = await requireActiveUser(req);
    const body = await readJson(req, 48000);
    const result = articleSchema.safeParse(body);
    if (!result.success) throw new HttpError(400, 'Invalid article');
    const secret = process.env.AI_GUEST_SECRET;
    const expires = body._expires;
    if (!secret || typeof expires !== 'number' || expires < Date.now() || typeof body._signature !== 'string') throw new HttpError(400, 'Generate a new article before saving');
    const expected = createHmac('sha256', secret).update(JSON.stringify(result.data) + expires).digest('hex');
    const a = Buffer.from(expected); const b = Buffer.from(body._signature);
    if (a.length !== b.length || !timingSafeEqual(a, b)) throw new HttpError(400, 'Invalid generated article');
    const db = adminDb();
    // Stable signature prevents duplicate saves after network retries.
    const ref = db.doc(`articles/${expected}`);
    await db.runTransaction(async tx => {
      const [existing, deletion] = await tx.getAll(ref, db.doc(`accountDeletions/${user.uid}`));
      if (deletion.exists) throw new HttpError(409, 'Account deletion is in progress');
      if (!existing.exists) tx.set(ref, { ...result.data, averageRating: 0, ratingSum: 0, ratingCount: 0, createdAt: FieldValue.serverTimestamp() });
    });
    revalidatePath('/sitemap.xml');
    return NextResponse.json({ id: ref.id });
  } catch (error) { return apiError(error); }
}
