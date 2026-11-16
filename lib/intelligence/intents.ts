import {createHash} from 'node:crypto';

export type SignalInput={id:string;projectId:string;kind:string;concept:string;claim:string;sourceUrl:string;revision:string;verification:string;observedAt?:Date};
export type IntentDirection='need'|'capability'|'offer';
export type IntentType='technical-integration'|'validation'|'technical-review'|'user-testing'|'distribution';
export type SignalIntent={id:string;signalId?:string;observationId?:string;projectId:string;direction:IntentDirection;intentType:IntentType;scope:string;extractionRule:string;verification:string;sourceUrl:string;revision:string;observedAt?:Date;claim:string;signalKind:string};
export type IntentCandidate={id:string;need:SignalIntent;relatedNeeds:SignalIntent[];provider:SignalIntent;relation:'documented-need'|'explicit-offer';scope:string;intentType:IntentType};
export type IntentPairRejection='self_match'|'scope_mismatch'|'need_requires_explicit_offer'|'offer_type_mismatch';

// A small, explicit concept vocabulary. Phrases identify a specific CKB capability;
// broad words such as "feedback", "transaction", "wallet" and "community" are not scopes.
const scopes:[string,RegExp][]=[
 ['ckb-per-script-group-cycle-analysis',/\b(?:per[- ](?:script[- ]group|group) cycles?|cycles? per script[- ]group|script[- ]group cycle (?:cost|analysis|profiling)|per[- ]group cycle sum)\b/i],
 ['ckb-javascript-contract-data-decoding',/\b(?:decod(?:e|ing) (?:data|cells?) (?:written|created) by (?:javascript|js) contracts?|javascript contract data decoding)\b/i],
 ['ckb-indexing-architecture',/\b(?:index(?:ing|er)[^\n]{0,80}(?:approach|patterns|architecture|many creators|discovery)|(?:approach|patterns|architecture)[^\n]{0,80}index(?:ing|er)|non[- ]trivial indexing needs?)\b/i],
 ['ckb-username-to-address-resolution',/\b(?:username|human[- ]readable name)[^\n]{0,80}(?:wallet|ckb address)|(?:wallet|ckb address)[^\n]{0,80}(?:username|human[- ]readable name)\b/i],
 ['ckb-verified-address-primary-name',/\b(?:primary (?:ckb )?name (?:for|lookup by) (?:an )?address|address[- ]verified (?:primary )?name|verified (?:primary )?name for (?:a )?(?:ckb )?address)\b/i],
 // Sender-profile identity differs from resolving a DID recipient to a lock script.
 ['ckb-sender-profile-identity',/\b(?:decentralized sender identity|backend[- ]stored profile labels|sender profile labels)\b/i],
 ['ckb-did-recipient-resolution',/\bdid:ckb\b[^\n]{0,100}\b(?:recipient|lock script|resolution)\b|\b(?:resolve|resolution)[^\n]{0,100}\bdid:ckb\b/i],
 ['ckb-transaction-submission-recovery',/\b(?:ambiguous (?:rpc )?(?:broadcast|submission)|(?:broadcast|submission)[^\n]{0,80}(?:recovery|uncertain|ambiguous)|(?:recovery|uncertain|ambiguous)[^\n]{0,80}(?:broadcast|submission))\b/i],
 ['ckb-session-lock-application-integration',/\b(?:real app using (?:ckb )?(?:sessions?|subscriptions?)|session[- ]lock integration|application sessions? on ckb)\b/i],
 ['ckb-contract-transaction-policy-review',/\b(?:application[- ]level transaction polic(?:y|ies)|pre[- ]sign(?:ing)? transaction polic(?:y|ies)|transaction polic(?:y|ies) review|typed[- ]cell preservation)\b/i],
 ['ckb-external-user-testing',/\b(?:looking for|need|want|seeking) (?:external )?testers? (?:for|to test) (?:my|our|the) (?:ckb )?(?:app|dapp|tool|project)\b|\b(?:happy to test|can test) (?:your|a) (?:ckb )?(?:app|dapp|tool|project)\b|\boutside user (?:for|of) (?:a|the) (?:ckb )?(?:app|dapp|tool|project)\b/i],
 ['ckb-developer-tool-adoption',/\b(?:first real use|real app using|first (?:one|two) (?:apps?|projects?|repositories?)|first outside user|outside user for (?:the )?(?:pr action|tool))\b/i],
 ['ckb-public-demo-distribution',/\b(?:hosted read[- ]only demo|public devnet demo|distribution channel for ckb|list(?:ing)? in (?:a )?ckb marketplace)\b/i],
];
const explicitOffer=/\b(?:happy to (?:jump on|help|set up|pair|test|host)|i would set it up (?:with them|for the first (?:one|two)(?: (?:apps?|projects?|repositories?|repos?))? (?:myself|with them)?)|i can (?:set up|help|review|run|test)|we can (?:set up|help|review|run|test)|offering to|available to (?:review|help|test)|i(?:'| a)m willing to)\b/i;
const validSource=(raw:string)=>{try{const u=new URL(raw);return u.protocol==='https:'&&u.hostname==='github.com'&&!u.username&&!u.password&&u.pathname.split('/').filter(Boolean).length>=4}catch{return false}};
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');

function paragraphContaining(claim:string,index:number){const start=claim.lastIndexOf('\n\n',index),end=claim.indexOf('\n\n',index);return claim.slice(start<0?0:start+2,end<0?claim.length:end).trim()}
function signalType(scope:string,direction:IntentDirection,concept:string,context:string,claim:string):IntentType {
 if(scope==='ckb-public-demo-distribution')return 'distribution';
 if(scope==='ckb-developer-tool-adoption'||scope==='ckb-external-user-testing'||/\b(?:real app using|first real use|outside user)\b/i.test(context))return 'user-testing';
 if(direction==='capability')return 'technical-integration';
 if(direction==='offer'&&/\b(?:call|pair|review|feedback|guidance|advice)\b/i.test(context))return 'technical-review';
 if(direction==='need'&&concept==='feedback-request'&&/\b(?:considering next|considering (?:adding|building|implementing)|planned feature|feature proposal)\b/i.test(context))return 'technical-integration';
 if(/\b(?:review|audit|guidance|feedback|advice|reviewer)\b/i.test(context+'\n'+claim))return 'technical-review';
 if(direction==='need'&&concept==='feedback-request')return 'technical-review';
 if(/\b(?:tester|testers|user testing|real users|first outside user|first real use)\b/i.test(context))return 'user-testing';
 if(/\b(?:test|testing|reproducible|reproduction|validate|validation|try it|run it)\b/i.test(context))return 'validation';
 return 'technical-integration';
}
export function classifySignal(signal:SignalInput):SignalIntent|null {
 if(!validSource(signal.sourceUrl)||signal.claim.trim().length<12||!(/^[a-f0-9]{40}$/.test(signal.revision)||!Number.isNaN(Date.parse(signal.revision))))return null;
 const found=scopes.map(([scope,pattern])=>({scope,match:pattern.exec(signal.claim)})).find(x=>x.match);if(!found||!found.match)return null;
 const {scope,match}=found,context=paragraphContaining(signal.claim,match.index??0);const offer=explicitOffer.test(context);
 let direction:IntentDirection;
 if(offer)direction='offer';else if(['need','obstacle'].includes(signal.kind))direction='need';else if(['capability','provides'].includes(signal.kind))direction='capability';else return null;
 const intentType=signalType(scope,direction,signal.concept,context,signal.claim);
 // Capabilities with no explicit willingness remain capabilities, never partnership offers.
 const extractionRule=`scope:${scope};direction:${direction};type:${intentType};taxonomy:v2`;
 return {id:hash(`${signal.id}\0${extractionRule}`),signalId:signal.id,projectId:signal.projectId,direction,intentType,scope,extractionRule,
  verification:'automated interpretation; source claim unverified',sourceUrl:signal.sourceUrl,revision:signal.revision,observedAt:signal.observedAt,
  claim:signal.claim,signalKind:signal.kind};
}

export function extractSignalIntents(signals:SignalInput[]):SignalIntent[]{return signals.map(classifySignal).filter((x):x is SignalIntent=>Boolean(x)).sort((a,b)=>a.id.localeCompare(b.id))}

export type IntentObservation={id:string;projectId:string;repository:string;revision:string;path:string;startLine:number;endLine:number;kind:string;fact:string;verification?:string};
/** Turns only a concrete CKB name API contract into a provider capability; arbitrary routes and keywords stay unclassified. */
export function classifyObservation(o:IntentObservation,context:IntentObservation[]=[]):SignalIntent|null {
 const ckbApi=context.some(x=>x.projectId===o.projectId&&x.repository===o.repository&&x.revision===o.revision&&x.kind==='api_route'&&/\b309 ckb\b/i.test(x.fact));
 if(o.kind!=='api_route'||!/^OpenAPI GET \/primary\/\{address\}/.test(o.fact)||!(/response fields:[^\n]*\bname\b/i.test(o.fact))||!ckbApi)return null;
 const sourceUrl=`${o.repository}/blob/${o.revision}/${o.path}#L${o.startLine}`;
 if(!validSource(`${o.repository}/blob/${o.revision}/${o.path}`)||!o.startLine)return null;
 const scope='ckb-verified-address-primary-name',extractionRule='api-route:primary-name-for-ckb-address;taxonomy:v2';
 return{id:hash(`${o.id}\0${extractionRule}`),observationId:o.id,projectId:o.projectId,direction:'capability',intentType:'technical-integration',scope,extractionRule,
  verification:'automated source interpretation; API declaration observed; runtime and identity semantics unverified',sourceUrl,revision:o.revision,claim:o.fact,signalKind:'api_route'};
}
export function extractObservationIntents(observations:IntentObservation[]):SignalIntent[]{const found=new Map<string,SignalIntent>();for(const x of observations.map(o=>classifyObservation(o,observations)).filter((x):x is SignalIntent=>Boolean(x))){const key=`${x.projectId}\0${x.scope}\0${x.sourceUrl}`;if(!found.has(key))found.set(key,x)}return[...found.values()].sort((a,b)=>a.id.localeCompare(b.id))}

export function explainIntentPair(need:SignalIntent,provider:SignalIntent):IntentPairRejection|null {
 if(need.projectId===provider.projectId)return 'self_match';
 if(need.scope!==provider.scope)return 'scope_mismatch';
 if(provider.direction!=='capability'&&provider.direction!=='offer')return 'need_requires_explicit_offer';
 if(provider.direction==='capability'&&need.intentType!=='technical-integration')return 'need_requires_explicit_offer';
 if(provider.direction==='offer'&&need.intentType!==provider.intentType)return 'offer_type_mismatch';
 return null;
}
export function discoverIntentCandidates(intents:SignalIntent[]):IntentCandidate[]{
 const needs=intents.filter(x=>x.direction==='need');const providers=intents.filter(x=>x.direction==='capability'||x.direction==='offer');const found=new Map<string,IntentCandidate>();
 for(const need of needs)for(const provider of providers){
  if(explainIntentPair(need,provider))continue;
  const explicit=provider.direction==='offer';
  const id=hash([need.projectId,provider.projectId,need.scope,provider.direction,provider.sourceUrl,provider.claim].join('\0'));
  const previous=found.get(id);
  if(!previous)found.set(id,{id,need,relatedNeeds:[],provider,relation:explicit?'explicit-offer':'documented-need',scope:need.scope,intentType:need.intentType});
  else if(previous.need.signalId!==need.signalId){
   const primary=previous.need.intentType==='technical-review'&&need.intentType!=='technical-review'?need:previous.need;
   const related=[...previous.relatedNeeds,previous.need,need].filter((x,i,all)=>all.findIndex(y=>y.sourceUrl===x.sourceUrl&&y.claim===x.claim)===i&&!(x.sourceUrl===primary.sourceUrl&&x.claim===primary.claim));
   found.set(id,{...previous,need:primary,relatedNeeds:related,intentType:primary.intentType});
  }
 }
 return [...found.values()].sort((a,b)=>a.id.localeCompare(b.id));
}

export function intentCompatibilityFindings(input:{consumerSignals:SignalInput[];providerSignals:SignalInput[];consumerProjectId?:string;providerProjectId?:string;providerClaim:string;observations?:{projectId:string;kind:string;fact:string}[];intentType?:IntentType;relation?:'documented-need'|'explicit-offer'}){
 if(input.intentType&&input.intentType!=='technical-integration')return [
  {dimension:'scope and activity',conclusion:'unknown' as const,explanation:`The imported need and ${input.relation==='explicit-offer'?'explicit offer':'capability claim'} share a bounded ${input.intentType} scope. Specific deliverables, audience and success criteria still need agreement.`},
  {dimension:'offer and readiness',conclusion:'unknown' as const,explanation:'The offer is a source claim at the recorded revision. Current availability, timing and qualifications have not been reconfirmed.'},
  {dimension:'response and outcome',conclusion:'unknown' as const,explanation:'No introduction, response, completed review/test, or adoption is recorded. Trycove has not contacted either project.'},
 ];
 const obs=input.observations??[];
 const env=(xs:SignalInput[],projectId:string)=>new Set([...xs.filter(s=>['deployment','environment'].includes(s.kind)).flatMap(s=>[...s.claim.matchAll(/\b(testnet|mainnet|devnet)\b/gi)].map(m=>m[1].toLowerCase())),...obs.filter(o=>o.projectId===projectId&&['client_network','declared_network'].includes(o.kind)).flatMap(o=>[...o.fact.matchAll(/\b(testnet|mainnet|devnet)\b/gi)].map(m=>m[1].toLowerCase()))]);
 const consumerProject=input.consumerProjectId??input.consumerSignals[0]?.projectId??'',providerProject=input.providerProjectId??input.providerSignals[0]?.projectId??'';const consumer=env(input.consumerSignals,consumerProject),provider=env(input.providerSignals,providerProject);const flexibleRpc=/--rpc\b|custom (?:ckb )?rpc|rpc url/i.test(input.providerClaim)||input.providerSignals.some(x=>/--rpc\b|custom (?:ckb )?rpc|rpc url/i.test(x.claim));
 const shared=[...consumer].filter(x=>provider.has(x));const disjoint=consumer.size>0&&provider.size>0&&!shared.length&&!flexibleRpc;
 const versions=(xs:SignalInput[],projectId:string)=>{const out=new Set<string>();for(const s of xs)for(const m of s.claim.matchAll(/@ckb-ccc\/(?:core|ccc)[^\n]{0,50}?(\d+\.\d+\.\d+)/g))out.add(m[1]);for(const o of obs.filter(x=>x.projectId===projectId&&['locked_dependency','dependency'].includes(x.kind)))for(const m of o.fact.matchAll(/@ckb-ccc\/(?:core|ccc)[^\n]{0,50}?(\d+\.\d+\.\d+)/g))out.add(m[1]);return out};
 const cv=versions(input.consumerSignals,consumerProject),pv=versions(input.providerSignals,providerProject);const sameVersion=[...cv].some(x=>pv.has(x));const differentVersions=cv.size>0&&pv.size>0&&!sameVersion;
 return [
  {dimension:'network and deployment',conclusion:disjoint?'environment_blocked' as const:'unknown' as const,explanation:disjoint?'The source claims name disjoint environments and the provider does not declare an arbitrary RPC endpoint; no network bridge is evidenced.':shared.length?'Both source sets mention '+shared.join(', ')+', but this does not establish the same chain, deployment or reachable RPC.':flexibleRpc?'The provider source claims a configurable RPC endpoint, but use against the consumer environment and chain identity remain unverified.':'Network and deployment are unknown or not shared by source claims.'},
  {dimension:'SDK and interface',conclusion:'unknown' as const,explanation:sameVersion?`Pinned/source declarations show a shared CCC version (${[...cv].find(x=>pv.has(x))}); API shape, transport, serialization and runtime behavior still require a check.`:differentVersions?`Pinned/source declarations differ (consumer ${[...cv].sort().join(', ')}; provider ${[...pv].sort().join(', ')}). This is an adapter risk, not proof of incompatibility.`:'The matching capability claims do not establish a shared API, SDK version or direct import path.'},
  {dimension:'scripts, cells and dependencies',conclusion:'unknown' as const,explanation:'Relevant script identities, deployed cells, debugger binaries, cell data and dependency availability have not been cross-validated.'},
  {dimension:'signing and transaction effects',conclusion:'unknown' as const,explanation:'No signing or broadcast is required by the proposed analysis path; read-only transaction retrieval, local replay inputs and execution effects still need validation.'},
  {dimension:'source status',conclusion:'unknown' as const,explanation:'The need and capability are imported source claims. Automated taxonomy interpretation is unverified, and no integration or adoption is established.'},
 ];
}
