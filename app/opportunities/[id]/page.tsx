import Link from 'next/link';
import {notFound} from 'next/navigation';
import {and,desc,eq,inArray} from 'drizzle-orm';
import {db} from '../../../lib/db';
import {candidateCapabilities,evidence,followUps,intelligenceAssessments,lifecycleEvidence,lifecycleVerificationRuns,needItems,opportunities,opportunityQualificationReviews,projects,technicalFootprints,trialEvidenceRecords,trialRuns} from '../../../lib/schema';
import {QualificationReviewReportSchema} from '../../../lib/intelligence/qualification';
import {FootprintLink} from '../../components/footprint';
import {IntelligenceAssessment} from '../../components/assessment';
import {LifecycleVerification} from '../../components/lifecycle-verification';
import {addFollowUp} from './actions';

export const dynamic='force-dynamic';

function safeExternalUrl(raw:string){
 try{const url=new URL(raw);return url.protocol==='https:'&&!url.username&&!url.password?url.href:null}catch{return null}
}

export default async function Page({params}:{params:Promise<{id:string}>}){
 const {id}=await params;
 const [opportunity]=await db.select().from(opportunities).where(eq(opportunities.id,id));
 if(!opportunity)notFound();
 const allProjects=await db.select().from(projects);
 const consumer=allProjects.find(project=>project.id===opportunity.projectA);
 const provider=allProjects.find(project=>project.id===opportunity.projectB);
 const capabilities=await db.select().from(candidateCapabilities).where(eq(candidateCapabilities.opportunityId,id));
 const capabilityIds=capabilities.map(capability=>capability.id);
 const [lifecycleRuns,lifecycleItems]=capabilityIds.length?await Promise.all([
  db.select().from(lifecycleVerificationRuns).where(inArray(lifecycleVerificationRuns.capabilityId,capabilityIds)).orderBy(desc(lifecycleVerificationRuns.checkedAt)),
  db.select().from(lifecycleEvidence).where(inArray(lifecycleEvidence.capabilityId,capabilityIds)).orderBy(desc(lifecycleEvidence.checkedAt)),
 ]):[[],[]];
 const [sourceEvidence,trials,history,consumerFootprints,providerFootprints,assessments,receipts]=await Promise.all([
  db.select().from(evidence).where(eq(evidence.opportunityId,id)),
  db.select().from(trialRuns).where(eq(trialRuns.opportunityId,id)),
  db.select().from(followUps).where(eq(followUps.opportunityId,id)).orderBy(desc(followUps.createdAt)),
  db.select().from(technicalFootprints).where(eq(technicalFootprints.projectId,opportunity.projectA)).orderBy(desc(technicalFootprints.analyzedAt)).limit(1),
  opportunity.projectB?db.select().from(technicalFootprints).where(eq(technicalFootprints.projectId,opportunity.projectB)).orderBy(desc(technicalFootprints.analyzedAt)).limit(1):Promise.resolve([]),
  db.select().from(intelligenceAssessments).where(eq(intelligenceAssessments.opportunityId,id)).orderBy(desc(intelligenceAssessments.createdAt)).limit(1),
  db.select({id:trialEvidenceRecords.id,mode:trialEvidenceRecords.mode,result:trialEvidenceRecords.result,evidenceLevel:trialEvidenceRecords.evidenceLevel,createdAt:trialEvidenceRecords.createdAt}).from(trialEvidenceRecords).where(eq(trialEvidenceRecords.opportunityId,id)).orderBy(desc(trialEvidenceRecords.createdAt)).limit(20),
 ]);
 const savedQualification=await db.select().from(opportunityQualificationReviews).where(eq(opportunityQualificationReviews.opportunityId,id)).orderBy(desc(opportunityQualificationReviews.createdAt)).limit(1);
 let qualificationReport:null|ReturnType<typeof QualificationReviewReportSchema.parse>=null;
 if(savedQualification[0]){try{const parsed=QualificationReviewReportSchema.safeParse(JSON.parse(savedQualification[0].review));if(parsed.success)qualificationReport=parsed.data}catch{/* Preserve malformed historical reviews and keep the rest of the workspace available. */}}
 const assessment=assessments[0];
 const [usedConsumer,usedProvider]=assessment&&opportunity.projectB?await Promise.all([
  db.select().from(technicalFootprints).where(and(eq(technicalFootprints.id,assessment.consumerFootprintId),eq(technicalFootprints.projectId,opportunity.projectA))).limit(1),
  db.select().from(technicalFootprints).where(and(eq(technicalFootprints.id,assessment.providerFootprintId),eq(technicalFootprints.projectId,opportunity.projectB))).limit(1),
 ]):[[],[]];
 const linkedNeedIds=sourceEvidence.map(item=>item.needItemId).filter((x):x is string=>Boolean(x));
 const linkedNeeds=linkedNeedIds.length?await db.select().from(needItems).where(inArray(needItems.id,linkedNeedIds)):[];

 return <>
  <section className="hero">
   <Link href="/opportunities" className="eyebrow">← Opportunities</Link>
   <h1>{consumer?.name} <span className="arrow">{provider?'×':'→'}</span> {provider?.name??'No provider found'}</h1>
   <p>{opportunity.problem}</p>
   <div className="tag">{opportunity.kind} / {opportunity.status} / not an adoption claim</div>
  </section>
  <div className="detail section">
   <div className="prose">
    <div className="eyebrow">Opportunity workspace / 机会工作区</div>
    <h2>Why these projects?</h2><p>{opportunity.reasoning}</p>
    <h2>{provider?'Compatibility & unknowns':'Search decision and unknowns'}</h2><p>{opportunity.requirements}</p>
    {linkedNeeds.length>0&&<><h2>Atomic builder need</h2>{linkedNeeds.map(item=><article className="card" key={item.id}><span className="tag">{item.category.replaceAll('-',' ')} · {item.stance.replaceAll('-',' ')} · automated interpretation</span><blockquote><p>{item.excerpt}</p></blockquote><p>Source revision {item.revision} · character offsets {item.startOffset}–{item.endOffset} · lineage {item.lineageKey.slice(-12)}</p><p>Parent source claim: {item.sourceClaim}</p><p>{item.verification}</p></article>)}</>}
    {savedQualification.length>0&&<section className="section" aria-labelledby="qualification-review">
     {qualificationReport?<>
      <div className="tag">{qualificationReport.outcome} · {qualificationReport.actionStatus} · no outreach sent</div>
      <h2 id="qualification-review">Builder opportunity qualification</h2>
      <p>This record is a reviewed decision from {qualificationReport.candidateReviews.length} candidates generated from the frozen imported corpus. It is not an introduction, response or adoption record.</p>
      <article className="card"><span className="tag">Supply-gap brief · {qualificationReport.supplyGap.result}</span>
       <h3>{qualificationReport.supplyGap.title}</h3>
       <h4>Builder problem</h4><p>{qualificationReport.supplyGap.problem}</p>
       <h4>Provider finding</h4><p>{qualificationReport.supplyGap.proposedConnection}</p>
       <h4>Expected benefit</h4><p>{qualificationReport.supplyGap.expectedBenefit}</p>
       <h4>Smallest useful next experiment</h4><p>{qualificationReport.supplyGap.smallestUsefulExperiment}</p>
       <h4>Participation required</h4><ul>{qualificationReport.supplyGap.requiredParticipation.map(item=><li key={item}>{item}</li>)}</ul>
       <h4>Success criteria</h4><ul>{qualificationReport.supplyGap.successCriteria.map(item=><li key={item}>{item}</li>)}</ul>
       <h4>Alternatives reviewed</h4>{qualificationReport.supplyGap.alternatives.map((item,index)=><p key={`${item.name}-${index}`}><strong>{item.name}.</strong> {item.finding}{item.evidenceUrl&&(()=>{const href=safeExternalUrl(item.evidenceUrl);return href?<>{' '}<a className="source" href={href} target="_blank" rel="noreferrer">Source ↗</a></>:null})()}</p>)}
       <h4>Missing evidence</h4><ul>{qualificationReport.supplyGap.missingEvidence.map(item=><li key={item}>{item}</li>)}</ul>
       <h4>Next human action</h4><p>{qualificationReport.supplyGap.nextHumanAction}</p>
       <p className="tag">Action status: {qualificationReport.supplyGap.actionStatus} · external action sent: {qualificationReport.supplyGap.externalActionSent?'yes':'no'}</p>
      </article>
      <h3>Candidate decisions</h3>
      <div className="stack">{qualificationReport.candidateReviews.map(candidate=><article className="card" key={candidate.candidateId}>
       <span className="tag">{candidate.assessment.outcome} · {candidate.intentType.replaceAll('-',' ')} · {candidate.projectName}</span>
       <blockquote><p>{candidate.need.excerpt}</p></blockquote>
       <p>{candidate.assessment.rationale}</p>
       <p><strong>Engine disposition:</strong> {candidate.engineDisposition} · <strong>Current source:</strong> {candidate.sourceState.state.toUpperCase()} (updated {candidate.sourceState.updatedAt.slice(0,10)}; checked {candidate.sourceState.checkedAt.slice(0,10)}) · <strong>Freshness:</strong> {candidate.currentState.freshness}</p>
       <p><strong>Current-state finding:</strong> {candidate.currentState.summary} {candidate.currentState.uncertainty}</p>
       <p><strong>Next action:</strong> {candidate.assessment.nextAction}</p>
       <details><summary>Inspect source evidence ({candidate.assessment.evidence.length})</summary>{candidate.assessment.evidence.map((item,index)=>{const href=safeExternalUrl(item.sourceUrl);return <article key={`${item.sourceUrl}-${item.revision??index}`}><span className="tag">{item.evidenceType}{item.revision?` · ${item.revision}`:''}</span><blockquote><p>{item.excerpt}</p></blockquote><p>{item.verification}</p>{href&&<a className="source" href={href} target="_blank" rel="noreferrer">Open evidence ↗</a>}</article>})}</details>
       {candidate.rejectedAlternatives.map((alternative,index)=><p key={`${alternative.sourceUrl}-${index}`}><strong>Rejected engine alternative:</strong> {alternative.providerClaim} — {alternative.reason}</p>)}
       {candidate.assessment.unknowns.length>0&&<p><strong>Unknown:</strong> {candidate.assessment.unknowns.join(' · ')}</p>}
       {(()=>{const href=safeExternalUrl(candidate.need.sourceUrl);return href?<a className="source" href={href} target="_blank" rel="noreferrer">Open exact builder source ↗</a>:null})()}
      </article>)}</div>
      <p className="muted">Evidence bundle {qualificationReport.evaluation.reviewInputSha256.slice(0,16)} · source snapshot {qualificationReport.evaluation.sourceSnapshotSha256.slice(0,16)} · external outcome {qualificationReport.externalOutcome}.</p>
     </>:<><h2 id="qualification-review">Qualification review</h2><p className="muted">A saved qualification record exists but failed validation for display. The original record remains preserved.</p></>}
    </section>}
    <h2>Engine assessment</h2>
    {assessment?<IntelligenceAssessment assessment={assessment} consumer={usedConsumer[0]} provider={usedProvider[0]}/>:<p className="muted">No structured intelligence assessment has been recorded for this opportunity.</p>}
    <LifecycleVerification claims={capabilities} runs={lifecycleRuns} evidence={lifecycleItems}/>
    <h2>Experiment</h2><p>{opportunity.experiment}</p>
    {trials.map(trial=><div className="card" key={trial.id}><span className="tag">Independent trial · {trial.result}</span><p>{trial.details}</p></div>)}
    <h2>Execution receipts</h2>
    {receipts.length?receipts.map(receipt=><p key={receipt.id}><Link className="source" href={`/trials/${encodeURIComponent(receipt.id)}`}>Level {receipt.evidenceLevel} · {receipt.mode} · {receipt.result} →</Link></p>):<p className="muted">No isolated execution receipt is attached.</p>}
    <h2>Follow-up ledger / 跟进记录</h2>
    <p>Record observations as they happen. Entries do not imply maintainer participation or adoption.</p>
    <div className="timeline">{history.map(item=><article key={item.id}><span className="tag">{item.kind} · {item.createdAt.toISOString().slice(0,10)}</span><p>{item.note}</p></article>)}{!history.length&&<p className="muted">No follow-ups recorded yet.</p>}</div>
    <form action={addFollowUp} className="card">
     <input type="hidden" name="id" value={id}/>
     <label htmlFor="kind">Entry type</label><select name="kind" id="kind">{['investigation','introduction','response','attempt','finding','fix','adoption','rejection','follow-up','dismissed','revised','advanced'].map(kind=><option key={kind}>{kind}</option>)}</select>
     <label htmlFor="note">What happened?</label><textarea id="note" name="note" required maxLength={2000}/>
     <label htmlFor="key">Write access key</label><input id="key" name="key" type="password" required autoComplete="off"/>
     <p>Writing is disabled unless write access is configured on the server.</p><button>Add to ledger</button>
    </form>
   </div>
   <aside className="stack">
    <div className="card"><span className="tag">Source evidence / 证据</span>{sourceEvidence.map(item=>{const href=safeExternalUrl(item.sourceUrl);return <div key={item.id}><p>{item.claim}</p>{href&&<a className="source" href={href} target="_blank" rel="noreferrer">Inspect source ↗</a>}<p>{item.verification} · {item.observedAt.toISOString().slice(0,10)}</p></div>})}</div>
    <div className="card"><span className="tag">Project technical footprints</span><p>Latest stored source scans for these projects; observations may not be specific to this opportunity.</p>{consumerFootprints[0]&&<FootprintLink footprint={consumerFootprints[0]} projectName={consumer?.name}/>} {providerFootprints[0]&&<FootprintLink footprint={providerFootprints[0]} projectName={provider?.name}/>} {!consumerFootprints.length&&!providerFootprints.length&&<p>No technical footprints have been recorded for these projects.</p>}</div>
    <div className="card"><span className="tag">Important distinction</span><p>{provider?'Offline script execution and synthetic fixtures do not prove fresh chain acceptance, a live deployment, maintainer approval or adoption.':'No suitable provider was supported by the source evidence searched; this is an explicit no-match decision, not proof that no provider exists.'}</p><Link className="source" href={`/projects/${opportunity.projectA}`}>{consumer?.name} profile →</Link>{opportunity.projectB&&<><br/><Link className="source" href={`/projects/${opportunity.projectB}`}>{provider?.name} profile →</Link></>}</div>
   </aside>
  </div>
 </>;
}
