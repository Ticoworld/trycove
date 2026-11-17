import Link from 'next/link';
import {and,asc,eq,ilike,inArray,or} from 'drizzle-orm';
import {db} from '../../lib/db';
import {needItems,projects,signals} from '../../lib/schema';

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

export default async function Page({searchParams}:{searchParams:Promise<{q?:string;needCategory?:string}>}){
 const params=await searchParams;
 const q=params.q?.trim().slice(0,100)??'';
 const category=categories.some(([key])=>key===params.needCategory)?params.needCategory:'';
 const pattern=`%${q.replace(/[%_\\]/g,'\\$&')}%`;
 const [signalMatches,needMatches,categoryMatches]=await Promise.all([
  q?db.select({id:signals.projectId}).from(signals).where(or(ilike(signals.claim,pattern),ilike(signals.concept,pattern))):Promise.resolve([]),
  q?db.select({id:needItems.projectId}).from(needItems).where(or(ilike(needItems.excerpt,pattern),ilike(needItems.category,pattern),ilike(needItems.stance,pattern))):Promise.resolve([]),
  category?db.select({id:needItems.projectId}).from(needItems).where(eq(needItems.category,category)):Promise.resolve([]),
 ]);
 const signalIds=[...new Set([...signalMatches.map(x=>x.id),...needMatches.map(x=>x.id)])];
 const categoryIds=[...new Set(categoryMatches.map(x=>x.id))];
 const searchCondition=q?or(ilike(projects.name,pattern),ilike(projects.description,pattern),...(signalIds.length?[inArray(projects.id,signalIds)]:[])):undefined;
 const categoryCondition=category?inArray(projects.id,categoryIds):undefined;
 const rows=category&&categoryIds.length===0?[]:await db.select().from(projects).where(and(searchCondition,categoryCondition)).orderBy(asc(projects.name)).limit(300);
 return <>
  <section className="hero"><div className="eyebrow">Ecosystem / 项目</div><h1>Find your next collaborator.</h1><p>Explore projects imported from public ecosystem sources. Descriptions are source claims, not independent verification.</p>
   <form className="search"><input name="q" defaultValue={q} placeholder="Search projects, capabilities and needs" aria-label="Search projects, capabilities and needs"/><select name="needCategory" defaultValue={category} aria-label="Filter by builder need"><option value="">All builder needs</option>{categories.map(([key,label])=><option value={key} key={key}>{label}</option>)}</select><button>Search / 搜索</button></form>
   <span className="muted">{rows.length} projects shown{category?` · filtered by ${categories.find(([key])=>key===category)?.[1]}`:''}</span>
  </section>
  <section className="section"><div className="grid">{rows.map(project=><Link href={`/projects/${encodeURIComponent(project.id)}`} className="card" key={project.id}><span className="tag">Sourced project</span><h3>{project.name}</h3><p>{project.description||'No description supplied by this source.'}</p><span className="arrow">View project →</span></Link>)}</div>{!rows.length&&<p>No projects found. Try another search or need category.</p>}</section>
 </>;
}
