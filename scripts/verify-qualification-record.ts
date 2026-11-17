import {createHash} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {join,resolve,relative,isAbsolute} from 'node:path';
import {and,eq} from 'drizzle-orm';
import {db} from '../lib/db';
import {evidence,followUps,opportunities,opportunityQualificationReviews} from '../lib/schema';
import {QualificationReviewReportSchema} from '../lib/intelligence/qualification';

const root=process.cwd(),sha=(v:string|Buffer)=>createHash('sha256').update(v).digest('hex');
async function main(){
 const input=process.argv[2]??'evidence/tc-01d/qualification-review-3b32928287de878a.json';
 const file=resolve(root,input),rel=relative(root,file);
 if(rel.startsWith('..')||isAbsolute(rel)||!rel.startsWith('evidence/tc-01d/qualification-review-'))throw new Error('Provide a saved TC-01D qualification-review artifact.');
 const raw=await readFile(file);if(raw.length>4_000_000)throw new Error('Qualification review exceeds the size limit.');
 const artifact=QualificationReviewReportSchema.parse(JSON.parse(raw.toString('utf8')));const artifactSha=sha(raw);
 if(artifact.outcome!=='NO_QUALIFIED_PILOT'||artifact.actionStatus!=='NO_QUALIFIED_PILOT'||artifact.externalOutcome!=='NO_EXTERNAL_PARTICIPATION_VERIFIED'||artifact.supplyGap.externalActionSent)throw new Error('Record does not preserve the no-pilot/no-external-action boundary.');
 const selected=artifact.candidateReviews.find(x=>x.candidateId===artifact.selectedCandidateId);if(!selected)throw new Error('Selected supply-gap decision is not in the candidate pool.');
 const opportunityId=`need-${sha(selected.need.needItemId).slice(0,32)}`;
 const [opportunityRows,reviewRows,evidenceRows,followUpRows]=await Promise.all([
  db.select().from(opportunities).where(eq(opportunities.id,opportunityId)).limit(1),
  db.select().from(opportunityQualificationReviews).where(eq(opportunityQualificationReviews.opportunityId,opportunityId)),
  db.select().from(evidence).where(eq(evidence.opportunityId,opportunityId)),
  db.select().from(followUps).where(eq(followUps.opportunityId,opportunityId)),
 ]);
 const opportunity=opportunityRows[0];if(!opportunity||opportunity.status!=='no-qualified-pilot'||opportunity.projectA!==selected.projectId||opportunity.projectB!==null)throw new Error('Saved no-pilot workspace does not match the selected imported need.');
 const persistedReview=reviewRows.find(x=>x.inputSnapshotSha256===artifact.evaluation.reviewInputSha256);if(!persistedReview||persistedReview.outcome!==artifact.outcome||persistedReview.actionStatus!==artifact.actionStatus)throw new Error('Expected qualification review was not persisted.');
 if(JSON.stringify(JSON.parse(persistedReview.review))!==JSON.stringify(artifact))throw new Error('Database review content differs from the source-backed report artifact.');
 const evidenceKeys=evidenceRows.map(x=>JSON.stringify([x.needItemId,x.claim,x.sourceUrl,x.revision]));if(new Set(evidenceKeys).size!==evidenceKeys.length||!evidenceRows.some(x=>x.needItemId===selected.need.needItemId&&x.sourceUrl===selected.need.sourceUrl&&x.revision===selected.need.revision))throw new Error('Workspace evidence is missing its exact source lineage or contains duplicates.');
 if(followUpRows.length!==0)throw new Error('A qualification run unexpectedly created a follow-up/external-action record.');
 if(new Set(reviewRows.map(x=>x.inputSnapshotSha256)).size!==reviewRows.length)throw new Error('Qualification history contains duplicate input snapshots.');
 const report={schemaVersion:1,verifiedAt:new Date().toISOString(),artifactPath:rel,artifactSha256:artifactSha,reviewInputSha256:artifact.evaluation.reviewInputSha256,opportunityId,workspaceStatus:opportunity.status,selectedNeedItemId:selected.need.needItemId,sourceUrl:selected.need.sourceUrl,sourceRevision:selected.need.revision,sourceEvidenceCount:evidenceRows.length,qualificationReviewHistoryCount:reviewRows.length,uniqueReviewSnapshots:true,followUpCount:followUpRows.length,actionStatus:persistedReview.actionStatus,contentMatchesArtifact:true,externalActionSent:false};
 const out=join(root,'evidence/tc-01d/persistence-verification.json'),bytes=Buffer.from(JSON.stringify(report,null,2)+'\n');await mkdir(join(root,'evidence/tc-01d'),{recursive:true});await writeFile(out,bytes);await writeFile(`${out}.sha256`,`${sha(bytes)}  persistence-verification.json\n`);
 console.log(JSON.stringify({...report,path:'evidence/tc-01d/persistence-verification.json',sha256:sha(bytes)},null,2));
}
main().catch(error=>{console.error(error instanceof Error?error.stack??error.message:String(error));process.exit(1)});
