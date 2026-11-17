import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { and, desc, eq, or } from 'drizzle-orm';
import { db } from '../../lib/db';
import { evidence, followUps, footprintObservations, opportunities, projects, technicalFootprints } from '../../lib/schema';
import { discoverTransactionInspectorConnections, type InterfaceObservation } from '../../lib/intelligence/product-connections';

type CohortEntry = { repositoryPath: string; productIds: string[]; revision: string };
const root = process.cwd();
const sha = (x: Buffer | string) => createHash('sha256').update(x).digest('hex');
function arg(name: string) { const i = process.argv.indexOf(name); return i < 0 ? undefined : process.argv[i + 1]; }
function sourceUrl(x: InterfaceObservation) {
  const repository = x.repository.replace(/^https:\/\/github\.com\//, '');
  return `https://github.com/${repository}/blob/${x.revision}/${x.path}#L${x.startLine}-L${x.endLine}`;
}
async function requestPriorArt(query: string) {
  const url = new URL('https://api.github.com/search/issues');
  url.searchParams.set('q', query);
  url.searchParams.set('per_page', '25');
  const checkedAt = new Date().toISOString();
  try {
    const response = await fetch(url, { headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'trycove-tc01e-capability-review', 'X-GitHub-Api-Version': '2022-11-28' }, signal: AbortSignal.timeout(15_000) });
    const text = await response.text();
    if (!response.ok) return { query, requestedUrl: url.href, checkedAt, status: 'unavailable', httpStatus: response.status, excerpt: text.slice(0, 300), results: [] };
    const body = JSON.parse(text) as { total_count?: number; items?: Array<{ html_url: string; title: string; body?: string | null; state: string; created_at: string; updated_at: string; repository_url?: string; pull_request?: unknown }> };
    return { query, requestedUrl: url.href, checkedAt, status: 'available', totalCount: body.total_count ?? 0,
      results: (body.items ?? []).slice(0, 25).map(x => ({ url: x.html_url, title: x.title, body: x.body?.slice(0, 1000) ?? '', state: x.state, createdAt: x.created_at, updatedAt: x.updated_at, isPullRequest: Boolean(x.pull_request) })) };
  } catch (error) { return { query, requestedUrl: url.href, checkedAt, status: 'unavailable', error: error instanceof Error ? error.message.slice(0, 300) : String(error).slice(0, 300), results: [] }; }
}

async function main() {
  const scanPath = arg('--scan');
  if (!scanPath || !/^evidence\/tc-01e\/source-scan-[\wTZ.-]+\.json$/.test(scanPath)) throw new Error('Usage: pnpm tc01e:discover -- --scan evidence/tc-01e/source-scan-<timestamp>.json [--persist]');
  const cohortBytes = await readFile('evidence/tc-01e/product-source-cohort.json');
  const cohort = JSON.parse(cohortBytes.toString('utf8')) as { schemaVersion: string; baselineCommit: string; selected: CohortEntry[] };
  if (cohort.schemaVersion !== 'tc-01e-product-cohort-v1' || cohort.selected.length !== 12) throw new Error('Unexpected product cohort');
  const scanBytes = await readFile(scanPath);
  const scan = JSON.parse(scanBytes.toString('utf8')) as { schemaVersion: string; cohortSha256: string; scanner: string; results: Array<{ repositoryPath: string; productIds: string[]; revision: string; exitCode: number | null }> };
  if (scan.schemaVersion !== 'tc-01e-source-scan-v1' || scan.cohortSha256 !== sha(cohortBytes) || scan.results.length !== cohort.selected.length || scan.results.some(x => x.exitCode !== 0)) throw new Error('Source scan receipt does not cover the frozen cohort or includes failures');
  if (scan.results.some((x, i) => x.repositoryPath !== cohort.selected[i]!.repositoryPath || x.revision !== cohort.selected[i]!.revision)) throw new Error('Source scan identities or revisions do not exactly match the frozen cohort');

  const cohortProducts = await db.select().from(projects);
  const cohortSummary = [];
  const observations: InterfaceObservation[] = [];
  for (const selected of cohort.selected) {
    const projectId = selected.productIds[0]!;
    const repository = `https://github.com/${selected.repositoryPath.toLowerCase()}`;
    const [footprint] = await db.select().from(technicalFootprints).where(and(
      eq(technicalFootprints.projectId, projectId), eq(technicalFootprints.repository, repository),
      eq(technicalFootprints.revision, selected.revision), eq(technicalFootprints.analyzerVersion, '1.9.1'),
    ));
    if (!footprint) throw new Error(`Missing version 1.9.1 pinned footprint for ${repository}@${selected.revision}`);
    const rows = await db.select().from(footprintObservations).where(eq(footprintObservations.footprintId, footprint.id));
    const kinds: Record<string, number> = {};
    for (const row of rows) kinds[row.kind] = (kinds[row.kind] ?? 0) + 1;
    const product = cohortProducts.find(x => x.id === projectId);
    if (!product) throw new Error(`Missing imported product identity ${projectId}`);
    cohortSummary.push({ projectId, name: product.name, description: product.description, repository, revision: selected.revision,
      footprintId: footprint.id, analyzerVersion: footprint.analyzerVersion, fileCount: footprint.fileCount,
      observationCount: rows.length, unknowns: JSON.parse(footprint.unknowns) as string[], kinds });
    observations.push(...rows.map(row => ({ id: row.id, projectId: row.projectId, repository: row.repository, revision: row.revision,
      path: row.path, startLine: row.startLine, endLine: row.endLine, kind: row.kind, fact: row.fact, evidence: row.evidence, verification: row.verification })));
  }

  const discovered = discoverTransactionInspectorConnections(observations);
  const selectedCandidate = discovered.candidates[0] ?? null;
  const currentTime = new Date().toISOString();
  const reportDir = 'evidence/tc-01e/discovery';
  const reportName = `source-discovery-${currentTime.replace(/[:.]/g, '-')}.json`;
  const reportPath = `${reportDir}/${reportName}`;
  let priorArt: unknown = { status: 'not-run', scope: 'GitHub indexed issue and pull-request title/body search in both candidate repositories; does not cover all code, discussions, social posts or private work.' };
  let existingLocalOpportunity: string | null = null;
  if (selectedCandidate) {
    const consumerPath = selectedCandidate.consumer.repository.replace('https://github.com/', '');
    const providerPath = selectedCandidate.provider.repository.replace('https://github.com/', '');
    const consumerAlias = consumerPath.split('/').at(-1)!;
    const providerAlias = providerPath.split('/').at(-1)!;
    const queries = [
      `repo:${consumerPath} ${providerAlias} is:issue in:title,body,comments`,
      `repo:${consumerPath} ${providerAlias} is:pull-request in:title,body,comments`,
      `repo:${consumerPath} "transaction visualization" is:issue in:title,body,comments`,
      `repo:${consumerPath} "transaction visualization" is:pull-request in:title,body,comments`,
      `repo:${providerPath} ${consumerAlias} is:issue in:title,body,comments`,
      `repo:${providerPath} ${consumerAlias} is:pull-request in:title,body,comments`,
      `repo:${providerPath} "cell lineage" is:issue in:title,body,comments`,
      `repo:${providerPath} "cell lineage" is:pull-request in:title,body,comments`,
    ];
    const searchResults = await Promise.all(queries.map(requestPriorArt));
    const mentions = searchResults.flatMap((x, index) => x.status === 'available' ? x.results.map(result => ({ ...result, searchedIn: queries[index] })) : []);
    const exactMentions = mentions.filter(x => `${x.title} ${x.url} ${x.body}`.toLowerCase().includes(consumerAlias.toLowerCase()) || `${x.title} ${x.url} ${x.body}`.toLowerCase().includes(providerAlias.toLowerCase()));
    priorArt = { status: searchResults.every(x => x.status === 'available') ? (exactMentions.length ? 'references-found-review-required' : 'no-reference-in-bounded-indexed-search') : 'incomplete',
      scope: 'Eight anonymous GitHub Search API queries: issues and pull requests in each candidate repository, using the counterpart repository alias and bounded transaction-visualization/cell-lineage terms across indexed titles, bodies and comments. This does not establish that no prior proposal or integration exists.', searches: searchResults };
    const generatedOpportunityId = `tc01e-${selectedCandidate.id.slice(0, 32)}`;
    const local = await db.select({ id: opportunities.id }).from(opportunities).where(or(
      and(eq(opportunities.projectA, selectedCandidate.consumer.projectId), eq(opportunities.projectB, selectedCandidate.provider.projectId)),
      and(eq(opportunities.projectA, selectedCandidate.provider.projectId), eq(opportunities.projectB, selectedCandidate.consumer.projectId)),
    )).orderBy(desc(opportunities.id)).limit(1);
    existingLocalOpportunity = local[0]?.id && local[0].id !== generatedOpportunityId ? local[0].id : null;
  }

  const capabilityEvidence = observations.filter(x => ['transaction_explorer_link', 'transaction_deep_link', 'transaction_deep_link_parser', 'network_contract', 'declared_network', 'broadcast'].includes(x.kind))
    .sort((a, b) => a.projectId.localeCompare(b.projectId) || a.path.localeCompare(b.path) || a.startLine - b.startLine || a.id.localeCompare(b.id));
  const report: Record<string, unknown> = {
    schemaVersion: 'tc01e-product-discovery-v1', createdAt: currentTime, baselineCommit: cohort.baselineCommit,
    frozenCohort: { path: 'evidence/tc-01e/product-source-cohort.json', sha256: sha(cohortBytes), selectedRepositories: cohort.selected.length,
      newRepositoryCandidates: cohort.selected.map(x => ({ repositoryPath: x.repositoryPath, productId: x.productIds[0], revision: x.revision })) },
    sourceScan: { path: scanPath, sha256: sha(scanBytes), analyzerVersion: '1.9.1', completed: scan.results.length, failed: 0, scanner: scan.scanner },
    methodology: { interfaceFamily: 'CKB transaction explorer links and network-scoped transaction deep links', targetPairsSupplied: false,
      selectionRules: ['Source-observed transaction hash submission and current explorer-link interface on the consumer.', 'Source-observed builder and route parser on the provider.', 'Explicit overlapping CKB network contract.', 'Cross-project identity; no shared dependency or description similarity rule.', 'Rank by exact interface, consumer behavior, network overlap, bounded adapter feasibility and pinned source confidence; use the stable source-evidence SHA only to break a complete tie.'],
      rejectedConditions: ['Self match', 'Missing consumer transaction submission or explorer link', 'Missing provider URL builder, hash-validating route parser or network contract', 'No supported network overlap', 'Unpinned or non-source-observed evidence'] },
    cohortSummary, footprintObservationTotal: cohortSummary.reduce((n, x) => n + x.observationCount, 0),
    extractedCapabilityEvidence: capabilityEvidence,
    discovery: { candidateCount: discovered.candidates.length, candidates: discovered.candidates, rejected: discovered.rejected,
      roleAssessments: discovered.roleAssessments.map(x => ({ ...x, productName: cohortProducts.find(p => p.id === x.projectId)?.name ?? x.projectId })),
      selectedCandidateId: selectedCandidate?.id ?? null },
    priorArt, localPriorWork: existingLocalOpportunity ? { status: 'candidate-pair-already-has-local-record', opportunityId: existingLocalOpportunity } : { status: 'no-existing-opportunity-pair-record' },
    persistence: { requested: process.argv.includes('--persist'), opportunityId: null as string | null, evidenceRecordsAdded: 0, reason: selectedCandidate ? null : 'No source candidate was generated.' },
    limitations: ['Static source footprints do not prove runtime behavior or deployment availability.', 'The opportunity value is inferred from source interfaces, not an explicit consumer request.', 'The existing Pudge explorer link is a working alternative; the proposed provider may improve transaction-flow inspection but is not demonstrated as superior for every task.', 'Shared GitHub ownership is retained as a potential relationship-bias concern.', 'Prior-art search is bounded to indexed issue and pull-request title/body results; no absence guarantee is made.'],
  };

  if (process.argv.includes('--persist') && selectedCandidate && !existingLocalOpportunity) {
    const consumerProject = cohortProducts.find(x => x.id === selectedCandidate.consumer.projectId)!;
    const providerProject = cohortProducts.find(x => x.id === selectedCandidate.provider.projectId)!;
    const opportunityId = `tc01e-${selectedCandidate.id.slice(0, 32)}`;
    const [priorArtReport] = await db.select().from(opportunities).where(eq(opportunities.id, opportunityId)).limit(1);
    if (!priorArtReport) await db.insert(opportunities).values({ id: opportunityId, projectA: consumerProject.id, projectB: providerProject.id,
      kind: 'Inferred product connection · read-only transaction deep link',
      problem: `${consumerProject.name} exposes CKB transaction hashes and currently links to a generic transaction explorer. Its source does not request an alternate viewer; the possible benefit is an easier-to-inspect transaction flow.`,
      reasoning: `${providerProject.name} source exposes a network-scoped CKB transaction route and validates 32-byte transaction hashes. A small browser-link adapter could open the read-only cell-flow view for transactions emitted by ${consumerProject.name}. This is an inferred product hypothesis, not an integration request or compatibility result. Bounded prior-art check: ${JSON.stringify(priorArt)}.`,
      requirements: JSON.stringify({ boundary: selectedCandidate.boundary, adapter: selectedCandidate.adapter, findings: selectedCandidate.findings,
        priorArt, providerRevision: selectedCandidate.provider.revision, consumerRevision: selectedCandidate.consumer.revision,
        currentProviderLicense: 'No root license file or GitHub license metadata was observed at the pinned provider revision; do not redistribute its source.' }),
      experiment: selectedCandidate.nextExperiment, status: 'discovered' }).onConflictDoNothing();
    let added = 0;
    for (const row of [selectedCandidate.consumer.link, ...selectedCandidate.consumer.submissions.slice(0, 1), selectedCandidate.provider.networkContract, selectedCandidate.provider.builder, selectedCandidate.provider.parser]) {
      const claim = `Pinned source observation (${row.kind}): ${row.fact}. Static observation only; runtime behavior is unverified.`;
      const url = sourceUrl(row);
      const old = await db.select({ id: evidence.id }).from(evidence).where(and(eq(evidence.opportunityId, opportunityId), eq(evidence.sourceUrl, url), eq(evidence.claim, claim))).limit(1);
      if (!old.length) { await db.insert(evidence).values({ opportunityId, claim, sourceUrl: url, revision: row.revision, observedAt: new Date(), verification: 'source_observed' }); added++; }
    }
    let priorArtEvidenceAdded = 0;
    const searchReports = (priorArt as { searches?: Array<{ status: string; requestedUrl: string; query: string; checkedAt: string; totalCount?: number }> }).searches ?? [];
    for (const search of searchReports.filter(x => x.status === 'available')) {
      const claim = `Bounded prior-art search for “${search.query}” returned ${search.totalCount ?? 0} indexed issue or pull-request result(s) at ${search.checkedAt}. This search scope is incomplete and absence is not proof that no prior work exists.`;
      const old = await db.select({ id: evidence.id }).from(evidence).where(and(eq(evidence.opportunityId, opportunityId), eq(evidence.sourceUrl, search.requestedUrl), eq(evidence.claim, claim))).limit(1);
      if (!old.length) { await db.insert(evidence).values({ opportunityId, claim, sourceUrl: search.requestedUrl, revision: null, observedAt: new Date(search.checkedAt), verification: 'bounded_source_search' }); priorArtEvidenceAdded++; }
    }
    const followUpNote = `After the source-based candidate had been generated, eight bounded GitHub issue/PR searches were run for repository aliases and transaction-visualization/cell-lineage terms. State: ${(priorArt as { status?: string }).status}. ${searchReports.length} responses retained. No maintainer or partner contact occurred. Evidence report: ${reportPath}. This does not prove absence of prior work.`;
    const oldFollowUp = await db.select({ id: followUps.id }).from(followUps).where(and(eq(followUps.opportunityId, opportunityId), eq(followUps.kind, 'finding'), eq(followUps.note, followUpNote))).limit(1);
    if (!oldFollowUp.length) await db.insert(followUps).values({ opportunityId, kind: 'finding', note: followUpNote, createdAt: new Date(currentTime) });
    report.persistence = { requested: true, opportunityId, evidenceRecordsAdded: added, priorArtEvidenceAdded,
      followUpAdded: !oldFollowUp.length, reason: 'Persisted through the existing opportunity, evidence and follow-up tables; no prior records were overwritten and no external action was recorded.' };
  }

  await mkdir(reportDir, { recursive: true });
  const name = reportName;
  const out = reportPath;
  const bytes = Buffer.from(`${JSON.stringify(report, null, 2)}\n`);
  await writeFile(out, bytes, { flag: 'wx' });
  await writeFile(`${out}.sha256`, `${sha(bytes)}  ${name}\n`, { flag: 'wx' });
  console.log(JSON.stringify({ report: out, sha256: sha(bytes), candidateCount: discovered.candidates.length, selectedCandidateId: selectedCandidate?.id ?? null,
    priorArt: report.priorArt, persistence: report.persistence }, null, 2));
  process.exit(0);
}

main().catch(error => { console.error(error instanceof Error ? error.message : String(error)); process.exit(1); });
