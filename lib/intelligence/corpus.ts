import { assess, type PlannedConnection, type TechnicalContract } from './planner';

export type CorpusObservation = {
  id?: string;
  projectId: string;
  repository: string;
  revision: string;
  path: string;
  startLine: number;
  endLine: number;
  kind: string;
  fact: string;
};

export type CorpusNeed = { projectId: string; claim: string; sourceUrl: string; revision: string };
export type CorpusCandidate = PlannedConnection & {
  need: CorpusNeed;
  relatedNeeds?: CorpusNeed[];
  consumerObservation: CorpusObservation;
  providerObservation: CorpusObservation;
  supportObservations?: CorpusObservation[];
  discoveryKind: 'exact-interface' | 'name-to-ckb-address' | 'transaction-recovery-adapter';
};

const callKinds = new Set([
  'local_call', 'input', 'input_selection', 'output', 'cell_dep', 'cell_deps', 'header_dep', 'header_deps',
  'fee', 'signing', 'broadcast', 'live_cell_query', 'cell_query', 'transaction_lookup', 'serialization',
  'deserialization', 'cycle_estimation',
]);
const testPath = /(?:^|\/)(?:__tests__|tests?|fixtures?|mocks?|examples?|benchmarks?|scripts\/evidence)(?:\/|$)|(?:\.test|\.spec|_test)\.[cm]?[jt]sx?$/i;
const allowedNeedHosts = new Set(['github.com', 'talk.nervos.org', 'ckbdapps.com']);
const validNeed = (need: CorpusNeed) => {
  try {
    const url = new URL(need.sourceUrl);
    return need.claim.length >= 20 && url.protocol === 'https:' && allowedNeedHosts.has(url.hostname) &&
      !url.username && !url.password &&
      (/^[a-f0-9]{40}$/.test(need.revision) || !Number.isNaN(Date.parse(need.revision)));
  } catch { return false; }
};
const isProductionObservation = (observation: CorpusObservation) => !testPath.test(observation.path);
const isNameToAddressNeed = (claim: string) =>
  /\busername\b.{0,100}\b(?:wallet|address)\b|\b(?:wallet|address)\b.{0,100}\busername\b/i.test(claim);
const isTransactionRecoveryNeed = (claim: string) =>
  /signed[- ]relay auditing|ambiguous (?:rpc|broadcast)|(?:broadcast|submission).{0,60}(?:recovery|uncertainty|unknown)|(?:recovery|uncertainty).{0,60}(?:broadcast|submission)/i.test(claim);
const isIntegrationExampleNeed = (claim: string) =>
  /integration examples?.{0,120}(?:applications|adopt|signing|broadcast|transaction)|(?:applications|adopt).{0,120}integration examples?/i.test(claim);
const isNameResolver = (observation: CorpusObservation) => observation.kind === 'api_route' &&
  /^OpenAPI GET \/resolve\/\{name\}/.test(observation.fact) &&
  /\b309 ckb\b/i.test(observation.fact) &&
  /response fields:[^\n]*\baddresses\b/i.test(observation.fact);
const source = (observation: CorpusObservation) => ({
  repository: observation.repository, revision: observation.revision, path: observation.path,
  startLine: observation.startLine, endLine: observation.endLine,
});
const contract = (
  observation: CorpusObservation,
  direction: 'requires' | 'provides',
  protocol: string,
  operation: string,
  value: string | null,
  documentedNeed: boolean,
  shape: { input: string | null; output: string | null; networks?: string[]; sdkVersions?: string[] },
): TechnicalContract => ({
  projectId: observation.projectId, direction, protocol, operation, inputShape: shape.input, outputShape: shape.output,
  networks: shape.networks ?? [], scriptIdentities: [], sdkVersions: shape.sdkVersions ?? [], source: source(observation),
  value, documentedNeed, alreadyIntegrated: false,
});
const normalize = (signature: string) => signature.replace(/\s+/g, ' ').trim();
function exactSignature(call: CorpusObservation, exported: CorpusObservation, name: string): boolean {
  const callShape = call.fact.match(new RegExp(`^Resolved call ${name}: (.+)$`))?.[1];
  const exportShape = exported.fact.match(new RegExp(`^Exported function ${name}(\\(.+)$`))?.[1];
  return Boolean(callShape && exportShape && normalize(callShape) === normalize(exportShape));
}
const networkLabels = (observations: CorpusObservation[], projectId: string, repository: string) =>
  [...new Set(observations.filter(o => isProductionObservation(o) && o.projectId === projectId && o.repository === repository && o.kind === 'client_network')
    .map(o => /PublicTestnet/.test(o.fact) ? 'testnet' : /PublicMainnet/.test(o.fact) ? 'mainnet' : null)
    .filter((x): x is 'testnet' | 'mainnet' => x !== null))];
const cccVersions = (observations: CorpusObservation[], projectId: string, repository: string) =>
  observations.filter(o => o.projectId === projectId && o.repository === repository &&
    ['locked_dependency', 'dependency'].includes(o.kind) && /@ckb-ccc\/(?:core|ccc):/.test(o.fact))
    .map(o => o.fact.replace(/^.*?(@ckb-ccc\/[^:]+):\s*/, '$1@'));

function addNameResolutionCandidates(
  observations: CorpusObservation[], needs: CorpusNeed[], out: Map<string, CorpusCandidate>, rejected: { missingNeed: number; missingProvider: number; invalidEvidence: number },
) {
  const routes = observations.filter(isNameResolver);
  const addressInputs = observations.filter(o => o.kind === 'address_parse');
  for (const need of needs.filter(n => validNeed(n) && isNameToAddressNeed(n.claim))) {
    const consumers = addressInputs.filter(o => o.projectId === need.projectId && isProductionObservation(o));
    const providers = routes.filter(o => o.projectId !== need.projectId && isProductionObservation(o));
    if (!consumers.length) { rejected.missingNeed++; continue; }
    if (!providers.length) { rejected.missingProvider++; continue; }
    for (const consumer of consumers) for (const provider of providers) {
      if (consumer.repository === provider.repository) { rejected.invalidEvidence++; continue; }
      const result = assess(
        contract(consumer, 'requires', 'HTTP JSON name-to-CKB-address', 'resolve-name-to-ckb-address', need.claim.slice(0, 1000), true,
          { input: 'human-readable-name', output: 'CKB-address-string', networks: networkLabels(observations, consumer.projectId, consumer.repository) }),
        contract(provider, 'provides', 'HTTP JSON name-to-CKB-address', 'resolve-name-to-ckb-address', null, false,
          { input: 'human-readable-name', output: 'CKB-address-string', networks: networkLabels(observations, provider.projectId, provider.repository) }),
      );
      if (!result) { rejected.invalidEvidence++; continue; }
      const supportObservations = observations.filter(o => o.kind === 'client_network' &&
        ((o.projectId === consumer.projectId && o.repository === consumer.repository) ||
          (o.projectId === provider.projectId && o.repository === provider.repository)));
      out.set(result.id, { ...result, need, consumerObservation: consumer, providerObservation: provider,
        supportObservations, discoveryKind: 'name-to-ckb-address' });
    }
  }
}

function addTransactionRecoveryCandidates(
  observations: CorpusObservation[], needs: CorpusNeed[], out: Map<string, CorpusCandidate>, rejected: { missingNeed: number; missingProvider: number; invalidEvidence: number },
) {
  const production = observations.filter(isProductionObservation);
  const providers = production.filter(o => o.kind === 'function' &&
    /^Exported function (?:prepare|track|monitor|submit)\w*Transaction\b/i.test(o.fact));
  for (const need of needs.filter(n => validNeed(n) && isTransactionRecoveryNeed(n.claim))) {
    const signings = production.filter(o => o.projectId === need.projectId && o.kind === 'signing' && /Calls signTransaction\b/.test(o.fact));
    const relayCalls = production.filter(o => o.projectId === need.projectId && ['broadcast', 'local_call'].includes(o.kind) &&
      /(?:Calls (?:relay|broadcast|send)\w*Transaction\b|Calls sendTransaction\b)/i.test(o.fact));
    const consumerPairs = signings.flatMap(signing => relayCalls.filter(relay => signing.repository === relay.repository &&
      signing.path === relay.path && Math.abs(signing.startLine - relay.startLine) <= 30).map(relay => ({ signing, relay })));
    if (!consumerPairs.length) { rejected.missingNeed++; continue; }
    const candidates = providers.flatMap(provider => {
      const ambiguityMarkers = production.filter(o => o.projectId === provider.projectId && o.repository === provider.repository &&
        o.path === provider.path && ['local_call', 'function'].includes(o.kind) &&
        /(?:Calls|(?:Exported function|Method)) (?:markAmbiguous|markSubmission|recordSubmissionUnknown|reconcile)\b/i.test(o.fact) &&
        o.startLine >= provider.startLine && o.endLine <= provider.endLine);
      return ambiguityMarkers.map(marker => ({ provider, marker }));
    });
    if (!candidates.length) { rejected.missingProvider++; continue; }
    for (const { signing, relay } of consumerPairs) for (const { provider, marker } of candidates) {
      if (provider.projectId === need.projectId || provider.repository === relay.repository) { rejected.invalidEvidence++; continue; }
      const relatedNeed = needs.find(n => n.projectId === provider.projectId && validNeed(n) && isIntegrationExampleNeed(n.claim));
      if (!relatedNeed) { rejected.missingProvider++; continue; }
      const consumer = contract(relay, 'requires', 'CKB transaction submission', 'track-and-reconcile-ambiguous-submission', need.claim.slice(0, 1000), true,
        { input: 'CCC-signed transaction serialized to an application relay', output: 'relay acknowledgement and transaction hash',
          networks: networkLabels(observations, relay.projectId, relay.repository), sdkVersions: cccVersions(observations, relay.projectId, relay.repository) });
      const providing = contract(provider, 'provides', 'CKB transaction submission', 'track-and-reconcile-ambiguous-submission', null, false,
        { input: 'CCC transaction, signer, and persisted intent metadata', output: 'tracked submission state reconciled by deterministic transaction hash',
          networks: networkLabels(observations, provider.projectId, provider.repository), sdkVersions: cccVersions(observations, provider.projectId, provider.repository) });
      const result = assess(consumer, providing);
      if (!result) { rejected.invalidEvidence++; continue; }
      const relayBoundary = production.filter(o => o.projectId === relay.projectId && o.repository === relay.repository &&
        o.kind === 'cell_dep_guard' && /packet-lock cell dep/i.test(o.fact));
      const providerSubmission = production.filter(o => o.projectId === provider.projectId && o.repository === provider.repository &&
        o.path === provider.path && ['broadcast', 'local_call'].includes(o.kind) && /Calls sendTransaction\b/.test(o.fact) &&
        o.startLine >= provider.startLine && o.endLine <= provider.endLine);
      const boundaryObservations = production.filter(o =>
        ((o.projectId === relay.projectId && o.repository === relay.repository) ||
          (o.projectId === provider.projectId && o.repository === provider.repository)) &&
        (['client_network', 'declared_network', 'ckb_rpc_broadcast'].includes(o.kind) ||
          (['locked_dependency', 'dependency'].includes(o.kind) && /@ckb-ccc\/core/.test(o.fact))));
      const supportObservations = [signing, marker, ...relayBoundary, ...providerSubmission, ...boundaryObservations].filter((o, i, all) =>
        all.findIndex(x => `${x.repository}:${x.path}:${x.startLine}:${x.fact}` === `${o.repository}:${o.path}:${o.startLine}:${o.fact}`) === i);
      const findings = [...result.findings, {
        dimension: 'relay boundary', conclusion: 'unknown' as const,
        explanation: relayBoundary.length
          ? 'The consumer relay has a packet-lock cell-dependency guard, while the provider CCC wrapper submits through signer.client.sendTransaction. A safe adapter must preserve the guard and route the same signed payload through the tracked flow.'
          : 'The existing relay path and provider submit path have not been shown to share a boundary; an adapter must preserve application-specific transaction checks.',
      }, {
        dimension: 'license and reuse', conclusion: 'unknown' as const,
        explanation: 'Neither inspected repository exposes a root license file at the pinned revisions; resolve reuse rights before copying or linking code.',
      }];
      if (!out.has(result.id)) out.set(result.id, { ...result, findings, need, relatedNeeds: [relatedNeed], consumerObservation: relay, providerObservation: provider,
        supportObservations, discoveryKind: 'transaction-recovery-adapter' });
    }
  }
}

/** Deterministic, evidence-gated discovery. Specialized concepts are explicit rules, never compatibility claims. */
export function discoverCorpus(
  observations: CorpusObservation[], needs: CorpusNeed[],
): { candidates: CorpusCandidate[]; rejected: { missingNeed: number; missingProvider: number; invalidEvidence: number } } {
  const production = observations.filter(isProductionObservation);
  const calls = production.filter(o => callKinds.has(o.kind) && /^Calls [A-Za-z_$][\w$]*/.test(o.fact));
  const exports = production.filter(o => o.kind === 'function' && /^Exported function [A-Za-z_$][\w$]*/.test(o.fact));
  const out = new Map<string, CorpusCandidate>();
  const rejected = { missingNeed: 0, missingProvider: 0, invalidEvidence: 0 };
  for (const call of calls) {
    const name = call.fact.match(/^Calls ([\w$]+)/)?.[1];
    if (!name || name.length < 8 || !(/[a-z][A-Z]|_/.test(name))) { rejected.missingNeed++; continue; }
    const word = new RegExp(`(^|[^A-Za-z0-9_$])${name.replace(/[$]/g, '\\$&')}([^A-Za-z0-9_$]|$)`, 'i');
    const need = needs.find(n => n.projectId === call.projectId && validNeed(n) && word.test(n.claim));
    if (!need) { rejected.missingNeed++; continue; }
    const signature = production.find(o => o.projectId === call.projectId && o.repository === call.repository &&
      o.path === call.path && o.startLine === call.startLine && o.kind === 'call_signature' && o.fact.startsWith(`Resolved call ${name}:`));
    const providers = exports.filter(o => o.projectId !== call.projectId && o.repository !== call.repository &&
      o.fact.match(/^Exported function ([\w$]+)/)?.[1] === name && signature && exactSignature(signature, o, name));
    if (!providers.length) { rejected.missingProvider++; continue; }
    for (const provider of providers) {
      const result = assess(
        contract(call, 'requires', 'source interface', name, need.claim.slice(0, 1000), true, { input: null, output: null }),
        contract(provider, 'provides', 'source interface', name, null, false, { input: null, output: null }),
      );
      if (!result) { rejected.invalidEvidence++; continue; }
      if (!out.has(result.id)) out.set(result.id, { ...result, need, consumerObservation: call, providerObservation: provider, discoveryKind: 'exact-interface' });
    }
  }
  addNameResolutionCandidates(production, needs, out, rejected);
  addTransactionRecoveryCandidates(production, needs, out, rejected);
  return { candidates: [...out.values()].sort((a, b) => a.id.localeCompare(b.id)), rejected };
}
