import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync, existsSync, symlinkSync, truncateSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { auditRecords } from '../scripts/audit-legacy-data.mjs';

const script = resolve('scripts/audit-legacy-data.mjs');
const privateUid = 'USER_UID_PRIVATE_SENTINEL_abcdefghijklmnopqrstuvwxyz';
const privateName = 'PERSON_NAME_PRIVATE_SENTINEL';
const privateContent = 'CONTENT_PRIVATE_SENTINEL';
const privateUrl = 'https://tracking.example.test/private?uid=USER_UID_PRIVATE_SENTINEL';

function article(overrides: Record<string, unknown> = {}) {
  return {
    id: 'story-safe-id', title: '눈 이야기', content: '눈이 내리는 아침에 학교에 갔어요. 친구가 환하게 웃으며 함께 책을 읽자고 말했어요. 오늘은 새로운 이야기를 읽는 즐거움을 배웠어요. 그리고 내일도 책을 읽기로 했어요.',
    summary: 'Snowy day', level: 'A1', topicCategory: 'daily-life', estimatedMinutes: 2,
    keyVocabulary: ['눈', '친구'], ratingCount: 1, ratingSum: 4, averageRating: 4,
    ...overrides,
  };
}
function review(overrides: Record<string, unknown> = {}) {
  return { id: privateUid, userId: privateUid, userDisplayName: privateName, rating: 4, pros: '', cons: '', ...overrides };
}
function run(cwd: string, args: string[]) {
  return spawnSync(process.execPath, [script, ...args], { cwd, encoding: 'utf8', timeout: 10_000 });
}
function fixture(contents: unknown, extension = 'json') {
  const cwd = mkdtempSync(join(tmpdir(), 'koreading-audit-'));
  const input = join(cwd, `fixture.${extension}`);
  writeFileSync(input, typeof contents === 'string' ? contents : JSON.stringify(contents));
  return { cwd, input };
}

test('healthy complete aggregate passes reconciliation but flags publicly readable identifiers', () => {
  const { cwd, input } = fixture({ reviewsComplete: true, articles: [{ ...article(), reviews: [review()] }] });
  const result = run(cwd, ['--input', input, '--json']);
  assert.equal(result.status, 0);
  const report = JSON.parse(result.stdout);
  assert.deepEqual(report.counts, { articles: 1, reviews: 1, completeArticles: 1, partialArticles: 0, orphanReviews: 0 });
  assert.equal(report.findings.aggregate_review_count_discrepancy, undefined);
  assert.equal(report.findings.aggregate_review_sum_discrepancy, undefined);
  assert.equal(report.findings.aggregate_review_average_discrepancy, undefined);
  assert.equal(report.findings.article_schema_incompatible, undefined);
  assert.equal(report.findings.review_public_user_id.count, 1);
  assert.match(JSON.stringify(report), /[a-f0-9]{24}/);
  for (const secret of [privateUid, privateName, privateContent, privateUrl, input, cwd]) {
    assert.ok(!`${result.stdout}${result.stderr}`.includes(secret));
  }
});

test('complete snapshot detects independently count, sum, average and dangling lastReviewUid', () => {
  const report = auditRecords([
    { type: 'article', id: 'one', reviewsComplete: true, data: article({ ratingCount: 2, ratingSum: 7, averageRating: 3.5, lastReviewUid: privateUid }) },
    { type: 'review', articleId: 'one', id: 'another-user', data: { userId: 'another-user', rating: 4 } },
  ]);
  for (const code of ['aggregate_review_count_discrepancy', 'aggregate_review_sum_discrepancy',
    'aggregate_review_average_discrepancy', 'article_public_last_review_uid', 'article_last_review_uid_without_review_doc']) {
    assert.equal(report.findings[code]?.count, 1, code);
  }
  assert.ok(!JSON.stringify(report).includes(privateUid));
});

test('partial review sets cannot be declared inconsistent or missing reviewer with certainty', () => {
  const report = auditRecords([{ type: 'article', id: 'partial', data: article({ ratingCount: 10, ratingSum: 42, averageRating: 4.2, lastReviewUid: privateUid }) }]);
  assert.equal(report.findings.aggregate_difference_unverified_partial_reviews.count, 1);
  assert.equal(report.findings.aggregate_review_count_discrepancy, undefined);
  assert.equal(report.findings.article_last_review_uid_without_review_doc, undefined);
  assert.equal(report.counts.partialArticles, 1);
});

test('legacy anonymous-by-field and conflicting IDs are explicitly ambiguous, not assigned to a person', () => {
  const report = auditRecords([
    { type: 'article', id: 'story', reviewsComplete: true, data: article({ ratingCount: 3, ratingSum: 12, averageRating: 4 }) },
    { type: 'review', articleId: 'story', id: privateUid, data: { rating: 4, userDisplayName: privateName } },
    { type: 'review', articleId: 'story', id: 'nonmatching-doc', data: { rating: 4, userId: privateUid } },
    { type: 'review', articleId: 'story', id: 'nameless-doc', data: { rating: 4 } },
  ]);
  assert.equal(report.findings.review_owner_not_independently_verified.count, 2);
  assert.equal(report.findings.review_display_name_only_cannot_prove_owner.count, 1);
  assert.equal(report.findings.review_ownership_id_conflict_or_legacy_id.count, 1);
  assert.equal(report.findings.aggregate_review_sum_discrepancy, undefined);
  assert.ok(!JSON.stringify(report).includes(privateName));
});

test('malicious image URLs, invalid schema and basic content QA are reported without raw values', () => {
  const { cwd, input } = fixture({ articles: [{ ...article({ title: `${privateContent} English`, content: `${privateContent} English`, imageUrls: [privateUrl, 'javascript:alert(1)', 'https://images.unsplash.com.evil.test/img'], keyVocabulary: ['눈', '눈'], ratingCount: -2, ratingSum: -1, averageRating: 8 }), reviews: [{ ...review({ rating: 8 }) }] }] });
  const result = run(cwd, ['--input', input, '--json']);
  assert.equal(result.status, 0);
  const report = JSON.parse(result.stdout);
  for (const code of ['article_untrusted_image_url', 'article_schema_incompatible', 'article_foreign_letters', 'article_content_short', 'article_duplicate_key_vocabulary', 'article_invalid_aggregate', 'review_schema_incompatible']) {
    assert.ok(report.findings[code]?.count >= 1, code);
  }
  for (const secret of [privateUid, privateName, privateContent, privateUrl]) assert.ok(!result.stdout.includes(secret));
});

test('NDJSON input supports mixed record order and output file is created once, never overwritten', () => {
  const lines = [
    { type: 'review', articleId: 'story-safe-id', id: privateUid, data: review() },
    { type: 'article', id: 'story-safe-id', reviewsComplete: true, data: article() },
  ].map(row => JSON.stringify(row)).join('\n') + '\n';
  const { cwd, input } = fixture(lines, 'ndjson');
  const output = join(cwd, 'report.json');
  const first = run(cwd, ['--input', input, '--output', output]);
  assert.equal(first.status, 0);
  const contents = readFileSync(output, 'utf8');
  assert.equal(JSON.parse(contents).counts.reviews, 1);
  const second = run(cwd, ['--input', input, '--output', output]);
  assert.notEqual(second.status, 0);
  assert.equal(readFileSync(output, 'utf8'), contents);
  for (const secret of [privateUid, privateName, input, cwd]) assert.ok(!`${first.stdout}${second.stderr}${contents}`.includes(secret));
});

test('missing, invalid, oversized and unsafe paths fail closed with generic error text', () => {
  const { cwd, input } = fixture({ articles: [{ ...article(), reviews: [review()] }] });
  const existing = writeFileSync(join(cwd, 'existing.json'), 'important');
  assert.equal(existing, undefined);
  const outside = join(tmpdir(), 'report-outside.json');
  const escape = run(cwd, ['--input', input, '--output', outside]);
  assert.notEqual(escape.status, 0);
  assert.equal(existsSync(outside), false);
  const same = run(cwd, ['--input', input, '--output', input]);
  assert.notEqual(same.status, 0);
  const overwrite = run(cwd, ['--input', input, '--output', join(cwd, 'existing.json')]);
  assert.notEqual(overwrite.status, 0);
  assert.equal(readFileSync(join(cwd, 'existing.json'), 'utf8'), 'important');
  const bad = join(cwd, 'malformed.json');
  writeFileSync(bad, JSON.stringify({ articles: [{ id: privateUid, content: privateContent, reviews: [{}] }] }));
  const error = run(cwd, ['--input', bad]);
  assert.notEqual(error.status, 0);
  for (const result of [escape, same, overwrite, error]) {
    assert.ok(!`${result.stdout}${result.stderr}`.includes(privateUid));
    assert.ok(!`${result.stdout}${result.stderr}`.includes(input));
    assert.ok(!`${result.stdout}${result.stderr}`.includes(privateContent));
  }
  const directory = join(cwd, 'directory.json');
  mkdirSync(directory);
  assert.notEqual(run(cwd, ['--input', directory]).status, 0);
  const link = join(cwd, 'link.json');
  try {
    symlinkSync(input, link, 'file');
    assert.notEqual(run(cwd, ['--input', link]).status, 0);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EPERM') throw error;
  }
});

test('oversized NDJSON line and file are rejected without exposing their content', () => {
  const { cwd, input } = fixture(JSON.stringify({ type: 'article', id: privateUid, data: { secret: privateContent, filler: 'x'.repeat(1024 * 1024 + 1) } }) + '\n', 'ndjson');
  const result = run(cwd, ['--input', input, '--json']);
  assert.notEqual(result.status, 0);
  assert.ok(!`${result.stdout}${result.stderr}`.includes(privateUid));
  const large = join(cwd, 'large.json');
  writeFileSync(large, '{}');
  truncateSync(large, 64 * 1024 * 1024 + 1);
  const fileResult = run(cwd, ['--input', large]);
  assert.notEqual(fileResult.status, 0);
  assert.ok(!`${fileResult.stdout}${fileResult.stderr}`.includes(large));
});

test('invalid fixture with --output produces no partial report or sensitive error', () => {
  const { cwd, input } = fixture('{"articles":[{"id":"' + privateUid + '","reviews":[{"id":"' + privateUid + '","rating":5}]}', 'json');
  const output = join(cwd, 'not-written.json');
  const result = run(cwd, ['--input', input, '--output', output]);
  assert.notEqual(result.status, 0);
  assert.equal(existsSync(output), false);
  for (const value of [privateUid, privateName, input, output]) assert.ok(!`${result.stdout}${result.stderr}`.includes(value));
});
