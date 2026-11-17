import {createHash} from 'node:crypto';
import {z} from 'zod';
import {explainIntentPair,type IntentPairRejection,type IntentType,type SignalIntent} from './intents';

export const QUALIFICATION_OUTCOMES=['QUALIFIED','NEEDS_CONFIRMATION','ALREADY_ADDRESSED','REJECTED','BLOCKED','NO_QUALIFIED_PILOT'] as const;
export type QualificationOutcome=typeof QUALIFICATION_OUTCOMES[number];

export const QualificationAssessmentSchema=z.object({
 candidateId:z.string().min(1),
 proposedOutcome:z.enum(QUALIFICATION_OUTCOMES.filter(x=>x!=='NO_QUALIFIED_PILOT') as [Exclude<QualificationOutcome,'NO_QUALIFIED_PILOT'>,...Exclude<QualificationOutcome,'NO_QUALIFIED_PILOT'>[]]),
 currentNeed:z.enum(['confirmed_unresolved','ambiguous','already_addressed','unknown']),
 sourceFreshness:z.enum(['current','partial','unresolved']),
 fit:z.enum(['specific','partial','unsupported','unknown']),
 providerKind:z.enum(['human_offer','technical_capability','none']),
 providerAvailability:z.enum(['confirmed','unconfirmed','not_applicable']),
 priorWork:z.enum(['none_found','partial','exact_capability_demonstrated','adopted','unknown']),
 rationale:z.string().trim().min(20).max(4000),
 value:z.string().trim().min(12).max(1200),
 participation:z.string().trim().min(12).max(1200),
 experiment:z.string().trim().min(12).max(1600),
 successCriteria:z.array(z.string().trim().min(4).max(400)).max(8),
 alternatives:z.array(z.object({name:z.string().min(1).max(240),evidenceUrl:z.string().url().optional(),finding:z.string().min(4).max(1200)}).strict()).max(8),
 unknowns:z.array(z.string().trim().min(4).max(600)).max(12),
 nextAction:z.string().trim().min(12).max(1200),
 evidence:z.array(z.object({sourceUrl:z.string().url(),revision:z.string().max(128).optional(),excerpt:z.string().min(1).max(2000),evidenceType:z.enum(['builder_need','provider_offer','provider_capability','current_state','prior_work','alternative']),checkedAt:z.string().datetime({offset:true}).optional(),verification:z.string().min(8).max(500)}).strict()).min(1).max(16),
}).strict();
export type QualificationAssessment=z.infer<typeof QualificationAssessmentSchema>;

const QualificationEvidenceSchema=z.object({
 sourceUrl:z.string().url(),revision:z.string().max(128).optional(),excerpt:z.string().min(1).max(2000),evidenceType:z.enum(['builder_need','provider_offer','provider_capability','current_state','prior_work','alternative']),checkedAt:z.string().datetime({offset:true}).optional(),verification:z.string().min(8).max(500),
}).strict();
export type QualificationEvidence=z.infer<typeof QualificationEvidenceSchema>;
const AssessmentResultSchema=QualificationAssessmentSchema.extend({outcome:z.enum(QUALIFICATION_OUTCOMES.filter(x=>x!=='NO_QUALIFIED_PILOT') as [Exclude<QualificationOutcome,'NO_QUALIFIED_PILOT'>,...Exclude<QualificationOutcome,'NO_QUALIFIED_PILOT'>[]])});
export const QualificationReviewReportSchema=z.object({
 schemaVersion:z.literal(1),
 evaluation:z.object({reviewInputSha256:z.string().regex(/^[a-f0-9]{64}$/),sourceSnapshotSha256:z.string().regex(/^[a-f0-9]{64}$/),candidatePoolSha256:z.string().regex(/^[a-f0-9]{64}$/),currentChecksSha256:z.string().regex(/^[a-f0-9]{64}$/),issueStateSha256:z.string().regex(/^[a-f0-9]{64}$/),reviewAnnotationsSha256:z.string().regex(/^[a-f0-9]{64}$/),baselineCommit:z.string().regex(/^[a-f0-9]{40}$/),checkedAt:z.string().datetime({offset:true}),selectionMethod:z.string().min(20),reviewMethod:z.string().min(20)}),
 outcome:z.enum(['QUALIFIED','NO_QUALIFIED_PILOT']),actionStatus:z.enum(['NOT_SENT_AWAITING_USER_APPROVAL','NO_QUALIFIED_PILOT']),selectedCandidateId:z.string().nullable(),
 candidateReviews:z.array(z.object({
  candidateId:z.string().min(1),projectName:z.string().min(1),projectId:z.string().min(1),source:z.string().min(1),engineDisposition:z.string().min(1),selectionReason:z.string().min(1),scope:z.string().min(1),intentType:z.string().min(1),
  need:z.object({needItemId:z.string().min(1),lineageKey:z.string().min(1),sourceUrl:z.string().url(),revision:z.string().min(1),sourceClaim:z.string(),excerpt:z.string().min(1),category:z.string(),stance:z.string(),interpretationMethod:z.string(),startOffset:z.number().int().nonnegative(),endOffset:z.number().int().nonnegative(),verification:z.string()}),
  provider:z.object({projectId:z.string(),sourceUrl:z.string().url(),revision:z.string(),claim:z.string(),verification:z.string()}).nullable(),
  rejectedAlternatives:z.array(z.object({providerProjectId:z.string(),providerClaim:z.string(),sourceUrl:z.string().url(),revision:z.string(),reason:z.string()})),
  currentState:z.object({checkedAt:z.string().datetime({offset:true}),result:z.string(),freshness:z.string(),lifecycleState:z.string(),compatibilityState:z.string(),summary:z.string(),uncertainty:z.string(),nextAction:z.string(),limitations:z.array(z.string()),sources:z.array(z.object({url:z.string().url(),kind:z.string(),fetchStatus:z.string(),httpStatus:z.number().optional(),revision:z.string().optional(),publishedAt:z.string().optional(),error:z.string().optional(),contentSha256:z.string(),excerpt:z.string()})),evidence:z.array(QualificationEvidenceSchema)}),
  assessment:AssessmentResultSchema,
  sourceState:z.object({state:z.enum(['open','closed']),updatedAt:z.string().datetime({offset:true}),closedAt:z.string().datetime({offset:true}).nullable(),checkedAt:z.string().datetime({offset:true}),sourceUrl:z.string().url(),exactNeedStillInBody:z.boolean()}),
 })).min(1).max(10),
 supplyGap:z.object({result:z.literal('NO_QUALIFIED_PILOT'),title:z.string(),problem:z.string(),proposedConnection:z.string(),expectedBenefit:z.string(),requiredParticipation:z.array(z.string()),smallestUsefulExperiment:z.string(),successCriteria:z.array(z.string()),alternatives:z.array(z.object({name:z.string(),evidenceUrl:z.string().url().optional(),finding:z.string()})),missingEvidence:z.array(z.string()),nextHumanAction:z.string(),actionStatus:z.literal('NO_QUALIFIED_PILOT'),externalActionSent:z.literal(false)}),
 supplyGapEvidence:z.array(QualificationEvidenceSchema),externalOutcome:z.literal('NO_EXTERNAL_PARTICIPATION_VERIFIED'),
}).strict();
export type QualificationReviewReport=z.infer<typeof QualificationReviewReportSchema>;

export type QualificationNeed=SignalIntent&{
 needItemId:string;lineageKey:string;sourceClaim:string;category:string;stance:string;startOffset:number;endOffset:number;
};
export type QualificationCandidate={
 id:string;source:'structured_match'|'code_observation_match'|'unmatched_need';need:QualificationNeed;
 provider?:SignalIntent;relation?:'documented-need'|'explicit-offer';scope:string;intentType:IntentType;
 selectionReason:string;rejectedAlternatives:Array<{providerProjectId:string;providerClaim:string;sourceUrl:string;revision:string;reason:IntentPairRejection}>;
};
export type QualificationMatch={id:string;need:QualificationNeed;provider:SignalIntent;relation:'documented-need'|'explicit-offer';source:'structured_match'|'code_observation_match';scope:string;intentType:IntentType};

const hash=(value:string)=>createHash('sha256').update(value).digest('hex');
const TYPE_ORDER:IntentType[]=['technical-integration','technical-review','security-review','user-testing','validation','product-feedback','adoption','distribution'];
const sourceTime=(need:QualificationNeed)=>{
 const parsed=Date.parse(need.revision);return Number.isFinite(parsed)?parsed:(need.observedAt?.getTime()??0);
};
const sortNeed=(a:QualificationNeed,b:QualificationNeed)=>sourceTime(b)-sourceTime(a)||Number(b.stance==='explicit-request')-Number(a.stance==='explicit-request')||b.claim.length-a.claim.length||a.needItemId.localeCompare(b.needItemId);
const poolId=(need:QualificationNeed,provider?:SignalIntent)=>`qualification-${hash(`${need.needItemId}\0${provider?.projectId??'no-provider'}\0${provider?.sourceUrl??''}`).slice(0,32)}`;

/** Builds a bounded, pair-blind review pool from the current engine output and active interpreted needs. */
export function buildQualificationPool(input:{needs:QualificationNeed[];matches:QualificationMatch[];providerIntents:SignalIntent[];limit?:number}):QualificationCandidate[]{
 const limit=Math.max(1,Math.min(input.limit??10,10));
 const matchedNeeds=new Set(input.matches.map(x=>x.need.needItemId));
 const matched=input.matches.slice().sort((a,b)=>Number(b.relation==='explicit-offer')-Number(a.relation==='explicit-offer')||sortNeed(a.need,b.need)||a.id.localeCompare(b.id)).slice(0,limit).map((x):QualificationCandidate=>({
  id:poolId(x.need,x.provider),source:x.source,need:x.need,provider:x.provider,relation:x.relation,scope:x.scope,intentType:x.intentType,
  selectionReason:'Surfaced by the existing structured need/provider or code-observation matcher against the imported corpus; qualification and current availability remain unverified.',
  rejectedAlternatives:[],
 }));
 const unmatched=input.needs.filter(x=>!matchedNeeds.has(x.needItemId)&&['explicit-request','reported-obstacle'].includes(x.stance));
 const selected:QualificationCandidate[]=[];
 const usedNeeds=new Set(matched.map(x=>x.need.needItemId));
 const issueCounts=new Map<string,number>();
 for(const row of matched)issueCounts.set(row.need.sourceUrl,(issueCounts.get(row.need.sourceUrl)??0)+1);
 const addNeed=(need:QualificationNeed,selectionReason:string)=>{
  selected.push(asUnmatched(need,selectionReason));usedNeeds.add(need.needItemId);issueCounts.set(need.sourceUrl,(issueCounts.get(need.sourceUrl)??0)+1);
 };
 for(const type of TYPE_ORDER){
  if(matched.length+selected.length>=limit)break;
  const options=unmatched.filter(x=>x.intentType===type&&!usedNeeds.has(x.needItemId)&&(issueCounts.get(x.sourceUrl)??0)<2).sort(sortNeed);
  const need=options[0];if(!need)continue;
  addNeed(need,`Selected as the most recent active actionable need for the ${type.replaceAll('-',' ')} class; the current engine produced no supported match. The ten-entry cap allows up to two distinct atomic needs from one source issue.`);
 }
 const remainder=unmatched.filter(x=>!usedNeeds.has(x.needItemId)).sort(sortNeed);
 for(const uniqueIssueOnly of [true,false])for(const need of remainder){
  if(matched.length+selected.length>=limit)break;
  const issueCount=issueCounts.get(need.sourceUrl)??0;
  if(usedNeeds.has(need.needItemId)||issueCount>=2||(uniqueIssueOnly&&issueCount!==0)||(!uniqueIssueOnly&&issueCount===0))continue;
  addNeed(need,'Selected after class coverage to fill the bounded ten-entry review cap; it is an actionable imported need, not a provider recommendation. Distinct needs from one issue remain separately traceable.');
 }
 return[...matched,...selected].slice(0,limit).sort((a,b)=>a.id.localeCompare(b.id));

 function asUnmatched(need:QualificationNeed,selectionReason:string):QualificationCandidate{
  const rejectedAlternatives=input.providerIntents.filter(p=>p.scope===need.scope&&p.projectId!==need.projectId)
   .map(provider=>({providerProjectId:provider.projectId,providerClaim:provider.claim,sourceUrl:provider.sourceUrl,revision:provider.revision,reason:explainIntentPair(need,provider)}))
   .filter((x):x is {providerProjectId:string;providerClaim:string;sourceUrl:string;revision:string;reason:IntentPairRejection}=>Boolean(x.reason))
   .sort((a,b)=>a.sourceUrl.localeCompare(b.sourceUrl));
  return{id:poolId(need),source:'unmatched_need',need,scope:need.scope,intentType:need.intentType,selectionReason,rejectedAlternatives};
 }
}

/** Applies non-negotiable evidence gates to an independent reviewer assessment. */
export function enforceQualificationGates(input:unknown):QualificationAssessment&{outcome:Exclude<QualificationOutcome,'NO_QUALIFIED_PILOT'>}{
 const assessment=QualificationAssessmentSchema.parse(input);
 let outcome=assessment.proposedOutcome;
 if(assessment.priorWork==='exact_capability_demonstrated'||assessment.priorWork==='adopted'||assessment.currentNeed==='already_addressed')outcome='ALREADY_ADDRESSED';
 else if(assessment.fit==='unsupported')outcome='REJECTED';
 else if(assessment.sourceFreshness!=='current')outcome='BLOCKED';
 else if(assessment.currentNeed==='unknown'||assessment.currentNeed==='ambiguous')outcome='NEEDS_CONFIRMATION';
 else if(assessment.providerKind==='none')outcome='BLOCKED';
 else if(assessment.providerKind==='human_offer'&&assessment.providerAvailability!=='confirmed')outcome='NEEDS_CONFIRMATION';
 else if(assessment.fit==='partial'||assessment.fit==='unknown')outcome='NEEDS_CONFIRMATION';
 if(outcome==='QUALIFIED'&&assessment.evidence.length<2)outcome='BLOCKED';
 return{...assessment,outcome};
}

export function aggregateQualificationOutcome(assessments:{outcome:Exclude<QualificationOutcome,'NO_QUALIFIED_PILOT'>}[]):'QUALIFIED'|'NO_QUALIFIED_PILOT'{
 return assessments.some(x=>x.outcome==='QUALIFIED')?'QUALIFIED':'NO_QUALIFIED_PILOT';
}
