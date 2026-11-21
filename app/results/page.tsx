import Link from 'next/link';
import {asc,desc,eq,inArray,isNull} from 'drizzle-orm';
import {db} from '../../lib/db';
import {feedbackListingConsents,followUps,handoffReports,opportunities,projects,trialEvidenceRecords,trialRuns} from '../../lib/schema';
import {FollowUpRecorder} from '../components/follow-up-recorder';
import {hasOrganizerSession} from '../../lib/organizer-auth';
export const dynamic='force-dynamic';
type Obj=Record<string,unknown>;
const obj=(x:unknown):Obj=>x&&typeof x==='object'&&!Array.isArray(x)?x as Obj:{};
const str=(x:unknown)=>typeof x==='string'?x:'';
export default async function ResultsPage(){
 const organizer=await hasOrganizerSession();
 const [receipts,runs,opps,projectRows,reports,listed]=await Promise.all([
  db.select().from(trialEvidenceRecords).orderBy(desc(trialEvidenceRecords.createdAt)).limit(100),
  db.select().from(trialRuns).orderBy(desc(trialRuns.observedAt)).limit(100),
  db.select().from(opportunities),db.select({id:projects.id,name:projects.name}).from(projects),
  db.select().from(handoffReports).where(eq(handoffReports.kind,'connection')).orderBy(desc(handoffReports.createdAt)),
  db.select({report:handoffReports}).from(handoffReports).innerJoin(feedbackListingConsents,eq(handoffReports.id,feedbackListingConsents.reportId))
    .where(isNull(handoffReports.revokedAt)).orderBy(desc(handoffReports.createdAt)),
 ]);
 const opportunityById=new Map(opps.map(x=>[x.id,x]));const projectName=new Map(projectRows.map(x=>[x.id,x.name]));
 const reportIds=reports.map(r=>r.id);const events=reportIds.length?await db.select().from(followUps).where(inArray(followUps.handoffReportId,reportIds)).orderBy(asc(followUps.createdAt),asc(followUps.id)):[];
 const eventsByReport=new Map<string,typeof events>();for(const e of events)if(e.handoffReportId)eventsByReport.set(e.handoffReportId,[...(eventsByReport.get(e.handoffReportId)??[]),e]);
 const eventView=(id:string)=>{const items=eventsByReport.get(id)??[];return items.filter(e=>organizer||e.publicNote).map(e=>({id:e.id,kind:e.kind,note:organizer||e.publicNote?e.note:'',sourceUrl:organizer||e.publicNote?e.sourceUrl:null,publicNote:e.publicNote,createdAt:e.createdAt.toISOString()}))};
 const feedback=listed.map(row=>row.report);const connections=reports;
 const status=(r:typeof reports[number])=>{const latest=(eventsByReport.get(r.id)??[]).filter(e=>organizer||e.publicNote).at(-1);return latest?.kind.replaceAll('-',' ')??'pending follow-up'};
 return <>
  <section className="hero"><div className="eyebrow">Results · evidence and follow-up</div><h1>What happened, and what happened next.</h1><p>Product Testing and Builder Connections keep source evidence, self-reported observations and recorded follow-up distinct. An empty timeline means follow-up is pending.</p><div className="bar"><a className="button" href="#product-testing">Product Testing</a><a className="button secondary" href="#builder-connections">Builder Connections</a></div></section>
  <section id="product-testing" className="section results-view"><div className="eyebrow">Product Testing</div><h2>Trials and approved feedback</h2>
   <h3>Published feedback reports</h3>{feedback.length?<div className="grid">{feedback.map(r=>{const content=obj(JSON.parse(r.content));const blockers=Array.isArray(content.blockers)?content.blockers.length:0;const isRevoked=!!r.revokedAt;return <article className="card" key={r.id}><span className="tag">{isRevoked?'Revoked':status(r)}</span><h3>{str(content.title)||'Product testing feedback'}</h3><p>{blockers} recorded blocker{blockers===1?'':'s'} · created {r.createdAt.toISOString().slice(0,10)}</p><p>{isRevoked?'The share link is no longer available.':'Only the tester-approved report copy is shared; the private source session remains separate.'}</p>{!isRevoked&&<p><a className="source" href={`/share/${r.shareToken}`}>Open approved report ↗</a> {r.opportunityId&&<Link className="source" href={`/opportunities/${encodeURIComponent(r.opportunityId??'')}`}>Source request ↗</Link>}</p>}</article>})}</div>:<p className="muted">No approved feedback reports have been published yet. A completed trial stays private until its tester reviews and approves a separate report.</p>}
   <section className="section"><div className="eyebrow">Integration Lab</div><h3>Execution evidence</h3>{receipts.length?<div className="grid">{receipts.map(record=>{const opportunity=record.opportunityId?opportunityById.get(record.opportunityId):undefined;return <Link className="card" key={record.id} href={`/trials/${encodeURIComponent(record.id)}`}><span className="tag">Level {record.evidenceLevel} · {record.result}</span><h3>{record.mode.replaceAll('-',' ')}</h3>{opportunity&&<p>{projectName.get(opportunity.projectA)} {opportunity.projectB?'×':''} {opportunity.projectB?projectName.get(opportunity.projectB):''}</p>}<p>Receipt {record.receiptSha256.slice(0,16)} · {record.createdAt.toISOString().slice(0,10)}</p><span className="arrow">Inspect exact receipt →</span></Link>})}</div>:<p className="muted">No Integration Lab execution receipts have been recorded.</p>}</section>
   <section className="section"><div className="eyebrow">Earlier observations</div><h3>Recorded trial events</h3>{runs.length?<div className="stack">{runs.map((run,index)=>{const opportunity=opportunityById.get(run.opportunityId);return <article className="card" key={`${run.opportunityId}-${run.observedAt.toISOString()}-${index}`}><span className="tag">{run.result}</span><h3>{opportunity?`${projectName.get(opportunity.projectA)} ${opportunity.projectB?'× '+projectName.get(opportunity.projectB):''}`:'Opportunity evidence'}</h3><p>{run.details.slice(0,1000)}</p><p>Observed {run.observedAt.toISOString().slice(0,10)} · <Link className="source" href={`/opportunities/${encodeURIComponent(run.opportunityId)}`}>Open workspace ↗</Link></p></article>})}</div>:<p className="muted">No trial outcome events are recorded. A candidate, prepared action or Pulse event is not counted as a result.</p>}</section>
  </section>
  <section id="builder-connections" className="section results-view"><div className="eyebrow">Builder Connections</div><h2>Saved Connection Briefs</h2>{connections.length?<div className="grid">{connections.map(r=>{const content=obj(JSON.parse(r.content));return <article className="card" key={r.id}><span className="tag">{r.revokedAt?'Revoked':status(r)}</span><h3>{str(content.title)||'Connection Brief'}</h3><p>Source-backed hypothesis · {r.createdAt.toISOString().slice(0,10)}</p><p>{r.revokedAt?'This share link has been revoked.':'The brief identifies evidence and known unknowns; it does not verify an integration.'}</p>{!r.revokedAt&&<p><a className="source" href={`/share/${r.shareToken}`}>Open public brief ↗</a></p>}<FollowUpRecorder reportId={r.id} kind="connection" events={eventView(r.id)} authorized={organizer}/><p><Link className="source" href={`/opportunities/${encodeURIComponent(r.opportunityId??'')}`}>Opportunity and follow-up ↗</Link></p></article>})}</div>:<p className="muted">No Connection Briefs have been published. A brief can only be prepared from a saved source-backed consumer/provider capability; an empty state is not a match.</p>}
  </section>
  <section className="section"><p className="muted">No builder reply, verified fix, external adoption or retest outcome is inferred from repository activity, a shared link or a recorded intention.</p></section>
 </>;
}
