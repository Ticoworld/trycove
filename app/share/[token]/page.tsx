import {WorkspaceDialog} from '../../workspace-dialog';
import '../../evidence-pages.css';
import Link from 'next/link';
import {notFound} from 'next/navigation';
import {readPublicHandoff} from '../../../lib/handoffs';
export const dynamic='force-dynamic';
export const revalidate=0;
export const metadata={robots:{index:false,follow:false},referrer:'no-referrer'};
type Obj=Record<string,unknown>;
const obj=(v:unknown):Obj=>v&&typeof v==='object'&&!Array.isArray(v)?v as Obj:{};
const str=(v:unknown)=>typeof v==='string'?v:'';
const safeUrl=(v:unknown)=>{const raw=str(v);try{const u=new URL(raw);return u.protocol==='https:'&&!u.username&&!u.password?u.href:null}catch{return null}};
export default async function SharedHandoffPage({params}:{params:Promise<{token:string}>}){
 const {token}=await params;const handoff=await readPublicHandoff(token);if(!handoff)notFound();const c=handoff.content;const feedback=handoff.kind==='feedback';
 const project=obj(c.project),request=obj(c.request),consumer=obj(c.consumer),provider=obj(c.provider),revisions=obj(c.sourceRevision);
 const tasks=Array.isArray(c.tasks)?c.tasks.map(x=>obj(x)).map(x=>({task:str(x.task),outcome:str(x.outcome),note:str(x.note)})):[];
 const blockers=Array.isArray(c.blockers)?c.blockers.map(x=>obj(x)).map(x=>({task:str(x.task),outcome:str(x.outcome),note:str(x.note)})):[];
 const evidence=Array.isArray(c.evidence)?c.evidence.map(x=>obj(x)).map(x=>({claim:str(x.claim),url:safeUrl(x.url),revision:str(x.revision),verification:str(x.verification)})):[];
 const unknowns=Array.isArray(c.unknowns)?c.unknowns.map(str):[];const limitations=Array.isArray(c.limitations)?c.limitations.map(str):[];
 const prerequisites=Array.isArray(c.prerequisites)?c.prerequisites.map(str).join(' · '):str(c.prerequisites);
 const heading=str(c.title)||'Trycove handoff',requestRevision=str(request.revision);
 const applicationUrl=safeUrl(project.url),sourceUrl=safeUrl(request.sourceUrl),consumerUrl=safeUrl(consumer.url),providerUrl=safeUrl(provider.url);
 const latestFollowUp=handoff.timeline.at(-1);
 return <article className="handoff-public evidence-paper shared-report">
  <header className="evidence-intro"><Link className="evidence-return" href="/">trycove<span>●</span></Link><h1>{heading}</h1><p className="evidence-context">{feedback?'Tester-approved feedback':'Connection brief'}</p><svg className="report-stamp" viewBox="0 0 120 120" aria-hidden="true"><path d="M29 23h67v78H29z" fill="#fffaf0" stroke="#29263b" strokeWidth="3"/><path d="M16 13h67v78H16z" fill="#f8cb61" stroke="#29263b" strokeWidth="3"/><path d="M29 32h40M29 43h33M29 54h40" stroke="#29263b" strokeWidth="3" strokeLinecap="round"/><circle cx="75" cy="78" r="13" fill="#fb907d" stroke="#29263b" strokeWidth="3"/><path d="m70 78 4 4 7-9" fill="none" stroke="#29263b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg></header>
  {feedback?<>
   <p className="lead">Self-reported observations about {str(project.name)}.</p>
   <section className="report-tasks"><h2>Recorded tasks</h2><ol>{tasks.map((task,i)=><li key={i}><strong>{task.task} · {task.outcome}</strong>{task.note&&<p>{task.note}</p>}</li>)}</ol></section>
  </>:<>
   <p className="lead">A proposed connection based on documented sources.</p>
   <section><h2>People to connect</h2><p>Consumer: <strong>{str(consumer.name)}</strong>{consumerUrl&&<> · <a href={consumerUrl} rel="noreferrer">Visit website</a></>}</p><p>Potential provider: <strong>{str(provider.name)}</strong>{providerUrl&&<> · <a href={providerUrl} rel="noreferrer">Visit website</a></>}</p></section>
   <section><h2>Documented need</h2><p>{str(c.need)}</p><h3>What the provider appears to offer</h3><p>{str(c.providerOffer)}</p><h3>Why a conversation may help</h3><p>{str(c.whyUseful)}</p><p>Next human action: {str(c.nextHumanAction)}</p></section>
  </>}
  <section className="report-follow-up"><h2>What happened next</h2>{handoff.timeline.length?<><p>Current status: {latestFollowUp?.kind.replaceAll('-',' ')}</p><ol>{handoff.timeline.map((event,i)=><li key={i}><strong>{event.kind.replaceAll('-',' ')}</strong> · {new Date(event.createdAt).toLocaleString()}{event.note&&<p>{event.note}</p>}{event.sourceUrl&&<p><a href={event.sourceUrl} rel="noreferrer">Supporting source ↗</a></p>}</li>)}</ol></>:<p>No follow-up recorded yet.</p>}</section>
  <WorkspaceDialog label="Report details">{feedback?<>
   <section><h2>Application</h2><p>{str(project.application)} · {str(c.environment)}</p>{applicationUrl&&<a href={applicationUrl} rel="noreferrer">Visit application</a>}</section>
   <section><h2>Original testing request</h2><p>{str(request.text)}</p>{sourceUrl&&<p><a href={sourceUrl} rel="noreferrer">Open source request</a> · {str(request.verification)} {requestRevision?`· revision ${requestRevision}`:''}</p>}</section>
   {blockers.length>0&&<section><h2>Prerequisites and blockers</h2><ul>{blockers.map((b,i)=><li key={i}>{b.task}: {b.outcome}{b.note?` — ${b.note}`:''}</li>)}</ul><p>{prerequisites}</p></section>}
   <section><h2>When and version limits</h2><p>Started {str(c.startedAt)} · completed {str(c.completedAt)}. {str(c.versionLimitations)}</p></section>
  </>:<>
   <section><h2>Evidence and open questions</h2><ul>{evidence.map((e,i)=><li key={i}>{e.claim} {e.url&&<a href={e.url} rel="noreferrer">View source</a>} {e.revision?`Revision ${e.revision}`:''} · {e.verification}</li>)}</ul><p>Source revisions: consumer {str(revisions.consumer)} · provider {str(revisions.provider)}</p><ul>{unknowns.map((x,i)=><li key={i}>{x}</li>)}</ul><p>Prerequisites: {prerequisites}</p></section>
  </>}<section><h2>Evidence boundaries</h2><ul>{limitations.map((x,i)=><li key={i}>{x}</li>)}</ul></section><p>Published as a separate copy. Private session data and receipt JSON are not available through this page.</p></WorkspaceDialog>
 </article>;
}
