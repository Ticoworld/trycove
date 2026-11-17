import Link from 'next/link';
import {and,asc,desc,eq,ilike,inArray,or} from 'drizzle-orm';
import {db} from '../../lib/db';
import {externalSourceSnapshots,footprintObservations,needItems,projectRepositories,projects,signals} from '../../lib/schema';
import {githubRepoPath,isCkbPulseLead,parsePulseState} from '../../lib/sources/pulse';

export const dynamic='force-dynamic';

const categories=[
 ['adoption','Adoption and first users'],
 ['distribution','Distribution and reach'],
 ['feature-request','Feature and capability requests'],
 ['infrastructure','Infrastructure and operations'],
 ['integration','Integrations'],
 ['product-feedback','Product feedback'],
 ['security','Security'],
 ['technical-review','Technical review'],
 ['user-testing','User testing'],
 ['validation','Technical validation'],
 ['unknown','Unclassified needs'],
] as const;

export default async function Page({searchParams}:{searchParams:Promise<{q?:string;needCategory?:string;category?:string}>}){
 const params=await searchParams;
 const q=params.q?.trim().slice(0,100)??'';
 const category=categories.some(([key])=>key===params.needCategory)?params.needCategory:'';
 const [categoryClaims,pulseChecks,pulseBodies,repoLinks,projectLinks]=await Promise.all([
  db.select({claim:signals.claim}).from(signals).where(eq(signals.kind,'product-category')),
  db.select({status:externalSourceSnapshots.status,checkedAt:externalSourceSnapshots.checkedAt}).from(externalSourceSnapshots).where(and(eq(externalSourceSnapshots.source,'ckb-pulse-state'),eq(externalSourceSnapshots.key,'state'))).orderBy(desc(externalSourceSnapshots.checkedAt)).limit(1),
  db.select().from(externalSourceSnapshots).where(and(eq(externalSourceSnapshots.source,'ckb-pulse-state'),eq(externalSourceSnapshots.key,'state'),eq(externalSourceSnapshots.status,'ok'))).orderBy(desc(externalSourceSnapshots.checkedAt)).limit(1),
  db.select({repository:projectRepositories.repository}).from(projectRepositories),db.select({repository:projects.repository}).from(projects),
 ]);
 const productCategories=[...new Set(categoryClaims.map(x=>x.claim.replace(/^CKBdapps category: /,'')))].sort((a,b)=>a.localeCompare(b));
 let pulseState:ReturnType<typeof parsePulseState>|null=null;try{if(pulseBodies[0]?.raw)pulseState=parsePulseState(pulseBodies[0].raw)}catch{}
 const linkedPaths=new Set([...repoLinks.map(x=>githubRepoPath(x.repository)),...projectLinks.map(x=>x.repository?githubRepoPath(x.repository):null)].filter((x):x is string=>Boolean(x)));
 const identityRows=linkedPaths.size?await db.select().from(externalSourceSnapshots).where(and(eq(externalSourceSnapshots.source,'github-repository-identity'),inArray(externalSourceSnapshots.key,[...linkedPaths]))).orderBy(desc(externalSourceSnapshots.checkedAt)):[];const seenAliases=new Set<string>();for(const row of identityRows){if(seenAliases.has(row.key))continue;seenAliases.add(row.key);if(row.status!=='ok'||!row.raw)continue;try{const identity=JSON.parse(row.raw) as {id?:unknown;full_name?:unknown};if(Number.isSafeInteger(identity.id)&&typeof identity.full_name==='string')linkedPaths.add(identity.full_name.toLowerCase())}catch{}}
 const pulseLeads=pulseState?.repos.filter(isCkbPulseLead).filter(repo=>!linkedPaths.has(repo.name.toLowerCase())).sort((a,b)=>(b.n24??0)-(a.n24??0)||a.name.localeCompare(b.name)).slice(0,9)??[];
 const pulseCheckStale=Boolean(pulseChecks[0]&&pulseChecks[0].status!=='ok'&&pulseChecks[0].status!=='not_modified');
 const productCategory=productCategories.includes(params.category??'')?params.category:'';
 const pattern=`%${q.replace(/[%_\\]/g,'\\$&')}%`;
 const [signalMatches,needMatches,footprintMatches,categoryMatches,productCategoryMatches]=await Promise.all([
  q?db.select({id:signals.projectId}).from(signals).where(or(ilike(signals.claim,pattern),ilike(signals.concept,pattern))):Promise.resolve([]),
  q?db.select({id:needItems.projectId}).from(needItems).where(or(ilike(needItems.excerpt,pattern),ilike(needItems.category,pattern),ilike(needItems.stance,pattern))):Promise.resolve([]),
  q?db.select({id:footprintObservations.projectId}).from(footprintObservations).where(or(ilike(footprintObservations.fact,pattern),ilike(footprintObservations.evidence,pattern))).limit(2000):Promise.resolve([]),
  category?db.select({id:needItems.projectId}).from(needItems).where(eq(needItems.category,category)):Promise.resolve([]),
  productCategory?db.select({id:signals.projectId}).from(signals).where(and(eq(signals.kind,'product-category'),eq(signals.claim,`CKBdapps category: ${productCategory}`))):Promise.resolve([]),
 ]);
 const signalIds=[...new Set([...signalMatches.map(x=>x.id),...needMatches.map(x=>x.id),...footprintMatches.map(x=>x.id)])];
 const categoryIds=[...new Set(categoryMatches.map(x=>x.id))];
 const productCategoryIds=[...new Set(productCategoryMatches.map(x=>x.id))];
 const searchCondition=q?or(ilike(projects.name,pattern),ilike(projects.description,pattern),...(signalIds.length?[inArray(projects.id,signalIds)]:[])):undefined;
 const categoryCondition=category?inArray(projects.id,categoryIds):undefined;
 const productCategoryCondition=productCategory?inArray(projects.id,productCategoryIds):undefined;
 const rows=(category&&categoryIds.length===0||productCategory&&productCategoryIds.length===0)?[]:await db.select().from(projects).where(and(searchCondition,categoryCondition,productCategoryCondition)).orderBy(asc(projects.name)).limit(300);
 return <>
  <section className="hero"><div className="eyebrow">Explore · CKB Product Hub</div><h1>Find products by what they do.</h1><p>Search imported product claims, source-observed interfaces and builder needs. A category helps you browse; it is not evidence of compatibility.</p>
   <form className="search"><input name="q" defaultValue={q} placeholder="Search products, capabilities, needs or dependencies" aria-label="Search products, capabilities, needs or dependencies"/><select name="category" defaultValue={productCategory} aria-label="Filter by product purpose"><option value="">All product purposes</option>{productCategories.map(name=><option value={name} key={name}>{name}</option>)}</select><select name="needCategory" defaultValue={category} aria-label="Filter by builder need"><option value="">All builder needs</option>{categories.map(([key,label])=><option value={key} key={key}>{label}</option>)}</select><button>Search / 搜索</button></form>
   <span className="muted">{rows.length} products shown{productCategory?` · purpose ${productCategory}`:''}{category?` · need ${categories.find(([key])=>key===category)?.[1]}`:''}</span>
  </section>
  <section className="section"><div className="eyebrow">Pulse · repository discovery leads</div><h2>Tracked repositories without a product match</h2><p className="muted">These CKB-marked Pulse repositories are not yet linked to a canonical product. They are review leads only; activity does not prove functionality or adoption.</p>{pulseState?<p className="muted">Last successful Pulse state: {pulseState.now} · CKB Pulse source snapshot {pulseBodies[0]?.sourceRevision?.slice(0,12)??'unknown'}{pulseCheckStale?' · the latest check failed; this retained state may be stale.':''}</p>:<p className="muted">Pulse state is unavailable or not imported. Repository coverage is unknown.</p>}{pulseLeads.length?<div className="grid">{pulseLeads.map(lead=><article className="card" key={lead.name}><span className="tag">Pulse lead · product identity unresolved</span><h3>{lead.name}</h3><p>{lead.desc||'Pulse has no repository description.'}</p><p>{(lead.tags??[]).join(' · ')} · last event {lead.lastAt??'unknown'} ({lead.lastKind??'unknown'}).</p><a className="source" href={`https://github.com/${lead.name}`} rel="noreferrer">Inspect repository ↗</a></article>)}</div>:pulseState?<p className="muted">No unlinked repository meets the CKB markers in this retained state. No missing product is inferred from that result.</p>:null}</section>
  <section className="section"><div className="grid">{rows.map(project=><Link href={`/projects/${encodeURIComponent(project.id)}`} className="card" key={project.id}><span className="tag">Product Passport</span><h3>{project.name}</h3><p>{project.description||'No description supplied by the primary product record.'}</p><span className="arrow">Inspect purpose and interfaces →</span></Link>)}</div>{!rows.length&&<p>No products found. Try a different purpose or search term.</p>}</section>
 </>;
}
