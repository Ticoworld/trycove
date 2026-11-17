import { describe, expect, it } from 'vitest';
import { discoverTransactionInspectorConnections, type InterfaceObservation } from '../lib/intelligence/product-connections';

const revision = 'a'.repeat(40);
const row = (projectId: string, repository: string, kind: string, fact: string, path = 'src/interface.ts', id = `${projectId}-${kind}`): InterfaceObservation => ({
  id, projectId, repository: `https://github.com/${repository}`, revision, path, startLine: 1, endLine: 8, kind, fact, evidence: fact, verification: 'source_observed',
});
const consumer = (network = 'testnet', projectId = 'consumer', repository = 'builder/app'): InterfaceObservation[] => [
  row(projectId, repository, 'transaction_explorer_link', 'Builds a CKB transaction explorer URL at transactions.explorer.nervos.org from a transaction-hash expression', 'src/History.tsx', `${projectId}-link`),
  row(projectId, repository, 'broadcast', 'Calls sendTransaction', 'src/actions.ts', `${projectId}-send`),
  row(projectId, repository, 'declared_network', `Configuration selects ${network}`, 'src/provider.tsx', `${projectId}-network`),
];
const provider = (networks = ['mainnet', 'testnet'], projectId = 'viewer', repository = 'viewer/product'): InterfaceObservation[] => [
  row(projectId, repository, 'transaction_deep_link', 'Builds a transaction deep link with a network query', 'src/url.ts', `${projectId}-build`),
  row(projectId, repository, 'transaction_deep_link_parser', 'Parses a network-scoped CKB transaction route and validates the 32-byte transaction hash', 'src/url.ts', `${projectId}-parse`),
  row(projectId, repository, 'network_contract', `Network type permits ${networks.join(', ')}`, 'src/types.ts', `${projectId}-networks`),
];

describe('capability-first product interface discovery', () => {
  it('derives a source-backed candidate from a consumer hash link and provider deep-link contract', () => {
    const result = discoverTransactionInspectorConnections([...consumer(), ...provider()]);
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]).toMatchObject({ kind: 'transaction-inspector-deep-link', evidenceLevel: 'source-observed hypothesis', consumer: { projectId: 'consumer', network: 'testnet' }, provider: { projectId: 'viewer', networks: ['mainnet', 'testnet'] } });
    expect(result.candidates[0]?.findings.find(x => x.dimension === 'chain compatibility')?.state).toBe('out-of-scope');
  });

  it('does not match shared CKB or CCC dependencies without functional interface evidence', () => {
    const rows = [row('a', 'one/app', 'locked_dependency', '@ckb-ccc/core: 1.2.0'), row('b', 'two/app', 'locked_dependency', '@ckb-ccc/core: 1.2.0')];
    expect(discoverTransactionInspectorConnections(rows).candidates).toEqual([]);
  });

  it('rejects unsupported networks and missing validation evidence', () => {
    const wrongNetwork = discoverTransactionInspectorConnections([...consumer('testnet'), ...provider(['mainnet'])]);
    expect(wrongNetwork.candidates).toEqual([]);
    expect(wrongNetwork.rejected.networkMismatch).toBeGreaterThan(0);
    const noParser = discoverTransactionInspectorConnections([...consumer(), ...provider().filter(x => x.kind !== 'transaction_deep_link_parser')]);
    expect(noParser.candidates).toEqual([]);
    expect(noParser.rejected.missingProviderEvidence).toBeGreaterThan(0);
  });

  it('rejects self matches and unverified third-party observations', () => {
    const self = discoverTransactionInspectorConnections([...consumer('testnet', 'same', 'same/repo'), ...provider(['testnet'], 'same', 'same/repo')]);
    expect(self.candidates).toEqual([]);
    expect(self.rejected.selfMatch).toBeGreaterThan(0);
    const unverified = discoverTransactionInspectorConnections([...consumer(), ...provider().map(x => ({ ...x, verification: 'hypothesis' }))]);
    expect(unverified.candidates).toEqual([]);
    expect(unverified.rejected.invalidEvidence).toBeGreaterThan(0);
  });
});
