import {createHash} from 'node:crypto';
import {lstat,mkdir,readFile,writeFile} from 'node:fs/promises';
import {isAbsolute,join,relative,resolve} from 'node:path';
import {eq} from 'drizzle-orm';
import {z} from 'zod';
import {db} from '../lib/db';
import {evidence,followUps,needItems,opportunities,opportunityPriorWorkReconciliations,opportunityQualificationReviews,projects} from '../lib/schema';
import {PriorWorkCollectionSchema} from '../lib/intelligence/prior-work';
import {candidateEvidenceCompleteness,PriorWorkCandidateInputSchema,PriorWorkR1ReportSchema,reconcilePriorWorkCandidate,verifyPriorWorkReferences} from '../lib/intelligence/prior-work-reconciliation';
import {QualificationReviewReportSchema} from '../lib/intelligence/qualification';

const root=process.cwd(),sha=(v:string|Buffer)=>createHash('sha256').update(v).digest('hex');
const paths={
 pool:'evidence/tc-01d/candidate-pool-257ae9da5f65b7bd.json',
 originalReport:'evidence/tc-01d/qualification-review-3b32928287de878a.json',
 collection:process.argv[2]??'evidence/tc-01d-r1/source-collection-20261117T171343Z.json',
 sourceObservations:'evidence/tc-01d-r1/source-observations.json',
 annotations:'evidence/tc-01d-r1/review-annotations.json',
 controlSelection:'evidence/tc-01d-r1/control-selection.json',
 pullChecks:'evidence/tc-01d-r1/repository-pull-checks.json',
 pullCheckResponse:'evidence/tc-01d-r1/cells-contracts-pulls-response-20261117.json',
};
const AnnotationSchema=z.object({
 capabilityKey:z.string(),needAssessment:z.enum(['active_unresolved','partially_addressed','answered','stale_or_unconfirmed','unknown','rejected']),currentNeedRationale:z.string(),events:z.array(z.any()),remainingUnknowns:z.array(z.string()),nextAction:z.string(),contactProposal:PriorWorkCandidateInputSchema.shape.contactProposal.optional(),priorContactEvidence:z.array(z.any()).optional(),participantInterestEvidence:z.array(z.any()).optional(),pilotAgreement:PriorWorkCandidateInputSchema.shape.pilotAgreement,pilotAgreementEvidence:z.array(z.any()).optional(),
}).strict();
const ControlAnnotationSchema=AnnotationSchema.extend({candidateId:z.string(),projectId:z.string(),projectName:z.string(),issueUrl:z.string().url(),needExcerpt:z.string(),previousConclusion:z.object({outcome:z.string(),rationale:z.string()}).strict()}).strict();
const AnnotationFileSchema=z.object({schemaVersion:z.literal(1),reviewerMethod:z.string().min(20),candidates:z.record(z.string(),AnnotationSchema),control:ControlAnnotationSchema}).strict();
const SourceObservationFileSchema=z.object({schemaVersion:z.literal(1),checkedAt:z.string().datetime({offset:true}),observations:z.array(z.object({repositoryRequestedUrl:z.string().url(),repositoryCanonicalUrl:z.string().url(),repositoryId:z.number().int().positive(),repositoryNodeId:z.string(),defaultBranch:z.string(),revision:z.string().regex(/^[a-f0-9]{40}$/),revisionCommittedAt:z.string().datetime({offset:true}),sourceUrl:z.string().url(),path:z.string(),sha256:z.string().regex(/^[a-f0-9]{64}$/),retrieval:z.string(),interpretation:z.string(),excerpts:z.array(z.object({lineStart:z.number().int().positive(),lineEnd:z.number().int().positive(),text:z.string().min(8)}).strict())}).strict())}).strict();
const PullCheckFileSchema=z.object({schemaVersion:z.literal(1),checkedAt:z.string().datetime({offset:true}),method:z.string(),repository:z.object({sourceUrl:z.string().url(),canonicalUrl:z.string().url(),repositoryId:z.number().int().positive()}).strict(),queryUrl:z.string().url(),responsePath:z.string(),responseSha256:z.string().regex(/^[a-f0-9]{64}$/),returnedCount:z.number().int().nonnegative(),pullRequests:z.array(z.object({number:z.number().int().positive(),title:z.string(),state:z.enum(['open','closed']),mergedAt:z.string().datetime().nullable(),headSha:z.string().regex(/^[a-f0-9]{40}$/),updatedAt:z.string().datetime()}).strict()).max(100),conclusion:z.string()}).strict();
type FileData={path:string;bytes:Buffer;sha256:string};
async function readEvidence(path:string):Promise<FileData>{
 const absolute=resolve(root,path),rel=relative(root,absolute);if(rel.startsWith('..')||isAbsolute(rel)||!rel.startsWith('evidence/'))throw new Error(`Input must be an evidence file: ${path}`);
 const stat=await lstat(absolute);if(!stat.isFile()||stat.isSymbolicLink()||stat.size>12_000_000)throw new Error(`Evidence input is not a bounded regular file: ${path}`);
 const bytes=await readFile(absolute);return{path:rel,bytes,sha256:sha(bytes)};
}
async function saveImmutable(path:string,bytes:Buffer){
 const absolute=resolve(root,path);await mkdir(join(absolute,'..'),{recursive:true});
 try{await writeFile(absolute,bytes,{flag:'wx',mode:0o644})}catch(error){if((error as NodeJS.ErrnoException).code!=='EEXIST')throw error;const previous=await readFile(absolute);if(!previous.equals(bytes))throw new Error(`Refusing to overwrite different evidence at ${path}`)}
 const sidecar=`${sha(bytes)}  ${path.split('/').at(-1)}\n`;
 try{await writeFile(`${absolute}.sha256`,sidecar,{flag:'wx',mode:0o644})}catch(error){if((error as NodeJS.ErrnoException).code!=='EEXIST')throw error;const previous=(await readFile(`${absolute}.sha256`,'utf8')).trim();if(previous!==sidecar.trim())throw new Error(`Existing SHA-256 sidecar disagrees for ${path}`)}
}
function allReferences(input:ReturnType<typeof PriorWorkCandidateInputSchema.parse>){return[...(input.contactProposal?.needEvidence??[]),...input.priorContactEvidence,...input.participantInterestEvidence,...input.pilotAgreementEvidence.map(item=>item.reference)]}
function opportunityIdForNeed(needItemId:string){return`need-${sha(needItemId).slice(0,32)}`}

async function main(){
 const files=Object.fromEntries(await Promise.all(Object.entries(paths).map(async([key,path])=>[key,await readEvidence(path)]))) as Record<keyof typeof paths,FileData>;
 const pool=JSON.parse(files.pool.bytes.toString('utf8'));
 const oldReview=QualificationReviewReportSchema.parse(JSON.parse(files.originalReport.bytes.toString('utf8')));
 const collection=PriorWorkCollectionSchema.parse(JSON.parse(files.collection.bytes.toString('utf8')));
 const sourceFile=SourceObservationFileSchema.parse(JSON.parse(files.sourceObservations.bytes.toString('utf8')));
 const annotation=AnnotationFileSchema.parse(JSON.parse(files.annotations.bytes.toString('utf8')));
 const controlSelection=JSON.parse(files.controlSelection.bytes.toString('utf8'));
 const pullCheck=PullCheckFileSchema.parse(JSON.parse(files.pullChecks.bytes.toString('utf8')));
 const pullResponse=JSON.parse(files.pullCheckResponse.bytes.toString('utf8'));
 if(pool.schemaVersion!==1||pool.candidates?.length!==10||pool.inputSnapshot?.sha256!==oldReview.evaluation.sourceSnapshotSha256)throw new Error('The corrected review requires the exact original ten-candidate pool and source snapshot.');
 if(files.pool.sha256!==oldReview.evaluation.candidatePoolSha256)throw new Error('The frozen candidate-pool hash differs from the original qualification report.');
 if(oldReview.outcome!=='NO_QUALIFIED_PILOT'||oldReview.selectedCandidateId===null||oldReview.externalOutcome!=='NO_EXTERNAL_PARTICIPATION_VERIFIED')throw new Error('The historical report is not the expected original no-pilot result.');
 if(sha(files.pullCheckResponse.bytes)!==pullCheck.responseSha256||pullResponse.length!==pullCheck.returnedCount||pullCheck.pullRequests.length!==pullCheck.returnedCount)throw new Error('The bounded repository pull-request check does not match its retained raw response.');
 if(!collection.referencedRepositories.some(item=>item.sourceUrl===pullCheck.repository.sourceUrl&&item.identity.repositoryId===pullCheck.repository.repositoryId))throw new Error('The bounded pull-request check repository identity does not match collected GitHub metadata.');
 const excludedIssues=new Set(pool.candidates.map((candidate:any)=>String(candidate.need?.sourceUrl??'').toLowerCase().replace(/\/$/,'')));
 if(controlSelection.inputSnapshotSha256!==pool.inputSnapshot.sha256||controlSelection.candidatePoolSha256!==files.pool.sha256||controlSelection.selected?.url!==controlSelection.rankedIssueUrls?.[0]?.url||excludedIssues.has(String(controlSelection.selected?.url??'').toLowerCase().replace(/\/$/,'')))throw new Error('The preselected control does not match the frozen pool or deterministic rank artifact.');
 const codeObservations=sourceFile.observations.flatMap(observation=>observation.excerpts.map(excerpt=>({sourceUrl:observation.sourceUrl,revision:observation.revision,excerpt:excerpt.text})));
 const candidateRows:ReturnType<typeof reconcilePriorWorkCandidate>[]=[];
 const referenceErrors:string[]=[];
 const oldById=new Map(oldReview.candidateReviews.map(candidate=>[candidate.candidateId,candidate]));
 for(const row of oldReview.candidateReviews){
  const note=annotation.candidates[row.candidateId];if(!note)throw new Error(`Missing R1 assessment for frozen candidate ${row.candidateId}`);
  const candidateInput=PriorWorkCandidateInputSchema.parse({candidateId:row.candidateId,projectId:row.projectId,projectName:row.projectName,capabilityKey:note.capabilityKey,issueUrl:row.need.sourceUrl,needExcerpt:row.need.excerpt,previousConclusion:{outcome:row.assessment.outcome,rationale:row.assessment.rationale},needAssessment:note.needAssessment,currentNeedRationale:note.currentNeedRationale,events:note.events,remainingUnknowns:note.remainingUnknowns,nextAction:note.nextAction,contactProposal:note.contactProposal,priorContactEvidence:note.priorContactEvidence??[],participantInterestEvidence:note.participantInterestEvidence??[],pilotAgreement:note.pilotAgreement,pilotAgreementEvidence:note.pilotAgreementEvidence??[]});
  if(candidateEvidenceCompleteness(candidateInput,collection)==='complete')referenceErrors.push(...verifyPriorWorkReferences(candidateInput.events,collection,codeObservations,allReferences(candidateInput)).map(error=>`${row.candidateId}: ${error}`));
  const thread=collection.issueThreads.find(item=>item.requestedUrl===candidateInput.issueUrl||item.canonicalUrl===candidateInput.issueUrl);
  if(candidateInput.contactProposal&&thread&&thread.author.toLowerCase()!==candidateInput.contactProposal.targetLogin.toLowerCase())throw new Error(`Contact target is not the current issue author for ${candidateInput.candidateId}`);
  candidateRows.push(reconcilePriorWorkCandidate(candidateInput,collection));
 }
 const controlInput=PriorWorkCandidateInputSchema.parse({...annotation.control,previousConclusion:annotation.control.previousConclusion,priorContactEvidence:[],participantInterestEvidence:[],pilotAgreementEvidence:[]});
 if(candidateEvidenceCompleteness(controlInput,collection)==='complete')referenceErrors.push(...verifyPriorWorkReferences(controlInput.events,collection,codeObservations).map(error=>`control: ${error}`));
 if(referenceErrors.length)throw new Error(referenceErrors.join('\n'));
 const controlResult=reconcilePriorWorkCandidate(controlInput,collection);
 if(Object.keys(annotation.candidates).some(id=>!oldById.has(id)))throw new Error('R1 annotations contain a candidate outside the frozen cohort.');
 const contactWorthy=candidateRows.filter(candidate=>candidate.actionReadiness==='CONTACT_WORTHY').sort((a,b)=>{
  const aRecent=Date.parse(a.discussion.latestCommentAt??'1970-01-01'),bRecent=Date.parse(b.discussion.latestCommentAt??'1970-01-01');
  return bRecent-aRecent||a.candidateId.localeCompare(b.candidateId);
 });
 const selected=contactWorthy[0]??null;
 if(contactWorthy.length>1)throw new Error("More than one candidate passed the current review's one-contact selection rule; document a comparison before preparing a draft.");
 if(selected&&!selected.contactDraft)throw new Error('A contact-worthy result must have a user-reviewable unsent draft.');
 const contactDraft=selected?.contactDraft??null;
 const poolSelection=oldReview.candidateReviews.find(candidate=>candidate.candidateId===oldReview.selectedCandidateId);if(!poolSelection)throw new Error('The historical selected supply gap is not in the original pool.');
 const originalOpportunityId=opportunityIdForNeed(poolSelection.need.needItemId);
 const contactSource=selected?oldReview.candidateReviews.find(candidate=>candidate.candidateId===selected.candidateId):null;
 if(selected&&!contactSource)throw new Error('Selected contact candidate was not generated from the frozen pool.');
 const contactOpportunityId=selected&&contactSource?opportunityIdForNeed(contactSource.need.needItemId):originalOpportunityId;
 const inputSnapshotSha256=sha(JSON.stringify({reportSchemaVersion:2,workspaceCandidateBindings:1,pool:files.pool.sha256,originalReport:files.originalReport.sha256,collection:files.collection.sha256,sourceObservations:files.sourceObservations.sha256,annotations:files.annotations.sha256,controlSelection:files.controlSelection.sha256,pullChecks:files.pullChecks.sha256,pullCheckResponse:files.pullCheckResponse.sha256}));
 const identityRows=[...collection.issueThreads.map(thread=>({sourceUrl:thread.repository.requestedUrl,identity:thread.repository})),...collection.referencedRepositories,...collection.pullRequests.map(pull=>({sourceUrl:pull.repository.requestedUrl,identity:pull.repository}))];
 const identities=new Map<string,{requestedUrl:string;canonicalUrl:string;repositoryId:number;nodeId:string;resolution:string;resolvedAt:string}>();
 for(const row of identityRows)identities.set(`${row.sourceUrl.toLowerCase()}\0${row.identity.repositoryId}`,{requestedUrl:row.sourceUrl,canonicalUrl:row.identity.canonicalUrl,repositoryId:row.identity.repositoryId,nodeId:row.identity.nodeId,resolution:row.identity.resolution,resolvedAt:row.identity.resolvedAt});
 const linkedPRs=collection.pullRequests.map(pull=>({url:pull.canonicalUrl,title:pull.title,state:pull.state,merged:pull.merged,headSha:pull.headSha,baseSha:pull.baseSha,updatedAt:pull.updatedAt,referencedFrom:pull.referencedFrom,filesStatus:pull.filesStatus}));
 const before=[await db.select().from(opportunities).where(eq(opportunities.id,originalOpportunityId)),await db.select().from(opportunityQualificationReviews).where(eq(opportunityQualificationReviews.opportunityId,originalOpportunityId)),await db.select().from(evidence).where(eq(evidence.opportunityId,originalOpportunityId)),await db.select().from(followUps).where(eq(followUps.opportunityId,originalOpportunityId))] as const;
 const originalOpportunity=before[0][0];if(!originalOpportunity||originalOpportunity.status!=='no-qualified-pilot')throw new Error('Original supply-gap workspace is missing or its historical status changed; preserving it is required.');
 const report=PriorWorkR1ReportSchema.parse({
  schemaVersion:2,
  evaluation:{checkedAt:[collection.checkedAt,pullCheck.checkedAt].sort().at(-1),inputSnapshotSha256,baselineCommit:'664aaf70a1a9c9a614be8739b6daac7c016846b2',candidatePoolSha256:files.pool.sha256,originalQualificationSha256:files.originalReport.sha256,sourceCollectionSha256:files.collection.sha256,sourceObservationsSha256:files.sourceObservations.sha256,annotationsSha256:files.annotations.sha256,controlSelectionSha256:files.controlSelection.sha256,selectionMethod:'The original ten-candidate pool is reused unchanged. The independent issue control was selected before its discussion was read by deterministic SHA-256 ranking across eligible imported issue URLs after excluding those ten.',reconciliationMethod:'For every fixed need, complete bounded issue comments are chronologically collected. Reviewer-labeled events are tied to an exact capability key and source quote, then a generic reducer keeps question, reported/observed implementation, demonstration, related integration progress, and contact/pilot readiness separate. Each saved workspace is bound to its own candidate id and candidate-level readiness. Exact citations are verified against collected bytes before the report is saved.'},
  actionReadiness:selected?'CONTACT_WORTHY':'NO_CONTACT_WORTHY_OPPORTUNITY',selectedCandidateId:selected?.candidateId??null,candidates:candidateRows,control:controlResult,contactDraft,contactSent:false,externalOutcome:'NO_EXTERNAL_PARTICIPATION_VERIFIED',sourceFailures:collection.failures,
  repositoryResolutions:[...identities.values()],relatedPullRequests:linkedPRs,repositoryPullRequestChecks:[{repositoryUrl:pullCheck.repository.canonicalUrl,queryUrl:pullCheck.queryUrl,checkedAt:pullCheck.checkedAt,responsePath:pullCheck.responsePath,responseSha256:pullCheck.responseSha256,returnedCount:pullCheck.returnedCount,pullRequests:pullCheck.pullRequests,conclusion:pullCheck.conclusion}],workspaces:{originalSupplyGapOpportunityId:originalOpportunityId,originalSupplyGapCandidateId:poolSelection.candidateId,contactCandidateOpportunityId:contactOpportunityId,contactCandidateId:selected?.candidateId??null},
  historicalPreservation:{originalPoolPath:files.pool.path,originalPoolSha256:files.pool.sha256,originalReportPath:files.originalReport.path,originalReportSha256:files.originalReport.sha256,originalReportUnchanged:true,oldQualificationReviewCountBefore:before[1].length,oldQualificationReviewCountAfter:before[1].length,originalFollowUpCountBefore:before[3].length,originalFollowUpCountAfter:before[3].length,oldEvidenceCountBefore:before[2].length,oldEvidenceCountAfter:before[2].length},
 });
 const outputPath=`evidence/tc-01d-r1/corrected-review-${inputSnapshotSha256.slice(0,16)}.json`,reportBytes=Buffer.from(JSON.stringify(report,null,2)+'\n');
 await saveImmutable(outputPath,reportBytes);
 const reportText=reportBytes.toString('utf8');
 await db.transaction(async tx=>{
  if(selected&&contactSource){
   const candidateNeed=contactSource.need;
   const [existingOpportunity]=await tx.select().from(opportunities).where(eq(opportunities.id,contactOpportunityId)).limit(1);
   if(existingOpportunity){if(existingOpportunity.projectA!==selected.projectId||existingOpportunity.projectB!==null)throw new Error('Deterministic contact workspace ID already belongs to another relationship.');}
   else {
    const [project]=await tx.select().from(projects).where(eq(projects.id,selected.projectId)).limit(1);
    const [need]=await tx.select().from(needItems).where(eq(needItems.id,candidateNeed.needItemId)).limit(1);
    if(!project||!need||need.projectId!==selected.projectId)throw new Error('Selected contact workspace requires the existing imported project and atomic need.');
    await tx.insert(opportunities).values({id:contactOpportunityId,projectA:selected.projectId,projectB:null,kind:'user-testing',problem:candidateNeed.excerpt,reasoning:`${selected.rationale}\n\nPrior-work is capability-scoped. The saved report records exact issue comments, limits, and the human-controlled contact stage.`,requirements:selected.remainingUnknowns.join('\n'),experiment:'Only after the builder confirms the need: agree a short script for the four named UX tasks, recruit no one without approval, and record observations without exposing keys or funds.',status:'contact-worthy'});
   }
   const linkedEvidence=await tx.select().from(evidence).where(eq(evidence.opportunityId,contactOpportunityId));
   if(!linkedEvidence.some(item=>item.needItemId===candidateNeed.needItemId&&item.sourceUrl===candidateNeed.sourceUrl&&item.revision===candidateNeed.revision))await tx.insert(evidence).values({opportunityId:contactOpportunityId,needItemId:candidateNeed.needItemId,claim:candidateNeed.excerpt,sourceUrl:candidateNeed.sourceUrl,revision:candidateNeed.revision,observedAt:new Date(collection.checkedAt),verification:'Imported atomic builder request; source quote cross-checked against complete public issue thread. This is not evidence that a user test occurred.'});
  }
  const workspaceBindings=new Map([[originalOpportunityId,poolSelection.candidateId],[contactOpportunityId,selected?.candidateId??poolSelection.candidateId]]);
  for(const [opportunityId,candidateId] of workspaceBindings){
   const [savedOpportunity]=await tx.select().from(opportunities).where(eq(opportunities.id,opportunityId)).limit(1);if(!savedOpportunity)throw new Error(`Workspace ${opportunityId} does not exist.`);
   const candidate=report.candidates.find(item=>item.candidateId===candidateId);if(!candidate)throw new Error(`Workspace ${opportunityId} candidate binding is missing.`);
   const rowId=`r1-${sha(`${opportunityId}\0${inputSnapshotSha256}`).slice(0,32)}`;
   await tx.insert(opportunityPriorWorkReconciliations).values({id:rowId,opportunityId,inputSnapshotSha256,actionReadiness:candidate.actionReadiness,report:reportText,createdAt:new Date()}).onConflictDoNothing();
  }
 });
 const after=[await db.select().from(opportunityQualificationReviews).where(eq(opportunityQualificationReviews.opportunityId,originalOpportunityId)),await db.select().from(evidence).where(eq(evidence.opportunityId,originalOpportunityId)),await db.select().from(followUps).where(eq(followUps.opportunityId,originalOpportunityId)),await db.select().from(opportunityPriorWorkReconciliations).where(eq(opportunityPriorWorkReconciliations.opportunityId,originalOpportunityId))] as const;
 if(after[0].length!==before[1].length||after[1].length!==before[2].length||after[2].length!==before[3].length)throw new Error('Historical qualification, source-evidence, or follow-up records changed while saving R1.');
 const attached=after[3].find(row=>row.inputSnapshotSha256===inputSnapshotSha256);if(!attached||attached.report!==reportText)throw new Error('Corrected report was not saved exactly in the existing workspace ledger.');
 const contactRows=await db.select().from(opportunityPriorWorkReconciliations).where(eq(opportunityPriorWorkReconciliations.opportunityId,contactOpportunityId));
 const originalLatest=after[3].slice().sort((a,b)=>b.createdAt.getTime()-a.createdAt.getTime())[0];
 const contactLatest=contactRows.slice().sort((a,b)=>b.createdAt.getTime()-a.createdAt.getTime())[0];
 if(originalLatest?.actionReadiness!==report.candidates.find(item=>item.candidateId===poolSelection.candidateId)?.actionReadiness||contactLatest?.actionReadiness!==report.candidates.find(item=>item.candidateId===report.selectedCandidateId)?.actionReadiness)throw new Error('Workspace action readiness does not match its bound candidate.');
 console.log(JSON.stringify({reportPath:outputPath,reportSha256:sha(reportBytes),inputSnapshotSha256,originalOpportunityId,contactOpportunityId,actionReadiness:report.actionReadiness,selectedCandidateId:report.selectedCandidateId,candidates:report.candidates.map(candidate=>({project:candidate.projectName,previous:candidate.previousConclusion.outcome,need:candidate.needState,priorAnswer:candidate.questionState,contact:candidate.actionReadiness,pilot:candidate.pilotReadiness})),control:{project:report.control.projectName,need:report.control.needState,contact:report.control.actionReadiness,pilot:report.control.pilotReadiness},contactSent:report.contactSent,externalOutcome:report.externalOutcome,history:{qualificationReviews:after[0].length,evidence:after[1].length,followUps:after[2].length,correctedReports:after[3].length}},null,2));
 process.exit(0);
}
main().catch(error=>{console.error(error instanceof Error?error.stack??error.message:String(error));process.exit(1)});
