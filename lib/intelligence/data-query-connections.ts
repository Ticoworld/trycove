import { createHash } from 'node:crypto';

export type DataQueryObservation = {
  id: string;
  projectId: string;
  repository: string;
  revision: string;
  path: string;
  startLine: number;
  endLine: number;
  dimension: string;
  kind: string;
  fact: string;
  evidence: string;
  verification: string;
};

type ProductGroup = {
  projectId: string;
  repository: string;
  revision: string;
  owner: string;
  observations: DataQueryObservation[];
};

export type DataQueryHypothesis = {
  id: string;
  status: 'rejected_no_demonstrated_value' | 'needs_boundary_review';
  consumer: { projectId: string; repository: string; revision: string; operation: string; call: DataQueryObservation; callCount: number; networks: string[]; dependencies: string[] };
  provider: { projectId: string; repository: string; revision: string; operation: string; api: DataQueryObservation; apiCount: number; networks: string[]; dependencies: string[] };
  interfaceMapping: string;
  compatibility: Array<{ dimension: string; state: 'source-compatible' | 'unknown' | 'incompatible'; explanation: string }>;
  valueAssessment: { state: 'not-demonstrated'; explanation: string };
  rejectionReasons: string[];
};

const sha = (parts: string[]) => createHash('sha256').update(parts.join('\0')).digest('hex');
const groupKey = (row: DataQueryObservation) => `${row.projectId}\0${row.repository}\0${row.revision}`;
const usablePath = (path: string) => !/(?:^|\/)(?:test|tests|fixture|fixtures|example|examples|mock|mocks|vendor|node_modules)(?:\/|$)|(?:\.test|\.spec|_test)\.[cm]?[jt]sx?$/i.test(path);

function operationFromFact(fact: string): string | null {
  return /\bCKB\s+([A-Za-z][A-Za-z0-9]*)\b/.exec(fact)?.[1] ?? null;
}

function networks(rows: DataQueryObservation[]): string[] {
  const values = new Set<string>();
  for (const row of rows) {
    if (row.kind === 'network_contract') {
      for (const match of row.fact.matchAll(/\b(mainnet|testnet|devnet)\b/g)) values.add(match[1]!);
    }
    if (row.kind === 'client_network') {
      const match = /ClientPublic(Mainnet|Testnet)/.exec(row.fact);
      if (match) values.add(match[1]!.toLowerCase());
    }
    if (row.kind === 'declared_network') {
      const match = /\b(mainnet|testnet|devnet)\b/i.exec(row.fact);
      if (match) values.add(match[1]!.toLowerCase());
    }
  }
  return [...values].sort();
}

function dependencies(rows: DataQueryObservation[]): string[] {
  return [...new Set(rows.filter(row => ['dependency', 'locked_dependency', 'rust_dependency'].includes(row.kind) && /\b(?:ckb|nervos|ccc)\b/i.test(row.fact)).map(row => row.fact))].sort();
}

function operationOfProvider(row: DataQueryObservation): string | null {
  return /\bmaps to CKB\s+([A-Za-z][A-Za-z0-9]*)\b/.exec(row.fact)?.[1]
    ?? operationFromFact(row.fact);
}

/**
 * Finds typed CKB query call / query provider edges in a frozen set of source
 * observations. This deliberately emits hypotheses; source matches alone never
 * establish provider behavior, value, deployment, compatibility, or adoption.
 */
export function discoverDataQueryConnections(observations: DataQueryObservation[]) {
  const trusted = observations.filter(row => row.verification === 'source_observed'
    && /^[a-f0-9]{40}$/.test(row.revision)
    && /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+$/.test(row.repository)
    && row.startLine > 0 && row.endLine >= row.startLine && usablePath(row.path));
  const groups = new Map<string, ProductGroup>();
  for (const row of trusted) {
    const key = groupKey(row);
    const owner = new URL(row.repository).pathname.split('/').filter(Boolean)[0]!.toLowerCase();
    const group = groups.get(key) ?? { projectId: row.projectId, repository: row.repository, revision: row.revision, owner, observations: [] };
    group.observations.push(row);
    groups.set(key, group);
  }

  const consumers = [...groups.values()].flatMap(group => {
    const byOperation = new Map<string, DataQueryObservation[]>();
    for (const call of group.observations.filter(row => row.kind === 'data_query_call')) {
      const operation = operationFromFact(call.fact);
      if (operation) byOperation.set(operation, [...(byOperation.get(operation) ?? []), call]);
    }
    return [...byOperation.entries()].map(([operation, calls]) => ({ group, operation, callCount: calls.length,
      call: calls.sort((a, b) => a.path.localeCompare(b.path) || a.startLine - b.startLine || a.id.localeCompare(b.id))[0]! }));
  });
  const providers = [...groups.values()].flatMap(group => {
    const byOperation = new Map<string, DataQueryObservation[]>();
    for (const api of group.observations.filter(row => row.kind === 'data_query_export' || row.kind === 'data_query_route_handler')) {
      const operation = operationOfProvider(api);
      if (operation) byOperation.set(operation, [...(byOperation.get(operation) ?? []), api]);
    }
    return [...byOperation.entries()].map(([operation, apis]) => ({ group, operation, apiCount: apis.length,
      api: apis.sort((a, b) => (a.kind === 'data_query_route_handler' ? 0 : 1) - (b.kind === 'data_query_route_handler' ? 0 : 1) || a.path.localeCompare(b.path) || a.startLine - b.startLine || a.id.localeCompare(b.id))[0]! }));
  });
  const roleAssessments = [...groups.values()].map(group => {
    const consumerRows = group.observations.filter(row => row.kind === 'data_query_call');
    const providerRows = group.observations.filter(row => row.kind === 'data_query_export' || row.kind === 'data_query_route_handler');
    return {
      projectId: group.projectId,
      repository: group.repository,
      revision: group.revision,
      owner: group.owner,
      consumerOperations: [...new Set(consumerRows.map(row => operationFromFact(row.fact)).filter((x): x is string => Boolean(x)))].sort(),
      consumerCallCount: consumerRows.length,
      providerOperations: [...new Set(providerRows.map(operationOfProvider).filter((x): x is string => Boolean(x)))].sort(),
      providerApiCount: providerRows.length,
      networks: networks(group.observations),
      missing: [!consumerRows.length ? 'no supported non-test CKB data-query call was observed' : null,
        !providerRows.length ? 'no concrete exported query method or executable query handler was observed' : null].filter((x): x is string => Boolean(x)),
    };
  }).sort((a, b) => a.projectId.localeCompare(b.projectId) || a.repository.localeCompare(b.repository));

  const hypotheses: DataQueryHypothesis[] = [];
  const rejected: Array<{ consumerProjectId: string; providerProjectId: string; consumerRepository: string; providerRepository: string; operation: string; reason: string; consumerEvidenceId: string; providerEvidenceId: string }> = [];
  for (const consumer of consumers) for (const provider of providers) {
    if (consumer.group.projectId === provider.group.projectId || consumer.group.repository === provider.group.repository) continue;
    const base = { consumerProjectId: consumer.group.projectId, providerProjectId: provider.group.projectId, consumerRepository: consumer.group.repository, providerRepository: provider.group.repository, operation: consumer.operation, consumerEvidenceId: consumer.call.id, providerEvidenceId: provider.api.id };
    if (consumer.operation !== provider.operation) {
      rejected.push({ ...base, reason: `Provider operation ${provider.operation} does not satisfy consumer operation ${consumer.operation}.` });
      continue;
    }
    if (consumer.group.owner === provider.group.owner) {
      rejected.push({ ...base, reason: 'Same GitHub owner; not evidence of connecting independent builders.' });
      continue;
    }
    const consumerNetworks = networks(consumer.group.observations);
    const providerNetworks = networks(provider.group.observations);
    const sharedNetworks = consumerNetworks.filter(value => providerNetworks.includes(value));
    const compatibility: DataQueryHypothesis['compatibility'] = [
      { dimension: 'query operation', state: 'source-compatible', explanation: `Both sides name CKB ${consumer.operation}; static observations do not establish compatible response semantics.` },
      { dimension: 'network', state: sharedNetworks.length ? 'source-compatible' : 'unknown', explanation: sharedNetworks.length ? `Both source sets mention ${sharedNetworks.join(', ')}; current remote identity and deployment remain unverified.` : `No explicit common network was found (consumer: ${consumerNetworks.join(', ') || 'unknown'}; provider: ${providerNetworks.join(', ') || 'unknown'}).` },
      { dimension: 'types and response fields', state: 'unknown', explanation: 'Type signatures are retained in the linked source observations; semantic equivalence, nullability, freshness and finality have not been independently established.' },
      { dimension: 'dependency and packaging', state: 'unknown', explanation: 'Dependency versions and source paths are retained, but a supported published provider package or protocol compatibility has not been established.' },
      { dimension: 'security and trust', state: 'unknown', explanation: 'Provider authentication, data provenance, rate limits, privacy and failure guarantees require source and runtime review.' },
    ];
    const reasons = [
      'The consumer already executes this same query operation in its pinned application source.',
      'No source-backed provider-specific field, indexing guarantee, trust improvement, failure reduction, or measured behavior difference was established.',
      'A candidate value proposition therefore cannot be stated without inventing improvement.',
      ...(!sharedNetworks.length ? ['No common explicit CKB network was observed.'] : []),
    ];
    const id = sha([consumer.group.projectId, provider.group.projectId, consumer.group.revision, provider.group.revision, consumer.call.id, provider.api.id]);
    hypotheses.push({
      id,
      status: 'rejected_no_demonstrated_value',
      consumer: { projectId: consumer.group.projectId, repository: consumer.group.repository, revision: consumer.group.revision, operation: consumer.operation, call: consumer.call, callCount: consumer.callCount, networks: consumerNetworks, dependencies: dependencies(consumer.group.observations) },
      provider: { projectId: provider.group.projectId, repository: provider.group.repository, revision: provider.group.revision, operation: provider.operation, api: provider.api, apiCount: provider.apiCount, networks: providerNetworks, dependencies: dependencies(provider.group.observations) },
      interfaceMapping: `Potential mapping: consumer ${consumer.operation} call at ${consumer.call.path}:${consumer.call.startLine} → provider ${provider.api.path}:${provider.api.startLine}. Input/response, version, network, freshness and trust semantics remain subject to review.`,
      compatibility,
      valueAssessment: { state: 'not-demonstrated', explanation: reasons.join(' ') },
      rejectionReasons: reasons,
    });
  }
  hypotheses.sort((a, b) => a.id.localeCompare(b.id));
  rejected.sort((a, b) => a.consumerProjectId.localeCompare(b.consumerProjectId) || a.providerProjectId.localeCompare(b.providerProjectId) || a.operation.localeCompare(b.operation) || a.consumerEvidenceId.localeCompare(b.consumerEvidenceId) || a.providerEvidenceId.localeCompare(b.providerEvidenceId));
  return { hypotheses, rejected, roleAssessments, trustedObservationCount: trusted.length, discardedObservationCount: observations.length - trusted.length };
}
