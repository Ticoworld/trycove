import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { and, eq, inArray } from 'drizzle-orm';
import { db } from '../../lib/db';
import { footprintObservations, projects, technicalFootprints } from '../../lib/schema';
import { discoverDataQueryConnections, type DataQueryObservation } from '../../lib/intelligence/data-query-connections';

type FrozenEntry = { repositoryPath: string; productIds: string[]; revision?: string; error?: string };
const cohortPath = 'evidence/tc-01e/gate-c-functional/frozen-cohort.json';
const sha = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
function arg(name: string) { const index = process.argv.indexOf(name); return index < 0 ? undefined : process.argv[index + 1]; }
function sourceUrl(row: DataQueryObservation) { return `${row.repository}/blob/${row.revision}/${row.path}#L${row.startLine}-L${row.endLine}`; }
function retainedObservation(row: DataQueryObservation) {
  const { evidence, ...metadata } = row;
  return { ...metadata, sourceUrl: sourceUrl(row), evidenceTextSha256: sha(evidence) };
}

async function main() {
  const scanPath = arg('--scan');
  if (!scanPath || !/^evidence\/tc-01e\/gate-c-functional\/source-scan-[\wTZ.-]+\.json$/.test(scanPath)) throw new Error('Usage: pnpm tc01e:discover:functional -- --scan evidence/tc-01e/gate-c-functional/source-scan-<timestamp>.json [--output evidence/tc-01e/gate-c-functional/<name>.json]');
  const [cohortBytes, scanBytes, licenseBytes] = await Promise.all([
    readFile(cohortPath),
    readFile(scanPath),
    readFile('evidence/tc-01e/gate-c-functional/license-review.json'),
  ]);
  const cohort = JSON.parse(cohortBytes.toString('utf8')) as { schemaVersion: string; baselineCommit: string; methodology: { sha256: string }; selection: { selected: FrozenEntry[] } };
  const scan = JSON.parse(scanBytes.toString('utf8')) as { schemaVersion: string; cohortSha256: string; methodologySha256: string; analyzerVersion: string; results: Array<{ repositoryPath: string; productIds: string[]; revision: string | null; exitCode: number | null }> };
  const licenseReview = JSON.parse(licenseBytes.toString('utf8')) as { schemaVersion: string; checks: Array<{ repositoryPath: string; revision: string }> };
  if (cohort.schemaVersion !== 'tc-01e-functional-cohort-v1' || cohort.selection.selected.length !== 12 || scan.schemaVersion !== 'tc-01e-functional-source-scan-v1' || scan.cohortSha256 !== sha(cohortBytes) || scan.methodologySha256 !== cohort.methodology.sha256 || scan.analyzerVersion !== '2.0.1' || scan.results.length !== 12) throw new Error('Source scan does not match the immutable functional cohort, analyzer and methodology');
  for (let index = 0; index < cohort.selection.selected.length; index++) {
    const expected = cohort.selection.selected[index]!;
    const observed = scan.results[index]!;
    if (expected.repositoryPath !== observed.repositoryPath || expected.revision !== observed.revision || expected.productIds[0] !== observed.productIds[0]) throw new Error(`Frozen source identity mismatch at cohort slot ${index + 1}`);
    const license = licenseReview.checks[index];
    if (licenseReview.schemaVersion !== 'tc-01e-license-review-v1' || licenseReview.checks.length !== 12 || license?.repositoryPath !== expected.repositoryPath || license.revision !== expected.revision) throw new Error(`License review does not match frozen source identity at cohort slot ${index + 1}`);
  }

  const revisions = cohort.selection.selected.filter((row): row is FrozenEntry & { revision: string } => /^[a-f0-9]{40}$/.test(row.revision ?? ''));
  const repositories = revisions.map(row => `https://github.com/${row.repositoryPath.toLowerCase()}`);
  const [productsList, footprints] = await Promise.all([
    db.select().from(projects),
    db.select().from(technicalFootprints).where(and(inArray(technicalFootprints.repository, repositories), eq(technicalFootprints.analyzerVersion, scan.analyzerVersion))),
  ]);
  const allObservations: DataQueryObservation[] = [];
  const inspected: Array<Record<string, unknown>> = [];
  for (const selected of cohort.selection.selected) {
    const scanRow = scan.results.find(row => row.repositoryPath === selected.repositoryPath)!;
    const productId = selected.productIds[0] ?? null;
    if (!selected.revision || !productId || scanRow.exitCode !== 0) {
      inspected.push({ repositoryPath: selected.repositoryPath, productId, revision: selected.revision ?? null, inspectionStatus: 'failed', reason: selected.error ?? `Source scanner exit code ${scanRow.exitCode}; frozen slot retained.` });
      continue;
    }
    const repository = `https://github.com/${selected.repositoryPath.toLowerCase()}`;
    const footprint = footprints.find(row => row.projectId === productId && row.repository === repository && row.revision === selected.revision);
    if (!footprint) {
      inspected.push({ repositoryPath: selected.repositoryPath, productId, revision: selected.revision, inspectionStatus: 'failed', reason: `Scanner command returned success, but no analyzer ${scan.analyzerVersion} pinned footprint was persisted.` });
      continue;
    }
    const rows = await db.select().from(footprintObservations).where(eq(footprintObservations.footprintId, footprint.id));
    const observations = rows.map(row => ({ ...row, verification: row.verification } as DataQueryObservation));
    allObservations.push(...observations);
    const kindCounts = Object.fromEntries([...new Set(rows.map(row => row.kind))].sort().map(kind => [kind, rows.filter(row => row.kind === kind).length]));
    const zeroSupportedFiles = footprint.fileCount === 0;
    const product = productsList.find(row => row.id === productId);
    inspected.push({
      repositoryPath: selected.repositoryPath,
      productId,
      productName: product?.name ?? productId,
      revision: selected.revision,
      analyzerVersion: footprint.analyzerVersion,
      fileCount: footprint.fileCount,
      observationCount: rows.length,
      sourceInspectionStatus: zeroSupportedFiles ? 'failed-no-supported-source-files' : footprint.status === 'complete' ? 'completed' : 'partial-unknowns-retained',
      unknowns: JSON.parse(footprint.unknowns) as string[],
      observationKinds: kindCounts,
      scanExitCode: scanRow.exitCode,
    });
  }

  const discovered = discoverDataQueryConnections(allObservations);
  const rolesByRepository = new Map(discovered.roleAssessments.map(role => [role.repository.toLowerCase(), role]));
  const roleAssessments = cohort.selection.selected.map(selected => {
    const repository = `https://github.com/${selected.repositoryPath.toLowerCase()}`;
    return rolesByRepository.get(repository) ?? {
      projectId: selected.productIds[0] ?? 'unknown', repository, revision: selected.revision ?? null,
      owner: selected.repositoryPath.split('/')[0]?.toLowerCase() ?? 'unknown', consumerOperations: [], consumerCallCount: 0,
      providerOperations: [], providerApiCount: 0, networks: [], missing: ['No supported source observations were available for role assessment.'],
    };
  });
  const selectedCandidate = null;
  const timestamp = new Date().toISOString();
  const requestedOutput = arg('--output');
  if (requestedOutput && !/^evidence\/tc-01e\/gate-c-functional\/[\w.-]+\.json$/.test(requestedOutput)) throw new Error('--output must be a JSON file directly inside evidence/tc-01e/gate-c-functional');
  const name = requestedOutput?.split('/').at(-1) ?? `functional-discovery-${timestamp.replace(/[:.]/g, '-')}.json`;
  const output = requestedOutput ?? `evidence/tc-01e/gate-c-functional/${name}`;
  const uiOutput = output.replace(/\.json$/, '-ui.json');
  const retainedHypotheses = discovered.hypotheses.map(hypothesis => ({
    ...hypothesis,
    consumer: { ...hypothesis.consumer, call: retainedObservation(hypothesis.consumer.call) },
    provider: { ...hypothesis.provider, api: retainedObservation(hypothesis.provider.api) },
  }));
  const uiHypotheses = retainedHypotheses.map(hypothesis => ({
    id: hypothesis.id,
    status: hypothesis.status,
    consumer: { projectId: hypothesis.consumer.projectId, repository: hypothesis.consumer.repository, revision: hypothesis.consumer.revision, operation: hypothesis.consumer.operation, call: hypothesis.consumer.call, callCount: hypothesis.consumer.callCount, networks: hypothesis.consumer.networks },
    provider: { projectId: hypothesis.provider.projectId, repository: hypothesis.provider.repository, revision: hypothesis.provider.revision, operation: hypothesis.provider.operation, api: hypothesis.provider.api, apiCount: hypothesis.provider.apiCount, networks: hypothesis.provider.networks },
    interfaceMapping: hypothesis.interfaceMapping,
    compatibility: hypothesis.compatibility,
    valueAssessment: hypothesis.valueAssessment,
    rejectionReasons: hypothesis.rejectionReasons,
  }));
  const uiProjection = {
    schemaVersion: 'tc-01e-functional-discovery-ui-v1',
    createdAt: timestamp,
    baselineCommit: cohort.baselineCommit,
    implementationBaseline: '511e2a820bbb9b755a8762357c36d6450e648ef2',
    capabilityFamily: 'CKB read-only transaction and live-cell queries crossing a consumer application boundary into an executable provider query method or handler',
    frozenCohort: { path: cohortPath, sha256: sha(cohortBytes), methodologyPath: 'evidence/tc-01e/gate-c-functional/discovery-methodology.md', methodologySha256: cohort.methodology.sha256, selectedCount: cohort.selection.selected.length },
    sourceScan: { path: scanPath, sha256: sha(scanBytes), analyzerVersion: scan.analyzerVersion, selectedCount: scan.results.length, commandSucceeded: scan.results.filter(row => row.exitCode === 0).length, commandFailed: scan.results.filter(row => row.exitCode !== 0).length, sourceInspections: inspected },
    matcher: { result: { roleAssessments, hypothesisCount: uiHypotheses.length, selectedCandidateId: selectedCandidate, rejectedHypotheses: uiHypotheses, rejectedOperationEdges: discovered.rejected } },
  };
  const uiBytes = Buffer.from(`${JSON.stringify(uiProjection, null, 2)}\n`);
  const report = {
    schemaVersion: 'tc-01e-gate-c-functional-discovery-v1',
    createdAt: timestamp,
    baselineCommit: cohort.baselineCommit,
    implementationBaseline: '511e2a820bbb9b755a8762357c36d6450e648ef2',
    frozenCohort: { path: cohortPath, sha256: sha(cohortBytes), methodologyPath: 'evidence/tc-01e/gate-c-functional/discovery-methodology.md', methodologySha256: cohort.methodology.sha256, selectedCount: cohort.selection.selected.length },
    sourceScan: { path: scanPath, sha256: sha(scanBytes), analyzerVersion: scan.analyzerVersion, selectedCount: scan.results.length, commandSucceeded: scan.results.filter(row => row.exitCode === 0).length, commandFailed: scan.results.filter(row => row.exitCode !== 0).length, sourceInspections: inspected,
      supersededScan: { path: 'evidence/tc-01e/gate-c-functional/source-scan-2026-11-18T09-30-29-857Z.json', analyzerVersion: '2.0.0', disposition: 'Retained but excluded from matching after a false positive treated inherited JavaScript object methods as CKB query operations; version 2.0.1 requires own entries in the query-operation map.' } },
    capabilityFamily: 'CKB read-only transaction and live-cell queries crossing a consumer application boundary into an executable provider query method or handler',
    matcher: {
      implementation: 'lib/intelligence/data-query-connections.ts',
      pairNamesHardcoded: false,
      acceptedConsumerEvidence: 'Pinned data_query_call observation in supported non-test application source; exact query method and typed call retained.',
      acceptedProviderEvidence: 'Pinned data_query_export or data_query_route_handler observation with an executable source method/handler and an exact delegated CKB query operation.',
      ranking: 'Exact query operation; distinct repositories and owners; explicit common network; then review exact types, dependency versions, provider packaging, freshness/finality and trust. Evidence-id SHA only breaks full ties.',
      result: { roleAssessments, hypothesisCount: retainedHypotheses.length, selectedCandidateId: selectedCandidate, rejectedHypotheses: retainedHypotheses, rejectedOperationEdges: discovered.rejected, discardedUntrustedObservations: discovered.discardedObservationCount },
    },
    extractedCapabilityEvidence: allObservations.filter(row => ['data_query_call', 'data_query_export', 'data_query_route_handler', 'network_contract', 'declared_network', 'client_network', 'dependency', 'locked_dependency', 'rust_dependency'].includes(row.kind))
      .sort((a, b) => a.projectId.localeCompare(b.projectId) || a.path.localeCompare(b.path) || a.startLine - b.startLine || a.id.localeCompare(b.id))
      .map(retainedObservation),
    licenseReview: { path: 'evidence/tc-01e/gate-c-functional/license-review.json', sha256: sha(licenseBytes), method: 'GitHub REST license endpoint queried at each frozen full source revision; unknown means GitHub did not identify a repository license file at that revision.', redistribution: 'No upstream source or generated bundle is included in this attempt report. Source locations, Trycove-authored facts and extracted-evidence hashes are retained. No third-party source was executed or integrated.' },
    existingImplementationReview: retainedHypotheses.map(hypothesis => ({ hypothesisId: hypothesis.id,
      finding: hypothesis.provider.api.kind === 'data_query_export'
        ? 'The consumer already performs this exact CKB query in its application code. The provider export delegates to the same query operation; no new data source, response semantics, freshness guarantee, validation, failure reduction or measurable behavior change is evidenced by the pinned source.'
        : 'The consumer already performs this exact CKB query in its application code. The provider handler also calls the same operation, but no distinct response semantics, freshness guarantee, validation, failure reduction or measurable behavior change is evidenced by the pinned source.',
      evidence: [hypothesis.consumer.call.sourceUrl, hypothesis.provider.api.sourceUrl],
      decision: 'Rejected before execution because the required product value is not source-supported.' })),
    priorArt: { status: 'not-run-no-candidate', scope: 'No edge met the frozen role, compatibility and value requirements. No GitHub issues or pull requests were used for selection or consulted after the no-candidate result.' },
    chosenCandidate: null,
    uiProjection: { path: uiOutput, sha256: sha(uiBytes), purpose: 'Reduced no-code projection imported by the Product Passport and functional discovery page so the result is included in production builds.' },
    decision: discovered.hypotheses.length ? 'No defensible functional candidate: exact query-name hypotheses were rejected because the consumer already performs the same operation and the provider adds no observed capability.' : 'No defensible functional candidate: the frozen cohort contained no exact consumer-to-provider data-query interface pair.',
    limitations: [
      'The capability family was limited to CKB transaction and live-cell queries. No other interface family was evaluated.',
      'Static source analysis cannot prove runtime reachability, deployed service availability, live network identity, response freshness, finality or adoption.',
      'Provider route and exported-method observations are hypotheses; authentication, public packaging, server operation and trust boundaries still require manual review.',
      'The hitbtc-api source pin had zero supported files and remains a failed source inspection in its frozen slot.',
      'No pair-specific prior-art search, adapter, execution receipt or integration-lab route was produced because no defensible candidate passed the frozen value requirement.',
    ],
  };
  const bytes = Buffer.from(`${JSON.stringify(report, null, 2)}\n`);
  await mkdir('evidence/tc-01e/gate-c-functional', { recursive: true });
  await writeFile(uiOutput, uiBytes, { flag: 'wx' });
  await writeFile(`${uiOutput}.sha256`, `${sha(uiBytes)}  ${uiOutput.split('/').at(-1)}\n`, { flag: 'wx' });
  await writeFile(output, bytes, { flag: 'wx' });
  await writeFile(`${output}.sha256`, `${sha(bytes)}  ${name}\n`, { flag: 'wx' });
  console.log(JSON.stringify({ report: output, sha256: sha(bytes), roleCounts: { consumerProjects: roleAssessments.filter(row => row.consumerCallCount > 0).length, providerProjects: roleAssessments.filter(row => row.providerApiCount > 0).length }, hypothesisCount: discovered.hypotheses.length, rejectedOperationEdges: discovered.rejected.length, selectedCandidateId: null }, null, 2));
  process.exit(0);
}

main().catch(error => { console.error(error instanceof Error ? error.stack : String(error)); process.exit(1); });
