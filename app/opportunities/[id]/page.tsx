import Link from 'next/link';
import {notFound} from 'next/navigation';
import {and,desc,eq,inArray} from 'drizzle-orm';
import {db} from '../../../lib/db';
import {candidateCapabilities,evidence,followUps,intelligenceAssessments,lifecycleEvidence,lifecycleVerificationRuns,opportunities,projects,technicalFootprints,trialEvidenceRecords,trialRuns} from '../../../lib/schema';
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
  db.select().from(technicalFootprints).where(eq(technicalFootprints.projectId,opportunity.projectB)).orderBy(desc(technicalFootprints.analyzedAt)).limit(1),
  db.select().from(intelligenceAssessments).where(eq(intelligenceAssessments.opportunityId,id)).orderBy(desc(intelligenceAssessments.createdAt)).limit(1),
  db.select({id:trialEvidenceRecords.id,mode:trialEvidenceRecords.mode,result:trialEvidenceRecords.result,evidenceLevel:trialEvidenceRecords.evidenceLevel,createdAt:trialEvidenceRecords.createdAt}).from(trialEvidenceRecords).where(eq(trialEvidenceRecords.opportunityId,id)).orderBy(desc(trialEvidenceRecords.createdAt)).limit(20),
 ]);
 const assessment=assessments[0];
 const [usedConsumer,usedProvider]=assessment?await Promise.all([
  db.select().from(technicalFootprints).where(and(eq(technicalFootprints.id,assessment.consumerFootprintId),eq(technicalFootprints.projectId,opportunity.projectA))).limit(1),
  db.select().from(technicalFootprints).where(and(eq(technicalFootprints.id,assessment.providerFootprintId),eq(technicalFootprints.projectId,opportunity.projectB))).limit(1),
 ]):[[],[]];

 return <>
  <section className="hero">
   <Link href="/opportunities" className="eyebrow">← Opportunities</Link>
   <h1>{consumer?.name} <span className="arrow">×</span> {provider?.name}</h1>
   <p>{opportunity.problem}</p>
   <div className="tag">{opportunity.kind} / {opportunity.status} / not an adoption claim</div>
  </section>
  <div className="detail section">
   <div className="prose">
    <div className="eyebrow">Opportunity workspace / 机会工作区</div>
    <h2>Why these projects?</h2><p>{opportunity.reasoning}</p>
    <h2>Compatibility & unknowns</h2><p>{opportunity.requirements}</p>
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
    <div className="card"><span className="tag">Important distinction</span><p>Offline script execution and synthetic fixtures do not prove fresh chain acceptance, a live deployment, maintainer approval or adoption.</p><Link className="source" href={`/projects/${opportunity.projectA}`}>{consumer?.name} profile →</Link><br/><Link className="source" href={`/projects/${opportunity.projectB}`}>{provider?.name} profile →</Link></div>
   </aside>
  </div>
 </>;
}
