import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { asc, eq } from 'drizzle-orm';
import { db } from '../../lib/db';
import { externalSourceSnapshots, sourceRecords, technicalFootprints } from '../../lib/schema';
import { repositoryUrl } from '../../lib/sources/ckbdapps-json';

const output = 'evidence/tc-01e/gate-c-functional/frozen-cohort.json';
const methodologyPath = 'evidence/tc-01e/gate-c-functional/discovery-methodology.md';
const limit = 12;
const sha = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');

type Claim = {
  projectId: string;
  name: string;
  repositoryPath: string;
  feedRevision: string;
  sourceRecordObservedAt: string;
  sourceRecordSha256: string;
};

function pin(repositoryPath: string) {
  try {
    const result = execFileSync('git', ['ls-remote', `https://github.com/${repositoryPath}.git`, 'HEAD'], {
      encoding: 'utf8', timeout: 20_000, stdio: ['ignore', 'pipe', 'ignore'],
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
    }).trim();
    const revision = result.split(/\s+/)[0] ?? '';
    return /^[a-f0-9]{40}$/.test(revision) ? { revision } : { error: 'Git remote returned no full HEAD revision' };
  } catch (error) {
    return { error: error instanceof Error ? error.message.slice(0, 250) : String(error).slice(0, 250) };
  }
}

async function main() {
  if (!existsSync(methodologyPath)) throw new Error(`Frozen methodology missing: ${methodologyPath}`);
  if (process.argv.includes('--verify')) {
    if (!existsSync(output) || !existsSync(`${output}.sha256`)) throw new Error(`Frozen cohort or digest is missing: ${output}`);
    const bytes = await readFile(output);
    const sidecar = (await readFile(`${output}.sha256`, 'utf8')).trim();
    const cohort = JSON.parse(bytes.toString('utf8')) as { schemaVersion: string; baselineCommit: string; methodology: { sha256: string }; selection: { limit: number; selected: Array<{ repositoryPath: string; selectionDigest: string; revision?: string }> } };
    if (sidecar !== `${sha(bytes)}  frozen-cohort.json` || cohort.schemaVersion !== 'tc-01e-functional-cohort-v1' || cohort.baselineCommit !== '533422e84b652ec73c70c16c4b3bf7bfeba8f952' || cohort.methodology.sha256 !== sha(await readFile(methodologyPath)) || cohort.selection.selected.length !== limit || cohort.selection.selected.some(row => row.selectionDigest !== sha(row.repositoryPath) || !/^[a-f0-9]{40}$/.test(row.revision ?? ''))) throw new Error('Frozen functional cohort integrity or identity checks failed');
    console.log(JSON.stringify({ verified: output, sha256: sha(bytes), selected: cohort.selection.selected.length, methodologySha256: cohort.methodology.sha256 }, null, 2));
    return;
  }
  if (existsSync(output)) throw new Error(`Refusing to replace frozen cohort ${output}; use --verify`);
  const methodologyBytes = await readFile(methodologyPath);
  const [records, footprints, pulseRows] = await Promise.all([
    db.select().from(sourceRecords).where(eq(sourceRecords.source, 'CKBdapps JSON')).orderBy(asc(sourceRecords.projectId), asc(sourceRecords.observedAt)),
    db.select().from(technicalFootprints),
    db.select().from(externalSourceSnapshots).where(eq(externalSourceSnapshots.source, 'ckb-pulse-state')).orderBy(asc(externalSourceSnapshots.checkedAt)),
  ]);

  const claimsByRepository = new Map<string, Claim[]>();
  for (const source of records) {
    try {
      const raw = JSON.parse(source.raw) as { record?: { github?: unknown; name?: unknown } };
      const url = repositoryUrl(raw.record?.github);
      if (!url) continue;
      const repositoryPath = new URL(url).pathname.split('/').filter(Boolean).join('/').toLowerCase();
      const rows = claimsByRepository.get(repositoryPath) ?? [];
      rows.push({
        projectId: source.projectId,
        name: typeof raw.record?.name === 'string' ? raw.record.name : source.projectId,
        repositoryPath,
        feedRevision: source.revision,
        sourceRecordObservedAt: source.observedAt.toISOString(),
        sourceRecordSha256: sha(source.raw),
      });
      claimsByRepository.set(repositoryPath, rows);
    } catch { /* Invalid source records are retained in the inventory counts, not promoted to repository claims. */ }
  }

  const scanned = new Set(footprints.map(row => row.repository.toLowerCase()));
  const candidates = [...claimsByRepository.entries()].map(([repositoryPath, claims]) => {
    const productIds = [...new Set(claims.map(claim => claim.projectId))].sort();
    return {
      repositoryPath,
      productIds,
      productNames: [...new Set(claims.map(claim => claim.name))].sort(),
      sourceClaims: claims.sort((a, b) => a.projectId.localeCompare(b.projectId) || a.sourceRecordSha256.localeCompare(b.sourceRecordSha256)),
      selectionDigest: sha(repositoryPath),
      alreadyPinned: scanned.has(`https://github.com/${repositoryPath}`),
      ambiguousIdentity: productIds.length !== 1,
    };
  });
  const eligible = candidates.filter(row => !row.alreadyPinned && !row.ambiguousIdentity)
    .sort((a, b) => a.selectionDigest.localeCompare(b.selectionDigest) || a.repositoryPath.localeCompare(b.repositoryPath));
  if (eligible.length < limit) throw new Error(`Frozen rules produce ${eligible.length} eligible repositories, fewer than ${limit}; cohort was not written.`);

  const pulse = pulseRows.filter(row => row.status === 'ok' || row.status === 'not_modified').at(-1);
  const selected = eligible.slice(0, limit).map(row => ({ ...row, ...pin(row.repositoryPath) }));
  const pinned = selected.filter(row => typeof row.revision === 'string' && /^[a-f0-9]{40}$/.test(row.revision));
  const pinFailures = selected.filter(row => typeof row.revision !== 'string' || !/^[a-f0-9]{40}$/.test(row.revision));
  const sourceRecordDigests = records.map(row => `${row.projectId}\0${row.sourceUrl}\0${row.revision}\0${sha(row.raw)}`).sort();
  const cohort = {
    schemaVersion: 'tc-01e-functional-cohort-v1',
    baselineCommit: '533422e84b652ec73c70c16c4b3bf7bfeba8f952',
    implementationBaseline: '511e2a820bbb9b755a8762357c36d6450e648ef2',
    frozenAt: new Date().toISOString(),
    methodology: { path: methodologyPath, sha256: sha(methodologyBytes) },
    inventory: {
      ckbDappsRecords: records.length,
      ckbDappsRecordSetSha256: sha(sourceRecordDigests.join('\n')),
      sourceUrl: 'https://ckbdapps.com/projects.json',
      feedRevision: records.at(-1)?.revision ?? null,
      latestPulseSnapshot: pulse ? { revision: pulse.sourceRevision, contentSha256: pulse.contentSha256, checkedAt: pulse.checkedAt.toISOString() } : null,
      existingPinnedFootprints: footprints.length,
    },
    selection: {
      algorithm: 'Normalize imported CKBdapps repository claims to lowercase owner/repository; exclude any path already present in a pinned footprint and any path claimed by more than one product identity; sort by SHA-256(lowercase owner/repository), then path; select the first 12. Pin exactly those 12 with git ls-remote HEAD. No source content or pair evidence is read during selection.',
      limit,
      eligibleCount: eligible.length,
      excludedAlreadyPinnedCount: candidates.filter(row => row.alreadyPinned).length,
      excludedAmbiguousCount: candidates.filter(row => row.ambiguousIdentity).length,
      allClaims: candidates.map(({ sourceClaims, ...row }) => ({ ...row, claims: sourceClaims })),
      eligible: eligible.map(({ sourceClaims, ...row }) => ({ ...row, claims: sourceClaims })),
      selected: selected.map(({ sourceClaims, ...row }) => ({ ...row, claims: sourceClaims })),
      pinFailures,
    },
  };
  await mkdir('evidence/tc-01e/gate-c-functional', { recursive: true });
  const bytes = Buffer.from(`${JSON.stringify(cohort, null, 2)}\n`);
  await writeFile(output, bytes, { flag: 'wx' });
  await writeFile(`${output}.sha256`, `${sha(bytes)}  frozen-cohort.json\n`, { flag: 'wx' });
  console.log(JSON.stringify({ output, sha256: sha(bytes), eligible: eligible.length, selected: pinned.map(row => ({ repositoryPath: row.repositoryPath, productId: row.productIds[0], revision: row.revision })), pinFailures }, null, 2));
}

main().catch(error => { console.error(error instanceof Error ? error.message : String(error)); process.exit(1); });
