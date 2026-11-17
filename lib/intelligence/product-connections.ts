import { createHash } from 'node:crypto';

export type InterfaceObservation = {
  id: string;
  projectId: string;
  repository: string;
  revision: string;
  path: string;
  startLine: number;
  endLine: number;
  kind: string;
  fact: string;
  evidence: string;
  verification: string;
};

export type ProductConnection = {
  id: string;
  kind: 'transaction-inspector-deep-link';
  evidenceLevel: 'source-observed hypothesis';
  consumer: { projectId: string; repository: string; revision: string; network: 'mainnet' | 'testnet'; link: InterfaceObservation; submissions: InterfaceObservation[] };
  provider: { projectId: string; repository: string; revision: string; networks: Array<'mainnet' | 'testnet'>; builder: InterfaceObservation; parser: InterfaceObservation; networkContract: InterfaceObservation };
  boundary: string;
  valueHypothesis: string;
  adapter: string;
  findings: Array<{ dimension: string; state: 'source-compatible' | 'unknown' | 'out-of-scope'; explanation: string }>;
  nextExperiment: string;
};

const groupKey = (x: InterfaceObservation) => `${x.projectId}\0${x.repository}\0${x.revision}`;
const sourceLink = (x: InterfaceObservation) => `https://github.com/${x.repository.replace(/^https:\/\/github\.com\//, '')}/blob/${x.revision}/${x.path}#L${x.startLine}-L${x.endLine}`;
const isNetwork = (x: InterfaceObservation, network: string) => x.kind === 'declared_network' && new RegExp(`\\b${network}\\b`, 'i').test(x.fact);
const sha = (parts: string[]) => createHash('sha256').update(parts.join('\0')).digest('hex');

/**
 * Finds one deliberately narrow, source-inspectable product interface family:
 * an application that already publishes CKB transaction links, and a read-only
 * product that accepts network-scoped CKB transaction deep links. This is a
 * possible UI connection, not a claim of shared contracts, chain compatibility,
 * adoption, or willingness to integrate.
 */
export function discoverTransactionInspectorConnections(observations: InterfaceObservation[]) {
  const trusted = observations.filter(x => x.verification === 'source_observed' && /^[a-f0-9]{40}$/.test(x.revision) &&
    /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+$/.test(x.repository) && x.startLine > 0 && x.endLine >= x.startLine &&
    !/(?:^|\/)(?:test|tests|fixture|fixtures|example|examples|mock|mocks)(?:\/|$)/i.test(x.path));
  const groups = new Map<string, InterfaceObservation[]>();
  for (const row of trusted) groups.set(groupKey(row), [...(groups.get(groupKey(row)) ?? []), row]);
  const consumers: ProductConnection['consumer'][] = [];
  const providers: ProductConnection['provider'][] = [];
  const roleAssessments: Array<{ projectId: string; repository: string; revision: string; consumerEligible: boolean; consumerNetworks: string[]; consumerMissing: string[]; providerEligible: boolean; providerNetworks: string[]; providerMissing: string[] }> = [];
  const rejected = { selfMatch: 0, missingConsumerEvidence: 0, missingProviderEvidence: 0, networkMismatch: 0, invalidEvidence: observations.length - trusted.length };

  for (const rows of groups.values()) {
    const link = rows.find(x => x.kind === 'transaction_explorer_link');
    const submissions = rows.filter(x => x.kind === 'broadcast' && /Calls sendTransaction\b/.test(x.fact));
    const networks = [...new Set(rows.flatMap(x => ['mainnet', 'testnet'].filter(n => isNetwork(x, n))))] as Array<'mainnet' | 'testnet'>;
    const consumerMissing = [!link ? 'no source-observed CKB transaction explorer link' : null,
      !submissions.length ? 'no source-observed transaction submission result' : null,
      !networks.length ? 'no explicit mainnet/testnet configuration' : null].filter((x): x is string => x !== null);
    if (link && submissions.length && networks.length) {
      for (const network of networks) consumers.push({ projectId: rows[0]!.projectId, repository: rows[0]!.repository, revision: rows[0]!.revision, network, link, submissions });
    } else if (link || submissions.length) rejected.missingConsumerEvidence++;

    const builder = rows.find(x => x.kind === 'transaction_deep_link');
    const parser = rows.find(x => x.kind === 'transaction_deep_link_parser');
    const networkContract = rows.find(x => x.kind === 'network_contract');
    const supportedNetworks = networkContract ? (['mainnet', 'testnet'] as const).filter(n => new RegExp(`\\b${n}\\b`).test(networkContract.fact)) : [];
    const providerMissing = [!builder ? 'no transaction deep-link builder' : null,
      !parser ? 'no route parser that validates a CKB transaction hash' : null,
      !networkContract || !supportedNetworks.length ? 'no explicit provider CKB network contract' : null].filter((x): x is string => x !== null);
    if (builder && parser && networkContract && supportedNetworks.length) providers.push({ projectId: rows[0]!.projectId, repository: rows[0]!.repository, revision: rows[0]!.revision,
      networks: [...supportedNetworks], builder, parser, networkContract });
    else if (builder || parser) rejected.missingProviderEvidence++;
    roleAssessments.push({ projectId: rows[0]!.projectId, repository: rows[0]!.repository, revision: rows[0]!.revision,
      consumerEligible: consumerMissing.length === 0, consumerNetworks: networks, consumerMissing,
      providerEligible: providerMissing.length === 0, providerNetworks: [...supportedNetworks], providerMissing });
  }

  const candidates: ProductConnection[] = [];
  for (const consumer of consumers) for (const provider of providers) {
    if (consumer.projectId === provider.projectId || consumer.repository === provider.repository) { rejected.selfMatch++; continue; }
    if (!provider.networks.includes(consumer.network)) { rejected.networkMismatch++; continue; }
    const evidence = [consumer.link, ...consumer.submissions, provider.builder, provider.parser, provider.networkContract];
    const id = sha([consumer.projectId, provider.projectId, consumer.revision, provider.revision, ...evidence.map(x => x.id).sort()]);
    candidates.push({ id, kind: 'transaction-inspector-deep-link', evidenceLevel: 'source-observed hypothesis', consumer, provider,
      boundary: 'Read-only browser navigation: a CKB transaction hash and the consumer’s explicit network are converted to the provider’s documented /tx/<hash>?network=<network> route.',
      valueHypothesis: 'The consumer currently directs transaction hashes to a generic explorer page. A transaction-flow inspector could make inputs, outputs, fee and cell lineage easier to inspect; this is an inferred product benefit, not a requested feature.',
      adapter: `Validate the 0x-prefixed 32-byte hash, preserve the consumer network (${consumer.network}), call the provider deep-link builder, and allow navigation only to the pinned HTTPS origin.`,
      findings: [
        { dimension: 'transaction hash format', state: 'source-compatible', explanation: 'The provider route parser requires a 0x-prefixed 32-byte CKB transaction hash. The consumer link is built from a value returned by its CCC signer submission call; runtime value validation remains required.' },
        { dimension: 'network', state: 'source-compatible', explanation: `The consumer has a source-declared ${consumer.network} configuration and the provider type contract permits ${consumer.network}; this does not prove the transaction exists on that network.` },
        { dimension: 'browser interface', state: 'source-compatible', explanation: 'The consumer already exposes an external transaction-view link and the provider accepts a transaction deep link. The proposed adapter changes navigation only; it does not share a wallet, signer or transaction builder.' },
        { dimension: 'runtime and deployment', state: 'unknown', explanation: 'Static source evidence does not establish that the provider deployment or its network RPC is currently available.' },
        { dimension: 'chain compatibility', state: 'out-of-scope', explanation: 'No transaction is signed, rebuilt, broadcast, or validated by the proposed link adapter.' },
        { dimension: 'prior art and adoption', state: 'unknown', explanation: 'A bounded prior-art check must run after candidate generation; a source-level URL contract does not establish that this pair is already integrated or used.' },
      ],
      nextExperiment: 'Run the pinned provider URL builder and parser with a valid transaction hash on the consumer network, reject malformed hashes and unsupported networks, then open a real consumer-produced testnet transaction in the deployed read-only visualizer if a public transaction is available.' });
  }
  candidates.sort((a, b) => a.id.localeCompare(b.id));
  if (!consumers.length) rejected.missingConsumerEvidence++;
  if (!providers.length) rejected.missingProviderEvidence++;
  return { candidates, rejected, roleAssessments: roleAssessments.sort((a, b) => a.projectId.localeCompare(b.projectId) || a.repository.localeCompare(b.repository)),
    evidenceLinks: candidates.map(x => ({ id: x.id, consumer: sourceLink(x.consumer.link), providerBuilder: sourceLink(x.provider.builder), providerParser: sourceLink(x.provider.parser), network: sourceLink(x.provider.networkContract) })) };
}
