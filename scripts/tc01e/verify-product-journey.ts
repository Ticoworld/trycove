import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { and, eq, sql } from 'drizzle-orm';
import { db } from '../../lib/db';
import { evidence, externalSourceSnapshots, footprintObservations, opportunities, projects, sourceRecords, technicalFootprints, trialEvidenceRecords, trialRuns, followUps } from '../../lib/schema';

const hash = (data: Buffer | string) => createHash('sha256').update(data).digest('hex');
function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
async function main() {
  const discoveryPath = 'evidence/tc-01e/discovery/source-discovery-2026-11-17T21-44-13-815Z.json';
  const discoveryBytes = await readFile(discoveryPath);
  const discovery = JSON.parse(discoveryBytes.toString('utf8')) as {
    discovery: { selectedCandidateId: string; candidates: Array<{ id: string; consumer: { projectId: string; repository: string; revision: string }; provider: { projectId: string; repository: string; revision: string } }> };
    persistence: { opportunityId: string; requested: boolean };
    frozenCohort: { path: string; sha256: string; selectedRepositories: number };
    sourceScan: { path: string; sha256: string; completed: number; analyzerVersion: string };
    priorArt: { status: string; searches: Array<{ status: string; totalCount?: number }> };
  };
  assert(discovery.discovery.selectedCandidateId, 'No engine-selected candidate is present');
  assert(discovery.persistence.requested && discovery.persistence.opportunityId, 'Discovery output was not persisted');
  assert(discovery.frozenCohort.selectedRepositories === 12 && discovery.sourceScan.completed === 12 && discovery.sourceScan.analyzerVersion === '1.9.1', 'Frozen code scan is incomplete');
  assert(discovery.priorArt.searches.length === 8 && discovery.priorArt.searches.every(item => item.status === 'available'), 'Prior-art query evidence is incomplete');

  const cohortBytes = await readFile(discovery.frozenCohort.path);
  const scanBytes = await readFile(discovery.sourceScan.path);
  assert(hash(cohortBytes) === discovery.frozenCohort.sha256 && hash(scanBytes) === discovery.sourceScan.sha256, 'Frozen discovery input digest mismatch');
  const candidate = discovery.discovery.candidates.find(item => item.id === discovery.discovery.selectedCandidateId);
  assert(candidate, 'Selected candidate is missing from the discovery result');
  const [opportunity] = await db.select().from(opportunities).where(eq(opportunities.id, discovery.persistence.opportunityId));
  assert(opportunity && opportunity.projectA === candidate.consumer.projectId && opportunity.projectB === candidate.provider.projectId, 'Saved opportunity does not match the engine-selected candidate');
  const [consumer] = await db.select().from(projects).where(eq(projects.id, candidate.consumer.projectId));
  const [provider] = await db.select().from(projects).where(eq(projects.id, candidate.provider.projectId));
  assert(consumer && provider, 'Imported product identities are missing');

  const sourceEvidence = await db.select().from(evidence).where(eq(evidence.opportunityId, opportunity.id));
  const persistedSearches = sourceEvidence.filter(item => item.verification === 'bounded_source_search');
  assert(persistedSearches.length >= 8, 'Bounded prior-art responses are not all persisted');
  const findings = await db.select().from(followUps).where(and(eq(followUps.opportunityId, opportunity.id), eq(followUps.kind, 'finding')));
  assert(findings.length > 0 && findings.some(item => item.note.includes('No maintainer or partner contact occurred')), 'Prior-art result or no-contact state is not recorded in the follow-up ledger');

  const receiptDir = 'evidence/tc-01e/execution';
  const receiptFiles = (await readdir(receiptDir)).filter(name => name.endsWith('.json') && !name.endsWith('.sha256'));
  assert(receiptFiles.length > 0, 'No execution receipt is available');
  const receipts = await Promise.all(receiptFiles.map(async name => ({ name, bytes: await readFile(join(receiptDir, name)) })));
  const latest = receipts.map(({ name, bytes }) => ({ name, bytes, value: JSON.parse(bytes.toString('utf8')) as { id: string; opportunityId: string; candidateId: string; startedAt: string; receiptSha256: string; executionResult: string; overallGateAssessment: string; bundleSha256: string; cases: Array<{ result: string }>; source: { consumer: { revision: string }; provider: { revision: string } } } })).sort((a, b) => a.value.startedAt.localeCompare(b.value.startedAt)).at(-1)!;
  const { receiptSha256, ...receiptBody } = latest.value;
  assert(hash(latest.bytes) === (await readFile(join(receiptDir, `${latest.name}.sha256`), 'utf8')).split(/\s+/)[0], 'Receipt file digest sidecar mismatch');
  assert(hash(JSON.stringify(receiptBody)) === receiptSha256, 'Receipt internal integrity digest mismatch');
  assert(latest.value.opportunityId === opportunity.id && latest.value.candidateId === discovery.discovery.selectedCandidateId, 'Execution receipt is not tied to the selected opportunity');
  assert(latest.value.source.consumer.revision === candidate.consumer.revision && latest.value.source.provider.revision === candidate.provider.revision, 'Execution receipt source revisions differ from candidate');
  assert(latest.value.executionResult === 'passed' && latest.value.overallGateAssessment === 'partial' && latest.value.cases.length >= 5 && latest.value.cases.every(item => item.result === 'passed'), 'Execution outcomes or evidence limits are not explicit');
  const [persistedReceipt] = await db.select().from(trialEvidenceRecords).where(eq(trialEvidenceRecords.id, latest.value.id));
  assert(persistedReceipt?.receiptSha256 === receiptSha256 && persistedReceipt.mode === 'real-upstream-source-interface-isolated', 'Execution receipt is not persisted in the existing trial evidence table');
  const associatedRuns = await db.select().from(trialRuns).where(eq(trialRuns.opportunityId, opportunity.id));
  assert(associatedRuns.some(item => item.details.includes(latest.value.id)), 'Integration Lab trial record is missing');

  const [projectCount, ckbDappsCount, pulseRepoCount, footprintCount, observationCount] = await Promise.all([
    db.select({ value: sql<number>`count(*)::int` }).from(projects),
    db.select().from(sourceRecords).where(eq(sourceRecords.source, 'CKBdapps JSON')),
    db.select().from(externalSourceSnapshots).where(eq(externalSourceSnapshots.source, 'ckb-pulse-repo')),
    db.select({ value: sql<number>`count(*)::int` }).from(technicalFootprints),
    db.select({ value: sql<number>`count(*)::int` }).from(footprintObservations),
  ]);
  const importedProjects = Number(projectCount[0]?.value ?? 0);
  const pinnedFootprints = Number(footprintCount[0]?.value ?? 0);
  const allObservations = Number(observationCount[0]?.value ?? 0);
  const ckbDappsImported = ckbDappsCount.length;
  const pulseRepositorySnapshots = pulseRepoCount.length;
  const trialReceiptRows = await db.select().from(trialEvidenceRecords).where(eq(trialEvidenceRecords.opportunityId, opportunity.id));
  const result = {
    database: process.env.DATABASE_URL ? 'PostgreSQL' : 'PGlite fallback',
    importedInventory: { projects: importedProjects, ckbDappsProjectSourceRecords: ckbDappsImported, pulseRepositorySnapshots, pinnedFootprints, footprintObservations: allObservations },
    frozenInput: { cohortSha256: discovery.frozenCohort.sha256, repositories: discovery.frozenCohort.selectedRepositories, scanSha256: discovery.sourceScan.sha256, analyzerVersion: discovery.sourceScan.analyzerVersion },
    discovery: { candidateId: discovery.discovery.selectedCandidateId, candidatesGenerated: discovery.discovery.candidates.length, consumer: { id: consumer.id, name: consumer.name, repository: candidate.consumer.repository, profilePath: `/projects/${consumer.id}` }, provider: { id: provider.id, name: provider.name, repository: candidate.provider.repository, profilePath: `/projects/${provider.id}` }, opportunityId: opportunity.id, workspacePath: `/opportunities/${opportunity.id}`, priorArt: discovery.priorArt.status, indexedSearches: discovery.priorArt.searches.length, persistedPriorArtEvidence: persistedSearches.length, followUpFindings: findings.length },
    execution: { receiptPath: join(receiptDir, latest.name), receiptId: latest.value.id, result: latest.value.executionResult, gateAssessment: latest.value.overallGateAssessment, mode: persistedReceipt.mode, evidenceLevel: persistedReceipt.evidenceLevel, positiveAndNegativeCases: latest.value.cases.length, historicalReceiptsPreserved: trialReceiptRows.length, labPath: `/trials/${latest.value.id}` },
    externalOutcome: 'NO_EXTERNAL_PARTICIPATION_VERIFIED',
  };
  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
}

main().catch(error => { console.error(error instanceof Error ? error.stack : String(error)); process.exit(1); });
