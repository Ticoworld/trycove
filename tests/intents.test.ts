import {describe,it,expect} from 'vitest';
import {classifySignal,discoverIntentCandidates,explainIntentPair,extractObservationIntents,extractSignalIntents,intentCompatibilityFindings,type SignalInput, type IntentObservation} from '../lib/intelligence/intents';

const signal=(x:Partial<SignalInput>={}):SignalInput=>({id:'s',projectId:'a',kind:'need',concept:'missing-capability',claim:'Per-script-group cycles are being considered for the explorer.',sourceUrl:'https://github.com/org/repo/issues/1',revision:'2026-11-14T12:36:42Z',verification:'issue author claim; unverified',...x});
const route=(x:Partial<IntentObservation>={}):IntentObservation=>({id:'observation-1',projectId:'cellula',repository:'https://github.com/LusoCryptoLabs/cells-resolver',revision:'b'.repeat(40),path:'src/openapi.ts',startLine:331,endLine:356,kind:'api_route',fact:'OpenAPI GET /primary/{address} (primary): The name an address chose for itself, verified both ways.; response fields: name, expired',...x});

describe('structured signal intents',()=>{
 it('matches a specific documented cycle need to a claimed cycle capability without needing a project-pair rule',()=>{
  const need=classifySignal(signal({id:'need',projectId:'explorer',claim:'Per-script-group cycles are one feature I am considering next.'}));
  const capability=classifySignal(signal({id:'cap',projectId:'cycle-tools',kind:'capability',claim:'The CLI reports per-script-group cycles with sums compared against the node.'}));
  expect(need?.scope).toBe('ckb-per-script-group-cycle-analysis');expect(capability?.direction).toBe('capability');
  expect(discoverIntentCandidates([need!,capability!])).toMatchObject([{relation:'documented-need',scope:'ckb-per-script-group-cycle-analysis'}]);
 });
 it('keeps a primary-name API separate from a portable-profile identity request',()=>{
  const source=route();const ckbResolve=route({id:'resolve',startLine:100,fact:'OpenAPI GET /resolve/{name}: CKB name resolution; coin type 309 ckb; response fields: name, addresses, proof'});
  const [capability]=extractObservationIntents([source,ckbResolve]);
  const need=classifySignal(signal({id:'identity',projectId:'pckt',claim:'Decentralized sender identity: replace backend-stored profile labels with portable, self-sovereign identity.'}));
  expect(capability).toMatchObject({direction:'capability',scope:'ckb-verified-address-primary-name'});
  expect(need?.scope).toBe('ckb-sender-profile-identity');
  expect(discoverIntentCandidates([need!,capability])).toHaveLength(0);
  expect(extractObservationIntents([source])).toHaveLength(0);
 });
 it('requires a specific common scope and rejects generic transaction, wallet, feedback and testing overlap',()=>{
  const claims=[
   signal({claim:'Please review transaction tooling and give ecosystem feedback.'}),
   signal({id:'b',projectId:'b',kind:'capability',claim:'A wallet and transaction helper is available.'}),
   signal({id:'c',projectId:'c',kind:'capability',claim:'We welcome testing and feedback from the community.'}),
  ];
  expect(extractSignalIntents(claims)).toHaveLength(0);
  expect(discoverIntentCandidates(extractSignalIntents(claims))).toHaveLength(0);
 });
 it('does not turn a source capability into an explicit partner offer',()=>{
  const n=classifySignal(signal({id:'need',claim:'Per-script-group cycles in the explorer are being considered.'}));
  const c=classifySignal(signal({id:'cap',projectId:'provider',kind:'capability',claim:'The tool provides per-script-group cycles for each transaction.'}));
  expect(c?.direction).toBe('capability');expect(discoverIntentCandidates([n!,c!])[0].relation).toBe('documented-need');
 });
 it('groups multiple need claims for the same project, provider and scope into one reviewable candidate',()=>{
  const direct=classifySignal(signal({id:'need-1',claim:'Decentralized sender identity: replace backend-stored profile labels with on-chain identity.'}));
  const followup=classifySignal(signal({id:'need-2',claim:'Decentralized sender identity is an integration need for wallet profiles.'}));
  const provider=classifySignal(signal({id:'cap',projectId:'provider',kind:'capability',claim:'Decentralized sender identity for wallet profiles is supported.'}));
  const matches=discoverIntentCandidates([direct!,followup!,provider!]);expect(matches).toHaveLength(1);expect(matches[0].relatedNeeds).toHaveLength(1);
 });
 it('requires an explicit, scope-matched offer for non-code review collaborations',()=>{
  const need=classifySignal(signal({id:'review-need',projectId:'dripfund',claim:'I need practical advice on better indexing and discovery patterns for a CKB app.'}));
  const offer=classifySignal(signal({id:'review-offer',projectId:'cellora',kind:'obstacle',claim:'Happy to jump on a 20-minute call with any app that has non-trivial indexing needs.'}));
  const broad=classifySignal(signal({id:'broad',projectId:'other',kind:'obstacle',claim:'Happy to give general feedback to the ecosystem.'}));
  expect(need?.intentType).toBe('technical-review');expect(offer?.direction).toBe('offer');
  expect(discoverIntentCandidates([need!,offer!])).toHaveLength(1);expect(broad).toBeNull();expect(discoverIntentCandidates([need!,...(broad?[broad]:[])])).toHaveLength(0);
 });
 it('does not treat generic code capability as a review offer or review need as integration',()=>{
  const review=classifySignal(signal({id:'review',projectId:'consumer',claim:'I need an independent review of this custom CKB lock script before testnet launch.'}));
  const kit=classifySignal(signal({id:'kit',projectId:'provider',kind:'capability',claim:'Session lock (Rust): the lock enforces recipient and outflow limits.'}));
  const reviewNeed=classifySignal(signal({id:'need-review',projectId:'consumer',concept:'feedback-request',claim:'Please review whether per-script-group cycles are a sound feature.'}));
  const cycles=classifySignal(signal({id:'cap-cycle',projectId:'cycle-tool',kind:'capability',claim:'The tool provides per-script-group cycle accounting.'}));
  expect(review).toBeNull();expect(kit).toBeNull();
  expect(reviewNeed?.intentType).toBe('technical-review');
  expect(discoverIntentCandidates([reviewNeed!,cycles!])).toHaveLength(0);
  expect(explainIntentPair(reviewNeed!,cycles!)).toBe('need_requires_explicit_offer');
 });
 it('keeps a specific feature proposal as an integration need inside a feedback section',()=>{
  const proposal=classifySignal(signal({id:'proposal',projectId:'explorer',concept:'feedback-request',claim:'What do you still check by hand while developing that an explorer should show? Per-script-group cycles are two features I am considering next.'}));
  const provider=classifySignal(signal({id:'cycle-cap',projectId:'tool',kind:'capability',claim:'The tool provides per-script-group cycle analysis.'}));
  expect(proposal?.intentType).toBe('technical-integration');expect(discoverIntentCandidates([proposal!,provider!])).toHaveLength(1);
 });
 it('treats open architecture questions in review sections as non-code review needs',()=>{
  const need=classifySignal(signal({id:'architecture-review',projectId:'app',concept:'feedback-request',claim:'Are there more robust CKB indexer patterns for resolving seller lock hashes?'}));
  const provider=classifySignal(signal({id:'indexer-offer',projectId:'reviewer',kind:'obstacle',claim:'Happy to jump on a call with any app that has non-trivial indexing needs.'}));
  expect(need?.intentType).toBe('technical-review');expect(discoverIntentCandidates([need!,provider!])).toHaveLength(1);
 });
 it('rejects capability matching when the source section is a review request about the same phrase',()=>{
  const need=classifySignal(signal({id:'recovery-review',projectId:'consumer',concept:'feedback-request',claim:'I would especially like feedback on whether this is the correct approach to ambiguous broadcast recovery.'}));
  const provider=classifySignal(signal({id:'recovery-cap',projectId:'provider',kind:'capability',claim:'The product handles ambiguous broadcast recovery.'}));
  expect(need?.intentType).toBe('technical-review');expect(discoverIntentCandidates([need!,provider!])).toHaveLength(0);
 });
 it('rejects DID recipient resolution as a substitute for sender profile identity',()=>{
  const need=classifySignal(signal({id:'profile',projectId:'pckt',claim:'Decentralized sender identity: replace backend-stored profile labels with on-chain or signed-attestation identity so naming is portable.'}));
  const provider=classifySignal(signal({id:'did-recipient',projectId:'credora',kind:'capability',claim:'did:ckb and address recipient resolution to a lock script is supported for certificate issuance.'}));
  expect(need?.scope).toBe('ckb-sender-profile-identity');expect(provider?.scope).toBe('ckb-did-recipient-resolution');
  expect(discoverIntentCandidates([need!,provider!])).toHaveLength(0);
 });
 it('can match a CKB app testing need with an explicit tester offer without code integration',()=>{
  const need=classifySignal(signal({id:'test-need',projectId:'app',concept:'missing-capability',claim:'Looking for testers for my CKB dapp before testnet release.'}));
  const offer=classifySignal(signal({id:'test-offer',projectId:'tester',kind:'obstacle',claim:'Happy to test your CKB dapp and file reproducible issues.'}));
  expect(need).toMatchObject({scope:'ckb-external-user-testing',intentType:'user-testing',direction:'need'});
  expect(offer).toMatchObject({scope:'ckb-external-user-testing',intentType:'user-testing',direction:'offer'});
  expect(discoverIntentCandidates([need!,offer!])).toMatchObject([{relation:'explicit-offer',intentType:'user-testing'}]);
 });
 it('blocks explicit disjoint networks and leaves custom RPC and matching labels unverified',()=>{
  const blocked=intentCompatibilityFindings({consumerSignals:[signal({kind:'deployment',claim:'Runs only on CKB testnet.'})],providerSignals:[signal({projectId:'b',kind:'deployment',claim:'Runs only on CKB mainnet.'})],providerClaim:'Fixed mainnet endpoint'});
  expect(blocked[0].conclusion).toBe('environment_blocked');
  const flexible=intentCompatibilityFindings({consumerSignals:[signal({kind:'deployment',claim:'Runs only on CKB devnet.'})],providerSignals:[signal({projectId:'b',kind:'deployment',claim:'Testnet and mainnet; configurable --rpc <url>.'})],providerClaim:'CLI accepts --rpc <url>'});
  expect(flexible[0].conclusion).toBe('unknown');
  const shared=intentCompatibilityFindings({consumerSignals:[signal({kind:'deployment',claim:'Runs on CKB testnet.'})],providerSignals:[signal({projectId:'b',kind:'deployment',claim:'Runs on CKB testnet.'})],providerClaim:'Testnet tool'});
  expect(shared[0].conclusion).toBe('unknown');
 });
 it('reports pinned dependency version differences as unknown adapter risk, not incompatibility',()=>{
  const findings=intentCompatibilityFindings({consumerProjectId:'a',providerProjectId:'b',consumerSignals:[],providerSignals:[],providerClaim:'Resolver HTTP API',observations:[
   {projectId:'a',kind:'locked_dependency',fact:'@ckb-ccc/core: 1.12.5'},
   {projectId:'b',kind:'locked_dependency',fact:'@ckb-ccc/core: 1.23.0'},
  ]});
  expect(findings.find(x=>x.dimension==='SDK and interface')).toMatchObject({conclusion:'unknown'});
  expect(findings.find(x=>x.dimension==='SDK and interface')?.explanation).toContain('consumer 1.12.5; provider 1.23.0');
 });
});
