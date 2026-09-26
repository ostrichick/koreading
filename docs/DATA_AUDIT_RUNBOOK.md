# Legacy data audit — offline read-only runbook

**Scope:** local, deliberately prepared **JSON/NDJSON fixtures only**. `scripts/audit-legacy-data.mjs` imports Node built-ins and does not connect to Firebase, fetch a URL, read production credentials, update a database, migrate a review, or delete any content. No current production dataset was inspected by developing or testing this tool. The `articles` collection and its `reviews` subcollections are the target data model; private user documents and account-deletion markers are **not** audited.

## Run

Use a controlled workstation and a fixture that you obtained through a separately authorized process. Protect the original fixture as personal data. From the repository root:

```sh
node scripts/audit-legacy-data.mjs --input ./fixtures/legacy.json
node scripts/audit-legacy-data.mjs --input ./fixtures/legacy.ndjson --json
node scripts/audit-legacy-data.mjs --input ./fixtures/legacy.ndjson --output ./reports/data-audit.json
node --import tsx --test tests/data-audit.test.ts
```

The first command writes **only a one-line aggregate summary to stdout**. `--json` emits the sanitized machine-readable report to stdout. `--output` writes the same report to a **new**, non-existing `.json` file located inside the current working directory. The script never overwrites, deletes, modifies, or creates input data. It refuses an existing report destination, an output outside the working directory, and destinations inside `.git`, `.next`, or `node_modules`. Create the `reports/` directory explicitly before selecting it; the script does not create directories. Do not redirect `--json` into the fixture or publish the report.

Supported input files are regular, non-symlink `.json` or `.ndjson` files of at most **64 MiB**. NDJSON has a **1 MiB limit per line**, and both formats have a limit of **200,000 combined article/review records**. These intentionally finite limits make very large dumps require splitting into safe fixtures. Splitting breaks complete review-set reconciliation across chunks: mark affected articles `reviewsComplete: false` or omit the flag. Do not claim a complete audit based on one subset. Invalid data/paths abort with a generic error and no report; partial findings are not emitted.

### Accepted JSON fixture

The following is illustrative synthetic data; it is not a production extraction:

```json
{
  "reviewsComplete": true,
  "articles": [
    {
      "id": "sample-article",
      "title": "눈 이야기",
      "content": "... full local article content ...",
      "summary": "Snowy day",
      "topicCategory": "daily-life",
      "level": "A1",
      "estimatedMinutes": 2,
      "keyVocabulary": ["눈"],
      "ratingCount": 1,
      "ratingSum": 4,
      "averageRating": 4,
      "lastReviewUid": "synthetic-review-id",
      "imageUrls": ["https://images.unsplash.com/photo-example"],
      "reviews": [
        { "id": "synthetic-review-id", "userId": "synthetic-review-id", "rating": 4, "userDisplayName": "Synthetic" }
      ]
    }
  ],
  "reviews": []
}
```

`articles` is required. Each article object must have `id` and regular article fields. Optional `reviews` is an array of review objects; each must have its **document ID in `id`**. Optional root `reviews` is a flat array with `articleId`, `id`, and review fields. Do not provide the same review in both places; duplicates cause a fail-closed input error. JSON article-level `reviewsComplete` overrides the root setting. If neither explicitly asserts completeness, reconciliation findings are provisional. A missing `reviews` array does **not** imply zero reviews. Do not put Firebase REST `fields.{x}.stringValue` objects directly into this fixture: values must already be decoded into ordinary strings, numbers, arrays, and objects.

### Accepted NDJSON fixture

One JSON object per line; article and review records may be in any order:

```json
{"type":"article","id":"sample-article","reviewsComplete":true,"data":{"title":"눈 이야기","content":"...","summary":"Snowy day","level":"A1","topicCategory":"daily-life","estimatedMinutes":2,"keyVocabulary":["눈"],"ratingCount":1,"ratingSum":4,"averageRating":4}}
{"type":"review","articleId":"sample-article","id":"synthetic-review-id","data":{"rating":4,"userId":"synthetic-review-id"}}
```

NDJSON does not have a root-level completeness setting; supply `reviewsComplete: true` **on each article only when every review of that article is included**. A record's `data` object contains the document fields; keep its `id` and (for reviews) `articleId` on the outer record. Parent `articles/{id}` and child `articles/{id}/reviews/{reviewId}` document paths are parsed into these explicit fields **before** passing to this tool, never into report output.

## Report interpretation and disclosure precautions

Machine report keys: `schemaVersion`, `scope`, `counts`, `findings`, `limitations`. Each finding contains a fixed category code, `severity`, total `count`, and at most five 24-character SHA-256 prefixes under `articleRefs`. **These hashes are pseudonymous correlation hints, not anonymization:** publicly known/guessable article IDs can be reverse-matched by hashing candidates. Keep reports access-controlled, do not post them or upload them to analytics, and delete working copies according to an approved retention policy. No raw document paths, article IDs, UIDs, display names, article body, review commentary, image URLs, or file paths are emitted. Fatal error messages are generic for the same reason. The human summary reports counts only.

- `article_public_last_review_uid`: legacy `lastReviewUid` exists on a publicly readable article, even if a matching review is present. `article_last_review_uid_without_review_doc` is additionally raised only when the article has an explicitly complete review snapshot. A mismatch is a **manual-review signal**, not proof of a specific user or deletion history.
- `review_public_user_id`, `review_public_display_name`, and `review_public_document_id_potential_uid`: inspect potentially exposed identifier fields/document IDs in publicly readable review documents. A long ID alone is only a *potential* UID; it is not identity verification.
- `review_owner_not_independently_verified`, `review_display_name_only_cannot_prove_owner`, `review_ownership_id_conflict_or_legacy_id`: distinguish missing IDs, display-name-only cases, and inconsistent document ID versus `userId`. Do not infer ownership from names or automatically delete reviews flagged here. A matching document ID and userId is still only an internally consistent claim in a local fixture.
- `article_invalid_aggregate`, `article_internal_aggregate_discrepancy`, `article_aggregate_outside_rating_bounds`, `article_legacy_missing_rating_sum`: test article-level numeric validity, internal average consistency, plausible 1–5 rating bounds and legacy sum fallback (`averageRating * ratingCount`). A missing sum is a separate migration-review finding, not automatically proven corruption.
- `aggregate_review_count_discrepancy`, `aggregate_review_sum_discrepancy`, `aggregate_review_average_discrepancy`: compare an article's aggregate with actual listed reviews **only** when `reviewsComplete: true` and ratings are valid. Missing/invalid reviewed ratings instead trigger `aggregate_cannot_reconcile_invalid_review_rating`. With an incomplete/unknown set, `aggregate_difference_unverified_partial_reviews` reports a *possible* difference without asserting database corruption. `review_article_not_in_snapshot` may mean orphan data **or** missing input, never automatic orphan deletion.
- `article_untrusted_image_url`: rejects non-HTTPS, malformed, host-lookalikes, credentials, nondefault ports, oversized strings or more than two URLs. Allowlisted hosts match the application implementation: `images.unsplash.com`, `upload.wikimedia.org`, `image.pollinations.ai`. This is a URL policy check, **not** a safety or copyright evaluation of remote image contents; no image URL is fetched.
- `article_schema_incompatible`, `review_schema_incompatible`, `article_content_short`, `article_foreign_letters`, `article_duplicate_key_vocabulary`: lightweight static checks of essential current schema and basic text constraints. A clean result **does not** certify full Zod schema compatibility, factual accuracy, CEFR validity, comprehensible-input ratios, required grammar, licensing, or educational suitability. A flagged legacy record may be historically valid yet incompatible with current requirements; human review decides disposition.

Aggregate count totals are the **number of records in the supplied fixture**, not production totals. Finding counts may overlap; they are not a count of distinct bad articles or people. The first five hash references are bounded examples for local triage, not an exhaustive index. This tool is diagnostic only; it cannot and will not auto-delete, adjust aggregates, resolve ownership, publish/unpublish, or migrate records.

## Follow-up conversion candidate preparation

If separately authorized, an operator should first identify the **correct production project**, acquire an approved read-only export/back-up through an official Firestore administrative workflow, verify its completeness and access restrictions, and convert the exported `articles` documents plus **all** corresponding `reviews` subcollection documents into the fixture format above. Decode Firestore REST typed fields/Timestamps safely, use child document IDs as `id`, and include a `reviewsComplete: true` assertion only after demonstrating full pagination, parent/child coverage, and a consistent snapshot. Native managed Firestore export is **not** itself the JSON/NDJSON schema above; a separate converter is required. Do not put project credentials, tokens or raw paths in fixture/report filenames or CLI output. Run on a protected local copy and reconcile suspicious hashes against raw records only in that restricted environment.

Once such a controlled fixture exists, [REVIEW_MIGRATION_RUNBOOK.md](./REVIEW_MIGRATION_RUNBOOK.md) documents the separate offline READY/HOLD preparation for legacy review privacy migration. That tool still performs no cloud writes and deliberately leaves uncertain ownership on HOLD. No production extraction, migration, or deletion is performed by either tool.
