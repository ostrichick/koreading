import { createHmac } from 'node:crypto';
import { Timestamp } from 'firebase-admin/firestore';
import { adminDb } from './admin';
import { HttpError, requireActiveUser } from './http';

// Reserve a conservative number of provider attempts, including fallback calls.
export const AI_WEIGHTS = { generateArticle: 6, generateTest: 5, lookupWord: 10, tutorChat: 5 };
export async function reserveAiQuota(req: Request, action: keyof typeof AI_WEIGHTS) {
  const secret = process.env.AI_GUEST_SECRET;
  if (!secret) throw new HttpError(503, 'AI service is not configured');
  const user = req.headers.has('authorization') ? await requireActiveUser(req) : null;
  const ip = (req.headers.get('x-vercel-forwarded-for') || req.headers.get('x-forwarded-for') || 'local').split(',')[0].trim();
  const hash = createHmac('sha256', secret).update(ip).digest('hex');
  const identity = user ? `user-${user.uid}` : `guest-${hash}`;
  const now = Date.now();
  const day = Math.floor(now / 86400000);
  const minute = Math.floor(now / 60000);
  const globalLimit = Number(process.env.AI_DAILY_BUDGET || 1000);
  if (!Number.isSafeInteger(globalLimit) || globalLimit < 1) throw new HttpError(503, 'AI budget is not configured');
  const limits = [
    { key: `global-${day}`, limit: globalLimit, cost: AI_WEIGHTS[action] },
    { key: `${identity}-${day}`, limit: user ? 200 : 40, cost: AI_WEIGHTS[action] },
    { key: `ip-${hash}-${minute}`, limit: 20, cost: 1 },
  ];
  const db = adminDb();
  await db.runTransaction(async tx => {
    const refs = limits.map(l => db.doc(`aiUsage/${l.key}`));
    const snapshots = await tx.getAll(...refs);
    if (limits.some((l, i) => (snapshots[i].data()?.used || 0) + l.cost > l.limit)) {
      throw new HttpError(429, 'AI usage limit reached. Please retry after the limit resets.');
    }
    limits.forEach((l, i) => tx.set(refs[i], { used: (snapshots[i].data()?.used || 0) + l.cost, expiresAt: Timestamp.fromMillis((day + 2) * 86400000) }));
  });
}
