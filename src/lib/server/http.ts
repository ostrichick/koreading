import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from './admin';

export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export async function readJson(req: Request, maxBytes = 24000) {
  if (!req.headers.get('content-type')?.includes('application/json')) throw new HttpError(415, 'JSON required');
  const reader = req.body?.getReader();
  if (!reader) throw new HttpError(400, 'Missing body');
  let bytes = 0;
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.length;
    if (bytes > maxBytes) { await reader.cancel(); throw new HttpError(413, 'Request too large'); }
    chunks.push(value);
  }
  const all = new Uint8Array(bytes);
  let offset = 0;
  for (const chunk of chunks) { all.set(chunk, offset); offset += chunk.length; }
  try { return JSON.parse(new TextDecoder().decode(all)); }
  catch { throw new HttpError(400, 'Invalid JSON'); }
}
export async function requireUser(req: Request, recent = false) {
  const token = req.headers.get('authorization')?.match(/^Bearer (.+)$/)?.[1];
  if (!token) throw new HttpError(401, 'Please sign in');
  const auth = adminAuth();
  let user;
  try { user = await auth.verifyIdToken(token, true); }
  catch { throw new HttpError(401, 'Please sign in again'); }
  if (recent && Date.now() / 1000 - user.auth_time > 300) throw new HttpError(401, 'Please sign in again before deleting your account');
  return user;
}
export async function requireActiveUser(req: Request) {
  const user = await requireUser(req);
  if ((await adminDb().doc(`accountDeletions/${user.uid}`).get()).exists) throw new HttpError(409, 'Account deletion is in progress');
  return user;
}
export function apiError(error: unknown) {
  if (error instanceof HttpError) return NextResponse.json({ error: error.message }, { status: error.status });
  console.error('Server request failed', error instanceof Error ? error.name : 'unknown');
  return NextResponse.json({ error: 'Service temporarily unavailable. Please retry later.' }, { status: 503 });
}
