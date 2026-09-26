import { isIP } from 'node:net';

// Shared storage is required on deployed runtimes. Local in-memory limits are for development only.
const local = new Map<string, { used: number; expires: number }>();
const lua = `for i=1,#KEYS do if tonumber(redis.call('GET',KEYS[i]) or '0')+tonumber(ARGV[1])>tonumber(ARGV[i+1]) then return 0 end end
for i=1,#KEYS do redis.call('INCRBY',KEYS[i],ARGV[1]); redis.call('EXPIRE',KEYS[i],172800) end return 1`;

/** Vercel overwrites incoming X-Forwarded-For; other deployments must never trust client headers. */
export function aiQuotaIdentity(headers: Headers, vercelEnvironment = process.env.VERCEL_ENV): string {
  if (vercelEnvironment !== 'production' && vercelEnvironment !== 'preview') return 'unverified-client';
  // A proxy upstream of Vercel may change the observable client IP; no identity/auth is implied.
  const first = headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '';
  if (first.length > 45) return 'unverified-client';
  const family = isIP(first);
  if (family === 4) return first;
  if (family === 6) return new URL(`http://[${first}]`).hostname.slice(1, -1);
  return 'unverified-client';
}

export async function checkAiQuota(identity: string, now = Date.now(), requireShared = process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL_ENV)): Promise<boolean> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode((process.env.AI_RATE_LIMIT_SALT || 'koreading') + identity));
  const id = Array.from(new Uint8Array(digest), n => n.toString(16).padStart(2, '0')).join('');
  const minute = Math.floor(now / 60000); const day = Math.floor(now / 86400000);
  const cap = Number(process.env.AI_DAILY_REQUEST_LIMIT || 1000);
  if (!Number.isSafeInteger(cap) || cap < 1) throw new Error('Invalid AI budget');
  const keys = [`ai:minute:${id}:${minute}`, `ai:day:${id}:${day}`, `ai:global:${day}`];
  const limits = [20, 100, cap];
  const url = process.env.UPSTASH_REDIS_REST_URL; const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (requireShared && (!url || !token)) throw new Error('Shared AI quota storage required');
  if (url || token) {
    if (!url || !token) throw new Error('Incomplete shared quota configuration');
    const response = await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(['EVAL', lua, '3', ...keys, '1', ...limits.map(String)]), signal: AbortSignal.timeout(3000), cache: 'no-store' });
    if (!response.ok) throw new Error('Shared quota service unavailable');
    const data = await response.json();
    if (data.error || ![0, 1].includes(data.result)) throw new Error('Invalid quota response');
    return data.result === 1;
  }
  for (const [key, entry] of local) if (entry.expires <= now) local.delete(key);
  if (local.size > 10000) return false;
  if (keys.some((key, i) => (local.get(key)?.used || 0) >= limits[i])) return false;
  keys.forEach((key, i) => local.set(key, { used: (local.get(key)?.used || 0) + 1, expires: i === 0 ? (minute + 1) * 60000 : (day + 1) * 86400000 }));
  return true;
}
