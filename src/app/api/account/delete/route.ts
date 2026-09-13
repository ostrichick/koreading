import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminAuth, adminDb } from '@/lib/server/admin';
import { apiError, requireUser } from '@/lib/server/http';

export async function POST(req: Request) {
  try {
    const user = await requireUser(req, true);
    const db = adminDb();
    // Tombstone blocks client writes and concurrent reviews; persists for safe retries.
    await db.doc(`accountDeletions/${user.uid}`).set({ startedAt: FieldValue.serverTimestamp() }, { merge: true });
    // Retain anonymous rating contribution; remove author data in bounded batches.
    while (true) {
      const reviews = await db.collectionGroup('reviews').where('userId', '==', user.uid).limit(200).get();
      if (reviews.empty) break;
      const batch = db.batch();
      reviews.docs.forEach(d => batch.update(d.ref, { userId: FieldValue.delete(), userDisplayName: 'Deleted account', pros: '', cons: '' }));
      await batch.commit();
    }
    await db.recursiveDelete(db.doc(`users/${user.uid}`));
    // Auth is deleted last: earlier failures leave a valid account for retrying cleanup.
    await adminAuth().deleteUser(user.uid);
    return NextResponse.json({ ok: true });
  } catch (error) { return apiError(error); }
}
