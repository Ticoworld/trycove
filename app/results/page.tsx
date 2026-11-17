import Link from 'next/link';
import {desc} from 'drizzle-orm';
import {db} from '../../lib/db';
import {opportunities,projects,trialEvidenceRecords,trialRuns} from '../../lib/schema';

export const dynamic='force-dynamic';

export default async function Page(){
 const [receipts,runs,allOpportunities,allProjects]=await Promise.all([
  db.select().from(trialEvidenceRecords).orderBy(desc(trialEvidenceRecords.createdAt)).limit(100),
  db.select().from(trialRuns).orderBy(desc(trialRuns.observedAt)).limit(100),
  db.select().from(opportunities),db.select({id:projects.id,name:projects.name}).from(projects),
 ]);
 const opportunityById=new Map(allOpportunities.map(x=>[x.id,x]));const projectName=new Map(allProjects.map(x=>[x.id,x.name]));
 return <><section className="hero"><div className="eyebrow">Results · recorded outcomes</div><h1>What the evidence says happened.</h1><p>Receipts and follow-up records show actual local observations. They do not establish external participation or adoption unless those are explicitly sourced.</p></section>
  <section className="section"><div className="eyebrow">Execution evidence</div><h2>Trial receipts</h2>{receipts.length?<div className="grid">{receipts.map(record=>{const opportunity=record.opportunityId?opportunityById.get(record.opportunityId):undefined;return <Link className="card" key={record.id} href={`/trials/${encodeURIComponent(record.id)}`}><span className="tag">Level {record.evidenceLevel} · {record.result}</span><h3>{record.mode.replaceAll('-',' ')}</h3>{opportunity&&<p>{projectName.get(opportunity.projectA)} {opportunity.projectB?'×':''} {opportunity.projectB?projectName.get(opportunity.projectB):''}</p>}<p>Receipt {record.receiptSha256.slice(0,16)} · {record.createdAt.toISOString().slice(0,10)}</p><span className="arrow">Inspect exact receipt →</span></Link>})}</div>:<p className="muted">No execution receipts have been recorded.</p>}</section>
  <section className="section"><div className="eyebrow">Outcome ledger</div><h2>Recorded trial events</h2>{runs.length?<div className="stack">{runs.map((run,index)=>{const opportunity=opportunityById.get(run.opportunityId);return <article className="card" key={`${run.opportunityId}-${run.observedAt.toISOString()}-${index}`}><span className="tag">{run.result}</span><h3>{opportunity?`${projectName.get(opportunity.projectA)} ${opportunity.projectB?'× '+projectName.get(opportunity.projectB):''}`:'Opportunity evidence'}</h3><p>{run.details.slice(0,1000)}</p><p>Observed {run.observedAt.toISOString().slice(0,10)} · <Link className="source" href={`/opportunities/${encodeURIComponent(run.opportunityId)}`}>Open workspace ↗</Link></p></article>})}</div>:<p className="muted">No trial outcome events are recorded. A candidate, prepared action or Pulse event is not counted as a result.</p>}</section>
  <section className="section"><p className="muted">No maintainer reply, external adoption or product usage is inferred from repository activity or trial execution.</p></section>
 </>;
}
