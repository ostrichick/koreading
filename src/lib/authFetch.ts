import { auth } from './firebase';

export async function authHeaders(): Promise<Record<string, string>> {
  await auth.authStateReady();
  const token = await auth.currentUser?.getIdToken();
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}
export async function serverMutation(path: string, body: unknown) {
  const res = await fetch(path, { method: 'POST', headers: await authHeaders(), body: JSON.stringify(body) });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}
