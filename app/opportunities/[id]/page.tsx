import Link from 'next/link';
import {notFound} from 'next/navigation';
import {and,desc,eq,inArray} from 'drizzle-orm';
import {db} from '../../../lib/db';
import {candidateCapabilities,evidence,followUps,handoffReports,intelligenceAssessments,lifecycleEvidence,lifecycleVerificationRuns,needItems,opportunities,opportunityPriorWorkReconciliations,opportunityQualificationReviews,projects,technicalFootprints,trialEvidenceRecords,trialRuns} from '../../../lib/schema';
import {QualificationReviewReportSchema} from '../../../lib/intelligence/qualification';
import {PriorWorkR1ReportSchema} from '../../../lib/intelligence/prior-work-reconciliation';
import {FootprintLink} from '../../components/footprint';
import {IntelligenceAssessment} from '../../components/assessment';
import {LifecycleVerification} from '../../components/lifecycle-verification';
import {addFollowUp} from './actions';
import {ConnectionHandoff} from './connection-handoff';
import {hasOrganizerSession} from '../../../lib/organizer-auth';
import {listPublishedTrials} from '../../../lib/trials/trial-packs';

export const dynamic='force-dynamic';
type ConnectionDetails={boundary?:string;adapter?:string;findings?:Array<{dimension:string;state:string;explanation:string}>;providerRevision?:string;consumerRevision?:string};

function safeExternalUrl(raw:string){
 try{const url=new URL(raw);return url.protocol==='https:'&&!url.username&&!url.password?url.href:null}catch{return null}
}

export default async function Page({params}:{params:Promise<{id:string}>}){
 const {id}=await params;
 const organizer=await hasOrganizerSession();
 const linkedTrial=(await listPublishedTrials()).find(room=>room.problemMap?.opportunityId===id);
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
 const [sourceEvidence,trials,history,consumerFootprints,providerFootprints,assessments,receipts,connectionReports]=await Promise.all([
  db.select().from(evidence).where(eq(evidence.opportunityId,id)),
  db.select().from(trialRuns).where(eq(trialRuns.opportunityId,id)),
  db.select().from(followUps).where(eq(followUps.opportunityId,id)).orderBy(desc(followUps.createdAt)),
  db.select().from(technicalFootprints).where(eq(technicalFootprints.projectId,opportunity.projectA)).orderBy(desc(technicalFootprints.analyzedAt)).limit(1),
  opportunity.projectB?db.select().from(technicalFootprints).where(eq(technicalFootprints.projectId,opportunity.projectB)).orderBy(desc(technicalFootprints.analyzedAt)).limit(1):Promise.resolve([]),
  db.select().from(intelligenceAssessments).where(eq(intelligenceAssessments.opportunityId,id)).orderBy(desc(intelligenceAssessments.createdAt)).limit(1),
  db.select({id:trialEvidenceRecords.id,mode:trialEvidenceRecords.mode,result:trialEvidenceRecords.result,evidenceLevel:trialEvidenceRecords.evidenceLevel,createdAt:trialEvidenceRecords.createdAt}).from(trialEvidenceRecords).where(eq(trialEvidenceRecords.opportunityId,id)).orderBy(desc(trialEvidenceRecords.createdAt)).limit(20),
  db.select().from(handoffReports).where(eq(handoffReports.opportunityId,id)).orderBy(desc(handoffReports.createdAt)),
 ]);
 const [savedQualification,savedPriorWork]=await Promise.all([
  db.select().from(opportunityQualificationReviews).where(eq(opportunityQualificationReviews.opportunityId,id)).orderBy(desc(opportunityQualificationReviews.createdAt)).limit(1),
  db.select().from(opportunityPriorWorkReconciliations).where(eq(opportunityPriorWorkReconciliations.opportunityId,id)).orderBy(desc(opportunityPriorWorkReconciliations.createdAt)).limit(1),
 ]);
 let qualificationReport:null|ReturnType<typeof QualificationReviewReportSchema.parse>=null;
 if(savedQualification[0]){try{const parsed=QualificationReviewReportSchema.safeParse(JSON.parse(savedQualification[0].review));if(parsed.success)qualificationReport=parsed.data}catch{/* Preserve malformed historical reviews and keep the rest of the workspace available. */}}
 let priorWorkReport:null|ReturnType<typeof PriorWorkR1ReportSchema.parse>=null;
 if(savedPriorWork[0]){try{const parsed=PriorWorkR1ReportSchema.safeParse(JSON.parse(savedPriorWork[0].report));if(parsed.success)priorWorkReport=parsed.data}catch{/* Keep the existing workspace usable if a historical reconciliation is malformed. */}}
 const workspaceCandidateId=priorWorkReport?(id===priorWorkReport.workspaces.originalSupplyGapOpportunityId?priorWorkReport.workspaces.originalSupplyGapCandidateId:id===priorWorkReport.workspaces.contactCandidateOpportunityId?priorWorkReport.workspaces.contactCandidateId:null):null;
 const workspaceCandidate=workspaceCandidateId?priorWorkReport?.candidates.find(candidate=>candidate.candidateId===workspaceCandidateId)??null:null;
 const assessment=assessments[0];
 let connectionDetails:ConnectionDetails|null=null;
 try{const parsed=JSON.parse(opportunity.requirements) as unknown;if(parsed&&typeof parsed==='object'&&!Array.isArray(parsed)){const value=parsed as Record<string,unknown>;if(typeof value.boundary==='string'&&typeof value.adapter==='string')connectionDetails={boundary:value.boundary,adapter:value.adapter,providerRevision:typeof value.providerRevision==='string'?value.providerRevision:undefined,consumerRevision:typeof value.consumerRevision==='string'?value.consumerRevision:undefined,findings:Array.isArray(value.findings)?value.findings.filter((item):item is {dimension:string;state:string;explanation:string}=>Boolean(item)&&typeof item==='object'&&typeof (item as Record<string,unknown>).dimension==='string'&&typeof (item as Record<string,unknown>).state==='string'&&typeof (item as Record<string,unknown>).explanation==='string'):undefined}}}catch{/* Preserve the original text when this is not structured connection data. */}
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
    <h2>{provider?'Compatibility & unknowns':'Search decision and unknowns'}</h2>
    {connectionDetails?.boundary&&connectionDetails?.adapter?<article className="card">
     <span className="tag">Source-derived connection hypothesis · not a compatibility claim</span>
     <h3>Functional boundary</h3><p>{connectionDetails.boundary}</p>
     <h3>Adapter contract</h3><p>{connectionDetails.adapter}</p>
     {(connectionDetails.consumerRevision||connectionDetails.providerRevision)&&<p>Consumer revision {connectionDetails.consumerRevision??'unknown'} · provider revision {connectionDetails.providerRevision??'unknown'}.</p>}
     {connectionDetails.findings&&<><h3>Compatibility findings</h3>{connectionDetails.findings.map((finding,index)=><article key={`${finding.dimension}-${index}`}><span className="tag">{finding.dimension} · {finding.state==='source-compatible'?'static source-interface match':finding.state}</span><p>{finding.explanation}</p></article>)}</>}
     <p className="muted">Later bounded prior-art checks and execution receipts appear in the evidence and follow-up sections below. Unknown source or deployment data remains unresolved.</p>
    </article>:<p>{opportunity.requirements}</p>}
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
    {priorWorkReport&&<section className="section" aria-labelledby="prior-work-review">
     <h2 id="prior-work-review">Issue history and contact readiness</h2>
     <article className="card">
      <span className="tag">{workspaceCandidate?.actionReadiness??savedPriorWork[0]?.actionReadiness??'NEEDS_CONFIRMATION'} · checked {priorWorkReport.evaluation.checkedAt.slice(0,10)} · contact not sent</span>
      <p>This review reuses the original ten-candidate pool. It records later issue replies and linked changes without replacing the earlier TC-01D conclusion. A prepared question is not a contact, a confirmed participant, or an agreed pilot.</p>
      <p>Original pool {priorWorkReport.evaluation.candidatePoolSha256.slice(0,16)} · corrected inputs {priorWorkReport.evaluation.inputSnapshotSha256.slice(0,16)} · external outcome {priorWorkReport.externalOutcome}.</p>
      {workspaceCandidate?.contactDraft&&<div className="card">
       <span className="tag">{workspaceCandidate.contactDraft.status} · pilot {workspaceCandidate.pilotReadiness}</span>
       <h3>Proposed first question for @{workspaceCandidate.contactDraft.targetLogin}</h3>
       <p><strong>Purpose:</strong> {workspaceCandidate.contactDraft.purpose}</p>
       <p><strong>Question:</strong> {workspaceCandidate.contactDraft.question}</p>
       <blockquote><p>{workspaceCandidate.contactDraft.draft}</p></blockquote>
       {workspaceCandidate.contactDraft.needEvidence.map((item,index)=>{const href=safeExternalUrl(item.sourceUrl);return href?<a className="source" key={`${item.sourceUrl}-${index}`} href={href} target="_blank" rel="noreferrer">Inspect original need ↗</a>:null})}
       <p className="muted">No message was sent, no follow-up response was recorded, no volunteers were recruited, and no pilot was agreed.</p>
      </div>}
      {priorWorkReport.actionReadiness==='NO_CONTACT_WORTHY_OPPORTUNITY'&&<p>No reviewed candidate currently justifies first contact. The individual unresolved questions and evidence gaps remain below.</p>}
      {priorWorkReport.repositoryResolutions.filter(item=>item.requestedUrl.replace(/\/$/,'').toLowerCase()!==item.canonicalUrl.replace(/\/$/,'').toLowerCase()).map(item=><p key={`${item.requestedUrl}-${item.repositoryId}`}>Resolved repository alias: <a className="source" href={item.requestedUrl} target="_blank" rel="noreferrer">{item.requestedUrl}</a> → <a className="source" href={item.canonicalUrl} target="_blank" rel="noreferrer">{item.canonicalUrl}</a> (GitHub repository ID {item.repositoryId}; {item.resolution}).</p>)}
     </article>
     <div className="stack">{priorWorkReport.candidates.map(candidate=><details className="card" key={candidate.candidateId} open={candidate.candidateId===workspaceCandidate?.candidateId}>
      <summary><strong>{candidate.projectName}</strong> · prior {candidate.previousConclusion.outcome} → {candidate.actionReadiness} · pilot {candidate.pilotReadiness}</summary>
      <blockquote><p>{candidate.needExcerpt}</p></blockquote>
      <p><strong>Previous decision:</strong> {candidate.previousConclusion.rationale}</p>
      <p><strong>Current need:</strong> {candidate.needState} · <strong>Question:</strong> {candidate.questionState} · <strong>Discussion:</strong> {candidate.discussion.completeness}, {candidate.discussion.commentCount} comments{candidate.discussion.latestCommentAt?`, last ${candidate.discussion.latestCommentAt.slice(0,10)}`:''}.</p>
      <p><strong>Implementation:</strong> {candidate.implementationEvidence.reported?'maintainer reported · ':''}{candidate.implementationEvidence.observed?'code observed · ':''}{candidate.implementationEvidence.demonstrated?'demonstration recorded · ':''}{candidate.implementationEvidence.adopted?'adoption evidenced':'no implementation/adoption finding in this capability scope'}</p>
      <p><strong>Related integration milestones:</strong> {Object.entries(candidate.relatedIntegrationMilestones).filter(([,value])=>value).map(([key])=>key).join(', ')||'none found in this bounded review'}{candidate.relatedIntegrationDemonstration!=='none_found'?` · demonstration: ${candidate.relatedIntegrationDemonstration}`:''}</p>
      {candidate.relatedPullRequests.map(pull=><p key={pull.url}><strong>Linked PR:</strong> <a className="source" href={pull.url} target="_blank" rel="noreferrer">{pull.title} ↗</a> · {pull.state}, {pull.merged?'merged':'unmerged'} · head {pull.headSha} · files {pull.filesStatus}.</p>)}
      <p>{candidate.rationale}</p>
      <h4>Subsequent evidence</h4>
      {candidate.events.map(event=><article key={event.eventId}>
       <span className="tag">{event.eventType.replaceAll('_',' ')} · {event.verification.replaceAll('_',' ')} · {event.relationship.replaceAll('_',' ')}</span>
       <p>{event.summary}</p>
       {event.references.map((reference,index)=>{const href=safeExternalUrl(reference.sourceUrl),comment=reference.commentId?candidate.discussion.commentTimeline.find(item=>item.id===reference.commentId):null;return <div key={`${reference.sourceUrl}-${index}`}><blockquote><p>{reference.quote}</p></blockquote><p>{comment?`@${comment.author} · ${comment.createdAt.slice(0,10)} · `:''}{href&&<a className="source" href={href} target="_blank" rel="noreferrer">Open cited source ↗</a>}{reference.revision?` · revision ${reference.revision}`:''}</p></div>})}
      </article>)}
      {candidate.remainingUnknowns.length>0&&<><h4>Still unknown</h4><ul>{candidate.remainingUnknowns.map(item=><li key={item}>{item}</li>)}</ul></>}
      <p><strong>Next action:</strong> {candidate.nextAction}</p>
     </details>)}
      <details className="card">
       <summary>Independent control: {priorWorkReport.control.projectName} · {priorWorkReport.control.actionReadiness} · pilot {priorWorkReport.control.pilotReadiness}</summary>
       <blockquote><p>{priorWorkReport.control.needExcerpt}</p></blockquote>
       <p>{priorWorkReport.control.rationale}</p>
       {priorWorkReport.control.events.map(event=><article key={event.eventId}><span className="tag">{event.eventType.replaceAll('_',' ')} · {event.verification.replaceAll('_',' ')}</span><p>{event.summary}</p>{event.references.map((reference,index)=>{const href=safeExternalUrl(reference.sourceUrl),comment=reference.commentId?priorWorkReport?.control.discussion.commentTimeline.find(item=>item.id===reference.commentId):null;return <div key={`${reference.sourceUrl}-${index}`}><blockquote><p>{reference.quote}</p></blockquote><p>{comment?`@${comment.author} · ${comment.createdAt.slice(0,10)} · `:''}{href&&<a className="source" href={href} target="_blank" rel="noreferrer">Open cited source ↗</a>}</p></div>})}</article>)}
       <h4>Still unknown</h4><ul>{priorWorkReport.control.remainingUnknowns.map(item=><li key={item}>{item}</li>)}</ul><p><strong>Next action:</strong> {priorWorkReport.control.nextAction}</p>
      </details>
     </div>
     <p className="muted">The original qualification review and follow-up ledger remain separate historical records. The corrected report is attached to this workspace and the selected builder-need workspace.</p>
    </section>}
    <h2>Engine assessment</h2>
    {assessment?<IntelligenceAssessment assessment={assessment} consumer={usedConsumer[0]} provider={usedProvider[0]}/>:<p className="muted">No structured intelligence assessment has been recorded for this opportunity.</p>}
    <LifecycleVerification claims={capabilities} runs={lifecycleRuns} evidence={lifecycleItems}/>
    <h2>Experiment</h2><p>{opportunity.experiment}</p>
    <p><Link className="source" href="/results">Open unified Results ↗</Link>{linkedTrial&&<> · <Link className="source" href={`/trials/rooms/${linkedTrial.id}`}>Open guided trial room ↗</Link></>}</p>
    {trials.map(trial=><div className="card" key={trial.id}><span className="tag">Independent trial · {trial.result}</span><p>{trial.details}</p></div>)}
    <h2>Execution receipts</h2>
    {receipts.length?receipts.map(receipt=><p key={receipt.id}><Link className="source" href={`/trials/${encodeURIComponent(receipt.id)}`}>Level {receipt.evidenceLevel} · {receipt.mode} · {receipt.result} →</Link></p>):<p className="muted">No isolated execution receipt is attached.</p>}
    <ConnectionHandoff opportunityId={id} authorized={organizer} candidates={capabilities.map(c=>({id:c.id,capability:c.capability,summary:c.summary,uncertainty:c.uncertainty,nextAction:c.nextAction,consumer:allProjects.find(p=>p.id===c.consumerProjectId)?.name??c.consumerProjectId,provider:allProjects.find(p=>p.id===c.providerProjectId)?.name??c.providerProjectId}))} events={history.filter(e=>(organizer||e.publicNote)&&e.handoffReportId&&connectionReports.some(r=>r.id===e.handoffReportId)).map(e=>({id:e.id,kind:e.kind,note:organizer||e.publicNote?e.note:'',sourceUrl:organizer||e.publicNote?e.sourceUrl:null,publicNote:e.publicNote,createdAt:e.createdAt.toISOString()}))} reports={connectionReports.filter(r=>r.kind==='connection').map(r=>({id:r.id,title:(JSON.parse(r.content) as {title?:string}).title??'Connection Brief',url:`/share/${r.shareToken}`,revoked:!!r.revokedAt}))}/>
    <h2>Follow-up ledger / 跟进记录</h2>
    <p>Record observations as they happen. Entries do not imply maintainer participation or adoption.</p>
    <div className="timeline">{history.filter(item=>organizer||item.publicNote).map(item=><article key={item.id}><span className="tag">{item.kind} · {item.createdAt.toISOString().slice(0,10)}</span>{(organizer||item.publicNote)&&<p>{item.note}</p>}</article>)}{!history.some(item=>organizer||item.publicNote)&&<p className="muted">No follow-ups recorded yet.</p>}</div>
    {organizer?<form action={addFollowUp} className="card">
     <input type="hidden" name="id" value={id}/>
     <label htmlFor="kind">Entry type</label><select name="kind" id="kind">{['investigation','introduction','response','attempt','finding','fix','adoption','rejection','follow-up','dismissed','revised','advanced'].map(kind=><option key={kind}>{kind}</option>)}</select>
     <label htmlFor="note">What happened?</label><textarea id="note" name="note" required maxLength={2000}/>
     <p>Entries are append-only. Status labels record what was reported; they do not independently verify an integration or adoption.</p><button>Add to ledger</button>
    </form>:<p className="muted"><Link href={`/organizer?return=${encodeURIComponent(`/opportunities/${id}`)}`}>Sign in as organizer</Link> to inspect private follow-up notes or append an event.</p>}
   </div>
   <aside className="stack">
    <div className="card"><span className="tag">Source evidence / 证据</span>{sourceEvidence.map(item=>{const href=safeExternalUrl(item.sourceUrl);return <div key={item.id}><p>{item.claim}</p>{href&&<a className="source" href={href} target="_blank" rel="noreferrer">Inspect source ↗</a>}<p>{item.verification} · {item.observedAt.toISOString().slice(0,10)}</p></div>})}</div>
    <div className="card"><span className="tag">Project technical footprints</span><p>Latest stored source scans for these projects; observations may not be specific to this opportunity.</p>{consumerFootprints[0]&&<FootprintLink footprint={consumerFootprints[0]} projectName={consumer?.name}/>} {providerFootprints[0]&&<FootprintLink footprint={providerFootprints[0]} projectName={provider?.name}/>} {!consumerFootprints.length&&!providerFootprints.length&&<p>No technical footprints have been recorded for these projects.</p>}</div>
    <div className="card"><span className="tag">Evidence scope</span><p>{provider?'The stored hypothesis is source-derived. Any attached trial is limited to the exact behavior described in its receipt; a passed route check does not prove live chain acceptance, deployment availability, maintainer approval or adoption.':'No suitable provider was supported by the source evidence searched; this is an explicit no-match decision, not proof that no provider exists.'}</p><Link className="source" href={`/projects/${opportunity.projectA}`}>{consumer?.name} profile →</Link>{opportunity.projectB&&<><br/><Link className="source" href={`/projects/${opportunity.projectB}`}>{provider?.name} profile →</Link></>}</div>
   </aside>
  </div>
 </>;
}
