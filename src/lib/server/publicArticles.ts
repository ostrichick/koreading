import 'server-only';
import type { Article } from '@/lib/db';
import { z } from 'zod';
import { levels, topics } from '@/lib/schemas';

type Value = { stringValue?: string; integerValue?: string; doubleValue?: number; timestampValue?: string; arrayValue?: { values?: Value[] }; mapValue?: { fields?: Record<string, Value> }; booleanValue?: boolean };
function decode(v: Value): unknown {
  if (v.stringValue !== undefined) return v.stringValue;
  if (v.integerValue !== undefined) return Number(v.integerValue);
  if (v.doubleValue !== undefined) return v.doubleValue;
  if (v.booleanValue !== undefined) return v.booleanValue;
  if (v.timestampValue) return { seconds: Math.floor(Date.parse(v.timestampValue) / 1000), nanoseconds: 0 };
  if (v.arrayValue) return (v.arrayValue.values || []).map(decode);
  if (v.mapValue) return Object.fromEntries(Object.entries(v.mapValue.fields || {}).map(([k, v]) => [k, decode(v)]));
  return null;
}
interface Document { name: string; fields: Record<string, Value> }
function article(doc: Document): Article {
  return { ...Object.fromEntries(Object.entries(doc.fields).map(([k, v]) => [k, decode(v)])), id: doc.name.split('/').pop()! } as Article;
}
const project = () => {
  const id = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!id || !/^[\w-]+$/.test(id)) throw new Error('Firebase project not configured');
  return `projects/${id}/databases/(default)/documents`;
};
async function request(path: string, body?: unknown) {
  return fetch(`https://firestore.googleapis.com/v1/${project()}${path}`, {
    method: body ? 'POST' : 'GET', headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    next: { revalidate: 60 }, signal: AbortSignal.timeout(10000),
  });
}
export async function publicArticle(id: string) {
  if (!/^[\w-]{1,128}$/.test(id)) return null;
  const response = await request(`/articles/${id}`);
  if (response.status === 404) return null;
  if (!response.ok) throw new Error('Article could not be loaded');
  return article(await response.json());
}
export const listQuerySchema = z.object({
  level: z.enum(['all', ...levels]).default('all'), topic: z.enum(['all', ...topics]).default('all'),
  sort: z.enum(['rating', 'newest']).default('rating'), cursor: z.string().max(2000).optional(),
});
type ListQuery = z.infer<typeof listQuerySchema>;
const cursorSchema = z.object({ id: z.string().regex(/^[\w-]{1,128}$/), date: z.string().datetime({ offset: true }), rating: z.number(), filter: z.string() });
export async function publicArticlePage(options: ListQuery, pageSize = 24, full = false) {
  const filters = [options.level !== 'all' && { fieldFilter: { field: { fieldPath: 'level' }, op: 'EQUAL', value: { stringValue: options.level } } }, options.topic !== 'all' && { fieldFilter: { field: { fieldPath: 'topicCategory' }, op: 'EQUAL', value: { stringValue: options.topic } } }].filter(Boolean);
  const filter = JSON.stringify([options.level, options.topic, options.sort]);
  const cursor = options.cursor ? cursorSchema.parse(JSON.parse(Buffer.from(options.cursor, 'base64url').toString('utf8'))) : null;
  if (cursor && cursor.filter !== filter) throw new Error('Cursor filters do not match');
  const orderBy = [...(options.sort === 'rating' ? [{ field: { fieldPath: 'averageRating' }, direction: 'DESCENDING' }] : []), { field: { fieldPath: 'createdAt' }, direction: 'DESCENDING' }, { field: { fieldPath: '__name__' }, direction: 'DESCENDING' }];
  const query = {
    from: [{ collectionId: 'articles' }], orderBy, limit: pageSize + 1,
    ...(full ? {} : { select: { fields: ['title', 'summary', 'summaries', 'summaryLanguage', 'level', 'topicCategory', 'estimatedMinutes', 'keyVocabulary', 'createdAt', 'averageRating', 'ratingCount'].map(fieldPath => ({ fieldPath })) } }),
    ...(filters.length ? { where: filters.length === 1 ? filters[0] : { compositeFilter: { op: 'AND', filters } } } : {}),
    ...(cursor ? { startAt: { before: false, values: [...(options.sort === 'rating' ? [{ doubleValue: cursor.rating }] : []), { timestampValue: cursor.date }, { referenceValue: `${project()}/articles/${cursor.id}` }] } } : {}),
  };
  const response = await request(':runQuery', { structuredQuery: query });
  if (!response.ok) throw new Error('Library unavailable. Check Firestore rules and indexes.');
  const results: { document?: Document }[] = await response.json();
  const docs = results.flatMap(r => r.document ? [r.document] : []);
  const visible = docs.slice(0, pageSize);
  const last = visible[visible.length - 1];
  const next = docs.length > pageSize && last ? Buffer.from(JSON.stringify({ id: last.name.split('/').pop(), date: last.fields.createdAt.timestampValue, rating: Number(last.fields.averageRating?.doubleValue ?? last.fields.averageRating?.integerValue ?? 0), filter })).toString('base64url') : null;
  return { articles: visible.map(article), cursor: next };
}
export async function publicArticleIndex(full = false) {
  const items: Article[] = [];
  let cursor: string | undefined;
  do {
    const result = await publicArticlePage({ level: 'all', topic: 'all', sort: 'newest', cursor }, 500, full);
    items.push(...result.articles);
    cursor = result.cursor || undefined;
  } while (cursor && items.length < 45000);
  return items;
}
