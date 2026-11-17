import {createHash} from 'node:crypto';
import {lstat,mkdir,readFile,writeFile} from 'node:fs/promises';
import {join,relative,resolve,isAbsolute} from 'node:path';
import {desc,eq} from 'drizzle-orm';
import {z} from 'zod';
import {db} from '../lib/db';
import {evidence,needItems,opportunities,opportunityQualificationReviews,projects} from '../lib/schema';
import {aggregateQualificationOutcome,enforceQualificationGates,QualificationAssessmentSchema,QualificationReviewReportSchema,type QualificationEvidence as AssessmentEvidence} from '../lib/intelligence/qualification';

const root=process.cwd(),sha=(value:string|Buffer)=>createHash('sha256').update(value).digest('hex');
const DEFAULTS={
 pool:'evidence/tc-01d/candidate-pool-257ae9da5f65b7bd.json',
 checks:'evidence/tc-01d/current-checks-257ae9da5f65b7bd-20261117T125000256Z.json',
 issueState:'evidence/tc-01d/github-issue-state-2026-11-17.json',
 comments:'evidence/tc-01d/ckautomata-review-comments-2026-11-17.json',
 decisions:'evidence/tc-01d/qualification-decisions.json',
};
const DocumentSchema=z.object({}).passthrough();

function normalized(value:string){return value.replace(/\s+/g,' ').trim().toLocaleLowerCase('en-US')}
async function boundedEvidenceFile(path:string){
 const file=resolve(root,path),rel=relative(root,file);if(rel.startsWith('..')||isAbsolute(rel)||!rel.startsWith('evidence/tc-01d/'))throw new Error(`Input must be inside evidence/tc-01d: ${path}`);
 const stat=await lstat(file);if(!stat.isFile()||stat.isSymbolicLink()||stat.size>8_000_000)throw new Error(`Input is not a bounded regular file: ${path}`);
 const bytes=await readFile(file);return{path:rel,bytes,sha256:sha(bytes),value:DocumentSchema.parse(JSON.parse(bytes.toString('utf8'))) as Record<string,any>};
}
function storedEvidence(input:{sourceUrl:string;revision?:string;excerpt:string;evidenceType:AssessmentEvidence['evidenceType'];checkedAt?:string;verification:string}):AssessmentEvidence{
 return{sourceUrl:input.sourceUrl,...(input.revision?{revision:input.revision}:{}),excerpt:input.excerpt.replace(/\s+/g,' ').trim().slice(0,1950)||'Source metadata was checked.',evidenceType:input.evidenceType,...(input.checkedAt?{checkedAt:input.checkedAt}:{}),verification:input.verification.slice(0,490)};
}
function adaptVerifierEvidence(item:any):AssessmentEvidence|undefined{
 const kinds:Record<string,AssessmentEvidence['evidenceType']>={human_offer:'provider_offer',code_observed:'provider_capability',maintainer_report:'prior_work',status_update:'current_state'};
 const evidenceType=kinds[item.evidenceType];if(!evidenceType||!item.sourceUrl||!item.excerpt)return;
 return storedEvidence({sourceUrl:item.sourceUrl,revision:item.revision,excerpt:item.excerpt,evidenceType,checkedAt:item.checkedAt,verification:`${item.conclusion??'Relevant public source material.'} ${item.verification??''}`});
}

async function main(){
 const args=process.argv.slice(2);const paths=Object.fromEntries(Object.keys(DEFAULTS).map((key,index)=>[key,args[index]??DEFAULTS[key as keyof typeof DEFAULTS]])) as typeof DEFAULTS;
 const [poolFile,checksFile,stateFile,commentsFile,decisionsFile]=await Promise.all([
  boundedEvidenceFile(paths.pool),boundedEvidenceFile(paths.checks),boundedEvidenceFile(paths.issueState),boundedEvidenceFile(paths.comments),boundedEvidenceFile(paths.decisions),
 ]);
 const pool=poolFile.value,checks=checksFile.value,state=stateFile.value,comments=commentsFile.value,decisions=decisionsFile.value;
 if(pool.schemaVersion!==1||checks.schemaVersion!==1||state.method!=='Authenticated GitHub CLI REST GET issue metadata; read-only; exact source issues in the generated pool plus Cellora offer #12'||decisions.schemaVersion!==1)throw new Error('Unexpected TC-01D evidence artifact schema or source method.');
 if(checks.sourcePoolSha256!==poolFile.sha256||checks.sourceSnapshotSha256!==pool.inputSnapshot.sha256)throw new Error('Current checks do not correspond to this exact candidate pool and source snapshot.');
 if(!Array.isArray(pool.candidates)||pool.candidates.length>10||pool.candidates.length<1)throw new Error('Candidate pool must contain one to ten generated candidates.');
 const checkById=new Map<string,any>((checks.checks??[]).map((x:any)=>[x.candidateId,x]));
 const stateByIssue=new Map<number,any>((state.issues??[]).map((x:any)=>[x.number,x]));
 const bodyChecksById=new Map<string,any>((state.bodyChecks??[]).filter((x:any)=>x.candidateId).map((x:any)=>[x.candidateId,x]));
 const annotationById=new Map<string,any>((decisions.candidates??[]).map((x:any)=>[x.candidateId,x.assessment]));
 if(pool.candidates.length!==annotationById.size||pool.candidates.some((x:any)=>!annotationById.has(x.id)))throw new Error('Each generated candidate must have exactly one independent qualification annotation.');
 const commentRows=comments.preservedComments??[];
 if(!Array.isArray(commentRows))throw new Error('Public comment evidence is invalid.');
 const commentCheckTime=comments.checkedAt as string;
 const candidateReviews=[];
 for(const candidate of pool.candidates){
  const priorCheck=checkById.get(candidate.id);const annotation=annotationById.get(candidate.id);const need=candidate.need;
  if(!priorCheck||!annotation)throw new Error(`Missing current check or assessment for ${candidate.id}`);
  const issueNumber=Number(need.sourceUrl.split('/').at(-1));const issueStatus=stateByIssue.get(issueNumber);const bodyCheck=bodyChecksById.get(candidate.id);
  if(!issueStatus||!bodyCheck||bodyCheck.exactNeedStillInBody!==true)throw new Error(`Current exact source need was not revalidated for ${candidate.id}`);
  if(issueStatus.html_url!==need.sourceUrl||bodyCheck.sourceUrl!==need.sourceUrl)throw new Error(`Source identity changed for ${candidate.id}`);
  if(issueStatus.state!=='open'&&issueStatus.state!=='closed')throw new Error(`Unexpected source issue state for ${candidate.id}`);
  const check=priorCheck.check;
  const evidenceItems:AssessmentEvidence[]=[storedEvidence({sourceUrl:need.sourceUrl,revision:need.revision,excerpt:need.excerpt,evidenceType:'builder_need',checkedAt:bodyCheck.checkedAt,verification:`Exact atomic excerpt remains in the fetched public issue body (body SHA-256 ${bodyCheck.bodySha256}); imported interpretation is automated and does not establish current builder intent.`}),storedEvidence({sourceUrl:need.sourceUrl,revision:issueStatus.updated_at,excerpt:`Authenticated current GitHub issue metadata: state ${issueStatus.state.toUpperCase()}, updated ${issueStatus.updated_at}${issueStatus.closed_at?`, closed ${issueStatus.closed_at}`:''}. This state does not alone prove that the request is resolved or remains wanted.`,evidenceType:'current_state',checkedAt:bodyCheck.checkedAt,verification:`Read-only GitHub CLI API response; body hash ${bodyCheck.bodySha256}. Exact need excerpt match: ${bodyCheck.exactNeedStillInBody}.`})];
  for(const item of (check.evidence??[]).map(adaptVerifierEvidence).filter(Boolean).slice(0,6))evidenceItems.push(item as AssessmentEvidence);
  if(candidate.provider)evidenceItems.push(storedEvidence({sourceUrl:candidate.provider.sourceUrl,revision:candidate.provider.revision,excerpt:candidate.provider.claim,evidenceType:candidate.provider.direction==='offer'?'provider_offer':'provider_capability',checkedAt:check.checkedAt,verification:`Provider record from the frozen imported pool. The current-state result is ${check.result}/${check.freshness}; this does not independently establish current availability or compatibility.`}));
  for(const alt of candidate.rejectedAlternatives??[]){
   if(evidenceItems.some(x=>x.sourceUrl===alt.sourceUrl&&x.evidenceType==='provider_offer'))continue;
   evidenceItems.push(storedEvidence({sourceUrl:alt.sourceUrl,revision:alt.revision,excerpt:alt.providerClaim,evidenceType:'provider_offer',checkedAt:check.checkedAt,verification:`Imported human offer; engine disposition ${alt.reason}. It is not a confirmed technical capability or current availability.`}));
  }
  if(comments.issueUrl===need.sourceUrl){
   for(const row of commentRows){
    const owner=state.issues.find((x:any)=>x.html_url===need.sourceUrl)?.authorLogin;
    const relationship=owner&&row.author===owner?'comment by the issue author':'comment from an account distinct from the issue author';
    evidenceItems.push(storedEvidence({sourceUrl:row.url,revision:row.createdAt,excerpt:String(row.body),evidenceType:'prior_work',checkedAt:commentCheckTime,verification:`Public ${relationship} (@${row.author}). Public account separation is observable; qualifications/independence are not independently established. Any maintainer implementation or deployment statement is attributed, not reproduced.`}));
   }
  }
  const base=QualificationAssessmentSchema.parse({candidateId:candidate.id,...annotation,sourceFreshness:check.freshness,evidence:evidenceItems});
  const enforced=enforceQualificationGates(base);
  const project=poolFile.value.candidates.find((x:any)=>x.id===candidate.id);
  const candidateProjectRows=await db.select({id:projects.id,name:projects.name}).from(projects).where(eq(projects.id,need.projectId)).limit(1);
  if(!candidateProjectRows.length)throw new Error(`Missing imported project ${need.projectId}`);
  candidateReviews.push({candidateId:candidate.id,projectName:candidateProjectRows[0].name,projectId:need.projectId,source:candidate.source,engineDisposition:priorCheck.engineDisposition,selectionReason:candidate.selectionReason,scope:candidate.scope,intentType:candidate.intentType,need,provider:candidate.provider??null,rejectedAlternatives:candidate.rejectedAlternatives??[],currentState:{checkedAt:check.checkedAt,result:check.result,freshness:check.freshness,lifecycleState:check.lifecycleState,compatibilityState:check.compatibilityState,summary:check.summary,uncertainty:check.uncertainty,nextAction:check.nextAction,limitations:check.limitations,sources:check.sources.map((s:any)=>({url:s.url,kind:s.kind,fetchStatus:s.fetchStatus,...(s.httpStatus?{httpStatus:s.httpStatus}:{}),...(s.revision?{revision:s.revision}:{}),...(s.publishedAt?{publishedAt:s.publishedAt}:{}),...(s.error?{error:s.error}:{}),contentSha256:s.contentSha256,excerpt:s.excerpt})),evidence:evidenceItems},assessment:{...enforced},sourceState:{state:issueStatus.state,updatedAt:issueStatus.updated_at,closedAt:issueStatus.closed_at,checkedAt:bodyCheck.checkedAt,sourceUrl:need.sourceUrl,exactNeedStillInBody:bodyCheck.exactNeedStillInBody}});
  void project;
 }
 const overall=aggregateQualificationOutcome(candidateReviews.map((x:any)=>({outcome:x.assessment.outcome})));
 if(overall!=='NO_QUALIFIED_PILOT')throw new Error('A qualified candidate requires an approval-ready Builder Opportunity Brief; do not create a supply-gap result.');
 const selectedCandidateId=decisions.selectedSupplyGapCandidateId as string;const selected=candidateReviews.find((x:any)=>x.candidateId===selectedCandidateId);
 if(!selected)throw new Error('The selected supply-gap need must originate from the generated candidate pool.');
 const supplyGap=decisions.supplyGap;
 if(supplyGap?.result!=='NO_QUALIFIED_PILOT'||supplyGap.externalActionSent!==false)throw new Error('Supply-gap output must be explicit and unsent.');
 const currentChecksTimes=(checks.checks??[]).map((x:any)=>x.check.checkedAt).filter(Boolean);
 const reviewInputSha256=sha(JSON.stringify({evaluatorVersion:'tc01d-qualification-v1',candidatePoolSha256:poolFile.sha256,currentChecksSha256:checksFile.sha256,issueStateSha256:stateFile.sha256,commentEvidenceSha256:commentsFile.sha256,reviewAnnotationsSha256:decisionsFile.sha256}));
 const checkedAt=[...(state.bodyChecks??[]).map((x:any)=>x.checkedAt),state.checkedAt,...currentChecksTimes].filter(Boolean).sort().at(-1)??state.checkedAt;
 const evaluation={reviewInputSha256,sourceSnapshotSha256:pool.inputSnapshot.sha256,candidatePoolSha256:poolFile.sha256,currentChecksSha256:checksFile.sha256,issueStateSha256:stateFile.sha256,reviewAnnotationsSha256:decisionsFile.sha256,baselineCommit:pool.baselineCommit,checkedAt,selectionMethod:pool.selectionAlgorithm,reviewMethod:decisions.reviewMethod};
 const supplyGapEvidence=selected.assessment.evidence.filter((x:AssessmentEvidence)=>x.evidenceType==='builder_need'||x.evidenceType==='provider_offer'||x.evidenceType==='current_state');
 const report=QualificationReviewReportSchema.parse({schemaVersion:1,evaluation,outcome:overall,actionStatus:'NO_QUALIFIED_PILOT',selectedCandidateId,candidateReviews,supplyGap,supplyGapEvidence,externalOutcome:'NO_EXTERNAL_PARTICIPATION_VERIFIED'});
 const bytes=Buffer.from(JSON.stringify(report,null,2)+'\n'),reportSha=sha(bytes),reportPath=`evidence/tc-01d/qualification-review-${reviewInputSha256.slice(0,16)}.json`;
 await mkdir(join(root,'evidence/tc-01d'),{recursive:true});
 try{await writeFile(join(root,reportPath),bytes,{flag:'wx',mode:0o644})}catch(error){if((error as NodeJS.ErrnoException).code!=='EEXIST')throw error;const old=await readFile(join(root,reportPath));if(!old.equals(bytes))throw new Error(`A previous report exists at ${reportPath} but differs; preserve it and use a new input review hash.`)}
 await writeFile(join(root,`${reportPath}.sha256`),`${reportSha}  ${reportPath.split('/').at(-1)}\n`,{mode:0o644});

 const opportunityId=`need-${sha(selected.need.needItemId).slice(0,32)}`;
 const project=await db.select({id:projects.id,name:projects.name}).from(projects).where(eq(projects.id,selected.projectId)).limit(1);if(!project[0])throw new Error('Selected consumer project is absent from the database.');
 const attachedEvidence=[
  {claim:`Builder need (exact imported atomic statement): ${selected.need.excerpt}`,sourceUrl:selected.need.sourceUrl,revision:selected.need.revision,verification:`Exact need remains present in public issue body checked ${selected.sourceState.checkedAt}; source issue is ${selected.sourceState.state.toUpperCase()}. Imported category and offsets are automated, and the public status does not confirm current intent. Evidence body SHA-256: ${state.bodyChecks.find((x:any)=>x.candidateId===selectedCandidateId).bodySha256}.`},
  {claim:`Current source status: issue ${selected.sourceState.state.toUpperCase()}, updated ${selected.sourceState.updatedAt}; exact atomic request still occurs in the body.`,sourceUrl:selected.need.sourceUrl,revision:selected.sourceState.updatedAt,verification:`Read-only authenticated GitHub API check at ${selected.sourceState.checkedAt}; open status is not proof the builder still wants outside help.`},
  ...selected.rejectedAlternatives.slice(0,1).map((alt:any)=>({claim:`Historical human review offer: ${alt.providerClaim}`,sourceUrl:alt.sourceUrl,revision:alt.revision,verification:`This same-scope alternative was rejected by the discovery matcher as ${alt.reason}; current-state result is ${selected.currentState.result}/${selected.currentState.freshness}. Offer is not confirmed as available.`})),
 ];
 const observationTime=new Date(state.bodyChecks.find((x:any)=>x.candidateId===selectedCandidateId).checkedAt);
 const reviewId=`qualification-${sha(`${opportunityId}\0${reviewInputSha256}`).slice(0,32)}`;
 const persistence=await db.transaction(async tx=>{
  let newOpportunity=false;const existingOpportunity=await tx.select().from(opportunities).where(eq(opportunities.id,opportunityId)).limit(1);
  if(!existingOpportunity.length){
   await tx.insert(opportunities).values({id:opportunityId,projectA:selected.projectId,projectB:null,kind:'TC-01D opportunity supply gap',problem:supplyGap.problem,reasoning:`${supplyGap.proposedConnection}\n\nQualification reviewed ${candidateReviews.length} candidates; none passed the source freshness, need and provider evidence gates.`,requirements:`${supplyGap.missingEvidence.join('\n')}\n\nNo suitable current provider was supported by the reviewed inventory. This is not proof that no provider exists.`,experiment:supplyGap.smallestUsefulExperiment,status:'no-qualified-pilot'}).onConflictDoNothing();
   newOpportunity=true;
  }
  let newEvidence=0;
  for(const item of attachedEvidence){
   const prior=await tx.select({id:evidence.id,needItemId:evidence.needItemId,claim:evidence.claim,sourceUrl:evidence.sourceUrl,revision:evidence.revision}).from(evidence).where(eq(evidence.opportunityId,opportunityId));
   if(!prior.some((x:any)=>x.needItemId===selected.need.needItemId&&x.claim===item.claim&&x.sourceUrl===item.sourceUrl&&(x.revision??null)===(item.revision??null))){await tx.insert(evidence).values({opportunityId,needItemId:selected.need.needItemId,claim:item.claim,sourceUrl:item.sourceUrl,revision:item.revision,observedAt:observationTime,verification:item.verification});newEvidence++}
  }
  await tx.insert(opportunityQualificationReviews).values({id:reviewId,opportunityId,inputSnapshotSha256:reviewInputSha256,outcome:'NO_QUALIFIED_PILOT',actionStatus:'NO_QUALIFIED_PILOT',review:JSON.stringify(report),createdAt:new Date()}).onConflictDoNothing();
  const saved=await tx.select({id:opportunityQualificationReviews.id,outcome:opportunityQualificationReviews.outcome,actionStatus:opportunityQualificationReviews.actionStatus}).from(opportunityQualificationReviews).where(eq(opportunityQualificationReviews.opportunityId,opportunityId)).orderBy(desc(opportunityQualificationReviews.createdAt)).limit(1);
  return{reviewId:saved[0]?.id,newOpportunity,newEvidence};
 });
 console.log(JSON.stringify({path:reportPath,sha256:reportSha,reviewInputSha256,outcome:overall,actionStatus:'NO_QUALIFIED_PILOT',selectedCandidateId,opportunityId,...persistence,candidateOutcomes:candidateReviews.map((x:any)=>({candidateId:x.candidateId,project:x.projectName,outcome:x.assessment.outcome,proposedOutcome:x.assessment.proposedOutcome,sourceFreshness:x.assessment.sourceFreshness})),evidenceItems:attachedEvidence.length,externalActionSent:false},null,2));
}

main().catch(error=>{console.error(error instanceof Error?error.stack??error.message:String(error));process.exit(1)});
