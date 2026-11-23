import Link from 'next/link';
import {Fraunces, Geist} from 'next/font/google';
import {BuilderDeclarations} from '../components/builder-declarations';
import {SiteHeader} from '../components/site-header';
import {getProblemMapOverview} from '../../lib/problem-map-data';
import {PROBLEM_DOMAINS} from '../../lib/problem-map';
import {MapExplorer} from './world-explorer';
import '../home.css';
import './world.css';

const display=Fraunces({subsets:['latin'],style:['normal','italic'],variable:'--home-display',display:'swap'});
const ui=Geist({subsets:['latin'],variable:'--home-ui',display:'swap'});
export const dynamic='force-dynamic';

export default async function ProblemMapPage(){
 const overview=await getProblemMapOverview();
 const products=overview.projects.map(project=>({id:project.id,name:project.name,description:project.description,sourceUrl:project.sourceUrl,revision:project.revision,memberships:[...(overview.memberships.get(project.id)?.entries()??[])].map(([slug,evidence])=>({slug,evidence}))}));
 const domains=PROBLEM_DOMAINS.map(domain=>({slug:domain.slug,title:domain.title,summary:domain.summary}));
 return <div className={`home map-page ${display.variable} ${ui.variable}`}><SiteHeader/><div className="map-shell home-inner"><MapExplorer domains={domains} products={products}/><details className="map-declarations"><summary>Builder declarations</summary><BuilderDeclarations/></details></div><footer className="home-footer"><div className="home-footer-inner home-inner"><Link className="home-brand" href="/">trycove<span>●</span></Link><nav aria-label="Footer"><Link href="/projects">Projects</Link><Link href="/opportunities">Connections</Link><Link href="/trials">Trials</Link><Link href="/about">About</Link></nav></div></footer></div>
}
