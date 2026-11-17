import Link from 'next/link';
import {notFound} from 'next/navigation';
import {eq,or,desc} from 'drizzle-orm';
import {db} from '../../../lib/db';
import {projects,opportunities,signals,signalIntents,needItems,sourceRecords,projectRepositories,technicalFootprints} from '../../../lib/schema';
import {FootprintLink} from '../../components/footprint';
export const dynamic='force-dynamic';

export default async function Page({params}:{params:Promise<{id:string}>}){
 const {id}=await params;const [p]=await db.select().from(projects).where(eq(projects.id,id));if(!p)notFound();
 const [ops,facts,intents,needs,sources,repositories,footprints,all]=await Promise.all([
  db.select().from(opportunities).where(or(eq(opportunities.projectA,id),eq(opportunities.projectB,id))),
  db.select().from(signals).where(eq(signals.projectId,id)),
  db.select().from(signalIntents).where(eq(signalIntents.projectId,id)),
  db.select().from(needItems).where(eq(needItems.projectId,id)),
  db.select().from(sourceRecords).where(eq(sourceRecords.projectId,id)),
  db.select().from(projectRepositories).where(eq(projectRepositories.projectId,id)),
  db.select().from(technicalFootprints).where(eq(technicalFootprints.projectId,id)).orderBy(desc(technicalFootprints.analyzedAt)).limit(5),
  db.select().from(projects),
 ]);
 const names=new Map(all.map(x=>[x.id,x.name]));
 const groups=[
  {title:'Capabilities',kinds:new Set(['capability'])},
  {title:'Needs and obstacles',kinds:new Set(['need','obstacle'])},
  {title:'Dependencies and deployments',kinds:new Set(['dependency','deployment','environment'])},
 ];
 const grouped=groups.map(group=>({...group,items:facts.filter(f=>group.kinds.has(f.kind))}));
 const other=facts.filter(f=>!groups.some(group=>group.kinds.has(f.kind)));
 const sortedNeeds=[...needs].sort((a,b)=>b.observedAt.getTime()-a.observedAt.getTime()||a.startOffset-b.startOffset);
 const latestNeeds=sortedNeeds.slice(0,6);
 return <>
  <section className="hero"><Link className="eyebrow" href="/projects">← All projects</Link><h1>{p.name}</h1><p>{p.description||'No description supplied by this source.'}</p><div className="bar">{p.website&&<a className="button" href={p.website} rel="noreferrer">Visit website ↗</a>}{p.repository&&<a className="button secondary" href={p.repository} rel="noreferrer">Primary repository ↗</a>}</div></section>
  <div className="detail section"><div>
   <div className="eyebrow">Connections / 关联</div><h2>Opportunity workspace</h2>{ops.length?ops.map(o=><Link className="card" style={{display:'block'}} href={`/opportunities/${o.id}`} key={o.id}><span className="tag">{o.kind}</span><h3>{names.get(o.projectA)} × {names.get(o.projectB)}</h3><p>{o.problem}</p><span className="arrow">Investigate →</span></Link>):<p className="muted">No researched connections yet. Absence of a connection is not evidence of inactivity.</p>}
   <section className="section"><div className="eyebrow">Repository evidence</div><h2>Source-linked repositories</h2><p className="muted">Repository links are source claims. A link alone does not prove ownership, deployment or compatibility.</p>{repositories.length?<div className="stack">{repositories.map(r=><article className="card" key={r.id}><span className="tag">{r.role.toLowerCase().includes('met on the way')?'Mentioned reference':'Source-claimed component'} · not independently verified</span><h3>{r.role}</h3><a className="source" href={r.repository} rel="noreferrer">{r.repository} ↗</a><p><a className="source" href={r.sourceUrl} rel="noreferrer">Inspect association source ↗</a> · observed {r.observedAt.toISOString().slice(0,10)}</p></article>)}</div>:<p className="muted">No secondary repository links have been sourced.</p>}</section>
   <section className="section"><div className="eyebrow">Source analysis</div><h2>Technical footprints</h2><p className="muted">Recent snapshots only. The latest snapshot may not reflect the current remote revision.</p>{footprints.length?<div className="stack">{footprints.map(f=><div className="card" key={f.id}><FootprintLink footprint={f}/></div>)}</div>:<p className="muted">No technical footprint has been recorded for this project.</p>}</section>
  </div><aside className="stack"><section className="card"><span className="tag">Builder needs · {needs.length} extracted statements</span><h3>What builders are asking for</h3><p className="muted">Each excerpt is copied from an imported source claim. Category and request status are automated interpretations, not verified builder intent.</p>{latestNeeds.length?latestNeeds.map(n=><article key={n.id}><span className="tag">{n.category.replaceAll('-',' ')} · {n.stance.replaceAll('-',' ')}</span><blockquote><p>{n.excerpt}</p></blockquote><a className="source" href={n.sourceUrl} rel="noreferrer">Inspect source ↗</a><p>Revision {n.revision.slice(0,12)} · observed {n.observedAt.toISOString().slice(0,10)} · {n.verification}</p></article>):<p className="muted">No need or obstacle statements have been extracted.</p>}{needs.length>latestNeeds.length&&<details><summary>Show all {needs.length} extracted statements</summary>{sortedNeeds.slice(6).map(n=><article key={n.id}><span className="tag">{n.category.replaceAll('-',' ')} · {n.stance.replaceAll('-',' ')}</span><blockquote><p>{n.excerpt}</p></blockquote><a className="source" href={n.sourceUrl} rel="noreferrer">Inspect source ↗</a><p>Revision {n.revision.slice(0,12)} · observed {n.observedAt.toISOString().slice(0,10)} · {n.verification}</p></article>)}</details>}<h3>Connection intents interpreted from sources</h3>{intents.length?intents.map(i=><article key={i.id}><span className="tag">{i.direction} · {i.intentType}</span><h4>{i.scope.replaceAll('-',' ')}</h4><p>{facts.find(f=>f.id===i.signalId)?.claim??'Source-observed API capability; inspect the linked code location.'}</p><a className="source" href={i.sourceUrl} rel="noreferrer">Inspect source ↗</a><p>{i.verification} · rule {i.extractionRule}</p></article>):<p className="muted">No specific capabilities or matching intents have been interpreted from current source records.</p>}{grouped.map(group=><section key={group.title}><h3>{group.title}</h3>{group.items.length?group.items.map(f=><article key={f.id}><p>{f.claim}</p><a className="source" href={f.sourceUrl} rel="noreferrer">Inspect source ↗</a><p>{f.verification} · {f.observedAt.toISOString().slice(0,10)}</p></article>):<p className="muted">No source-backed records; unknown.</p>}</section>)}<h3>Releases</h3><p className="muted">Release metadata is not imported yet; version and release status are unknown.</p>{other.length>0&&<details><summary>Other imported claims ({other.length})</summary>{other.map(f=><article key={f.id}><p><b>{f.kind}</b>: {f.claim}</p><a className="source" href={f.sourceUrl} rel="noreferrer">Source ↗</a><p>{f.verification}</p></article>)}</details>}</section><section className="card"><span className="tag">Provenance</span><h3>Imported project claim</h3><p>{sources.length} source records. Observed {p.observedAt.toISOString().slice(0,10)}. Descriptions have not been independently verified.</p><a className="source" href={p.sourceUrl} rel="noreferrer">Inspect source ↗</a><p>Revision {p.revision.slice(0,12)}</p></section></aside></div>
 </>;
}
