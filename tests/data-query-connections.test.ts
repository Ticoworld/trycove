import { describe, expect, it } from 'vitest';
import { discoverDataQueryConnections, type DataQueryObservation } from '../lib/intelligence/data-query-connections';

const revision = 'a'.repeat(40);
const row = (projectId: string, repository: string, kind: string, fact: string, id: string, path = 'src/service.ts'): DataQueryObservation => ({
  id, projectId, repository: `https://github.com/${repository}`, revision, path, startLine: 3, endLine: 9,
  dimension: 'state', kind, fact, evidence: fact, verification: 'source_observed',
});
const consumerRows = (projectId = 'app', repository = 'builder/app'): DataQueryObservation[] => [
  row(projectId, repository, 'data_query_call', 'Application calls CKB getTransaction; typed call (hash: string) => Promise<Transaction | undefined>', `${projectId}-query`),
  row(projectId, repository, 'network_contract', 'Network type permits mainnet, testnet', `${projectId}-network`),
  row(projectId, repository, 'locked_dependency', '@ckb-ccc/core: 1.2.3', `${projectId}-dep`, 'pnpm-lock.yaml'),
];
const providerRows = (projectId = 'service', repository = 'provider/service'): DataQueryObservation[] => [
  row(projectId, repository, 'data_query_export', 'Exported query method getTransaction maps to CKB getTransaction; signature getTransaction(hash: string): Promise<Transaction | undefined>', `${projectId}-api`),
  row(projectId, repository, 'client_network', 'Constructs ClientPublicMainnet', `${projectId}-network`),
];

describe('functional CKB data-query discovery', () => {
  it('retains an exact source interface hypothesis and rejects it when no new value is evidenced', () => {
    const result = discoverDataQueryConnections([...consumerRows(), ...providerRows()]);
    expect(result.hypotheses).toHaveLength(1);
    expect(result.hypotheses[0]).toMatchObject({
      status: 'rejected_no_demonstrated_value',
      consumer: { operation: 'getTransaction', networks: ['mainnet', 'testnet'] },
      provider: { operation: 'getTransaction', networks: ['mainnet'] },
      valueAssessment: { state: 'not-demonstrated' },
    });
    expect(result.hypotheses[0]?.compatibility[0]?.state).toBe('source-compatible');
    expect(result.hypotheses[0]?.compatibility[2]?.state).toBe('unknown');
  });

  it('rejects same-owner pairs and does not match shared CKB dependencies alone', () => {
    const sameOwner = discoverDataQueryConnections([
      ...consumerRows('app', 'one/app'),
      ...providerRows('service', 'one/service'),
    ]);
    expect(sameOwner.hypotheses).toEqual([]);
    expect(sameOwner.rejected.some(item => item.reason.includes('Same GitHub owner'))).toBe(true);

    const dependencies = [
      row('one', 'one/app', 'locked_dependency', '@ckb-ccc/core: 1.2.3', 'one-dep', 'pnpm-lock.yaml'),
      row('two', 'two/service', 'locked_dependency', '@ckb-ccc/core: 1.2.3', 'two-dep', 'pnpm-lock.yaml'),
    ];
    const noInterfaces = discoverDataQueryConnections(dependencies);
    expect(noInterfaces.hypotheses).toEqual([]);
    expect(noInterfaces.roleAssessments.every(role => role.missing.length === 2)).toBe(true);
  });

  it('rejects unpinned, fixture and unverified observations', () => {
    const rejected: DataQueryObservation[] = [
      { ...consumerRows()[0]!, revision: 'main' },
      { ...providerRows()[0]!, path: 'fixtures/provider.ts' },
      { ...providerRows()[0]!, verification: 'hypothesis' },
    ];
    const result = discoverDataQueryConnections(rejected);
    expect(result.hypotheses).toEqual([]);
    expect(result.discardedObservationCount).toBe(3);
  });
});
