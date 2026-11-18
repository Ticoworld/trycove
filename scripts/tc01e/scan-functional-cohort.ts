import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { ANALYZER_VERSION } from '../../lib/intelligence/footprint';

const cohortPath = 'evidence/tc-01e/gate-c-functional/frozen-cohort.json';
const sha = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
type Entry = { repositoryPath: string; productIds: string[]; revision?: string; error?: string };

async function main() {
  const cohortBytes = await readFile(cohortPath);
  const cohort = JSON.parse(cohortBytes.toString('utf8')) as { schemaVersion: string; methodology: { sha256: string }; selection: { selected: Entry[] } };
  if (cohort.schemaVersion !== 'tc-01e-functional-cohort-v1' || cohort.selection.selected.length !== 12) throw new Error('Unexpected or unfrozen functional cohort');
  const results: Array<Record<string, unknown>> = [];
  for (const selected of cohort.selection.selected) {
    const projectId = selected.productIds[0];
    const command = ['pnpm', 'exec', 'tsx', 'scripts/footprints.ts', '--project', String(projectId), '--repository-url', `https://github.com/${selected.repositoryPath}`, '--revision', String(selected.revision), '--limit', '1'];
    const startedAt = new Date().toISOString();
    if (!projectId || selected.productIds.length !== 1 || !/^[a-f0-9]{40}$/.test(selected.revision ?? '')) {
      results.push({ repositoryPath: selected.repositoryPath, productIds: selected.productIds, revision: selected.revision ?? null, command, startedAt, finishedAt: new Date().toISOString(), exitCode: null, error: selected.error ?? 'Selected repository did not receive a valid immutable pin; slot retained without replacement.' });
      continue;
    }
    try {
      const stdout = execFileSync('pnpm', command.slice(1), {
        encoding: 'utf8', timeout: 180_000, maxBuffer: 2_000_000,
        env: { ...process.env, GIT_LFS_SKIP_SMUDGE: '1', GIT_TERMINAL_PROMPT: '0' },
      });
      results.push({ repositoryPath: selected.repositoryPath, productIds: selected.productIds, revision: selected.revision, command, startedAt, finishedAt: new Date().toISOString(), exitCode: 0, stdout: stdout.slice(0, 10_000), stderr: '' });
      console.log(stdout.trim());
    } catch (error) {
      const failure = error as NodeJS.ErrnoException & { status?: number; stdout?: Buffer | string; stderr?: Buffer | string };
      const stdout = typeof failure.stdout === 'string' ? failure.stdout : failure.stdout?.toString('utf8') ?? '';
      const stderr = typeof failure.stderr === 'string' ? failure.stderr : failure.stderr?.toString('utf8') ?? '';
      results.push({ repositoryPath: selected.repositoryPath, productIds: selected.productIds, revision: selected.revision, command, startedAt, finishedAt: new Date().toISOString(), exitCode: failure.status ?? null, error: failure.message.slice(0, 500), stdout: stdout.slice(0, 10_000), stderr: stderr.slice(0, 10_000) });
      console.error(`${selected.repositoryPath}: ${failure.message.slice(0, 250)}`);
    }
  }
  const receipt = {
    schemaVersion: 'tc-01e-functional-source-scan-v1',
    cohortPath,
    cohortSha256: sha(cohortBytes),
    methodologySha256: cohort.methodology.sha256,
    analyzerVersion: ANALYZER_VERSION,
    scanner: 'scripts/footprints.ts; bounded clone and static source analysis; repository code was not executed',
    selectedCount: cohort.selection.selected.length,
    results,
  };
  const bytes = Buffer.from(`${JSON.stringify(receipt, null, 2)}\n`);
  const id = new Date().toISOString().replace(/[:.]/g, '-');
  const output = `evidence/tc-01e/gate-c-functional/source-scan-${id}.json`;
  await mkdir('evidence/tc-01e/gate-c-functional', { recursive: true });
  await writeFile(output, bytes, { flag: 'wx' });
  await writeFile(`${output}.sha256`, `${sha(bytes)}  ${output.split('/').at(-1)}\n`, { flag: 'wx' });
  const succeeded = results.filter(row => row.exitCode === 0).length;
  console.log(JSON.stringify({ output, sha256: sha(bytes), selected: results.length, succeeded, failed: results.length - succeeded, sourceRevisions: results.map(row => ({ repositoryPath: row.repositoryPath, revision: row.revision, exitCode: row.exitCode })) }, null, 2));
  process.exit(succeeded === results.length ? 0 : 1);
}

main().catch(error => { console.error(error instanceof Error ? error.stack : String(error)); process.exit(1); });
