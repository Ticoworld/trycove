import Link from 'next/link';
import {asc,eq} from 'drizzle-orm';
import {db} from '../lib/db';
import {projects,signals} from '../lib/schema';

export const dynamic='force-dynamic';

export default async function Home(){
 const [products,categories]=await Promise.all([
  db.select({id:projects.id,name:projects.name,description:projects.description}).from(projects).orderBy(asc(projects.name)).limit(8),
  db.select({concept:signals.concept,claim:signals.claim,projectId:signals.projectId}).from(signals).where(eq(signals.kind,'product-category')),
 ]);
 const projectsByCategory=new Map<string,Set<string>>();for(const row of categories){const set=projectsByCategory.get(row.claim.replace(/^CKBdapps category: /,''))??new Set<string>();set.add(row.projectId);projectsByCategory.set(row.claim.replace(/^CKBdapps category: /,''),set)}
 const purposes=[...projectsByCategory.entries()].map(([name,ids])=>({name,count:ids.size})).sort((a,b)=>b.count-a.count||a.name.localeCompare(b.name)).slice(0,8);
 return <>
  <section className="hero"><div className="eyebrow">Trycove · CKB Product Hub</div><h1>Test CKB products and find builder connections.</h1><p>Testers can try real tasks in guided rooms and report where they get stuck. Builders can put products in front of testers through organizer-published rooms and find complementary products through documented needs and capabilities.</p><div className="bar"><Link className="button" href="/trials">Explore products to test</Link><Link className="button secondary" href="/map">Explore problems and connections</Link></div></section>
  <section className="section"><div className="section-head"><div><div className="eyebrow">Explore by purpose</div><h2>Products across the ecosystem</h2></div><Link className="source" href="/projects">All product passports ↗</Link></div><p className="muted">Categories are imported from CKBdapps. They help locate products; a shared category does not establish a technical connection.</p><div className="grid">{purposes.map(category=><Link className="card" href={`/projects?category=${encodeURIComponent(category.name)}`} key={category.name}><span className="tag">Imported functional category</span><h3>{category.name}</h3><p>{category.count} source-listed product{category.count===1?'':'s'}</p><span className="arrow">Explore this purpose →</span></Link>)}</div>{!purposes.length&&<p className="muted">Product category claims have not been imported.</p>}</section>
  <section className="section"><div className="section-head"><div><div className="eyebrow">Product Passports</div><h2>Open a product and inspect its evidence</h2></div><Link className="source" href="/projects">Browse all products ↗</Link></div><div className="grid">{products.map(product=><Link className="card" href={`/projects/${encodeURIComponent(product.id)}`} key={product.id}><span className="tag">Source-linked product</span><h3>{product.name}</h3><p>{product.description||'Purpose is not described in the primary project record.'}</p><span className="arrow">Open Passport →</span></Link>)}</div></section>
  <section className="section"><div className="eyebrow">From capability to proof</div><h2>Connection work stays inspectable</h2><div className="grid"><Link className="card" href="/opportunities"><span className="tag">Connect</span><h3>Investigate relationships</h3><p>See the specific interface boundary, source revision, compatibility assumptions and prior-work checks behind a candidate.</p></Link><Link className="card" href="/trials"><span className="tag">Try</span><h3>Find a guided trial</h3><p>Review what a trial asks you to do, what you need to start, and how to share feedback.</p></Link><Link className="card" href="/results"><span className="tag">Results</span><h3>See what happened</h3><p>Review saved receipts and follow-up records without treating a demo, activity count or prepared action as adoption.</p></Link></div></section>
 </>;
}
