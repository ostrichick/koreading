#!/usr/bin/env node
/** Offline, bounded, read-only inspection of locally supplied legacy fixtures. No Firebase imports. */
import { createHash } from 'node:crypto';
import { createReadStream, lstatSync, openSync, readFileSync, realpathSync, closeSync, writeFileSync } from 'node:fs';
import { dirname, extname, isAbsolute, relative, resolve, sep } from 'node:path';
import { createInterface } from 'node:readline';

const MAX_BYTES = 64 * 1024 * 1024;
const MAX_LINE_BYTES = 1024 * 1024;
const MAX_RECORDS = 200_000;
const MAX_SAMPLES = 5;
const LEVELS = new Set(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']);
const LANGUAGES = new Set(['en', 'es', 'ja', 'zh']);
const TOPICS = new Set(['fairy-tales', 'daily-life', 'culture', 'nature-travel', 'k-content', 'news', 'food', 'history']);
const IMAGE_HOSTS = new Set(['images.unsplash.com', 'upload.wikimedia.org', 'image.pollinations.ai']);
const foreignLetters = /[^\u1100-\u11ff\u3130-\u318f\uac00-\ud7af\P{L}]/u;
const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const ref = id => createHash('sha256').update(id).digest('hex').slice(0, 24);
const finite = value => typeof value === 'number' && Number.isFinite(value);
const close = (a, b) => Math.abs(a - b) <= 0.000001;

function issue(report, code, articleRef, severity = 'review') {
  const record = report.findings[code] ??= { severity, count: 0, articleRefs: [] };
  record.count++;
  if (articleRef && record.articleRefs.length < MAX_SAMPLES && !record.articleRefs.includes(articleRef)) {
    record.articleRefs.push(articleRef);
  }
}

function validImage(url) {
  if (typeof url !== 'string' || url.length > 6000) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && IMAGE_HOSTS.has(parsed.hostname)
      && !parsed.username && !parsed.password && !parsed.port;
  } catch { return false; }
}

function checkArticle(report, a, id) {
  const label = ref(id);
  const text = key => typeof a[key] === 'string' && a[key].trim().length > 0;
  const vocabulary = Array.isArray(a.keyVocabulary) ? a.keyVocabulary.filter(w => typeof w === 'string') : [];
  const duplicateVocabulary = Array.isArray(a.keyVocabulary)
    && new Set(vocabulary.map(w => w.normalize('NFC').toLowerCase())).size !== vocabulary.length;
  const foreign = (text('title') && foreignLetters.test(a.title)) || (text('content') && foreignLetters.test(a.content));
  const short = text('content') && a.content.trim().length < 80;
  const untrustedImages = own(a, 'imageUrls') && (!Array.isArray(a.imageUrls)
    || a.imageUrls.length > 2 || a.imageUrls.some(url => !validImage(url)));
  const optionalText = (field, max, korean = false) => !own(a, field)
    || (typeof a[field] === 'string' && a[field].trim().length > 0 && a[field].length <= max
      && (!korean || !foreignLetters.test(a[field])));
  const summarySchema = !own(a, 'summaries') || object(a.summaries)
    && [...LANGUAGES].every(language => typeof a.summaries[language] === 'string'
      && !!a.summaries[language].trim() && a.summaries[language].length <= 1000);
  const promptsSchema = !own(a, 'imagePrompts') || Array.isArray(a.imagePrompts)
    && a.imagePrompts.length <= 2 && a.imagePrompts.every(prompt => typeof prompt === 'string'
      && !!prompt.trim() && prompt.length <= 2000);
  const grammarSchema = !own(a, 'grammarEvidence') || Array.isArray(a.grammarEvidence)
    && a.grammarEvidence.length >= 2 && a.grammarEvidence.length <= 3
    && a.grammarEvidence.every(entry => object(entry) && typeof entry.pattern === 'string'
      && !!entry.pattern.trim() && entry.pattern.length <= 200
      && typeof entry.quote === 'string' && !!entry.quote.trim()
      && entry.quote.length <= 1000 && !foreignLetters.test(entry.quote));
  if (!text('title') || a.title.length > 200 || !text('content') || a.content.length > 10000
    || !text('summary') || a.summary.length > 1000 || !LEVELS.has(a.level)
    || !TOPICS.has(a.topicCategory) || !Number.isInteger(a.estimatedMinutes)
    || a.estimatedMinutes < 1 || a.estimatedMinutes > 60
    || !Array.isArray(a.keyVocabulary) || a.keyVocabulary.length < 1 || a.keyVocabulary.length > 10
    || (Array.isArray(a.keyVocabulary) && a.keyVocabulary.some(w => typeof w !== 'string' || !w.trim() || w.length > 50))
    || vocabulary.some(word => foreignLetters.test(word))
    || (own(a, 'summaryLanguage') && !LANGUAGES.has(a.summaryLanguage))
    || !summarySchema || !promptsSchema || !grammarSchema
    || !optionalText('hookQuote', 500, true) || !optionalText('discussionPrompt', 1000)
    || !optionalText('genre', 100) || (own(a, 'generatorModel')
      && (typeof a.generatorModel !== 'string' || a.generatorModel.length > 100))
    || foreign || short || duplicateVocabulary || untrustedImages) {
    issue(report, 'article_schema_incompatible', label);
  }
  if (short) issue(report, 'article_content_short', label, 'manual_qa');
  if (foreign) issue(report, 'article_foreign_letters', label, 'manual_qa');
  if (duplicateVocabulary) issue(report, 'article_duplicate_key_vocabulary', label, 'manual_qa');
  if (untrustedImages) issue(report, 'article_untrusted_image_url', label, 'security');
  if (own(a, 'lastReviewUid')) {
    issue(report, 'article_public_last_review_uid', label, 'privacy');
    if (typeof a.lastReviewUid !== 'string' || !a.lastReviewUid.trim()) {
      issue(report, 'article_invalid_last_review_uid', label);
    }
  }
  const count = a.ratingCount;
  const sum = a.ratingSum;
  const average = a.averageRating;
  if (!Number.isSafeInteger(count) || count < 0 || (own(a, 'ratingSum') && (!Number.isSafeInteger(sum) || sum < 0))
    || !finite(average) || average < 0 || average > 5) issue(report, 'article_invalid_aggregate', label);
  if (!own(a, 'ratingSum')) issue(report, 'article_legacy_missing_rating_sum', label, 'migration_review');
  if (Number.isSafeInteger(count) && count >= 0 && finite(average)) {
    const actualSum = own(a, 'ratingSum') && finite(sum) ? sum : average * count;
    if (count === 0 && (!close(actualSum, 0) || !close(average, 0))
      || count > 0 && !close(actualSum / count, average)) {
      issue(report, 'article_internal_aggregate_discrepancy', label);
    }
    if (count > 0 && (actualSum < count || actualSum > count * 5)) {
      issue(report, 'article_aggregate_outside_rating_bounds', label);
    }
  }
}

function checkReview(report, review, id, articleRef) {
  if (!Number.isInteger(review.rating) || review.rating < 1 || review.rating > 5
    || typeof review.pros !== 'string' || review.pros.length > 2000
    || typeof review.cons !== 'string' || review.cons.length > 2000
    || (own(review, 'userDisplayName') && (typeof review.userDisplayName !== 'string'
      || review.userDisplayName.length > 100))) {
    issue(report, 'review_schema_incompatible', articleRef);
  }
  // Firestore subcollection reads are public. Both IDs and userId can reveal account identifiers.
  if (own(review, 'userId')) {
    issue(report, 'review_public_user_id', articleRef, 'privacy');
    if (typeof review.userId !== 'string' || !review.userId.trim()) issue(report, 'review_invalid_user_id', articleRef);
    else if (review.userId !== id) issue(report, 'review_ownership_id_conflict_or_legacy_id', articleRef, 'ownership_ambiguous');
  } else {
    issue(report, 'review_owner_not_independently_verified', articleRef, 'ownership_ambiguous');
  }
  if (id.length >= 20 || (typeof review.userId === 'string' && review.userId === id)) {
    issue(report, 'review_public_document_id_potential_uid', articleRef, 'privacy');
  }
  if (own(review, 'userDisplayName')) issue(report, 'review_public_display_name', articleRef, 'privacy');
  if (!own(review, 'userId') && own(review, 'userDisplayName')) {
    issue(report, 'review_display_name_only_cannot_prove_owner', articleRef, 'ownership_ambiguous');
  }
}

/** Returns a fixed-schema, de-identified report. IDs/text/URLs are never assigned to report fields. */
export function auditRecords(records, completeByDefault = false) {
  const report = {
    schemaVersion: 1,
    scope: 'offline_local_fixture_only',
    counts: { articles: 0, reviews: 0, completeArticles: 0, partialArticles: 0, orphanReviews: 0 },
    findings: /** @type {Record<string, {severity: string, count: number, articleRefs: string[]}>} */ ({}),
    limitations: ['No live Firestore data accessed or modified.', 'A hash reference is a correlation hint, not proof of ownership.', 'Automated content checks cannot establish CEFR or educational validity.'],
  };
  const articles = new Map();
  const reviews = new Map();
  let seen = 0;
  for (const row of records) {
    if (++seen > MAX_RECORDS) throw new Error('Record limit exceeded');
    if (!object(row) || !['article', 'review'].includes(row.type)) throw new Error('Unsupported record shape');
    if (row.type === 'article') {
      if (typeof row.id !== 'string' || !row.id || row.id.length > 512 || !object(row.data)) throw new Error('Invalid article record');
      if (row.reviewsComplete !== undefined && typeof row.reviewsComplete !== 'boolean') throw new Error('Invalid completeness flag');
      if (articles.has(row.id)) throw new Error('Duplicate article record');
      const complete = row.reviewsComplete === true || (row.reviewsComplete === undefined && completeByDefault);
      articles.set(row.id, { data: row.data, complete });
      report.counts.articles++;
      report.counts[complete ? 'completeArticles' : 'partialArticles']++;
      checkArticle(report, row.data, row.id);
    } else {
      if (typeof row.articleId !== 'string' || !row.articleId || row.articleId.length > 512
        || typeof row.id !== 'string' || !row.id || row.id.length > 512 || !object(row.data)) {
        throw new Error('Invalid review record');
      }
      const key = JSON.stringify([row.articleId, row.id]);
      if (reviews.has(key)) throw new Error('Duplicate review record');
      reviews.set(key, row);
      report.counts.reviews++;
      checkReview(report, row.data, row.id, ref(row.articleId));
    }
  }

  const grouped = new Map();
  for (const row of reviews.values()) {
    if (!articles.has(row.articleId)) {
      report.counts.orphanReviews++;
      issue(report, 'review_article_not_in_snapshot', ref(row.articleId), 'incomplete_or_orphan');
      continue;
    }
    const group = grouped.get(row.articleId) ?? { count: 0, sum: 0, allValid: true, ids: new Set() };
    group.count++;
    group.ids.add(row.id);
    if (Number.isInteger(row.data.rating) && row.data.rating >= 1 && row.data.rating <= 5) group.sum += row.data.rating;
    else group.allValid = false;
    grouped.set(row.articleId, group);
  }

  for (const [id, { data: article, complete }] of articles) {
    const label = ref(id);
    const group = grouped.get(id) ?? { count: 0, sum: 0, allValid: true, ids: new Set() };
    const countDiff = Number.isSafeInteger(article.ratingCount) && article.ratingCount !== group.count;
    const sum = own(article, 'ratingSum') ? article.ratingSum : article.averageRating * article.ratingCount;
    const sumDiff = finite(sum) && group.allValid && !close(sum, group.sum);
    const averageDiff = finite(article.averageRating) && group.allValid
      && !close(article.averageRating, group.count ? group.sum / group.count : 0);
    if (!complete && (countDiff || sumDiff || averageDiff)) {
      issue(report, 'aggregate_difference_unverified_partial_reviews', label, 'insufficient_evidence');
    } else if (complete && group.allValid) {
      if (countDiff) issue(report, 'aggregate_review_count_discrepancy', label);
      if (sumDiff) issue(report, 'aggregate_review_sum_discrepancy', label);
      if (averageDiff) issue(report, 'aggregate_review_average_discrepancy', label);
    } else if (complete && !group.allValid) {
      issue(report, 'aggregate_cannot_reconcile_invalid_review_rating', label, 'insufficient_evidence');
    }
    if (complete && typeof article.lastReviewUid === 'string' && !group.ids.has(article.lastReviewUid)) {
      issue(report, 'article_last_review_uid_without_review_doc', label, 'manual_review');
    }
  }
  return report;
}

function within(root, candidate) {
  const delta = relative(root, candidate);
  return delta === '' || (delta !== '..' && !delta.startsWith(`..${sep}`) && !isAbsolute(delta));
}

function inputFile(input) {
  if (!input || input.startsWith('-')) throw new Error('Supply --input with a local .json or .ndjson file');
  const path = resolve(input);
  if (!['.json', '.ndjson'].includes(extname(path).toLowerCase())) throw new Error('Input must be .json or .ndjson');
  const metadata = lstatSync(path);
  if (!metadata.isFile() || metadata.isSymbolicLink() || metadata.size > MAX_BYTES) throw new Error('Input must be a regular, non-symlink file under 64 MiB');
  return path;
}

function outputFile(output, input) {
  if (!output || output.startsWith('-')) throw new Error('Supply --output with a new local .json file');
  const path = resolve(output);
  const root = realpathSync(process.cwd());
  const parent = dirname(path);
  const actualParent = realpathSync(parent);
  const rootSegment = relative(root, path).split(sep)[0].toLowerCase();
  if (!within(root, path) || !within(root, actualParent) || !lstatSync(parent).isDirectory()
    || ['.git', '.next', 'node_modules'].includes(rootSegment)
    || extname(path).toLowerCase() !== '.json' || path === input || path === root) {
    throw new Error('Output must be a new .json file inside the current working directory');
  }
  return path;
}

function recordsFromJson(source) {
  const root = JSON.parse(readFileSync(source, 'utf8'));
  if (!object(root) || !Array.isArray(root.articles) || (own(root, 'reviews') && !Array.isArray(root.reviews))) {
    throw new Error('Expected {articles:[...], reviews?:[...], reviewsComplete?:boolean}');
  }
  if (own(root, 'reviewsComplete') && typeof root.reviewsComplete !== 'boolean') throw new Error('Invalid reviewsComplete flag');
  const rows = [];
  for (const article of root.articles) {
    if (!object(article) || (own(article, 'reviews') && !Array.isArray(article.reviews))) throw new Error('Invalid article or embedded reviews');
    const { id, reviews: embedded = [], reviewsComplete, ...data } = article;
    if (rows.length >= MAX_RECORDS) throw new Error('Record limit exceeded');
    rows.push({ type: 'article', id, data, reviewsComplete });
    for (const review of embedded) {
      if (!object(review)) throw new Error('Invalid embedded review');
      const { id: reviewId, ...reviewData } = review;
      if (rows.length >= MAX_RECORDS) throw new Error('Record limit exceeded');
      rows.push({ type: 'review', articleId: id, id: reviewId, data: reviewData });
    }
  }
  for (const review of root.reviews ?? []) {
    if (!object(review)) throw new Error('Invalid review');
    const { articleId, id, ...data } = review;
    if (rows.length >= MAX_RECORDS) throw new Error('Record limit exceeded');
    rows.push({ type: 'review', articleId, id, data });
  }
  return auditRecords(rows, root.reviewsComplete === true);
}

async function recordsFromNdjson(source) {
  const rows = [];
  const stream = createReadStream(source, { encoding: 'utf8', highWaterMark: 64 * 1024 });
  const reader = createInterface({ input: stream, crlfDelay: Infinity });
  try {
    for await (const line of reader) {
      if (Buffer.byteLength(line, 'utf8') > MAX_LINE_BYTES) throw new Error('NDJSON line exceeds 1 MiB');
      if (!line.trim()) continue;
      if (rows.length >= MAX_RECORDS) throw new Error('Record limit exceeded');
      rows.push(JSON.parse(line));
    }
  } finally { reader.close(); stream.destroy(); }
  return auditRecords(rows);
}

function args(argv) {
  const parsed = {};
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    if (flag === '--json' && !own(parsed, 'json')) parsed.json = true;
    else if (['--input', '--output'].includes(flag) && !own(parsed, flag)) parsed[flag] = argv[++i];
    else throw new Error('Usage: --input local.json|local.ndjson [--json | --output report.json]');
  }
  if (!parsed['--input'] || (parsed.json && parsed['--output'])) throw new Error('Choose --json or --output, not both');
  return parsed;
}

export async function main(argv) {
  const parsed = args(argv);
  const source = inputFile(parsed['--input']);
  const destination = parsed['--output'] ? outputFile(parsed['--output'], source) : null;
  const report = extname(source).toLowerCase() === '.ndjson' ? await recordsFromNdjson(source) : recordsFromJson(source);
  const json = JSON.stringify(report, null, 2) + '\n';
  if (destination) {
    const fd = openSync(destination, 'wx', 0o600); // Never overwrite an existing file, including symlinks.
    try { writeFileSync(fd, json, 'utf8'); } finally { closeSync(fd); }
  }
  if (parsed.json) process.stdout.write(json);
  else process.stdout.write(`Offline audit: ${report.counts.articles} articles, ${report.counts.reviews} reviews; ${Object.keys(report.findings).length} finding categories. ${report.counts.completeArticles} complete review sets; ${report.counts.partialArticles} partial/unknown. No source changes or cloud access.\n`);
  return report;
}

if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(new URL(import.meta.url))) {
  main(process.argv.slice(2)).catch(() => {
    // Never echo exception messages, paths or parsed fixture contents.
    process.stderr.write('Offline audit failed: invalid input, unsafe path, or limit exceeded. No data was changed.\n');
    process.exitCode = 1;
  });
}
