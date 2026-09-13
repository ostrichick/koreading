import 'server-only';
import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

function app() {
  const existing = getApps().find(a => a.name === 'koreading-server');
  if (existing) return existing;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw && !process.env.GOOGLE_APPLICATION_CREDENTIALS && !process.env.FIRESTORE_EMULATOR_HOST) {
    throw new Error('Server credentials are not configured');
  }
  return initializeApp({
    credential: raw ? cert(JSON.parse(raw)) : applicationDefault(),
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  }, 'koreading-server');
}
export const adminDb = () => getFirestore(app());
export const adminAuth = () => getAuth(app());
