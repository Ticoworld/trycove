import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

const reportPath = 'evidence/tc-01e/gate-c-functional/functional-discovery.json';
const outputDirectory = 'evidence/tc-01e/gate-c-functional';
const sha = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
const arg = (name: string) => { const index = process.argv.indexOf(name); return index < 0 ? undefined : process.argv[index + 1]; };

async function main() {
  const baseUrl = new URL(arg('--base-url') ?? 'http://127.0.0.1:3000');
  if (!['localhost', '127.0.0.1', '::1'].includes(baseUrl.hostname)) throw new Error('Functional discovery smoke checks are restricted to a local Trycove server');
  const reportBytes = await readFile(reportPath);
  const report = JSON.parse(reportBytes.toString('utf8')) as { matcher: { result: { roleAssessments: Array<{ projectId: string; repository: string; revision: string | null; consumerCallCount: number; providerApiCount: number }> } } };
  const product = report.matcher.result.roleAssessments.find(role => role.consumerCallCount > 0 || role.providerApiCount > 0);
  if (!product) throw new Error('The frozen discovery result contains no source-assessed product to use for the Passport path check');

  const checks: Array<{ route: string; status: number; contentType: string | null; htmlSha256: string; requiredText: string[]; missing: string[] }> = [];
  async function check(route: string, requiredText: string[]) {
    const response = await fetch(new URL(route, baseUrl));
    const html = await response.text();
    const missing = requiredText.filter(text => !html.includes(text));
    checks.push({ route, status: response.status, contentType: response.headers.get('content-type'), htmlSha256: sha(html), requiredText, missing });
  }

  const passportRoute = `/projects/${encodeURIComponent(product.projectId)}`;
  const discoveryRoute = `/functional-discovery?product=${encodeURIComponent(product.projectId)}`;
  await check(passportRoute, ['Product Passport', 'CKB query interfaces assessed', discoveryRoute]);
  await check(discoveryRoute, [
    'Functional discovery evidence',
    'Rejected exact-operation hypotheses',
    '0 selected connections',
    'No candidate passed the value requirement',
    'packages/chain/src/proof.ts',
    'Integration Lab and execution evidence',
    'Not produced for this discovery attempt',
  ]);

  const failures = checks.filter(check => check.status !== 200 || check.missing.length > 0);
  const receipt = {
    schemaVersion: 'tc-01e-functional-discovery-ui-smoke-v1',
    createdAt: new Date().toISOString(),
    result: failures.length ? 'failed' : 'passed',
    renderScope: 'Production Next.js server-rendered HTML; content and journey assertions, not visual browser inspection.',
    browserVisualCheck: { status: 'blocked', reason: 'CUA browser connection failed to initialize: the gaas-browser node_repl sandbox cannot be disabled.' },
    app: { baseUrl: baseUrl.origin, startCommand: 'pnpm start --hostname 0.0.0.0', buildCommand: 'pnpm build' },
    discoveryReport: { path: reportPath, sha256: sha(reportBytes) },
    journey: { productId: product.projectId, repository: product.repository, revision: product.revision, passportRoute, discoveryRoute },
    checks,
  };
  const bytes = Buffer.from(`${JSON.stringify(receipt, null, 2)}\n`);
  const id = new Date().toISOString().replace(/[:.]/g, '-');
  const output = `${outputDirectory}/ui-journey-${id}.json`;
  await mkdir(outputDirectory, { recursive: true });
  await writeFile(output, bytes, { flag: 'wx' });
  await writeFile(`${output}.sha256`, `${sha(bytes)}  ${output.split('/').at(-1)}\n`, { flag: 'wx' });
  console.log(JSON.stringify({ path: output, sha256: sha(bytes), result: receipt.result, checks: checks.map(({ route, status, missing }) => ({ route, status, missing })) }, null, 2));
  if (failures.length) process.exitCode = 1;
}

main().catch(error => { console.error(error instanceof Error ? error.stack : String(error)); process.exit(1); });
