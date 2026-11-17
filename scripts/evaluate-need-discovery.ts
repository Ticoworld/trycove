import {createHash} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {execFileSync} from 'node:child_process';
import {discoverCorpus} from '../lib/intelligence/corpus';
import {discoverIntentCandidates,explainIntentPair,extractObservationIntents,extractSignalIntents} from '../lib/intelligence/intents';

const arg=(name:string)=>{const i=process.argv.indexOf(name);return i<0?undefined:process.argv[i+1]};
const stableHash=(value:string)=>createHash('sha256').update(value).digest('hex');

async function main(){
 const mode=arg('--mode')??'baseline';if(!['baseline','new'].includes(mode))throw Error('--mode must be baseline or new');
 const snapshotPath=arg('--snapshot')??'evidence/needs-discovery-input-2026-11-17.json.gz';
 const manifestPath=arg('--holdout')??'evidence/needs-discovery-heldout-2026-11-17.json';
 const output=arg('--out')??`evidence/needs-discovery-${mode}-2026-11-17.json`;
 if(!/^evidence\/[A-Za-z0-9_.-]+\.json$/.test(output))throw Error('--out must be a .json file under evidence/');
 const snapshot=JSON.parse(gunzipSync(await readFile(snapshotPath)).toString('utf8'));
 const holdout=JSON.parse(await readFile(manifestPath,'utf8'));
 if(snapshot.inputSha256!==holdout.inputSha256)throw Error('Holdout and source snapshot digest do not match');
 const input=snapshot.input,holdoutUrls=new Set<string>(holdout.excludedFromProviderSearch);
 const latest=new Map<string,any>();
 for(const footprint of [...input.technicalFootprints].sort((a:any,b:any)=>new Date(b.analyzedAt).getTime()-new Date(a.analyzedAt).getTime())){
  const key=`${footprint.projectId}\0${footprint.repository}\0${footprint.scope}`;if(!latest.has(key))latest.set(key,footprint);
 }
 const latestFootprintIds=new Set([...latest.values()].map((f:any)=>f.id));
 const observations=input.footprintObservations.filter((o:any)=>latestFootprintIds.has(o.footprintId));
 const signals=input.signals;
 const allSignalIntents=extractSignalIntents(signals);
 const allObservationIntents=extractObservationIntents(observations);
 const heldoutSignals=signals.filter((s:any)=>holdoutUrls.has(s.sourceUrl)&&['need','obstacle'].includes(s.kind));
 const providerIntents=[...allSignalIntents.filter(x=>x.direction!=='need'&&!holdoutUrls.has(x.sourceUrl)),...allObservationIntents];
 const legacyNeeds=allSignalIntents.filter(x=>x.direction==='need'&&holdoutUrls.has(x.sourceUrl));
 const legacyIntentCandidates=discoverIntentCandidates([...legacyNeeds,...providerIntents]);
 const sourceNeeds=heldoutSignals.filter((s:any)=>s.kind==='need').map((s:any)=>({projectId:s.projectId,claim:s.claim,sourceUrl:s.sourceUrl,revision:s.revision}));
 const legacyCorpus=discoverCorpus(observations,sourceNeeds);
 const rejectionCounts:Record<string,number>={};
 for(const need of legacyNeeds)for(const provider of providerIntents){if(need.projectId===provider.projectId||need.scope!==provider.scope)continue;const reason=explainIntentPair(need,provider);if(reason)rejectionCounts[reason]=(rejectionCounts[reason]??0)+1}
 const providerBySource=new Map(providerIntents.map(x=>[x.sourceUrl,x]));
 const projectById=new Map(input.projects.map((p:any)=>[p.id,p.name]));
 const selectedProjectIds=new Set([...holdoutUrls].flatMap(url=>signals.filter((s:any)=>s.sourceUrl===url).map((s:any)=>s.projectId)));
 const selectedFootprints=[...latest.values()].filter((f:any)=>selectedProjectIds.has(f.projectId));
 const selectedWithCode=new Set(observations.filter((o:any)=>selectedProjectIds.has(o.projectId)).map((o:any)=>o.projectId));
 const intentCandidates=legacyIntentCandidates.map(c=>({pipeline:'typed-intent',consumerId:c.need.projectId,consumer:projectById.get(c.need.projectId)??c.need.projectId,providerId:c.provider.projectId,provider:projectById.get(c.provider.projectId)??c.provider.projectId,scope:c.scope,intentType:c.intentType,relation:c.relation,need:{claim:c.need.claim,sourceUrl:c.need.sourceUrl,revision:c.need.revision},providerEvidence:{claim:c.provider.claim,sourceUrl:c.provider.sourceUrl,revision:c.provider.revision,verification:c.provider.verification},providerFootprint:c.provider.observationId?observations.find((o:any)=>o.id===c.provider.observationId)?.repository:null}));
 const corpusCandidates=legacyCorpus.candidates.map(c=>({pipeline:'source-corpus',consumerId:c.consumer.projectId,consumer:projectById.get(c.consumer.projectId)??c.consumer.projectId,providerId:c.provider.projectId,provider:projectById.get(c.provider.projectId)??c.provider.projectId,scope:c.discoveryKind,need:{claim:c.need.claim,sourceUrl:c.need.sourceUrl,revision:c.need.revision},consumerTouchpoint:{repository:c.consumerObservation.repository,revision:c.consumerObservation.revision,path:c.consumerObservation.path,line:c.consumerObservation.startLine},providerTouchpoint:{repository:c.providerObservation.repository,revision:c.providerObservation.revision,path:c.providerObservation.path,line:c.providerObservation.startLine},supportTouchpoints:c.supportObservations?.length??0,findings:c.findings}));
 const candidatePairs=new Set([...intentCandidates,...corpusCandidates].map(c=>`${c.consumerId}\0${c.providerId}`));
 const candidates=[...intentCandidates,...corpusCandidates];
 const baseline={schemaVersion:1,mode,createdAt:new Date().toISOString(),evaluatorRevision:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),snapshot:{path:snapshotPath,inputSha256:snapshot.inputSha256,codeRevision:snapshot.codeRevision},holdout:{path:manifestPath,seed:holdout.seed,selectedIssueCount:holdout.selectedIssueUrls.length,selectedIssueUrls:holdout.selectedIssueUrls,excludedIssueUrlsFromProviderSearch:holdout.excludedFromProviderSearch,selectedProjectCount:selectedProjectIds.size,selectedProjectsWithCodeObservations:selectedWithCode.size,selectedProjectsWithoutCodeObservations:[...selectedProjectIds].filter(x=>!selectedWithCode.has(x))},corpus:{projects:input.projects.length,signals:signals.length,needItems:input.needItems.length,eligibleNeedProjects:new Set(signals.filter((s:any)=>['need','obstacle'].includes(s.kind)).map((s:any)=>s.projectId)).size,eligibleNeedSignals:signals.filter((s:any)=>['need','obstacle'].includes(s.kind)).length,latestFootprints:latest.size,latestCodeObservationCount:observations.length,storedIntentCount:input.signalIntents.length},oldBehavior:{atomicNeedItemsConsumed:false,heldoutSourceSignals:heldoutSignals.length,classifiedHeldoutNeedIntents:legacyNeeds.length,unclassifiedHeldoutSignals:heldoutSignals.length-new Set(legacyNeeds.map(x=>x.signalId)).size,availableProviderIntents:providerIntents.length,typedCandidateCount:intentCandidates.length,sourceCorpusCandidateCount:corpusCandidates.length,candidateRelationshipCount:candidatePairs.size,sameScopeRejections:rejectionCounts,corpusRejections:legacyCorpus.rejected,unmatchedNeedScopes:legacyNeeds.filter(n=>!providerIntents.some(p=>p.projectId!==n.projectId&&p.scope===n.scope)).map(n=>({projectId:n.projectId,scope:n.scope,claim:n.claim,sourceUrl:n.sourceUrl})),candidates,existingLifecycle:input.candidateCapabilities.map((c:any)=>({capability:c.capability,consumerId:c.consumerProjectId,providerId:c.providerProjectId,lifecycleState:c.lifecycleState,compatibilityState:c.compatibilityState,freshness:c.freshness,lastVerifiedAt:c.lastVerifiedAt,nextAction:c.nextAction}))},limitations:['This held-out comparison is at whole source-issue URL level; all statements and signal rows from a selected issue are excluded from provider signal matching.','No user-testing item exists in the frozen source snapshot; technical validation is the available testing-related stratum.','Need categories are provisional automated interpretations, not human ground-truth labels.','A candidate is not proof of compatibility, current availability, maintainer approval, or adoption.','The old intent path does not consult candidate-scoped lifecycle state when generating candidates.']};
 const bytes=Buffer.from(JSON.stringify(baseline,null,2)+'\n');await writeFile(output,bytes);
 console.log(JSON.stringify({output,bytes:bytes.length,mode,eligibleNeedProjects:baseline.corpus.eligibleNeedProjects,selectedIssueCount:baseline.holdout.selectedIssueCount,selectedProjectsWithCodeObservations:baseline.holdout.selectedProjectsWithCodeObservations,heldoutSignals:baseline.oldBehavior.heldoutSourceSignals,classifiedHeldoutNeedIntents:baseline.oldBehavior.classifiedHeldoutNeedIntents,typedCandidateCount:baseline.oldBehavior.typedCandidateCount,sourceCorpusCandidateCount:baseline.oldBehavior.sourceCorpusCandidateCount,candidateRelationshipCount:baseline.oldBehavior.candidateRelationshipCount,sameScopeRejections:baseline.oldBehavior.sameScopeRejections},null,2));
}
main().catch(error=>{console.error(error instanceof Error?error.message:String(error));process.exit(1)});
