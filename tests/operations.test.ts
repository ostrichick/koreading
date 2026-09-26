import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { drillPath, validateDrillName } from '../scripts/operations.mjs';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const script = resolve(repo, 'scripts/operations.mjs');

test('only one demo-prefixed path segment is accepted', () => {
  assert.equal(validateDrillName('demo-backup-20260921'), 'demo-backup-20260921');
  for (const name of ['prod', 'production', 'demo-prod', 'demo-live', '../demo-escape', 'demo-../escape',
    'demo-foo/bar', 'demo-foo\\bar', 'C:\\demo-escape', '.', 'demo-', 'DEMO-TEST', 'demo-' + 'x'.repeat(100)]) {
    assert.throws(() => validateDrillName(name), /local directory name/);
  }
  const root = resolve(repo, '.verification/emulator-drills');
  assert.equal(drillPath(root, 'demo-safe'), resolve(root, 'demo-safe'));
  assert.throws(() => drillPath(root, '../prod'), /local directory name/);
});

test('preflight does not print credentials or read live environment files', () => {
  const secret = 'SENSITIVE-SENTINEL-DO-NOT-DISCLOSE-120389';
  const output = execFileSync(process.execPath, [script, 'preflight'], {
    cwd: repo, encoding: 'utf8', env: { ...process.env, GEMINI_API_KEY: secret },
  });
  assert.match(output, /LOCAL STATIC PREFLIGHT PASS/);
  assert.match(output, /contents NOT read/);
  assert.doesNotMatch(output, /SENSITIVE-SENTINEL/);
  assert.doesNotMatch(output, /your_gemini_api_key/);
});

test('production source, unsupported flags and real cloud host are rejected before any export', () => {
  for (const args of [
    ['prepare-backup', '--source', 'prod-real', '--target', 'demo-reject'],
    ['prepare-backup', '--source', 'demo-koreading', '--target', '../outside'],
    ['prepare-backup', '--source', 'demo-koreading', '--target', 'demo-safe', '--execute'],
    ['prepare-restore', '--source', 'demo-safe', '--target', 'demo-safe'],
    ['fixture-seed', '--port', '8080'],
  ]) {
    const result = spawnSync(process.execPath, [script, ...args], { cwd: repo, encoding: 'utf8' });
    assert.notEqual(result.status, 0, args.join(' '));
  }
  const fixture = spawnSync(process.execPath, [script, 'fixture-verify', '--port', '19081'], {
    cwd: repo, encoding: 'utf8', env: { ...process.env, FIRESTORE_EMULATOR_HOST: 'production.example.com:19081' },
  });
  assert.notEqual(fixture.status, 0);
  assert.match(fixture.stderr, /expected FIRESTORE_EMULATOR_HOST/);
});
