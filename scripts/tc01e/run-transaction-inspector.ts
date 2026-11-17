import { createHash, randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { chmod, lstat, mkdir, mkdtemp, readFile, readdir, realpath, rm, writeFile } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { build } from 'esbuild';
import { eq } from 'drizzle-orm';
import { db } from '../../lib/db';
import { trialEvidenceRecords, trialRuns } from '../../lib/schema';

type PinnedSource = { repository: string; revision: string; sourceFiles: Array<{ path: string; sha256: string; purpose: string }> };
type Profile = {
  schemaVersion: string;
  capability: string;
  discoveryCandidateId: string;
  adapterSha256: string;
  fixtureSha256: string;
  consumer: PinnedSource & { licenseMetadataAtReview: string | null; licenseMetadataCheckedAt: string };
  provider: PinnedSource & { licenseMetadataAtReview: string | null; licenseMetadataCheckedAt: string; publicOrigin: string };
  licenseAndReuseBoundary: string;
  networkBoundary: string;
  runtime: { nodeImage: string; esbuild: string };
};
type Discovery = { frozenCohort?: { path: string; sha256: string }; sourceScan?: { path: string; sha256: string }; discovery?: { selectedCandidateId?: string; candidates?: Array<{ id: string; consumer: { repository: string; revision: string }; provider: { repository: string; revision: string } }> } };
type ProcessResult = { exitCode: number | null; signal: NodeJS.Signals | null; timedOut: boolean; truncated: boolean; stdout: Buffer; stderr: Buffer };

const profilePath = 'experiments/tc01e/transaction-inspector/profile.json';
const discoveryPath = 'evidence/tc-01e/discovery/source-discovery-2026-11-17T21-23-46-568Z.json';
const receiptBase = 'tc01e-grid3-ckb-viz-transaction-inspector';
const hash = (data: Buffer | string) => createHash('sha256').update(data).digest('hex');
const nodeImage = 'node:24-alpine@sha256:116b800c3754b440ee0aa3ed2f20f5bf3d99a554bfd9adeea09ea8017f6e85f5';
const maxLogBytes = 32_768;

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function checkedRepo(input: string, source: PinnedSource) {
  const root = resolve(input);
  const stat = await lstat(root);
  assert(stat.isDirectory() && !stat.isSymbolicLink(), `Source root is not a directory: ${root}`);
  const git = await run('git', ['-C', root, 'rev-parse', 'HEAD']);
  assert(git.exitCode === 0 && git.stdout.toString('utf8').trim() === source.revision, `Source revision mismatch for ${source.repository}`);
  const origin = await run('git', ['-C', root, 'remote', 'get-url', 'origin']);
  const expected = new URL(source.repository);
  const actual = new URL(origin.stdout.toString('utf8').trim());
  assert(origin.exitCode === 0 && actual.hostname === expected.hostname && actual.pathname.replace(/\.git$/, '').toLowerCase() === expected.pathname.toLowerCase(), `Unexpected source identity for ${source.repository}`);
  const status = await run('git', ['-C', root, 'status', '--porcelain=v1', '--untracked-files=all']);
  assert(status.exitCode === 0 && !status.stdout.toString('utf8').trim(), `Pinned source checkout is modified: ${source.repository}`);
  for (const file of source.sourceFiles) {
    const path = join(root, file.path);
    const fileStat = await lstat(path);
    assert(fileStat.isFile() && !fileStat.isSymbolicLink(), `Pinned source is not a regular file: ${file.path}`);
    assert(hash(await readFile(path)) === file.sha256, `Pinned source hash mismatch: ${file.path}`);
  }
  const top = await readdir(root);
  const licenseFiles = top.filter(name => /^(license|copying|copyright)(\.|$)/i.test(name));
  assert(!licenseFiles.length, `Review license status before execution; unexpected license files: ${licenseFiles.join(', ')}`);
  return root;
}

async function run(command: string, args: string[], options: { cwd?: string; env?: NodeJS.ProcessEnv; timeoutMs?: number; captureLimit?: number } = {}): Promise<ProcessResult> {
  const limit = options.captureLimit ?? maxLogBytes;
  return new Promise((resolvePromise, reject) => {
    let ended = false;
    let timedOut = false;
    let truncated = false;
    let outBytes = 0;
    let errBytes = 0;
    const out: Buffer[] = [];
    const err: Buffer[] = [];
    const child = spawn(command, args, { cwd: options.cwd, env: options.env, stdio: ['ignore', 'pipe', 'pipe'] });
    const timer = setTimeout(() => { timedOut = true; child.kill('SIGKILL'); }, options.timeoutMs ?? 30_000);
    const collect = (target: Buffer[], chunk: Buffer, type: 'stdout' | 'stderr') => {
      const bytes = type === 'stdout' ? outBytes : errBytes;
      const remaining = Math.max(0, limit - bytes);
      if (remaining) target.push(chunk.subarray(0, remaining));
      if (type === 'stdout') outBytes += chunk.length; else errBytes += chunk.length;
      if (chunk.length > remaining) { truncated = true; child.kill('SIGKILL'); }
    };
    child.stdout.on('data', (chunk: Buffer) => collect(out, chunk, 'stdout'));
    child.stderr.on('data', (chunk: Buffer) => collect(err, chunk, 'stderr'));
    child.once('error', error => { if (ended) return; ended = true; clearTimeout(timer); reject(error); });
    child.once('close', (exitCode, signal) => {
      if (ended) return;
      ended = true;
      clearTimeout(timer);
      resolvePromise({ exitCode, signal, timedOut, truncated, stdout: Buffer.concat(out), stderr: Buffer.concat(err) });
    });
  });
}

async function main() {
  const sourceBase = argument('--source-root');
  if (!sourceBase) throw new Error('Usage: pnpm tc01e:run:transaction-inspector -- --source-root /path/to/pinned-checkouts');
  const profileBytes = await readFile(profilePath);
  const profile = JSON.parse(profileBytes.toString('utf8')) as Profile;
  assert(profile.schemaVersion === 'tc01e-trusted-upstream-profile-v1' && profile.runtime.nodeImage === nodeImage, 'Unrecognized fixed execution profile');
  assert(profile.consumer.licenseMetadataAtReview === null && profile.provider.licenseMetadataAtReview === null, 'License review changed; re-review before execution');
  assert(profile.provider.publicOrigin === 'https://ckb-viz.truthixify.dev', 'Unexpected provider origin');
  assert(profile.licenseAndReuseBoundary.includes('Do not copy, modify or redistribute'), 'Missing source reuse limitation');
  assert(profile.networkBoundary.includes('No public RPC calls'), 'Missing network boundary');

  const discoveryBytes = await readFile(discoveryPath);
  const discoveryDigest = (await readFile(`${discoveryPath}.sha256`, 'utf8')).trim().split(/\s+/)[0];
  assert(hash(discoveryBytes) === discoveryDigest, 'Discovery output digest does not match its evidence sidecar');
  const discovery = JSON.parse(discoveryBytes.toString('utf8')) as Discovery;
  const candidate = discovery.discovery?.candidates?.find(item => item.id === profile.discoveryCandidateId);
  assert(discovery.discovery?.selectedCandidateId === profile.discoveryCandidateId && candidate, 'Fixed profile does not correspond to an engine-selected discovery candidate');
  assert(candidate.consumer.repository === profile.consumer.repository && candidate.consumer.revision === profile.consumer.revision, 'Consumer source does not match discovered candidate');
  assert(candidate.provider.repository === profile.provider.repository && candidate.provider.revision === profile.provider.revision, 'Provider source does not match discovered candidate');
  assert(discovery.frozenCohort && discovery.sourceScan, 'Discovery report omits its frozen input references');
  assert(hash(await readFile(discovery.frozenCohort.path)) === discovery.frozenCohort.sha256, 'Frozen cohort digest mismatch');
  assert(hash(await readFile(discovery.sourceScan.path)) === discovery.sourceScan.sha256, 'Source scan digest mismatch');

  const consumerRoot = await checkedRepo(join(sourceBase, 'grid3'), profile.consumer);
  const providerRoot = await checkedRepo(join(sourceBase, 'ckb-viz'), profile.provider);
  const consumerConstants = await readFile(join(consumerRoot, 'client/src/lib/constants.ts'), 'utf8');
  const consumerNetwork = await readFile(join(consumerRoot, 'client/src/providers/CKBProvider.tsx'), 'utf8');
  const consumerPage = await readFile(join(consumerRoot, 'client/src/app/game/[id]/page.tsx'), 'utf8');
  const consumerActions = await readFile(join(consumerRoot, 'client/src/hooks/useGameActions.ts'), 'utf8');
  const providerUrls = await readFile(join(providerRoot, 'src/app/url.ts'), 'utf8');
  const providerTypes = await readFile(join(providerRoot, 'src/domain/types.ts'), 'utf8');
  const providerReadme = await readFile(join(providerRoot, 'README.md'), 'utf8');
  assert(consumerConstants.includes('CKB_EXPLORER_URL') && consumerConstants.includes('SCRIPT_CELL_DEP'), 'Grid3 source contract changed');
  assert(consumerNetwork.includes('network: "nervos_testnet"'), 'Grid3 testnet signer configuration no longer matches the frozen profile');
  assert(consumerPage.includes('CKB_EXPLORER_URL}/transaction/${claimTxHash}') && consumerActions.includes('signer.sendTransaction(tx)'), 'Grid3 transaction-to-explorer flow no longer matches the frozen profile');
  assert(providerUrls.includes('export function buildUrl') && providerUrls.includes('export function parseLocation') && providerTypes.includes("'mainnet' | 'testnet'"), 'CKB Viz URL or network interface changed');
  assert(providerReadme.includes(profile.provider.publicOrigin), 'CKB Viz deployment origin is no longer present in its pinned README claim');
  const esbuildPackage = JSON.parse(await readFile('node_modules/esbuild/package.json', 'utf8')) as { version?: unknown };
  assert(esbuildPackage.version === profile.runtime.esbuild, 'Installed esbuild does not match the pinned profile');
  const workspace = await realpath(process.cwd());
  const stageRoot = join(workspace, '.data/tc01e-staging');
  await mkdir(stageRoot, { recursive: true, mode: 0o700 });
  const stageRootStat = await lstat(stageRoot);
  const stageRelative = relative(workspace, await realpath(stageRoot));
  assert(stageRootStat.isDirectory() && !stageRootStat.isSymbolicLink() && !stageRelative.startsWith('..') && !isAbsolute(stageRelative), 'Execution staging directory must remain inside the workspace and cannot be a symlink');
  const stage = await mkdtemp(join(stageRoot, 'run-'));
  const dockerConfig = join(stage, 'docker-config');
  const inputDir = join(stage, 'input');
  const workEnv: NodeJS.ProcessEnv = { PATH: process.env.PATH, DOCKER_CONFIG: dockerConfig, GIT_CONFIG_GLOBAL: '/dev/null', NODE_ENV: 'production' };
  const containerName = `trycove-tc01e-${randomUUID()}`;
  const startedAt = new Date().toISOString();
  const receiptId = `${receiptBase}-${startedAt.replace(/[:.]/g, '-').toLowerCase()}`;
  let result: ProcessResult | null = null;
  let bundleSha256 = '';
  let adapterSha256 = '';
  let fixtureSha256 = '';
  const testedCases = [
    'positive: Grid3 source constants provide the existing explorer origin and a pinned CKB CellDep transaction-hash fixture; Trycove adapter calls the actual CKB Viz URL builder; actual CKB Viz parser returns the same hash and testnet network',
    'negative: malformed hash rejected by the adapter',
    'negative: unsupported devnet rejected by the adapter',
    'negative: route that changes the validated hash or network rejected by the adapter',
    'negative: actual CKB Viz parser ignores a malformed transaction route',
  ];
  try {
    await mkdir(dockerConfig, { mode: 0o700 });
    await mkdir(inputDir, { mode: 0o755 });
    const adapterPath = resolve('experiments/tc01e/transaction-inspector/adapter.ts');
    const adapterBytes = await readFile(adapterPath);
    adapterSha256 = hash(adapterBytes);
    assert(adapterSha256 === profile.adapterSha256, 'Adapter source hash does not match the reviewed execution profile');
    const fixtureBytes = await readFile('fixtures/tc01e/grid3-contract-dependency.json');
    fixtureSha256 = hash(fixtureBytes);
    assert(fixtureSha256 === profile.fixtureSha256, 'Fixture hash does not match the reviewed execution profile');
    const entry = `
      import { CKB_EXPLORER_URL, SCRIPT_CELL_DEP } from ${JSON.stringify(join(consumerRoot, 'client/src/lib/constants.ts'))};
      import { buildUrl, parseLocation } from ${JSON.stringify(join(providerRoot, 'src/app/url.ts'))};
      import { isValidTxHash } from ${JSON.stringify(join(providerRoot, 'src/domain/units.ts'))};
      import { buildTransactionInspectorHref } from ${JSON.stringify(adapterPath)};
      const hash = SCRIPT_CELL_DEP.outPoint.txHash;
      const legacyConsumerHref = new URL('/transaction/' + hash, CKB_EXPLORER_URL).href;
      const href = buildTransactionInspectorHref({ hash, network: 'testnet', providerOrigin: ${JSON.stringify(profile.provider.publicOrigin)}, providerNetworks: ['mainnet', 'testnet'] }, { isValidTxHash, buildUrl: (network, txHash) => buildUrl(network, txHash) });
      (globalThis as typeof globalThis & { window: { location: { href: string } } }).window = { location: { href } };
      const parsed = parseLocation();
      const errors: string[] = [];
      if (!legacyConsumerHref.startsWith(CKB_EXPLORER_URL + '/transaction/')) errors.push('consumer legacy explorer link not preserved');
      if (href !== ${JSON.stringify(profile.provider.publicOrigin)} + '/tx/' + hash + '?network=testnet') errors.push('provider builder output mismatch');
      if (parsed.path[0] !== hash || parsed.network !== 'testnet') errors.push('provider parser did not preserve hash/network');
      for (const input of [
        { hash: '0x1234', network: 'testnet', providerOrigin: ${JSON.stringify(profile.provider.publicOrigin)}, providerNetworks: ['testnet'] },
        { hash, network: 'devnet', providerOrigin: ${JSON.stringify(profile.provider.publicOrigin)}, providerNetworks: ['testnet'] },
      ]) { try { buildTransactionInspectorHref(input as never, { isValidTxHash, buildUrl: (network, txHash) => buildUrl(network, txHash) }); errors.push('adapter accepted invalid or unsupported input'); } catch {} }
      try { buildTransactionInspectorHref({ hash, network: 'testnet', providerOrigin: ${JSON.stringify(profile.provider.publicOrigin)}, providerNetworks: ['testnet'] }, { isValidTxHash, buildUrl: () => '/tx/' + '0x' + '0'.repeat(64) + '?network=mainnet' }); errors.push('adapter accepted rewritten route'); } catch {}
      (globalThis as typeof globalThis & { window: { location: { href: string } } }).window = { location: { href: 'https://ckb-viz.truthixify.dev/tx/0x1234?network=testnet' } };
      const invalidParsed = parseLocation();
      if (invalidParsed.path.length !== 0) errors.push('provider parser accepted malformed hash');
      const output = { passed: errors.length === 0, candidateId: ${JSON.stringify(profile.discoveryCandidateId)}, node: process.version, legacyConsumerHref, href, hash, network: parsed.network, parsedHash: parsed.path[0] ?? null, invalidParsedHash: invalidParsed.path[0] ?? null, errors };
      console.log(JSON.stringify(output));
      if (errors.length) process.exitCode = 1;
    `;
    const built = await build({ stdin: { contents: entry, resolveDir: process.cwd(), sourcefile: 'tc01e-entry.ts', loader: 'ts' }, bundle: true, write: false, platform: 'node', format: 'cjs', target: 'node24', alias: { '@': join(providerRoot, 'src') }, sourcemap: false, legalComments: 'none' });
    const bundle = Buffer.from(built.outputFiles[0]!.contents);
    bundleSha256 = hash(bundle);
    await writeFile(join(inputDir, 'run.cjs'), bundle, { flag: 'wx', mode: 0o644 });
    await chmod(stage, 0o755);
    await chmod(inputDir, 0o755);
    const dockerArgs = ['run', '--rm', '--name', containerName, '--pull=never', '--network=none', '--read-only', '--cap-drop=ALL', '--security-opt=no-new-privileges', '--pids-limit=32', '--memory=128m', '--cpus=1', '--user=1000:1000', '--tmpfs=/tmp:rw,noexec,nosuid,size=16m', '--mount', `type=bind,src=${inputDir},dst=/input,readonly`, nodeImage, 'node', '/input/run.cjs'];
    const dockerVersion = await run('docker', ['--version'], { env: workEnv, timeoutMs: 5000 });
    assert(dockerVersion.exitCode === 0, 'Docker is unavailable');
    result = await run('docker', dockerArgs, { env: workEnv, timeoutMs: 20_000 });
    const outputText = result.stdout.toString('utf8').trim();
    assert(outputText.length > 0, `Isolated container produced no JSON (exit=${result.exitCode}, signal=${result.signal}, timedOut=${result.timedOut}, stderr=${result.stderr.toString('utf8').slice(0, 1000)})`);
    const output = JSON.parse(outputText) as { passed: boolean; candidateId: string; node: string; legacyConsumerHref: string; href: string; hash: string; network: string; parsedHash: string | null; invalidParsedHash: string | null; errors: string[] };
    assert(result.exitCode === 0 && !result.timedOut && !result.truncated && output.passed, `Isolated run failed: ${result.stderr.toString('utf8').slice(0, 300)}`);
    assert(output.candidateId === profile.discoveryCandidateId, 'Executed candidate identity mismatch');

    const receiptIdSha256 = hash(`${receiptId}\0${profile.discoveryCandidateId}\0${bundleSha256}`);
    const receipt = {
      schemaVersion: 'tc01e-upstream-interface-receipt-v1',
      id: receiptId,
      receiptSha256: '',
      runId: receiptIdSha256.slice(0, 20),
      opportunityId: `tc01e-${profile.discoveryCandidateId.slice(0, 32)}`,
      candidateId: profile.discoveryCandidateId,
      mode: 'real-upstream-source-interface-isolated',
      executionResult: 'passed',
      overallGateAssessment: 'partial',
      evidenceLevel: 3,
      startedAt,
      finishedAt: new Date().toISOString(),
      source: { consumer: { repository: profile.consumer.repository, revision: profile.consumer.revision, files: profile.consumer.sourceFiles }, provider: { repository: profile.provider.repository, revision: profile.provider.revision, files: profile.provider.sourceFiles }, sourceRootsChecked: true },
      adapter: { path: 'experiments/tc01e/transaction-inspector/adapter.ts', sha256: adapterSha256, candidateSpecificCodeInMatcher: false },
      fixture: { path: 'fixtures/tc01e/grid3-contract-dependency.json', sha256: fixtureSha256, value: output.hash, provenance: 'Value is declared by pinned Grid3 source as a script CellDep transaction hash. It is not claimed as a transaction broadcast by Grid3 or independently checked on chain.' },
      runtime: { image: nodeImage, node: output.node, esbuild: profile.runtime.esbuild, docker: dockerVersion.stdout.toString('utf8').trim(), network: 'none', timeoutMs: 20000, memoryMiB: 128, cpus: 1, pids: 32, containerUser: '1000:1000' },
      executedCommands: {
        host: ['pnpm', 'tc01e:run:transaction-inspector', '--', '--source-root', sourceBase],
        isolated: ['docker', ...dockerArgs],
      },
      isolation: ['Reviewed source acquisition and hash validation happened outside the execution container.', 'No package installation or external dependencies were required.', 'Only the generated route-check bundle was mounted read-only.', 'Container had no network, credentials, signer keys or home directory.', 'Read-only root filesystem, no capabilities, non-root UID 1000, no-new-privileges, process/memory/CPU/time/output limits.', 'Generated bundle and transient staging directory were deleted after recording output hashes.'],
      cases: testedCases.map((description, index) => ({ description, result: 'passed', output: index === 0 ? { legacyConsumerHref: output.legacyConsumerHref, adapterHref: output.href, parsedHash: output.parsedHash, network: output.network } : undefined })),
      stdout: output,
      stdoutSha256: hash(result.stdout),
      stderrSha256: hash(result.stderr),
      exitCode: result.exitCode,
      signal: result.signal,
      timedOut: result.timedOut,
      truncated: result.truncated,
      bundleSha256,
      license: { githubMetadata: { consumer: profile.consumer.licenseMetadataAtReview, provider: profile.provider.licenseMetadataAtReview }, rootLicenseFilesFound: false, restriction: 'No license grant was identified at the inspected revisions. Source code was not committed; the combined bundle existed only in transient private staging for this bounded execution and was destroyed.' },
      limitations: [
        'The only runtime consumer module exercised is Grid3 constants.ts; the actual React signer hook and game page were inspected but not executed.',
        'The fixture hash is a Grid3 source-declared CellDep transaction hash, not a Grid3 transaction produced by sendTransaction and not an independently verified on-chain transaction.',
        'This run proves only read-only URL adapter and CKB Viz parser behavior, not provider deployment availability, RPC success, cell-flow correctness, transaction acceptance, chain compatibility, user value, adoption or maintainer approval.',
        'Unlicensed upstream repositories were used only for this transient private compatibility test; no source bundle was retained or redistributed.'
      ],
      reproduction: ['Acquire the exact repositories and checkout the recorded full commit SHAs.', 'Verify all source file SHA-256 values in the profile.', 'Run pnpm install --frozen-lockfile.', 'Run pnpm tc01e:run:transaction-inspector -- --source-root <pinned-source-parent>. The fixed runner verifies candidate selection, repository identities, revisions, source file digests, then compiles and executes only the approved route modules in an offline container.'],
    };
    const receiptWithoutDigest = Object.fromEntries(Object.entries(receipt).filter(([key]) => key !== 'receiptSha256'));
    receipt.receiptSha256 = hash(JSON.stringify(receiptWithoutDigest));
    const reportDir = 'evidence/tc-01e/execution';
    await mkdir(reportDir, { recursive: true });
    const receiptBytes = Buffer.from(`${JSON.stringify(receipt, null, 2)}\n`);
    const receiptPath = join(reportDir, `${receiptId}.json`);
    try {
      await writeFile(receiptPath, receiptBytes, { flag: 'wx' });
      await writeFile(`${receiptPath}.sha256`, `${hash(receiptBytes)}  ${receiptId}.json\n`, { flag: 'wx' });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
      const prior = await readFile(receiptPath);
      assert(hash(prior) === hash(receiptBytes), 'An existing execution receipt differs; preserve it and write a new versioned receipt ID');
    }

    const [oldRecord] = await db.select().from(trialEvidenceRecords).where(eq(trialEvidenceRecords.id, receiptId));
    if (!oldRecord) await db.insert(trialEvidenceRecords).values({ id: receiptId, opportunityId: receipt.opportunityId, mode: receipt.mode, evidenceLevel: receipt.evidenceLevel, result: receipt.executionResult, receiptSha256: receipt.receiptSha256, receipt: JSON.stringify(receipt), createdAt: new Date(receipt.finishedAt) });
    else assert(oldRecord.receiptSha256 === receipt.receiptSha256, 'Existing database receipt hash mismatch; historical record was preserved');
    const [oldRun] = await db.select().from(trialRuns).where(eq(trialRuns.opportunityId, receipt.opportunityId));
    const runNote = `Isolated real-source interface execution ${receiptId}; URL route and parser passed. See ${receiptPath}. Evidence scope is browser navigation only; no transaction submission or chain validation.`;
    if (!oldRun || !oldRun.details.includes(receiptId)) await db.insert(trialRuns).values({ opportunityId: receipt.opportunityId, result: 'passed · route interface only', details: runNote, observedAt: new Date(receipt.finishedAt) });
    console.log(JSON.stringify({ receipt: receiptPath, receiptSha256: hash(receiptBytes), sourceRevisions: [profile.consumer.revision, profile.provider.revision], output: receipt.stdout, receiptId }, null, 2));
  } finally {
    try { await run('docker', ['rm', '-f', containerName], { env: workEnv, timeoutMs: 5000 }); } catch { /* Container exits --rm; best effort cleanup only. */ }
    await rm(stage, { recursive: true, force: true });
  }
}

main().then(() => process.exit(0)).catch(error => { console.error(error instanceof Error ? error.stack : String(error)); process.exit(1); });
