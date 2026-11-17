import {createHash} from 'node:crypto';
import {db} from '../db';
import {candidateCapabilities,evidence,followUps,intelligenceAssessments,intelligenceRuns,lifecycleEvidence,lifecycleVerificationRuns,opportunities,projects,signalIntents} from '../schema';
import {and,eq,inArray,sql} from 'drizzle-orm';
import {discoverIntentCandidates,extractObservationIntents,extractSignalIntents,intentCompatibilityFindings,type IntentCandidate,type IntentObservation,type SignalInput,type SignalIntent} from './intents';
import {interpretNeedItems,type NeedItemSource} from './need-discovery';
import type {CandidateVerification} from './current-state';

const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
const link=(o:IntentObservation)=>`${o.repository}/blob/${o.revision}/${o.path}#L${o.startLine}`;
const intentValues=(x:SignalIntent)=>({id:x.id,signalId:x.signalId??null,needItemId:x.needItemId??null,observationId:x.observationId??null,projectId:x.projectId,direction:x.direction,intentType:x.intentType,scope:x.scope,extractionRule:x.extractionRule,verification:x.verification,sourceUrl:x.sourceUrl,revision:x.revision,observedAt:x.observedAt??new Date()});

/** Persist derived interpretations additively. Source atoms are independently linked and refreshes do not erase prior evidence. */
export async function replaceStructuredIntentRecords(sourceSignals:SignalInput[],observations:IntentObservation[],needItems:NeedItemSource[]=[]){
 const interpreted=interpretNeedItems(needItems).intents;
 const intents=[...extractSignalIntents(sourceSignals),...extractObservationIntents(observations),...interpreted];
 for(let i=0;i<intents.length;i+=200){
  const rows=intents.slice(i,i+200).map(intentValues);
  if(rows.length)await db.insert(signalIntents).values(rows).onConflictDoUpdate({target:signalIntents.id,set:{signalId:sql`excluded.signal_id`,needItemId:sql`excluded.need_item_id`,observationId:sql`excluded.observation_id`,projectId:sql`excluded.project_id`,direction:sql`excluded.direction`,intentType:sql`excluded.intent_type`,scope:sql`excluded.scope`,extractionRule:sql`excluded.extraction_rule`,verification:sql`excluded.verification`,sourceUrl:sql`excluded.source_url`,revision:sql`excluded.revision`,observedAt:sql`excluded.observed_at`}});
 }
 return intents;
}

type EvidenceClaim={claim:string;sourceUrl:string;revision?:string|null;verification:string;needItemId?:string};
export async function persistIntentCandidates(input:{candidates:IntentCandidate[];sourceSignals:SignalInput[];observations:IntentObservation[];footprints:{id:string;projectId:string;repository?:string}[];runId:string;createdAt:Date}){
 const projectRows=await db.select({id:projects.id,name:projects.name}).from(projects),output=[];
 for(const c of input.candidates){
  const a=projectRows.find(x=>x.id===c.need.projectId),b=projectRows.find(x=>x.id===c.provider.projectId);
  const aSignals=input.sourceSignals.filter(x=>x.projectId===c.need.projectId),bSignals=input.sourceSignals.filter(x=>x.projectId===c.provider.projectId);
  const findings=intentCompatibilityFindings({consumerProjectId:c.need.projectId,providerProjectId:c.provider.projectId,consumerSignals:aSignals,providerSignals:bSignals,providerClaim:c.provider.claim,observations:input.observations,intentType:c.intentType,relation:c.relation});
  const conclusion=findings.some(x=>x.conclusion==='environment_blocked')?'environment_blocked':'unknown',id=`intent-${c.id.slice(0,32)}`;
  const human=c.relation==='explicit-offer';
  const problem=human?`Assess whether ${b?.name??c.provider.projectId}’s recorded ${c.intentType.replaceAll('-',' ')} offer can help with the exact request from ${a?.name??c.need.projectId}.`:`Investigate the ${c.scope.replaceAll('-',' ')} need from ${a?.name??c.need.projectId} against the source-backed capability from ${b?.name??c.provider.projectId}.`;
  const reasoning=human
   ?`An atomic builder statement records an actionable ${c.intentType.replaceAll('-',' ')} need, and a separate source records an explicit offer with the same bounded activity. This is a human collaboration lead, not a code capability. The offer’s current availability and topic fit have not been reconfirmed.`
   :`An atomic source-backed need and separate project capability share the same bounded scope (${c.scope}). The decision keeps the exact request separate from its parent claim. Matching does not establish runtime compatibility, a maintainer offer, integration, or adoption.`;
  const experiment=human
   ?'Before any introduction, inspect the linked offer and ask for reconfirmation through a human-controlled process. Agree on the exact scope, expected output, timeframe and success criteria. Trycove has not contacted either project.'
   :c.intentType==='validation'
    ?'Prepare a reproducible positive case, a deliberately invalid case and an incomplete-dependency case using pinned inputs. Record the exact toolchain and raw outputs before treating the capability as useful.'
    :'Trace the exact source boundary on both projects, record network/version/signer/script assumptions that are actually known, then define a bounded positive and negative experiment. Do not infer compatibility from shared CKB terminology.';
  const requirements=[...findings.map(f=>`${f.dimension} (${f.conclusion}): ${f.explanation}`),...(c.need.unresolvedContext??[])].join('\n');
  const value={id,projectA:c.need.projectId,projectB:c.provider.projectId,kind:`${human?'Explicit human offer':'Documented need'} / ${c.intentType}`,problem,reasoning,requirements,experiment,status:'provisional'};
  const [previous]=await db.select().from(opportunities).where(eq(opportunities.id,id));
  if(!previous)await db.insert(opportunities).values(value);else if(['discovered','provisional'].includes(previous.status))await db.update(opportunities).set(value).where(eq(opportunities.id,id));

  const claims:EvidenceClaim[]=[
   {claim:c.need.claim,sourceUrl:c.need.sourceUrl,revision:c.need.revision,verification:c.need.verification,needItemId:c.need.needItemId},
   ...(c.need.sourceClaim&&c.need.sourceClaim!==c.need.claim?[{claim:c.need.sourceClaim,sourceUrl:c.need.sourceUrl,revision:c.need.revision,verification:'parent source claim; imported claim, unverified',needItemId:c.need.needItemId}]:[]),
   ...c.relatedNeeds.map(n=>({claim:n.claim,sourceUrl:n.sourceUrl,revision:n.revision,verification:n.verification,needItemId:n.needItemId})),
   {claim:c.provider.claim,sourceUrl:c.provider.sourceUrl,revision:c.provider.revision,verification:c.provider.verification,needItemId:c.provider.needItemId},
  ];
  const sourceObservations=input.observations.filter(o=>o.projectId===c.need.projectId||o.projectId===c.provider.projectId).filter(o=>{
   if(c.provider.observationId)return o.id===c.provider.observationId;
   return c.scope==='ckb-per-script-group-cycle-analysis'?/^(?:src\/profile\.ts|src\/replay\.ts|src\/explorer\.ts)$/.test(o.path)&&/profileTransaction|planReplay|replayGroups|transaction|rawTransaction/.test(o.fact):false;
  }).slice(0,12);
  for(const o of sourceObservations)claims.push({claim:o.fact,sourceUrl:link(o),revision:o.revision,verification:'pinned source observation; runtime compatibility unknown'});
  const current=await db.select().from(evidence).where(eq(evidence.opportunityId,id));
  for(const item of claims){
   const existing=current.find(x=>x.sourceUrl===item.sourceUrl&&x.claim===item.claim);
   if(existing){if(item.needItemId&&!existing.needItemId)await db.update(evidence).set({needItemId:item.needItemId}).where(eq(evidence.id,existing.id));continue}
   await db.insert(evidence).values({opportunityId:id,needItemId:item.needItemId??null,claim:item.claim,sourceUrl:item.sourceUrl,revision:item.revision??null,observedAt:input.createdAt,verification:item.verification});
  }
  const providerObservation=c.provider.observationId?input.observations.find(x=>x.id===c.provider.observationId):undefined;
  const footprintA=input.footprints.find(x=>x.projectId===c.need.projectId),footprintB=(providerObservation?input.footprints.find(x=>x.projectId===c.provider.projectId&&x.repository===providerObservation.repository):undefined)??input.footprints.find(x=>x.projectId===c.provider.projectId);
  if(footprintA&&footprintB)await db.insert(intelligenceAssessments).values({id:hash(input.runId+c.id),runId:input.runId,opportunityId:id,consumerFootprintId:footprintA.id,providerFootprintId:footprintB.id,conclusion,findings:JSON.stringify(findings),createdAt:input.createdAt}).onConflictDoNothing();
  output.push({id,consumer:a?.name??c.need.projectId,provider:b?.name??c.provider.projectId,scope:c.scope,relation:c.relation,conclusion,need:c.need.claim,needItemId:c.need.needItemId,providerClaim:c.provider.claim,providerSource:c.provider.sourceUrl});
 }
 return output;
}

/** Persist one deterministic, source-backed no-provider decision for an actionable unmatched atom. */
export async function persistRepresentativeNoMatch(input:{needItems:NeedItemSource[];matchedNeedItemIds:Set<string>;runId:string;createdAt:Date}){
 const {intents}=interpretNeedItems(input.needItems);
 const candidates=intents.filter(item=>item.direction==='need'&&item.needItemId&&!input.matchedNeedItemIds.has(item.needItemId));
 const categoryOrder=['technical-review','security','validation','user-testing','integration','feature-request','infrastructure','product-feedback','adoption','distribution','unknown'];
 candidates.sort((a,b)=>{
  const stanceRank=(x:string|undefined)=>x==='explicit-request'?0:1;
  return stanceRank(a.stance)-stanceRank(b.stance)||(categoryOrder.indexOf(a.category??'unknown')-categoryOrder.indexOf(b.category??'unknown'))||((b.observedAt?.getTime()??0)-(a.observedAt?.getTime()??0))||a.needItemId!.localeCompare(b.needItemId!);
 });
 const selected=candidates[0];if(!selected)return null;
 const id=`need-${hash(selected.needItemId!).slice(0,32)}`;
 const projectRows=await db.select({id:projects.id,name:projects.name}).from(projects),project=projectRows.find(x=>x.id===selected.projectId);
 const requirements=`No other imported source record met the same bounded scope and evidence requirements in this discovery run. This is a no-match result for the searched inventory, not evidence that no suitable provider exists. A category-level interpretation does not establish provider expertise or willingness.\nCurrent-state verification: not run because no provider candidate was supported.\nEvidence used: ${selected.sourceUrl} at ${selected.revision}; offsets ${selected.startOffset}–${selected.endOffset}; method ${selected.interpretationMethod}.`;
 const nextAction=selected.intentType==='technical-review'||selected.intentType==='security-review'
  ?'Write the precise review question and expected output, then identify and invite an appropriate reviewer through a human-controlled process. No offer or response is recorded.'
  :selected.intentType==='user-testing'||selected.intentType==='validation'
   ?'Prepare a reproducible test plan with setup, positive and negative cases, and expected evidence; recruit a tester through a human-controlled process.'
   :'Add the missing interface, environment, or deliverable constraints to the need, then rerun discovery against refreshed source evidence.';
 const value={id,projectA:selected.projectId,projectB:null,kind:`No provider found / ${selected.intentType}`,problem:`No provider was supported for this source-backed ${selected.category?.replaceAll('-',' ')} request: “${selected.claim}”`,reasoning:`The engine interpreted one atomic builder statement from ${project?.name??selected.projectId}, searched imported provider capabilities and explicit human offers outside its source issue, and found no evidence-backed match. The statement remains an imported claim; the automated category and scope interpretation is not independently verified.`,requirements,experiment:nextAction,status:'needs-provider'};
 const [previous]=await db.select().from(opportunities).where(eq(opportunities.id,id));
 if(!previous)await db.insert(opportunities).values(value);else if(['needs-provider','discovered'].includes(previous.status))await db.update(opportunities).set(value).where(eq(opportunities.id,id));
 const sourceClaims=[
  {claim:selected.claim,sourceUrl:selected.sourceUrl,revision:selected.revision,verification:selected.verification,needItemId:selected.needItemId},
  ...(selected.sourceClaim&&selected.sourceClaim!==selected.claim?[{claim:selected.sourceClaim,sourceUrl:selected.sourceUrl,revision:selected.revision,verification:'parent source claim; imported claim, unverified',needItemId:selected.needItemId}]:[]),
 ];
 const existing=await db.select().from(evidence).where(eq(evidence.opportunityId,id));
 for(const item of sourceClaims){const row=existing.find(x=>x.claim===item.claim&&x.sourceUrl===item.sourceUrl);if(row){if(!row.needItemId)await db.update(evidence).set({needItemId:item.needItemId}).where(eq(evidence.id,row.id));continue}await db.insert(evidence).values({opportunityId:id,needItemId:item.needItemId,claim:item.claim,sourceUrl:item.sourceUrl,revision:item.revision,observedAt:input.createdAt,verification:item.verification})}
 return{id,consumer:project?.name??selected.projectId,needItemId:selected.needItemId,category:selected.category,stance:selected.stance,claim:selected.claim,sourceUrl:selected.sourceUrl,revision:selected.revision,scope:selected.scope,intentType:selected.intentType,nextAction,selectionRule:'unmatched actionable need; explicit requests first; then review/security/validation/testing before other classes; newest source observation; stable item id tie-break',evidenceBackedProviderMatches:0,status:'needs-provider'};
}

/** Append the existing candidate-scoped lifecycle result for a discovered opportunity. */
export async function persistCandidateVerification(input:{opportunityId:string;capabilityKey:string;capability:string;consumerProjectId:string;providerProjectId:string;result:CandidateVerification}){
 const {result}=input,checkedAt=new Date(result.checkedAt),capabilityId=`candidate-cap-${hash(`${input.opportunityId}\0${input.capabilityKey}`).slice(0,28)}`,runId=`lifecycle-${hash(`${capabilityId}\0${result.checkedAt}`).slice(0,28)}`;
 const [previous]=await db.select().from(candidateCapabilities).where(and(eq(candidateCapabilities.opportunityId,input.opportunityId),eq(candidateCapabilities.capabilityKey,input.capabilityKey)));
 const capabilityValue={id:capabilityId,opportunityId:input.opportunityId,capabilityKey:input.capabilityKey,capability:input.capability,consumerProjectId:input.consumerProjectId,providerProjectId:input.providerProjectId,lifecycleState:result.lifecycleState,compatibilityState:result.compatibilityState,freshness:result.freshness,summary:result.summary,uncertainty:result.uncertainty,nextAction:result.nextAction,lastVerifiedAt:result.freshness==='current'?checkedAt:null,createdAt:previous?.createdAt??checkedAt,updatedAt:checkedAt};
 await db.insert(candidateCapabilities).values(capabilityValue).onConflictDoUpdate({target:[candidateCapabilities.opportunityId,candidateCapabilities.capabilityKey],set:{lifecycleState:capabilityValue.lifecycleState,compatibilityState:capabilityValue.compatibilityState,freshness:capabilityValue.freshness,summary:capabilityValue.summary,uncertainty:capabilityValue.uncertainty,nextAction:capabilityValue.nextAction,lastVerifiedAt:capabilityValue.lastVerifiedAt,updatedAt:checkedAt}});
 const sourceRecord=result.sources.map(s=>({url:s.url,kind:s.kind,checkedAt:s.checkedAt,fetchStatus:s.fetchStatus,httpStatus:s.httpStatus,revision:s.revision,publishedAt:s.publishedAt,error:s.error,cache:s.cache}));
 await db.insert(lifecycleVerificationRuns).values({id:runId,capabilityId,checkedAt,freshness:result.freshness,result:result.result,priorLifecycle:result.priorLifecycle,evaluatedLifecycle:result.lifecycleState,method:'Candidate-scoped current-state verification during structured-need discovery; bounded public GitHub/source refresh using existing verifier and conditional cache.',queries:JSON.stringify({queries:result.queries,sources:sourceRecord}),conclusion:result.summary,limitations:JSON.stringify(result.limitations),nextAction:result.nextAction,sourceCount:result.sources.length}).onConflictDoNothing();
 for(const item of result.evidence)await db.insert(lifecycleEvidence).values({id:`lifecycle-evidence-${item.id.slice(0,40)}`,capabilityId,verificationRunId:runId,evidenceType:item.evidenceType,sourceUrl:item.sourceUrl,revision:item.revision??null,path:item.path??null,line:item.line??null,publishedAt:item.publishedAt?new Date(item.publishedAt):null,checkedAt:new Date(item.checkedAt),excerpt:item.excerpt,conclusion:item.conclusion,verification:item.verification,sourceSha256:item.sourceSha256}).onConflictDoNothing();
 return{capabilityId,runId,checkedAt:result.checkedAt,lifecycleState:result.lifecycleState,compatibilityState:result.compatibilityState,freshness:result.freshness,result:result.result,sourceCount:result.sources.length,availableSourceCount:result.sources.filter(s=>s.fetchStatus==='available').length,evidenceCount:result.evidence.length,nextAction:result.nextAction,limitations:result.limitations};
}

/** Keep old machine-generated candidates visible as review history when a new run no longer supports them. */
export async function markUnmatchedGeneratedCandidatesForReview(input:{currentOpportunityIds:Set<string>;runId:string;observedAt:Date}){
 const rows=await db.select().from(opportunities);const retired:string[]=[];
 for(const row of rows){if(!['intent-','intelligence-','need-'].some(prefix=>row.id.startsWith(prefix))||!['discovered','provisional','needs-provider'].includes(row.status)||input.currentOpportunityIds.has(row.id))continue;
  const note=`Automated discovery run ${input.runId} did not resurface this candidate from current active needs and provider evidence. The opportunity and its evidence are retained for review. This absence is not evidence of incompatibility or completion.`;
  await db.update(opportunities).set({status:'needs-review',requirements:`${row.requirements}\n\nRefresh note: ${note}`}).where(eq(opportunities.id,row.id));
  const history=await db.select().from(followUps).where(eq(followUps.opportunityId,row.id));if(!history.some(x=>x.note===note))await db.insert(followUps).values({opportunityId:row.id,kind:'finding',note,createdAt:input.observedAt});retired.push(row.id);
 }
 return retired;
}

export function intentRunId(input:{footprintIds:string[];intents:{id:string;revision:string}[]}){return hash(JSON.stringify({footprints:[...input.footprintIds].sort(),intents:input.intents.map(x=>[x.id,x.revision]).sort(),taxonomy:'intent-v2-need-items'}))}
