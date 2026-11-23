import Link from 'next/link';
import {asc} from 'drizzle-orm';
import {db} from '../lib/db';
import {projects} from '../lib/schema';
import './home.css';

export const dynamic = 'force-dynamic';

function Story() {
 return <div className="home-story-art" role="img" aria-label="An imagined story: a builder makes a product, someone needs it, they try it together, and record feedback.">
  <svg viewBox="0 0 1000 250" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
   <g stroke="#29263b" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
    <path fill="#f8cb61" d="M4 10h230v230H4z"/><path fill="#fb907d" d="M252 10h230v230H252z"/><path fill="#b7a8ef" d="M500 10h230v230H500z"/><path fill="#81d4e4" d="M748 10h248v230H748z"/>
    <path fill="#fff8e8" d="M30 168h180v42H30zM52 65h100v78H52z"/><path fill="#81d4e4" d="M64 78h76v50H64z"/><path fill="none" d="M80 101h43m-21-20v40"/><circle fill="#f4b79f" cx="171" cy="107" r="25"/><path fill="#29263b" d="M148 103q-4-37 27-31 24 4 21 28-16-17-48 3z"/><path fill="#fff8e8" d="M145 171q0-42 27-42t30 42z"/><path fill="none" d="M149 145l-28 17"/>
    <circle fill="#f4b79f" cx="327" cy="124" r="26"/><path fill="#29263b" d="M302 120q0-35 25-35 28 0 27 32-18-15-52 3z"/><path fill="#fff8e8" d="M293 205q1-53 34-53t35 53z"/><path fill="#fff8e8" d="M370 39h81v65h-37l-19 15 2-15h-27z"/><path fill="none" d="M390 70h40m-20-20v40"/>
    <path fill="#fff8e8" d="M545 71h135v112H545z"/><path fill="#81d4e4" d="M559 84h107v72H559z"/><path fill="none" d="M592 119l14 14 30-31"/><circle fill="#f4b79f" cx="536" cy="172" r="22"/><path fill="#f4b79f" d="M517 205q1-20 20-20t21 20z"/><circle fill="#f4b79f" cx="690" cy="172" r="22"/><path fill="#f4b79f" d="M670 205q1-20 20-20t22 20z"/>
    <path fill="#fff8e8" d="M813 41h112v155H813z"/><path fill="none" d="M837 78h64m-64 25h64m-64 25h35"/><path fill="#f8cb61" d="M866 149l14 13 27-32"/><circle fill="#f4b79f" cx="796" cy="165" r="22"/><path fill="#29263b" d="M775 162q-2-28 22-27 23 2 21 25-17-12-43 2z"/><path fill="#fff8e8" d="M768 216q0-31 28-31t29 31z"/>
   </g>
  </svg>
 </div>;
}
export default async function Home(){
 const products=await db.select({id:projects.id,name:projects.name,description:projects.description}).from(projects).orderBy(asc(projects.name)).limit(3);
 return <div className="home">
  <section className="home-hero"><div className="home-copy"><span className="home-star" aria-hidden="true">✳</span><h1>It&apos;s built.<br/><em>Now what?</em></h1><p>Find projects, make connections, and try something real.</p><div className="home-actions"><Link className="home-primary" href="/projects">Explore projects <span>↗</span></Link><Link className="home-secondary" href="/trials">Find a trial ↗</Link></div></div>
   <div className="home-world"><img src="/home-districts.svg" alt=""/><Link className="district payments" href="/map/payments-checkout">Payments ↗</Link><Link className="district trade" href="/map/trading-markets">Trade &amp; swap ↗</Link><Link className="district fiber" href="/projects?q=Fiber">Fiber ↗</Link><Link className="district build" href="/map/developer-tools">Build apps ↗</Link></div>
  </section>
  <section className="home-story"><div className="home-story-heading"><div><span>From idea to feedback</span><h2>See what happens next.</h2></div><Link href="/opportunities">Explore connections ↗</Link></div><Story/><p className="home-story-note">An illustrated example</p></section>
  <section className="home-discover"><div className="home-discover-heading"><div><span>Take a closer look</span><h2>Projects to explore</h2></div><Link href="/projects">All projects ↗</Link></div><div className="home-products">{products.map((p,i)=><Link href={`/projects/${encodeURIComponent(p.id)}`} className={`home-product product-${i}`} key={p.id}><span>Project</span><h3>{p.name}</h3><p>{p.description || 'Open the project to explore its source records.'}</p><b>View project ↗</b></Link>)}{!products.length && <p>No projects have been imported yet.</p>}</div><Link className="home-trial" href="/trials"><span>Ready to try something?</span><strong>Find a trial <b>↗</b></strong></Link></section>
 </div>;
}
