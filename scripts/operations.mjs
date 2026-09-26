// LOCAL/EMULATOR-ONLY rehearsal. Never opens .env.local or calls a cloud endpoint.
import { existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectId = 'demo-koreading';
const repo = realpathSync(resolve(dirname(fileURLToPath(import.meta.url)), '..'));
const drillRoot = join(repo, '.verification', 'emulator-drills');
const fixture = {
  kind: { stringValue: 'koreading-local-emulator-only' },
  value: { stringValue: 'backup-restore-fixture-v1' },
};

export function validateDrillName(name) {
  if (typeof name !== 'string' || !/^demo-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name) || name.length > 64 || /prod|live|cloud|real/i.test(name)) {
    throw new Error('Use a single local directory name: demo-<lowercase-letters-numbers-hyphens> (not prod/live/cloud).');
  }
  return name;
}

export function drillPath(root, name) {
  const result = resolve(root, validateDrillName(name));
  if (dirname(result) !== resolve(root)) throw new Error('Drill paths must remain directly under emulator-drills.');
  return result;
}

function existingDirectoryWithoutSymlink(folder, create = false) {
  if (!existsSync(folder) && create) mkdirSync(folder);
  if (!existsSync(folder)) throw new Error(`Missing local drill directory: ${relative(repo, folder)}`);
  const info = lstatSync(folder);
  if (info.isSymbolicLink() || !info.isDirectory()) throw new Error('Drill directories must be real local directories, not links.');
}

function ensureDrillRoot(create = false) {
  existingDirectoryWithoutSymlink(join(repo, '.verification'), create);
  existingDirectoryWithoutSymlink(drillRoot, create);
}

function assertFreshTarget(name) {
  const target = drillPath(drillRoot, name);
  if (existsSync(target)) throw new Error(`Refusing to overwrite existing target: ${relative(repo, target)}`);
  return target;
}

function staticConfigCheck() {
  const config = JSON.parse(readFileSync(join(repo, 'firebase.json'), 'utf8'));
  const pkg = JSON.parse(readFileSync(join(repo, 'package.json'), 'utf8'));
  if (config.firestore?.rules !== 'firestore.rules' || !existsSync(join(repo, 'firestore.rules')) || config.emulators?.firestore?.port !== 8080) {
    throw new Error('Unexpected Firebase local rules/emulator configuration. Stop and inspect firebase.json.');
  }
  if (!pkg.scripts?.['test:emulators']?.includes('--project demo-koreading') || !pkg.scripts?.['test:emulators']?.includes('--only firestore')) {
    throw new Error('Emulator test command must explicitly select demo-koreading and firestore only.');
  }
  return true;
}

function preflight() {
  staticConfigCheck();
  // Only parse LEFT-HAND variable names from the public template; never open .env.local.
  const names = readFileSync(join(repo, '.env.local.example'), 'utf8')
    .split(/\r?\n/).map(line => /^\s*([A-Z][A-Z0-9_]*)\s*=/.exec(line)?.[1]).filter(Boolean);
  const expected = ['NEXT_PUBLIC_FIREBASE_PROJECT_ID', 'GEMINI_API_KEY', 'CRON_SECRET',
    'UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN', 'AI_DAILY_REQUEST_LIMIT'];
  const missingNames = expected.filter(name => !names.includes(name));
  if (missingNames.length) throw new Error(`Template missing variable names: ${missingNames.join(', ')}`);
  const observed = expected.map(name => `${name}: ${Object.hasOwn(process.env, name) ? 'process-present' : 'process-absent'}`);
  console.log('LOCAL STATIC PREFLIGHT PASS: firebase.json rules/emulator port and demo-only test script.');
  console.log(`.env.local: ${existsSync(join(repo, '.env.local')) ? 'file exists (contents NOT read)' : 'file absent (contents NOT read)'}`);
  console.log(`Template variable names present: ${expected.join(', ')}`);
  console.log(`Process variable names only (NOT values): ${observed.join('; ')}`);
  console.log('NOT CHECKED: credential validity, deployed rules, cloud project, data, billing, production recovery.');
}

function rulesChecksum(value) {
  return createHash('sha256').update(value).digest('hex');
}

function writeIsolatedConfig(target, port, kind, rulesSource = join(repo, 'firestore.rules')) {
  // Firebase treats the directory containing --config as its project root and
  // rejects rules outside that directory. Copy only public rules, never env files.
  const rules = readFileSync(rulesSource);
  writeFileSync(join(target, 'firestore.rules'), rules, { flag: 'wx' });
  const config = {
    firestore: { rules: 'firestore.rules' },
    emulators: { firestore: { host: '127.0.0.1', port }, ui: { enabled: false } },
  };
  writeFileSync(join(target, 'firebase.json'), JSON.stringify(config, null, 2) + '\n', { flag: 'wx' });
  writeFileSync(join(target, 'operations.json'), JSON.stringify({ kind, projectId, port, rulesSha256: rulesChecksum(rules) }, null, 2) + '\n', { flag: 'wx' });
}

function relativePath(name, tail) {
  return ['.verification', 'emulator-drills', name, tail].join('/');
}

function prepareBackup(source, targetName) {
  if (source !== projectId) throw new Error('Source MUST be explicitly --source demo-koreading. Production IDs are forbidden.');
  staticConfigCheck();
  ensureDrillRoot(true);
  const target = assertFreshTarget(targetName);
  mkdirSync(target);
  writeIsolatedConfig(target, 19080, 'backup');
  const snapshot = relativePath(targetName, 'snapshot');
  console.log(`LOCAL BACKUP PLAN READY: ${relative(repo, target)}`);
  console.log('Run ONLY this isolated emulator command from the repository root (no cloud credentials needed):');
  console.log(`npx --no-install firebase-tools emulators:exec --project ${projectId} --only firestore --config ${relativePath(targetName, 'firebase.json')} --export-on-exit ${snapshot} "node scripts/operations.mjs fixture-seed --port 19080"`);
  console.log(`Then verify: node scripts/operations.mjs verify-backup --source ${targetName}`);
}

function validateBackup(name) {
  ensureDrillRoot();
  const source = drillPath(drillRoot, name);
  existingDirectoryWithoutSymlink(source);
  const marker = JSON.parse(readFileSync(join(source, 'operations.json'), 'utf8'));
  if (marker.kind !== 'backup' || marker.projectId !== projectId || marker.port !== 19080) throw new Error('Backup marker is not a matching local-only fixture.');
  const rulesFile = join(source, 'firestore.rules');
  if (!existsSync(rulesFile) || lstatSync(rulesFile).isSymbolicLink() || rulesChecksum(readFileSync(rulesFile)) !== marker.rulesSha256) {
    throw new Error('Saved demo Firestore rules missing or changed since fixture creation.');
  }
  const snapshot = join(source, 'snapshot');
  existingDirectoryWithoutSymlink(snapshot);
  const metadataFile = join(snapshot, 'firebase-export-metadata.json');
  if (!existsSync(metadataFile) || !lstatSync(metadataFile).isFile() || lstatSync(metadataFile).isSymbolicLink()) {
    throw new Error('Firebase emulator export metadata missing or not a regular file.');
  }
  const metadata = JSON.parse(readFileSync(metadataFile, 'utf8'));
  if (!metadata.firestore?.path || typeof metadata.firestore.path !== 'string') throw new Error('Export has no Firestore entry.');
  const exportPath = resolve(snapshot, metadata.firestore.path);
  if (exportPath !== snapshot && !exportPath.startsWith(snapshot + sep)) throw new Error('Export metadata path escapes snapshot directory.');
  if (!existsSync(exportPath) || !lstatSync(exportPath).isFile() || lstatSync(exportPath).isSymbolicLink()) {
    throw new Error('Firestore export payload not found, not a regular file, or linked.');
  }
  const resolvedPayload = realpathSync(exportPath);
  const resolvedSnapshot = realpathSync(snapshot);
  if (!resolvedPayload.startsWith(resolvedSnapshot + sep)) throw new Error('Firestore export payload resolves outside demo snapshot.');
  console.log(`LOCAL SNAPSHOT VERIFIED: ${relative(repo, snapshot)} (metadata + Firestore payload exist; fixture content is checked during restore).`);
  return snapshot;
}

function prepareRestore(sourceName, targetName) {
  if (sourceName === targetName) throw new Error('Restore target MUST differ from backup source.');
  staticConfigCheck();
  validateBackup(sourceName);
  const target = assertFreshTarget(targetName);
  mkdirSync(target);
  writeIsolatedConfig(target, 19081, 'restore-verification', join(drillRoot, sourceName, 'firestore.rules'));
  console.log(`LOCAL RESTORE PLAN READY: ${relative(repo, target)}`);
  console.log('Run ONLY this isolated emulator import command from the repository root:');
  console.log(`npx --no-install firebase-tools emulators:exec --project ${projectId} --only firestore --config ${relativePath(targetName, 'firebase.json')} --import ${relativePath(sourceName, 'snapshot')} "node scripts/operations.mjs fixture-verify --port 19081"`);
  console.log('PASS requires the imported fixture to match; restore never targets a cloud database.');
}

async function fixtureRequest(action, port) {
  if (!['fixture-seed', 'fixture-verify'].includes(action) || ![19080, 19081].includes(port) ||
      (action === 'fixture-seed' && port !== 19080) || (action === 'fixture-verify' && port !== 19081)) {
    throw new Error('Fixture commands require the designated isolated emulator port.');
  }
  const host = process.env.FIRESTORE_EMULATOR_HOST || '';
  if (!new RegExp(`^(localhost|127\\.0\\.0\\.1):${port}$`).test(host)) {
    throw new Error('Missing expected FIRESTORE_EMULATOR_HOST for isolated localhost emulator; refusing request.');
  }
  // Security rules correctly deny anonymous access to arbitrary fixture docs.
  // The rules-unit-testing SDK bypasses rules ONLY against the explicit local
  // emulator host/port; it neither loads production credentials nor writes cloud.
  const [{ initializeTestEnvironment }, { doc, getDoc, setDoc }] = await Promise.all([
    import('@firebase/rules-unit-testing'), import('firebase/firestore'),
  ]);
  const env = await initializeTestEnvironment({ projectId, firestore: { host: '127.0.0.1', port } });
  try {
    await env.withSecurityRulesDisabled(async context => {
      const db = context.firestore();
      const document = doc(db, 'operationsDrill', 'fixture');
      if (action === 'fixture-seed') {
        const before = await getDoc(document);
        if (before.exists()) throw new Error('Refusing to seed an existing emulator fixture.');
        await setDoc(document, { kind: fixture.kind.stringValue, value: fixture.value.stringValue });
      }
      const after = await getDoc(document);
      if (!after.exists() || after.data().kind !== fixture.kind.stringValue || after.data().value !== fixture.value.stringValue) {
        throw new Error('Local fixture does not match original content.');
      }
    });
    console.log(`${action === 'fixture-seed' ? 'SEED' : 'RESTORE'} FIXTURE VERIFIED: ${projectId}, localhost:${port}.`);
  } finally {
    await env.cleanup();
  }
}

function main() {
  if (realpathSync(process.cwd()) !== repo) throw new Error('Run from the project repository root only.');
  const [command, ...rest] = process.argv.slice(2);
  const allowed = {
    preflight: [], 'prepare-backup': ['source', 'target'], 'verify-backup': ['source'],
    'prepare-restore': ['source', 'target'], 'fixture-seed': ['port'], 'fixture-verify': ['port'],
  };
  if (!Object.hasOwn(allowed, command)) throw new Error('Commands: preflight | prepare-backup --source demo-koreading --target demo-name | verify-backup --source demo-name | prepare-restore --source demo-name --target demo-new-name');
  const options = {};
  for (let i = 0; i < rest.length; i += 2) {
    const key = rest[i]?.match(/^--([a-z]+)$/)?.[1];
    if (!key || !allowed[command].includes(key) || options[key] !== undefined || !rest[i + 1] || rest[i + 1].startsWith('--')) throw new Error('Invalid, unknown, duplicate or missing flag.');
    options[key] = rest[i + 1];
  }
  if (Object.keys(options).length !== allowed[command].length) throw new Error('All command flags must be supplied explicitly.');
  if (command === 'preflight') return preflight();
  if (command === 'prepare-backup') return prepareBackup(options.source, options.target);
  if (command === 'verify-backup') return validateBackup(options.source);
  if (command === 'prepare-restore') return prepareRestore(options.source, options.target);
  return fixtureRequest(command, Number(options.port));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  Promise.resolve().then(main).catch(error => {
    console.error(`LOCAL OPERATIONS STOPPED: ${error instanceof Error ? error.message : 'Unknown error'}`);
    process.exitCode = 1;
  });
}
