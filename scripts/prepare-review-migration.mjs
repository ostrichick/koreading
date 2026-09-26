#!/usr/bin/env node
/**
 * Build a local review-privacy migration candidate from an already authorized
 * JSON/NDJSON fixture. This file never connects to Firebase or the network.
 *
 * The generated candidate is sensitive because READY operations contain the
 * verified owner UID needed to create a private reviewOwnership mapping. Keep it
 * access-controlled. Ambiguous ownership is never guessed.
 */
import { createHash, randomUUID } from 'node:crypto';
import { closeSync, lstatSync, openSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { dirname, extname, isAbsolute, relative, resolve, sep } from 'node:path';

const MAX_BYTES = 64 * 1024 * 1024;
const MAX_LINE_BYTES = 1024 * 1024;
const MAX_RECORDS = 200_000;
const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const hashRef = value => createHash('sha256').update(value).digest('hex').slice(0, 24);

function within(root, candidate) {
  const delta = relative(root, candidate);
  return delta === '' || (delta !== '..' && !delta.startsWith(`..${sep}`) && !isAbsolute(delta));
}

function inputFile(input) {
  if (!input || input.startsWith('-')) throw new Error('invalid input');
  const path = resolve(input);
  if (!['.json', '.ndjson'].includes(extname(path).toLowerCase())) throw new Error('invalid input');
  const metadata = lstatSync(path);
  if (!metadata.isFile() || metadata.isSymbolicLink() || metadata.size > MAX_BYTES) throw new Error('invalid input');
  return path;
}

function outputFile(output, input) {
  if (!output || output.startsWith('-')) throw new Error('invalid output');
  const path = resolve(output);
  const root = realpathSync(process.cwd());
  const parent = dirname(path);
  const actualParent = realpathSync(parent);
  const first = relative(root, path).split(sep)[0].toLowerCase();
  if (!within(root, path) || !within(root, actualParent) || !lstatSync(parent).isDirectory()
    || ['.git', '.next', 'node_modules'].includes(first)
    || extname(path).toLowerCase() !== '.json' || path === input || path === root) {
    throw new Error('invalid output');
  }
  return path;
}

function validateArticleId(id) {
  return typeof id === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(id);
}

function validReviewData(data) {
  const allowed = new Set(['rating', 'pros', 'cons', 'userId', 'userDisplayName', 'createdAt', 'updatedAt']);
  return object(data)
    && Object.keys(data).every(key => allowed.has(key))
    && Number.isInteger(data.rating) && data.rating >= 1 && data.rating <= 5
    && typeof data.pros === 'string' && data.pros.length <= 2000
    && typeof data.cons === 'string' && data.cons.length <= 2000
    && typeof data.userDisplayName === 'string' && data.userDisplayName.trim().length > 0
    && data.userDisplayName.length <= 100;
}

function parseJson(source) {
  const root = JSON.parse(readFileSync(source, 'utf8'));
  if (!object(root) || !Array.isArray(root.articles) || (own(root, 'reviews') && !Array.isArray(root.reviews))) {
    throw new Error('invalid fixture');
  }
  const records = [];
  for (const article of root.articles) {
    if (!object(article) || !Array.isArray(article.reviews ?? [])) throw new Error('invalid fixture');
    const { id, reviews = [], ...data } = article;
    records.push({ type: 'article', id, data });
    for (const review of reviews) {
      if (!object(review)) throw new Error('invalid fixture');
      const { id: reviewId, ...data } = review;
      records.push({ type: 'review', articleId: id, id: reviewId, data });
    }
  }
  for (const review of root.reviews ?? []) {
    if (!object(review)) throw new Error('invalid fixture');
    const { articleId, id, ...data } = review;
    records.push({ type: 'review', articleId, id, data });
  }
  if (records.length > MAX_RECORDS) throw new Error('record limit');
  return records;
}

function parseNdjson(source) {
  const text = readFileSync(source, 'utf8');
  const records = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    if (Buffer.byteLength(line, 'utf8') > MAX_LINE_BYTES) throw new Error('line limit');
    if (records.length >= MAX_RECORDS) throw new Error('record limit');
    const row = JSON.parse(line);
    if (!object(row) || !['article', 'review'].includes(row.type)) throw new Error('invalid fixture');
    records.push(row);
  }
  return records;
}

export function buildReviewMigrationCandidate(records, createId = randomUUID) {
  const articles = new Map();
  const reviews = [];
  for (const row of records) {
    if (!object(row) || !['article', 'review'].includes(row.type)) throw new Error('invalid record');
    if (row.type === 'article') {
      if (!validateArticleId(row.id)) throw new Error('invalid article');
      if (articles.has(row.id)) throw new Error('duplicate article');
      articles.set(row.id, object(row.data) ? row.data : {});
      continue;
    }
    reviews.push(row);
  }

  const ready = [];
  const holds = [];
  const seenOwnerArticle = new Set();
  for (const row of reviews) {
    const articleId = row.articleId;
    const sourceReviewId = row.id;
    const data = row.data;
    const holdRef = hashRef(JSON.stringify([articleId, sourceReviewId]));
    const hold = reason => holds.push({ ref: holdRef, reason });

    if (!validateArticleId(articleId) || !articles.has(articleId)) { hold('article_not_verified_in_fixture'); continue; }
    if (typeof sourceReviewId !== 'string' || !sourceReviewId || sourceReviewId.length > 512 || !validReviewData(data)) {
      hold('review_schema_incompatible'); continue;
    }
    if (typeof data.userId !== 'string' || !data.userId || data.userId !== sourceReviewId) {
      hold(own(data, 'userId') ? 'ownership_conflict' : 'ownership_not_verified'); continue;
    }

    const ownerKey = JSON.stringify([data.userId, articleId]);
    if (seenOwnerArticle.has(ownerKey)) { hold('duplicate_owner_article'); continue; }
    seenOwnerArticle.add(ownerKey);

    const publicReviewId = createId();
    if (typeof publicReviewId !== 'string' || !/^[0-9a-f-]{36}$/i.test(publicReviewId) || publicReviewId === data.userId) {
      throw new Error('invalid generated id');
    }
    const { userId, ...legacyPublicData } = data;
    const publicData = { ...legacyPublicData, schemaVersion: 2 };
    ready.push({
      source: { articleId, reviewId: sourceReviewId },
      publicReview: { articleId, reviewId: publicReviewId, data: publicData },
      privateOwnership: { uid: userId, articleId, reviewId: publicReviewId },
    });
  }

  const articleMarkerUpdates = [];
  const articleMarkerHolds = [];
  const readyByLegacyKey = new Map(ready.map(operation => [
    JSON.stringify([operation.source.articleId, operation.source.reviewId]), operation,
  ]));
  for (const [articleId, data] of articles) {
    if (!own(data, 'lastReviewUid')) continue;
    const lastReviewUid = data.lastReviewUid;
    const articleRef = hashRef(articleId);
    if (typeof lastReviewUid !== 'string' || !lastReviewUid) {
      articleMarkerHolds.push({ ref: articleRef, reason: 'invalid_last_review_uid' });
      continue;
    }
    const operation = readyByLegacyKey.get(JSON.stringify([articleId, lastReviewUid]));
    if (!operation) {
      articleMarkerHolds.push({ ref: articleRef, reason: 'last_review_uid_not_ready' });
      continue;
    }
    articleMarkerUpdates.push({ articleId, remove: 'lastReviewUid', lastReviewId: operation.publicReview.reviewId });
  }

  return {
    schemaVersion: 1,
    scope: 'offline_review_privacy_migration_candidate',
    sensitive: true,
    counts: {
      reviews: reviews.length,
      ready: ready.length,
      hold: holds.length,
      articleMarkerReady: articleMarkerUpdates.length,
      articleMarkerHold: articleMarkerHolds.length,
    },
    ready,
    holds,
    articleMarkerUpdates,
    articleMarkerHolds,
    limitations: [
      'No Firebase, Auth, or network access was used.',
      'READY requires source review document ID to equal a non-empty userId field.',
      'Missing or conflicting ownership is HOLD and is never inferred from display names.',
      'A public lastReviewUid is replaced only when it points to a READY review in the same article; otherwise the article marker is HOLD.',
      'This candidate does not modify source data and is not an executable production migration.',
    ],
  };
}

function args(argv) {
  const parsed = {};
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    if (['--input', '--output'].includes(flag) && !own(parsed, flag)) parsed[flag] = argv[++i];
    else throw new Error('usage');
  }
  if (!parsed['--input']) throw new Error('usage');
  return parsed;
}

export function main(argv) {
  const parsed = args(argv);
  const source = inputFile(parsed['--input']);
  const destination = parsed['--output'] ? outputFile(parsed['--output'], source) : null;
  const records = extname(source).toLowerCase() === '.ndjson' ? parseNdjson(source) : parseJson(source);
  const candidate = buildReviewMigrationCandidate(records);
  if (destination) {
    const fd = openSync(destination, 'wx', 0o600);
    try { writeFileSync(fd, JSON.stringify(candidate, null, 2) + '\n', 'utf8'); }
    finally { closeSync(fd); }
  }
  process.stdout.write(`Review migration candidate: ${candidate.counts.ready} READY, ${candidate.counts.hold} HOLD from ${candidate.counts.reviews} reviews; ${candidate.counts.articleMarkerReady} article markers READY, ${candidate.counts.articleMarkerHold} HOLD. No cloud access or source changes.${destination ? ' Sensitive candidate written to a new local file.' : ' No candidate file written.'}\n`);
  return candidate;
}

if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(new URL(import.meta.url))) {
  try { main(process.argv.slice(2)); }
  catch {
    process.stderr.write('Review migration preparation failed: invalid input, unsafe path, or limit exceeded. No data was changed.\n');
    process.exitCode = 1;
  }
}
