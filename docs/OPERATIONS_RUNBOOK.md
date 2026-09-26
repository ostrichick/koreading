# Local operations and emulator recovery rehearsal

**Scope:** This runbook operates only on the disposable Firebase Firestore emulator project `demo-koreading`. It is **not** a production backup, production restore, cloud Firestore export, or disaster-recovery guarantee. No production credentials are needed, and these commands must never be repurposed with a real Firebase project ID.

## Guardrails and prerequisites

- Run all commands from the repository root, using Node.js and a local Firebase CLI already available in the npm cache (`npx --no-install firebase-tools --version`). The project emulator requires Java 21 or newer. A missing CLI or Java runtime is a blocker; do not install or use production credentials merely to complete the rehearsal.
- The helper reads `firebase.json`, `package.json`, the **environment-variable names only** in `.env.local.example`, and whether `.env.local` exists. It never opens `.env.local` or prints variable values. It does not establish that configured credentials or deployed rules are correct.
- The backup source must be exactly `--source demo-koreading`. Backup/restore names must be one lower-case `demo-...` path segment, and files are confined to `.verification/emulator-drills/` (git-ignored). Existing names, symlinks, unsafe paths and overwrite attempts are refused. It never deletes files or overwrites exports.
- Both phases use a fresh isolated emulator configuration **and a copied public `firestore.rules` file**, because Firebase CLI rejects a rules path outside the config directory. The backup records a SHA-256 digest for its copied rules; restore reuses those saved rules. Ports are localhost **19080** (backup) and **19081** (restore), never the normal project emulator port 8080. If a port is occupied, stop and investigate instead of targeting another server. The helper's fixture endpoints additionally require the matching `FIRESTORE_EMULATOR_HOST` and hard-code `127.0.0.1` plus the `demo-koreading` project. No `.env.local` contents or real keys are copied.
- The generated commands use `emulators:exec`, `--only firestore`, `--project demo-koreading`, and explicit `--config`. They seed a known throwaway document, export it to a new local directory, then import it into a separate new emulator process and check the fixture. **Do not replace these with `firestore:export`, `firestore:import`, `gcloud`, `firebase deploy`, or a real project ID.**

## 1. Static environment preflight

```powershell
node scripts/operations.mjs preflight
node --import tsx --test tests/operations.test.ts
```

Preflight checks that the repository's emulator test command explicitly uses the demo project, `firebase.json` names the expected rules and emulator port, and required variable **names** appear in the public example. It reports whether `.env.local` exists, without reading it. A pass does not mean that a key is valid, Redis is enabled, quota accounting is globally safe, Cron has run, or deployed infrastructure matches this repository.

On the audited Windows PC, the system Java was 16, whereas the Android Studio JBR is Java 21. If the Firebase CLI refuses to start because Java is older than 21, use this **session-local** configuration before running the printed emulator command (adjust only if Java 21 is installed elsewhere):

```powershell
$env:JAVA_HOME = 'C:\Program Files\Android\Android Studio\jbr'
$env:PATH = "$env:JAVA_HOME\bin;$env:PATH"
java -version
```

## 2. Export a disposable demo fixture

Choose a **new** name, for example `demo-backup-a01`, and run:

```powershell
node scripts/operations.mjs prepare-backup --source demo-koreading --target demo-backup-a01
```

The helper creates only `.verification/emulator-drills/demo-backup-a01/` with a manifest and isolated emulator config, **not** an export yet. It prints a full `npx --no-install firebase-tools emulators:exec ... --export-on-exit ...` command. Review that the command contains `--project demo-koreading`, `--only firestore`, `--config .verification/emulator-drills/demo-backup-a01/firebase.json`, `--export-on-exit .verification/emulator-drills/demo-backup-a01/snapshot`, and `fixture-seed --port 19080`, then execute that exact printed command. The emulator runs only the known fixture, exits, and creates the snapshot. Do not supply `--force`.

```powershell
node scripts/operations.mjs verify-backup --source demo-backup-a01
```

This checks the matching demo backup manifest, Firebase export metadata and referenced Firestore payload in the new local snapshot. Metadata presence alone cannot prove a successful restore; perform step 3.

## 3. Restore into another disposable emulator, then verify

Choose a **different, unused** target name, such as `demo-restore-a01`:

```powershell
node scripts/operations.mjs prepare-restore --source demo-backup-a01 --target demo-restore-a01
```

The helper first validates the source snapshot and creates a fresh independent emulator config on port 19081. Review the printed `npx --no-install firebase-tools emulators:exec ... --import ...` command: it must contain `--project demo-koreading`, `--only firestore`, the fresh target config, the original source's `snapshot` directory, and `fixture-verify --port 19081`. Execute the printed command. A successful drill requires the command to exit **0** and output `RESTORE FIXTURE VERIFIED`; the fixture verifier only reads the imported document and checks exact expected values. It does not delete, write to, or reset any running emulator or database.

If any command fails, preserve its logs and the disposable snapshot for inspection; do not retry by overwriting a target. Use a new `demo-...` name after resolving the error. Firestore emulator permission-denied lines in independent security tests may be expected **negative-test** outcomes; this drill specifically requires successful export metadata and imported fixture equality.

## 4. Separate production release/recovery checklist — not executable here

Before any eventual production release, an authorized operator must independently determine the correct Firebase project and deployment identity, production rules currently in effect, credentials/bindings, provider quotas/charges, Vercel Cron health, data retention/legal requirements, backup mechanism, retention and restoration permissions. Arrange a real backup with the cloud provider's documented production facilities and test it in a separately authorized non-production environment. Confirm the app and Firestore rules are deployed compatibly; the private-draft UI expects public article creation to be admin-restricted. Manually verify two different real user identities, draft isolation, publication rights, review deletion and privacy wording, plus rollback criteria. Do not treat this demo fixture as proof of production backup or deployed authentication.

**Out of scope / not verified:** production Firebase data, Firestore point-in-time recovery, Storage/R2 objects, Auth users, custom indexes, real credentials, cloud backups/restores, operational billing, deployed app, proxy identity or legal compliance. The repository's current `firebase.json` configures only Firestore emulation; this drill deliberately excludes other services.
