// Runs each e2e spec in its own Jest process. The native `better-sqlite3`
// addon cannot be loaded twice in one process under Jest's ESM VM modules, so
// two suites sharing a process fail with "this.sqlite is not a constructor".
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const testDir = fileURLToPath(new URL('.', import.meta.url));
const extraArgs = process.argv.slice(2);
const specs = readdirSync(testDir).filter((f) => f.endsWith('.e2e-spec.ts'));

let failed = false;
for (const spec of specs) {
  const { status } = spawnSync(
    process.execPath,
    [
      '--experimental-vm-modules',
      'node_modules/jest/bin/jest.js',
      '--config',
      './test/jest-e2e.json',
      `test/${spec}`,
      ...extraArgs,
    ],
    { stdio: 'inherit' },
  );
  if (status !== 0) failed = true;
}
process.exit(failed ? 1 : 0);
