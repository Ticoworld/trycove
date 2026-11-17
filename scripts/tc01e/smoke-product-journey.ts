import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

const sha = (value: Buffer | string) => createHash('sha256').update(value).digest('hex');
function arg(name: string) { const index = process.argv.indexOf(name); return index < 0 ? undefined : process.argv[index + 1]; }

async function main() {
  const base = new URL(arg('--base-url') ?? 'http://127.0.0.1:3000');
  if (base.protocol !== 'http:' || !['127.0.0.1', 'localhost', '::1'].includes(base.hostname)) throw new Error('--base-url must be a local loopback HTTP origin');
  const discoveryPath = arg('--discovery') ?? 'evidence/tc-01e/discovery/source-discovery-2026-11-17T21-44-13-815Z.json';
  const discovery = JSON.parse(await readFile(discoveryPath, 'utf8')) as { discovery: { candidates: Array<{ id: string; consumer: { projectId: string }; provider: { projectId: string } }>; selectedCandidateId: string }; persistence: { opportunityId: string } };
  const candidate = discovery.discovery.candidates.find(item => item.id === discovery.discovery.selectedCandidateId);
  if (!candidate) throw new Error('Selected candidate is absent from the persisted discovery report');
  const receiptDirectory = 'evidence/tc-01e/execution';
  const receiptNames = (await (await import('node:fs/promises')).readdir(receiptDirectory)).filter(name => name.endsWith('.json') && !name.endsWith('.sha256'));
  const receipts = await Promise.all(receiptNames.map(async name => ({ name, record: JSON.parse(await readFile(`${receiptDirectory}/${name}`, 'utf8')) as { id: string; startedAt: string; executionResult: string } })));
  const receipt = receipts.filter(item => item.record.executionResult === 'passed').sort((a, b) => a.record.startedAt.localeCompare(b.record.startedAt)).at(-1);
  if (!receipt) throw new Error('No passed execution receipt is linked to the product experiment');

  const checks: Array<{ path: string; contains: string[] }> = [
    { path: '/projects', contains: ['Grid3', 'ckb-viz'] },
    { path: `/projects/${candidate.consumer.projectId}`, contains: ['Product Passport', 'Known and proposed relationships', 'transaction_explorer_link', discovery.persistence.opportunityId] },
    { path: `/projects/${candidate.provider.projectId}`, contains: ['Product Passport', 'Grid3', 'transaction_deep_link', 'transaction_deep_link_parser'] },
    { path: `/opportunities/${encodeURIComponent(discovery.persistence.opportunityId)}`, contains: ['Functional boundary', 'Adapter contract', 'Compatibility findings', 'Execution receipts', 'bounded_source_search'] },
    { path: `/trials/${encodeURIComponent(receipt.record.id)}`, contains: ['real-upstream-source-interface-isolated', 'read-only URL builder/parser boundary', 'legacyConsumerHref', 'inspect adapter source', 'limitations'] },
  ];
  const results = [];
  for (const check of checks) {
    const url = new URL(check.path, base);
    const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    const body = await response.text();
    const missing = check.contains.filter(needle => !body.toLowerCase().includes(needle.toLowerCase()));
    results.push({ url: url.href, status: response.status, responseBytes: Buffer.byteLength(body), responseSha256: sha(body), requiredContent: check.contains, missing });
  }
  const report = { schemaVersion: 'tc01e-product-journey-http-smoke-v1', checkedAt: new Date().toISOString(), baseOrigin: base.origin,
    discoveryPath, candidateId: discovery.discovery.selectedCandidateId, consumerId: candidate.consumer.projectId, providerId: candidate.provider.projectId,
    opportunityId: discovery.persistence.opportunityId, receiptPath: `${receiptDirectory}/${receipt.name}`, receiptId: receipt.record.id,
    results, result: results.every(item => item.status === 200 && item.missing.length === 0) ? 'passed' : 'failed' };
  const directory = 'evidence/tc-01e/ui';
  await mkdir(directory, { recursive: true });
  const filename = `route-smoke-${report.checkedAt.replace(/[:.]/g, '-')}.json`;
  const bytes = Buffer.from(`${JSON.stringify(report, null, 2)}\n`);
  await writeFile(`${directory}/${filename}`, bytes, { flag: 'wx' });
  await writeFile(`${directory}/${filename}.sha256`, `${sha(bytes)}  ${filename}\n`, { flag: 'wx' });
  console.log(JSON.stringify({ path: `${directory}/${filename}`, sha256: sha(bytes), result: report.result, routes: results.map(item => ({ url: item.url, status: item.status, missing: item.missing })) }, null, 2));
  process.exit(results.every(item => item.status === 200 && item.missing.length === 0) ? 0 : 1);
}

main().catch(error => { console.error(error instanceof Error ? error.stack : String(error)); process.exit(1); });
