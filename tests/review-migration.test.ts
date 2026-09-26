import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { buildReviewMigrationCandidate } from '../scripts/prepare-review-migration.mjs';

const script = resolve('scripts/prepare-review-migration.mjs');
const uid = 'PRIVATE_UID_SENTINEL_abcdefghijklmnopqrstuvwxyz';

function validData(overrides: Record<string, unknown> = {}) {
  return { userId: uid, userDisplayName: 'Learner', rating: 4, pros: 'good', cons: '', ...overrides };
}

function fixture(value: unknown, extension = 'json') {
  const cwd = mkdtempSync(join(tmpdir(), 'koreading-review-migration-'));
  const input = join(cwd, `input.${extension}`);
  writeFileSync(input, typeof value === 'string' ? value : JSON.stringify(value));
  return { cwd, input };
}

test('verified UID-keyed review becomes an opaque public review plus private owner mapping', () => {
  const id = '11111111-2222-4333-8444-555555555555';
  const candidate = buildReviewMigrationCandidate([
    { type: 'article', id: 'article-a' },
    { type: 'review', articleId: 'article-a', id: uid, data: validData() },
  ], () => id);
  assert.deepEqual(candidate.counts, { reviews: 1, ready: 1, hold: 0, articleMarkerReady: 0, articleMarkerHold: 0 });
  const operation = candidate.ready[0];
  assert.equal(operation.publicReview.reviewId, id);
  assert.equal(operation.publicReview.data.userId, undefined);
  assert.equal(operation.publicReview.data.schemaVersion, 2);
  assert.equal(operation.privateOwnership.uid, uid);
  assert.equal(operation.privateOwnership.articleId, 'article-a');
  assert.equal(operation.privateOwnership.reviewId, id);
});

test('unexpected legacy fields are held instead of copied into the future public review', () => {
  const candidate = buildReviewMigrationCandidate([
    { type: 'article', id: 'article-a' },
    { type: 'review', articleId: 'article-a', id: uid, data: validData({ ownerUid: uid }) },
  ]);
  assert.equal(candidate.counts.ready, 0);
  assert.equal(candidate.counts.hold, 1);
  assert.equal(candidate.holds[0].reason, 'review_schema_incompatible');
  assert.equal(JSON.stringify(candidate.holds).includes(uid), false);
});

test('missing or conflicting ownership is held and never inferred from display name', () => {
  const candidate = buildReviewMigrationCandidate([
    { type: 'article', id: 'article-a' },
    { type: 'review', articleId: 'article-a', id: uid, data: { userDisplayName: 'Same Name', rating: 4, pros: '', cons: '' } },
    { type: 'review', articleId: 'article-a', id: 'different-id', data: validData() },
  ]);
  assert.deepEqual(candidate.counts, { reviews: 2, ready: 0, hold: 2, articleMarkerReady: 0, articleMarkerHold: 0 });
  assert.deepEqual(candidate.holds.map((item: { reason: string }) => item.reason).sort(), ['ownership_conflict', 'ownership_not_verified']);
  assert.equal(JSON.stringify(candidate.holds).includes(uid), false);
  assert.equal(JSON.stringify(candidate.holds).includes('Same Name'), false);
});

test('duplicate reviews for one verified owner and article are held instead of overwriting a private mapping', () => {
  let n = 0;
  const candidate = buildReviewMigrationCandidate([
    { type: 'article', id: 'article-a' },
    { type: 'review', articleId: 'article-a', id: uid, data: validData() },
    { type: 'review', articleId: 'article-a', id: uid, data: validData({ rating: 5 }) },
  ], () => `11111111-2222-4333-8444-${String(++n).padStart(12, '0')}`);
  assert.equal(candidate.counts.ready, 1);
  assert.equal(candidate.counts.hold, 1);
  assert.equal(candidate.holds[0].reason, 'duplicate_owner_article');
});

test('public lastReviewUid becomes lastReviewId only when its exact legacy review is READY', () => {
  const id = '11111111-2222-4333-8444-555555555555';
  const candidate = buildReviewMigrationCandidate([
    { type: 'article', id: 'article-a', data: { lastReviewUid: uid } },
    { type: 'review', articleId: 'article-a', id: uid, data: validData() },
  ], () => id);
  assert.deepEqual(candidate.articleMarkerUpdates, [{ articleId: 'article-a', remove: 'lastReviewUid', lastReviewId: id }]);
  assert.deepEqual(candidate.articleMarkerHolds, []);
  assert.equal(candidate.counts.articleMarkerReady, 1);
});

test('public lastReviewUid stays HOLD when matching ownership is not READY', () => {
  const candidate = buildReviewMigrationCandidate([
    { type: 'article', id: 'article-a', data: { lastReviewUid: uid } },
    { type: 'review', articleId: 'article-a', id: uid, data: { userDisplayName: 'Learner', rating: 4, pros: '', cons: '' } },
  ]);
  assert.deepEqual(candidate.articleMarkerUpdates, []);
  assert.equal(candidate.articleMarkerHolds[0].reason, 'last_review_uid_not_ready');
  assert.equal(JSON.stringify(candidate.articleMarkerHolds).includes(uid), false);
  assert.equal(candidate.counts.articleMarkerHold, 1);
});

test('CLI summary never prints UID and output is sensitive, new and non-overwriting', () => {
  const { cwd, input } = fixture({
    articles: [{ id: 'article-a', reviews: [{ id: uid, ...validData() }] }],
  });
  const output = join(cwd, 'candidate.json');
  const first = spawnSync(process.execPath, [script, '--input', input, '--output', output], { cwd, encoding: 'utf8' });
  assert.equal(first.status, 0);
  assert.equal(first.stdout.includes(uid), false);
  assert.equal(first.stderr.includes(uid), false);
  const candidate = JSON.parse(readFileSync(output, 'utf8'));
  assert.equal(candidate.sensitive, true);
  assert.equal(candidate.ready[0].privateOwnership.uid, uid);
  const original = readFileSync(input, 'utf8');
  const second = spawnSync(process.execPath, [script, '--input', input, '--output', output], { cwd, encoding: 'utf8' });
  assert.notEqual(second.status, 0);
  assert.equal(readFileSync(input, 'utf8'), original);
  assert.equal(readFileSync(output, 'utf8').includes(uid), true);
});

test('NDJSON is accepted but unsafe output paths fail closed without leaking input data', () => {
  const rows = [
    { type: 'article', id: 'article-a', data: {} },
    { type: 'review', articleId: 'article-a', id: uid, data: validData() },
  ].map(row => JSON.stringify(row)).join('\n') + '\n';
  const { cwd, input } = fixture(rows, 'ndjson');
  const dry = spawnSync(process.execPath, [script, '--input', input], { cwd, encoding: 'utf8' });
  assert.equal(dry.status, 0);
  assert.match(dry.stdout, /1 READY, 0 HOLD/);
  assert.equal(dry.stdout.includes(uid), false);
  const outside = join(tmpdir(), 'koreading-review-migration-outside.json');
  const unsafe = spawnSync(process.execPath, [script, '--input', input, '--output', outside], { cwd, encoding: 'utf8' });
  assert.notEqual(unsafe.status, 0);
  assert.equal(existsSync(outside), false);
  assert.equal(`${unsafe.stdout}${unsafe.stderr}`.includes(uid), false);
  assert.equal(`${unsafe.stdout}${unsafe.stderr}`.includes(input), false);
});
