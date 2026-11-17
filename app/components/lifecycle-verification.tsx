import type {candidateCapabilities,lifecycleEvidence,lifecycleVerificationRuns} from '../../lib/schema';

type Claim=typeof candidateCapabilities.$inferSelect;
type Run=typeof lifecycleVerificationRuns.$inferSelect;
type Evidence=typeof lifecycleEvidence.$inferSelect;

const safeSource=(raw:string)=>{try{const u=new URL(raw);return u.protocol==='https:'&&['github.com','raw.githubusercontent.com','talk.nervos.org','teapaw.org'].includes(u.hostname)?u.href:null}catch{return null}};
const date=(value:Date|null)=>value?value.toISOString().slice(0,10):'unknown';

export function LifecycleVerification({claims,runs,evidence}:{claims:Claim[];runs:Run[];evidence:Evidence[]}){
 if(!claims.length)return <section className="card"><span className="tag">Current-state verification</span><h2>Prior art and lifecycle</h2><p className="muted">No capability-scoped source refresh has been recorded for this opportunity yet.</p></section>;
 return <section className="card lifecycle-panel"><span className="tag">Current-state verification / capability scoped</span><h2>Prior art, progress and remaining work</h2>
  {claims.map(claim=>{
   const history=runs.filter(x=>x.capabilityId===claim.id);const latest=history[0];const sources=evidence.filter(x=>x.capabilityId===claim.id);
   let queried:{sources?:{url:string;fetchStatus:string;error?:string;revision?:string;publishedAt?:string;cache?:string}[]}={};try{queried=latest?JSON.parse(latest.queries):{}}catch{}
   return <article className="lifecycle-claim" key={claim.id}>
    <div className="row"><h3>{claim.capability}</h3><span className="tag">{claim.lifecycleState.replaceAll('_',' ')} · compatibility {claim.compatibilityState.replaceAll('_',' ')} · freshness {claim.freshness}</span></div>
    <p>{claim.summary}</p><p><strong>Unknown:</strong> {claim.uncertainty}</p><p><strong>Next action:</strong> {claim.nextAction}</p>
    <p className="muted">Last check: {latest?date(latest.checkedAt):'not checked'} · last fully fresh verification: {date(claim.lastVerifiedAt)}</p>
    {latest&&<><h4>Latest source refresh · {latest.result} / {latest.freshness}</h4><p>{latest.conclusion}</p>
     {!!queried.sources?.length&&<ul>{queried.sources.map((source,i)=>{const href=safeSource(source.url);return <li key={`${source.url}-${i}`}>{href?<a className="source" href={href} target="_blank" rel="noreferrer">{source.url}</a>:<span>{source.url}</span>} · {source.fetchStatus}{source.revision?` · ${source.revision.slice(0,12)}`:''}{source.error?` · ${source.error}`:''}{source.cache?` · cache ${source.cache}`:''}</li>})}</ul>}
    </>}
    {!!sources.length&&<><h4>Preserved evidence</h4>{sources.map(item=>{const href=safeSource(item.sourceUrl);return <div className="lifecycle-evidence" key={item.id}><span className="tag">{item.evidenceType.replaceAll('_',' ')} · {item.conclusion}</span><p>{item.excerpt}</p>{href&&<a className="source" href={href} target="_blank" rel="noreferrer">Inspect source ↗</a>}<p className="muted">Checked {date(item.checkedAt)}{item.publishedAt?` · source date ${date(item.publishedAt)}`:''}{item.revision?` · revision ${item.revision.slice(0,12)}`:''} · SHA-256 {item.sourceSha256}</p><p>{item.verification}</p></div>})}</>}
    {history.length>1&&<><h4>Verification history</h4><ul>{history.slice(1).map(run=><li key={run.id}>{date(run.checkedAt)} · {run.priorLifecycle.replaceAll('_',' ')} → {run.evaluatedLifecycle.replaceAll('_',' ')} · {run.result} / {run.freshness} · {run.conclusion}</li>)}</ul></>}
   </article>
  })}
  <p className="muted">Lifecycle state is separate from technical compatibility. A historical demonstration is not proof of current production readiness or adoption. A failed source refresh preserves the last recorded state and leaves freshness unresolved.</p>
 </section>
}
