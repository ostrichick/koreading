# Review privacy migration - offline candidate preparation

This procedure prepares a **local, non-executable candidate** for moving legacy public reviews away from UID-keyed document paths. It does not connect to Firebase, Auth, Vercel, or any network service and never modifies the source fixture.

## Why this exists

The legacy review layout used a user's UID as `articles/{articleId}/reviews/{uid}` and also stored `userId` in the publicly readable review. The new application model uses an opaque public review ID and a private owner mapping under the user's own data. Existing records must not be reassigned by display name or other guesses.

## Input

Use the same deliberately prepared JSON/NDJSON fixture shape documented in [DATA_AUDIT_RUNBOOK.md](./DATA_AUDIT_RUNBOOK.md). Obtain that fixture only through a separately authorized, read-only export process.

Run a dry preparation first:

```powershell
node scripts/prepare-review-migration.mjs --input ./fixtures/legacy.json
```

This prints counts only. It does not emit UIDs, review text, article IDs, or a candidate file.

To write a candidate:

```powershell
node scripts/prepare-review-migration.mjs --input ./fixtures/legacy.json --output ./reports/review-migration-candidate.json
```

The destination must be a new `.json` file inside the current working directory. Existing files, symlinks, repository internals such as `.git`/`.next`/`node_modules`, and paths outside the working directory are refused.

## READY versus HOLD

A review is **READY** only when all of the following are true:

- its article ID is present in the supplied fixture and matches the application's bounded ID format;
- the review data matches the current basic rating/comment/display-name shape;
- a non-empty `userId` exists;
- the review document ID is exactly equal to that `userId`;
- no second READY record would create another owner mapping for the same user and article.

READY creates a candidate with:

- the original article/review reference needed for a later privileged migration;
- a fresh opaque UUID for the future public review document;
- public review data with `userId` removed and the non-sensitive `schemaVersion: 2` marker added so runtime code can never confuse a new mapped review with a legacy UID-keyed review;
- a private ownership instruction containing `uid`, `articleId`, and the new opaque `reviewId`. A later privileged migration would write only `{ reviewId }` to `users/{uid}/reviewOwnership/{articleId}`; the UID and article ID are path components, not fields in the private mapping document.

The tool also inspects an article's legacy public `lastReviewUid`. It prepares `lastReviewUid` removal plus a replacement opaque `lastReviewId` **only** when that UID points to a READY review in the same article. A missing, invalid, conflicting, or non-READY target leaves the article marker on HOLD rather than guessing which review should replace it.

Missing `userId`, conflicting document ID versus `userId`, missing article context, unexpected/unknown review fields, incompatible review data, and duplicate owner/article pairs are **HOLD**. Unknown fields are not copied forward because they could contain an old identifier. HOLD output contains only a shortened SHA-256 correlation reference and a reason; ownership is never inferred from `userDisplayName`.

## Handling the candidate

The candidate file is **sensitive** because READY operations contain raw UIDs and source document references needed for a future controlled migration. Store it with the same protections as the source export. Do not commit it, attach it to issues, upload it to analytics, or publish it. The command-line summary intentionally contains counts only.

This tool does not prove that the source export is complete or current. It does not recalculate article ratings, write `reviewOwnership`, modify `lastReviewUid`, delete UID-keyed reviews, or resolve HOLD records. A future production migration requires a verified backup, a stable app/rules version that understands the new review model, privileged credentials, rollback criteria, and an independently reviewed execution plan.
