import {z} from 'zod';
import type {PriorWorkCollection} from './prior-work';

export const ACTION_READINESS_STATES=[
 'CONTACT_WORTHY','CONTACTED','INTEREST_CONFIRMED','PILOT_READY','ALREADY_ADDRESSED',
 'NEEDS_CONFIRMATION','REJECTED','BLOCKED','NO_CONTACT_WORTHY_OPPORTUNITY',
] as const;
export type ActionReadiness=typeof ACTION_READINESS_STATES[number];

export const PriorWorkReferenceSchema=z.object({
 sourceKind:z.enum(['issue_body','issue_comment','pull_request','code_observation']),
 sourceUrl:z.string().url(),
 commentId:z.number().int().positive().optional(),
 revision:z.string().max(128).optional(),
 path:z.string().max(1000).optional(),
 quote:z.string().trim().min(8).max(2000),
}).strict();
export type PriorWorkReference=z.infer<typeof PriorWorkReferenceSchema>;

export const PriorWorkEventSchema=z.object({
 eventId:z.string().regex(/^[a-z0-9-]{3,100}$/),
 capabilityKey:z.string().min(2).max(160),
 relationship:z.enum(['same_capability','related_capability','unrelated']),
 eventType:z.enum(['question_asked','advice_provided','implementation_reported','implementation_observed','integration_proposed','integration_in_progress','demonstration_completed','external_adoption','unresolved_work']),
 effect:z.enum(['asks','answers','partially_answers','reports_implementation','observes_implementation','proposes','progresses','demonstrates','adopts','identifies_unresolved','unrelated']),
 verification:z.enum(['builder_statement','independent_advice','maintainer_report','code_observed','maintainer_reported_test','independent_execution','external_adoption']),
 summary:z.string().trim().min(8).max(1200),
 references:z.array(PriorWorkReferenceSchema).min(1).max(8),
}).strict();
export type PriorWorkEvent=z.infer<typeof PriorWorkEventSchema>;

export const PriorWorkCandidateInputSchema=z.object({
 candidateId:z.string().min(1),
 projectId:z.string().min(1),
 projectName:z.string().min(1),
 capabilityKey:z.string().min(2).max(160),
 issueUrl:z.string().url(),
 needExcerpt:z.string().trim().min(8).max(2000),
 previousConclusion:z.object({outcome:z.string().min(1),rationale:z.string().trim().min(8).max(4000)}).strict(),
 needAssessment:z.enum(['active_unresolved','partially_addressed','answered','stale_or_unconfirmed','unknown','rejected']),
 currentNeedRationale:z.string().trim().min(8).max(1600),
 events:z.array(PriorWorkEventSchema).max(40),
 remainingUnknowns:z.array(z.string().trim().min(4).max(800)).max(16),
 nextAction:z.string().trim().min(8).max(1200),
 contactProposal:z.object({
  targetLogin:z.string().min(1).max(100),
  targetRole:z.enum(['builder','potential_collaborator']),
  purpose:z.string().trim().min(12).max(600),
  question:z.string().trim().min(12).max(600),
  draft:z.string().trim().min(50).max(2400),
  needEvidence:z.array(PriorWorkReferenceSchema).min(1).max(4),
 }).strict().optional(),
 priorContactEvidence:z.array(PriorWorkReferenceSchema).max(8).default([]),
 participantInterestEvidence:z.array(PriorWorkReferenceSchema).max(8).default([]),
 pilotAgreement:z.object({participants:z.boolean(),scope:z.boolean(),prerequisites:z.boolean(),experiment:z.boolean()}).strict(),
 pilotAgreementEvidence:z.array(z.object({dimension:z.enum(['participants','scope','prerequisites','experiment']),reference:PriorWorkReferenceSchema}).strict()).max(12).default([]),
}).strict();
export type PriorWorkCandidateInput=z.infer<typeof PriorWorkCandidateInputSchema>;

export const PriorWorkCandidateResultSchema=z.object({
 candidateId:z.string(),projectId:z.string(),projectName:z.string(),capabilityKey:z.string(),issueUrl:z.string().url(),
 needExcerpt:z.string(),previousConclusion:z.object({outcome:z.string(),rationale:z.string()}),
 discussion:z.object({completeness:z.enum(['complete','partial','unavailable']),commentCount:z.number().int().nonnegative(),latestCommentAt:z.string().datetime().nullable(),commentTimeline:z.array(z.object({id:z.number().int().positive(),url:z.string().url(),author:z.string(),createdAt:z.string().datetime()}).strict()).max(500)}),
 events:z.array(PriorWorkEventSchema),
 questionState:z.enum(['answered','partially_answered','unanswered','unknown']),
 implementationEvidence:z.object({reported:z.boolean(),observed:z.boolean(),demonstrated:z.boolean(),adopted:z.boolean()}),
 relatedIntegrationMilestones:z.object({proposed:z.boolean(),inProgress:z.boolean(),demonstrated:z.boolean(),adopted:z.boolean()}).strict(),
 relatedIntegrationDemonstration:z.enum(['none_found','maintainer_reported','independently_executed']),
 relatedPullRequests:z.array(z.object({url:z.string().url(),title:z.string(),state:z.enum(['open','closed']),merged:z.boolean(),headSha:z.string().regex(/^[a-f0-9]{40}$/),baseSha:z.string().regex(/^[a-f0-9]{40}$/),updatedAt:z.string().datetime(),filesStatus:z.enum(['complete','partial','unavailable'])}).strict()).max(30),
 needState:z.enum(['active_unresolved','partially_addressed','answered','stale_or_unconfirmed','unknown','rejected']),
 actionReadiness:z.enum(ACTION_READINESS_STATES),
 pilotReadiness:z.enum(['PILOT_READY','NOT_READY']),
 contactDraft:z.object({targetLogin:z.string(),targetRole:z.enum(['builder','potential_collaborator']),purpose:z.string(),question:z.string(),draft:z.string(),needEvidence:z.array(PriorWorkReferenceSchema).min(1).max(4),status:z.literal('NOT_SENT_AWAITING_USER_APPROVAL'),sent:z.literal(false)}).strict().nullable(),
 rationale:z.string().trim().min(8),remainingUnknowns:z.array(z.string()),nextAction:z.string(),
}).strict();
export type PriorWorkCandidateResult=z.infer<typeof PriorWorkCandidateResultSchema>;

export const PriorWorkR1ReportSchema=z.object({
 schemaVersion:z.literal(2),
 evaluation:z.object({checkedAt:z.string().datetime({offset:true}),inputSnapshotSha256:z.string().regex(/^[a-f0-9]{64}$/),baselineCommit:z.string().regex(/^[a-f0-9]{40}$/),candidatePoolSha256:z.string().regex(/^[a-f0-9]{64}$/),originalQualificationSha256:z.string().regex(/^[a-f0-9]{64}$/),sourceCollectionSha256:z.string().regex(/^[a-f0-9]{64}$/),sourceObservationsSha256:z.string().regex(/^[a-f0-9]{64}$/),annotationsSha256:z.string().regex(/^[a-f0-9]{64}$/),controlSelectionSha256:z.string().regex(/^[a-f0-9]{64}$/),selectionMethod:z.string().min(20),reconciliationMethod:z.string().min(20)}).strict(),
 actionReadiness:z.enum(['CONTACT_WORTHY','NO_CONTACT_WORTHY_OPPORTUNITY']),selectedCandidateId:z.string().nullable(),
 candidates:z.array(PriorWorkCandidateResultSchema).min(1).max(10),control:PriorWorkCandidateResultSchema,
 contactDraft:z.object({targetLogin:z.string(),targetRole:z.enum(['builder','potential_collaborator']),purpose:z.string(),question:z.string(),draft:z.string(),needEvidence:z.array(PriorWorkReferenceSchema).min(1).max(4),status:z.literal('NOT_SENT_AWAITING_USER_APPROVAL'),sent:z.literal(false)}).strict().nullable(),
 contactSent:z.literal(false),externalOutcome:z.literal('NO_EXTERNAL_PARTICIPATION_VERIFIED'),
 sourceFailures:z.array(z.object({url:z.string().url(),stage:z.string(),httpStatus:z.number().int().optional(),message:z.string()}).passthrough()).max(100),
 repositoryResolutions:z.array(z.object({requestedUrl:z.string().url(),canonicalUrl:z.string().url(),repositoryId:z.number().int().positive(),nodeId:z.string(),resolution:z.string(),resolvedAt:z.string().datetime({offset:true})}).strict()).max(60),
 relatedPullRequests:z.array(z.object({url:z.string().url(),title:z.string(),state:z.enum(['open','closed']),merged:z.boolean(),headSha:z.string().regex(/^[a-f0-9]{40}$/),baseSha:z.string().regex(/^[a-f0-9]{40}$/),updatedAt:z.string().datetime(),referencedFrom:z.array(z.object({issueUrl:z.string().url(),commentId:z.number().int().positive().optional(),excerpt:z.string()}).strict()),filesStatus:z.enum(['complete','partial','unavailable'])}).strict()).max(30),
 repositoryPullRequestChecks:z.array(z.object({repositoryUrl:z.string().url(),queryUrl:z.string().url(),checkedAt:z.string().datetime({offset:true}),responsePath:z.string(),responseSha256:z.string().regex(/^[a-f0-9]{64}$/),returnedCount:z.number().int().nonnegative(),pullRequests:z.array(z.object({number:z.number().int().positive(),title:z.string(),state:z.enum(['open','closed']),mergedAt:z.string().datetime().nullable(),headSha:z.string().regex(/^[a-f0-9]{40}$/),updatedAt:z.string().datetime()}).strict()).max(100),conclusion:z.string()}).strict()).max(10).default([]),
 workspaces:z.object({originalSupplyGapOpportunityId:z.string(),originalSupplyGapCandidateId:z.string(),contactCandidateOpportunityId:z.string(),contactCandidateId:z.string().nullable()}).strict(),
 historicalPreservation:z.object({originalPoolPath:z.string(),originalPoolSha256:z.string().regex(/^[a-f0-9]{64}$/),originalReportPath:z.string(),originalReportSha256:z.string().regex(/^[a-f0-9]{64}$/),originalReportUnchanged:z.literal(true),oldQualificationReviewCountBefore:z.number().int().nonnegative(),oldQualificationReviewCountAfter:z.number().int().nonnegative(),originalFollowUpCountBefore:z.number().int().nonnegative(),originalFollowUpCountAfter:z.number().int().nonnegative(),oldEvidenceCountBefore:z.number().int().nonnegative(),oldEvidenceCountAfter:z.number().int().nonnegative()}).strict(),
}).strict();
export type PriorWorkR1Report=z.infer<typeof PriorWorkR1ReportSchema>;

export function deriveActionReadiness(input:{
 discussionComplete:boolean;needAssessment:PriorWorkCandidateInput['needAssessment'];contactProposal?:PriorWorkCandidateInput['contactProposal'];
 priorContactEvidence:PriorWorkCandidateInput['priorContactEvidence'];participantInterestEvidence:PriorWorkCandidateInput['participantInterestEvidence'];
 pilotAgreement:PriorWorkCandidateInput['pilotAgreement'];pilotAgreementEvidence:PriorWorkCandidateInput['pilotAgreementEvidence'];
}):ActionReadiness{
 if(!input.discussionComplete)return 'BLOCKED';
 if(input.needAssessment==='answered')return 'ALREADY_ADDRESSED';
 if(input.needAssessment==='rejected')return 'REJECTED';
 const evidencedDimensions=new Set(input.pilotAgreementEvidence.map(item=>item.dimension));
 const pilotConfirmed=Object.values(input.pilotAgreement).every(Boolean)&&(['participants','scope','prerequisites','experiment'] as const).every(dimension=>evidencedDimensions.has(dimension));
 if(pilotConfirmed)return 'PILOT_READY';
 if(input.participantInterestEvidence.length>0)return 'INTEREST_CONFIRMED';
 if(input.priorContactEvidence.length>0)return 'CONTACTED';
 if(input.needAssessment==='active_unresolved'&&input.contactProposal)return 'CONTACT_WORTHY';
 return 'NEEDS_CONFIRMATION';
}

function sameSourceUrl(left:string,right:string){return left.toLowerCase().replace(/\/$/,'')===right.toLowerCase().replace(/\/$/,'')}
export function candidateEvidenceCompleteness(input:PriorWorkCandidateInput,collection:PriorWorkCollection):'complete'|'partial'|'unavailable'{
 const thread=collection.issueThreads.find(item=>sameSourceUrl(item.requestedUrl,input.issueUrl)||sameSourceUrl(item.canonicalUrl,input.issueUrl));
 if(!thread)return 'unavailable';
 if(thread.commentsStatus==='unavailable')return 'unavailable';
 if(thread.commentsStatus==='partial')return 'partial';
 if(collection.issueReferences.some(reference=>sameSourceUrl(reference.sourceIssueUrl,input.issueUrl)&&!reference.collected))return 'partial';
 const referencedPulls=input.events.flatMap(event=>event.references.filter(reference=>reference.sourceKind==='pull_request').map(reference=>reference.sourceUrl));
 for(const url of referencedPulls){
  if(collection.failures.some(failure=>sameSourceUrl(failure.url,url)))return 'partial';
  const pull=collection.pullRequests.find(item=>sameSourceUrl(item.requestedUrl,url)||sameSourceUrl(item.canonicalUrl,url));
  if(!pull||pull.filesStatus!=='complete')return 'partial';
 }
 return 'complete';
}

export function reconcilePriorWorkCandidate(input:PriorWorkCandidateInput,collection:PriorWorkCollection):PriorWorkCandidateResult{
 const parsed=PriorWorkCandidateInputSchema.parse(input);
 const thread=collection.issueThreads.find(item=>item.requestedUrl===parsed.issueUrl||item.canonicalUrl===parsed.issueUrl);
 const evidenceCompleteness=candidateEvidenceCompleteness(parsed,collection);
 const discussionComplete=evidenceCompleteness==='complete';
 const scoped=parsed.events.filter(event=>event.relationship==='same_capability'&&event.capabilityKey===parsed.capabilityKey);
 const allRelevant=parsed.events.filter(event=>event.relationship!=='unrelated');
 const questionEvents=scoped.filter(event=>['answers','partially_answers','identifies_unresolved'].includes(event.effect));
 const questionState:PriorWorkCandidateResult['questionState']=!discussionComplete?'unknown':questionEvents.some(event=>event.effect==='answers')?'answered':questionEvents.some(event=>event.effect==='partially_answers')?'partially_answered':questionEvents.some(event=>event.effect==='identifies_unresolved')?'unanswered':'unanswered';
 const implementationEvidence={
  reported:scoped.some(event=>event.effect==='reports_implementation'),
  observed:scoped.some(event=>event.effect==='observes_implementation'),
  demonstrated:scoped.some(event=>event.eventType==='demonstration_completed'||event.effect==='demonstrates'),
  adopted:scoped.some(event=>event.eventType==='external_adoption'||event.effect==='adopts'),
 };
 const relatedEvents=allRelevant.filter(event=>event.relationship==='related_capability');
 const relatedIntegrationMilestones={
  proposed:relatedEvents.some(event=>event.eventType==='integration_proposed'||event.effect==='proposes'),
  inProgress:relatedEvents.some(event=>event.eventType==='integration_in_progress'||event.effect==='progresses'),
  demonstrated:relatedEvents.some(event=>event.eventType==='demonstration_completed'||event.effect==='demonstrates'),
  adopted:relatedEvents.some(event=>event.eventType==='external_adoption'||event.effect==='adopts'),
 };
 const relatedIntegrationDemonstration:PriorWorkCandidateResult['relatedIntegrationDemonstration']=relatedEvents.some(event=>(event.eventType==='demonstration_completed'||event.effect==='demonstrates')&&event.verification==='independent_execution')?'independently_executed':relatedEvents.some(event=>event.eventType==='demonstration_completed'||event.effect==='demonstrates')?'maintainer_reported':'none_found';
 const pullUrls=new Set(parsed.events.flatMap(event=>event.references.filter(reference=>reference.sourceKind==='pull_request').map(reference=>reference.sourceUrl)));
 const relatedPullRequests=collection.pullRequests.filter(pull=>[pull.requestedUrl,pull.canonicalUrl].some(url=>pullUrls.has(url))).map(pull=>({url:pull.canonicalUrl,title:pull.title,state:pull.state,merged:pull.merged,headSha:pull.headSha,baseSha:pull.baseSha,updatedAt:pull.updatedAt,filesStatus:pull.filesStatus}));
 const actionReadiness=deriveActionReadiness({discussionComplete,needAssessment:parsed.needAssessment,contactProposal:parsed.contactProposal,priorContactEvidence:parsed.priorContactEvidence,participantInterestEvidence:parsed.participantInterestEvidence,pilotAgreement:parsed.pilotAgreement,pilotAgreementEvidence:parsed.pilotAgreementEvidence});
 const pilotReadiness=actionReadiness==='PILOT_READY'?'PILOT_READY':'NOT_READY';
 const contactDraft=actionReadiness==='CONTACT_WORTHY'&&parsed.contactProposal?{...parsed.contactProposal,status:'NOT_SENT_AWAITING_USER_APPROVAL' as const,sent:false as const}:null;
 const rationale=actionReadiness==='CONTACT_WORTHY'?`${parsed.currentNeedRationale} A first question is justified; no participant agreement is implied.`:actionReadiness==='ALREADY_ADDRESSED'?`${parsed.currentNeedRationale} The scoped request received relevant subsequent work; any narrower remaining issue is listed separately.`:actionReadiness==='BLOCKED'?'The relevant source discussion was not completely retrieved, so prior-work reconciliation is incomplete.':parsed.currentNeedRationale;
 return PriorWorkCandidateResultSchema.parse({candidateId:parsed.candidateId,projectId:parsed.projectId,projectName:parsed.projectName,capabilityKey:parsed.capabilityKey,issueUrl:parsed.issueUrl,needExcerpt:parsed.needExcerpt,previousConclusion:parsed.previousConclusion,discussion:{completeness:evidenceCompleteness,commentCount:thread?.comments.length??0,latestCommentAt:thread?.comments.at(-1)?.createdAt??null,commentTimeline:thread?.comments.map(comment=>({id:comment.id,url:comment.url,author:comment.author,createdAt:comment.createdAt}))??[]},events:parsed.events,questionState,implementationEvidence,relatedIntegrationMilestones,relatedIntegrationDemonstration,relatedPullRequests,needState:parsed.needAssessment,actionReadiness,pilotReadiness,contactDraft,rationale,remainingUnknowns:parsed.remainingUnknowns,nextAction:parsed.nextAction});
}

export function verifyPriorWorkReferences(events:PriorWorkEvent[],collection:PriorWorkCollection,codeObservations:{sourceUrl:string;revision:string;excerpt:string}[],extraReferences:PriorWorkReference[]=[]):string[]{
 const errors:string[]=[];
 const references=[...events.flatMap(event=>event.references),...extraReferences];
 for(const reference of references){
  const eventLabel=events.find(event=>event.references.includes(reference))?.eventId??'additional reference';
  const thread=collection.issueThreads.find(item=>item.requestedUrl===reference.sourceUrl||item.canonicalUrl===reference.sourceUrl||item.comments.some(comment=>comment.url===reference.sourceUrl));
  if(reference.sourceKind==='issue_body'){
   if(!thread||!thread.body.includes(reference.quote))errors.push(`${eventLabel}: issue body quote not found at ${reference.sourceUrl}`);
  }else if(reference.sourceKind==='issue_comment'){
   const comment=thread?.comments.find(item=>item.id===reference.commentId&&item.url===reference.sourceUrl);
   if(!comment||!comment.body.includes(reference.quote))errors.push(`${eventLabel}: issue comment quote not found at ${reference.sourceUrl}`);
  }else if(reference.sourceKind==='pull_request'){
   const pull=collection.pullRequests.find(item=>item.requestedUrl===reference.sourceUrl||item.canonicalUrl===reference.sourceUrl);
   if(!pull||reference.revision&&pull.headSha!==reference.revision||!([pull?.body,...(pull?.files??[]).map(file=>file.patch??'')].some(text=>typeof text==='string'&&text.includes(reference.quote))))errors.push(`${eventLabel}: pull request evidence not found at ${reference.sourceUrl}`);
  }else{
   const observation=codeObservations.find(item=>item.sourceUrl===reference.sourceUrl&&item.revision===reference.revision&&item.excerpt.includes(reference.quote));
   if(!observation)errors.push(`${eventLabel}: code observation quote not found at ${reference.sourceUrl}`);
  }
 }
 return errors;
}
