import {projectQualifiedMemberships} from './qualified-map';
import {and, desc, eq, inArray, isNull, or} from 'drizzle-orm';
import {db} from './db';
import {
  candidateCapabilities,
  evidence,
  footprintObservations,
  needItems,
  opportunities,
  projects,
  signalIntents,
  signals,
  technicalFootprints,
  trialEvidenceRecords,
  trialRuns,
} from './schema';
import {
  addClassificationEvidence,
  classifyCapabilityLabel,
  classifyDirectoryCategory,
  classifyIntentScope,
  classifySourceClaim,
  PROBLEM_DOMAINS,
  type ClassificationEvidence,
} from './problem-map';

const CATEGORY_PREFIX = 'CKBdapps category: ';
const MAP_FOOTPRINT_KINDS = [
  'api_route',
  'data_query_call',
  'data_query_export',
  'data_query_route_handler',
  'live_cell_query',
  'transaction_lookup',
  'function',
  'interface_declaration',
  'locked_dependency',
  'client_network',
  'declared_network',
  'signing',
  'broadcast',
] as const;

type ProjectSummary = Pick<typeof projects.$inferSelect, 'id' | 'name' | 'description' | 'website' | 'repository' | 'sourceUrl' | 'revision' | 'observedAt'>;
type Memberships = Map<string, Map<string, ClassificationEvidence[]>>;

function applyMemberships(
  result: Memberships,
  projectId: string,
  classification: { slug: string },
  row: ClassificationEvidence,
) {
  const memberships = result.get(projectId) ?? new Map<string, ClassificationEvidence[]>();
  addClassificationEvidence(memberships, classification.slug, row);
  result.set(projectId, memberships);
}

function buildMemberships(
  signalRows: Array<{ projectId: string; kind: string; claim: string; sourceUrl: string; revision: string; verification: string }>,
  intentRows: Array<{ projectId: string; scope: string; sourceUrl: string; revision: string; verification: string }>,
  capabilityRows: Array<{ opportunityId: string; capability: string; consumerProjectId: string; providerProjectId: string; lifecycleState: string; compatibilityState: string }>,
) {
  const result: Memberships = new Map();
  for (const row of signalRows) {
    if (row.kind === 'product-category' && row.claim.startsWith(CATEGORY_PREFIX)) {
      const category = row.claim.slice(CATEGORY_PREFIX.length);
      for (const domain of classifyDirectoryCategory(category)) {
        applyMemberships(result, row.projectId, domain, {
          kind: 'directory-category', label: category, sourceUrl: row.sourceUrl,
          revision: row.revision, verification: row.verification,
        });
      }
    }
    for (const domain of classifySourceClaim(row.claim)) {
      const phrase = domain.sourceClaimPhrases?.find((item) => row.claim.toLowerCase().includes(item.toLowerCase()));
      if (!phrase) continue;
      applyMemberships(result, row.projectId, domain, {
        kind: 'source-claim', label: `Source claim references “${phrase}”`, sourceUrl: row.sourceUrl,
        revision: row.revision, verification: row.verification,
      });
    }
  }
  for (const row of intentRows) {
    for (const domain of classifyIntentScope(row.scope)) {
      applyMemberships(result, row.projectId, domain, {
        kind: 'source-intent', label: row.scope, sourceUrl: row.sourceUrl,
        revision: row.revision, verification: row.verification,
      });
    }
  }
  for (const row of capabilityRows) {
    for (const domain of classifyCapabilityLabel(row.capability)) {
      const evidenceRow: ClassificationEvidence = {
        kind: 'recorded-capability', label: row.capability,
        verification: `${row.lifecycleState} · compatibility ${row.compatibilityState}`,
        opportunityId: row.opportunityId,
      };
      applyMemberships(result, row.consumerProjectId, domain, evidenceRow);
      applyMemberships(result, row.providerProjectId, domain, evidenceRow);
    }
  }
  return result;
}

async function classificationInputs(projectId?: string) {
  const whereProject = projectId ? eq(signals.projectId, projectId) : undefined;
  const scopedSignalKinds = or(
    eq(signals.kind, 'product-category'),
    inArray(signals.kind, ['capability', 'provides', 'need', 'obstacle']),
  );
  const whereIntentProject = projectId ? eq(signalIntents.projectId, projectId) : undefined;
  const whereCapabilityProject = projectId
    ? or(eq(candidateCapabilities.consumerProjectId, projectId), eq(candidateCapabilities.providerProjectId, projectId))
    : undefined;
  return Promise.all([
    db.select({projectId: signals.projectId, kind: signals.kind, claim: signals.claim, sourceUrl: signals.sourceUrl, revision: signals.revision, verification: signals.verification})
      .from(signals).where(and(scopedSignalKinds, whereProject)),
    db.select({projectId: signalIntents.projectId, scope: signalIntents.scope, sourceUrl: signalIntents.sourceUrl, revision: signalIntents.revision, verification: signalIntents.verification})
      .from(signalIntents).where(whereIntentProject),
    db.select({opportunityId: candidateCapabilities.opportunityId, capability: candidateCapabilities.capability, consumerProjectId: candidateCapabilities.consumerProjectId, providerProjectId: candidateCapabilities.providerProjectId, lifecycleState: candidateCapabilities.lifecycleState, compatibilityState: candidateCapabilities.compatibilityState})
      .from(candidateCapabilities).where(whereCapabilityProject),
  ]);
}

export async function getProblemMapOverview() {
  const [allProjects, categories, intents, capabilities] = await Promise.all([
    db.select({id: projects.id, name: projects.name, description: projects.description, website: projects.website, repository: projects.repository, sourceUrl: projects.sourceUrl, revision: projects.revision, observedAt: projects.observedAt})
      .from(projects).orderBy(projects.name),
    db.select({projectId: signals.projectId, kind: signals.kind, claim: signals.claim, sourceUrl: signals.sourceUrl, revision: signals.revision, verification: signals.verification})
      .from(signals).where(or(eq(signals.kind, 'product-category'), inArray(signals.kind, ['capability', 'provides', 'need', 'obstacle']))),
    db.select({projectId: signalIntents.projectId, scope: signalIntents.scope, sourceUrl: signalIntents.sourceUrl, revision: signalIntents.revision, verification: signalIntents.verification})
      .from(signalIntents),
    db.select({opportunityId: candidateCapabilities.opportunityId, capability: candidateCapabilities.capability, consumerProjectId: candidateCapabilities.consumerProjectId, providerProjectId: candidateCapabilities.providerProjectId, lifecycleState: candidateCapabilities.lifecycleState, compatibilityState: candidateCapabilities.compatibilityState})
      .from(candidateCapabilities),
  ]);
  const memberships = buildMemberships(categories, intents, capabilities);
  const counts = new Map<string, number>();
  for (const domain of PROBLEM_DOMAINS) counts.set(domain.slug, 0);
  for (const [id, member] of memberships) {
    const projected = projectQualifiedMemberships(id, member);
    if (projected.size) memberships.set(id, projected);
    else memberships.delete(id);
    for (const slug of projected.keys()) counts.set(slug, (counts.get(slug) ?? 0) + 1);
  }
  return {
    projects: allProjects as ProjectSummary[],
    memberships,
    counts,
    unclassifiedCount: allProjects.filter((project) => !memberships.has(project.id)).length,
  };
}

export async function getProjectProblemDomains(projectId: string) {
  const [categories, intents, capabilities] = await classificationInputs(projectId);
  return projectQualifiedMemberships(projectId, buildMemberships(categories, intents, capabilities).get(projectId) ?? new Map());
}

export async function getProblemDomainData(slug: string) {
  const overview = await getProblemMapOverview();
  const memberIds = overview.projects
    .filter((project) => slug === 'unclassified' ? !overview.memberships.has(project.id) : overview.memberships.get(project.id)?.has(slug))
    .map((project) => project.id);
  const memberSet = new Set(memberIds);
  const products = overview.projects.filter((project) => memberSet.has(project.id));
  if (!memberIds.length) {
    return {products, memberships: overview.memberships, signals: [], needs: [], intents: [], opportunities: [], capabilities: [], evidence: [], footprints: [], observations: [], trialReceipts: [], trialRuns: []};
  }
  const [signalRows, needRows, intentRows, opportunityRows, footprintRows] = await Promise.all([
    db.select().from(signals).where(and(inArray(signals.projectId, memberIds), inArray(signals.kind, ['capability', 'provides', 'need', 'obstacle', 'dependency', 'deployment', 'environment']))).limit(500),
    db.select().from(needItems).where(and(inArray(needItems.projectId, memberIds), isNull(needItems.supersededAt))).orderBy(desc(needItems.observedAt)).limit(1000),
    db.select().from(signalIntents).where(inArray(signalIntents.projectId, memberIds)).limit(160),
    db.select().from(opportunities).where(or(inArray(opportunities.projectA, memberIds), inArray(opportunities.projectB, memberIds))).limit(100),
    db.select().from(technicalFootprints).where(inArray(technicalFootprints.projectId, memberIds)).orderBy(desc(technicalFootprints.analyzedAt)).limit(Math.min(memberIds.length * 4, 240)),
  ]);
  const opportunityIds = opportunityRows.map((row) => row.id);
  const latestFootprints = new Map<string, (typeof footprintRows)[number]>();
  for (const footprint of footprintRows) if (!latestFootprints.has(footprint.projectId)) latestFootprints.set(footprint.projectId, footprint);
  const latestFootprintIds = [...latestFootprints.values()].map((row) => row.id);
  const [capabilityRows, evidenceRows, observationRows, trialReceipts, trialRunRows] = await Promise.all([
    opportunityIds.length ? db.select().from(candidateCapabilities).where(inArray(candidateCapabilities.opportunityId, opportunityIds)) : Promise.resolve([]),
    opportunityIds.length ? db.select().from(evidence).where(inArray(evidence.opportunityId, opportunityIds)) : Promise.resolve([]),
    latestFootprintIds.length ? db.select().from(footprintObservations).where(and(inArray(footprintObservations.footprintId, latestFootprintIds), inArray(footprintObservations.kind, [...MAP_FOOTPRINT_KINDS]))).limit(180) : Promise.resolve([]),
    opportunityIds.length ? db.select({id:trialEvidenceRecords.id,opportunityId:trialEvidenceRecords.opportunityId,mode:trialEvidenceRecords.mode,result:trialEvidenceRecords.result,evidenceLevel:trialEvidenceRecords.evidenceLevel,receiptSha256:trialEvidenceRecords.receiptSha256,createdAt:trialEvidenceRecords.createdAt}).from(trialEvidenceRecords).where(inArray(trialEvidenceRecords.opportunityId, opportunityIds)).orderBy(desc(trialEvidenceRecords.createdAt)) : Promise.resolve([]),
    opportunityIds.length ? db.select().from(trialRuns).where(inArray(trialRuns.opportunityId, opportunityIds)).orderBy(desc(trialRuns.observedAt)) : Promise.resolve([]),
  ]);
  return {
    products,
    memberships: overview.memberships,
    signals: signalRows,
    needs: needRows,
    intents: intentRows,
    opportunities: opportunityRows,
    capabilities: capabilityRows,
    evidence: evidenceRows,
    footprints: [...latestFootprints.values()],
    observations: observationRows,
    trialReceipts,
    trialRuns: trialRunRows,
  };
}
