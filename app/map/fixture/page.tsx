import {notFound} from 'next/navigation';
import {Fraunces, Geist} from 'next/font/google';
import {PROBLEM_DOMAINS} from '../../../lib/problem-map';
import {SiteHeader} from '../../components/site-header';
import {MapExplorer, type Product} from '../world-explorer';
import '../../home.css';
import '../world.css';
const display=Fraunces({subsets:['latin'],style:['normal','italic'],variable:'--home-display',display:'swap'});
const ui=Geist({subsets:['latin'],variable:'--home-ui',display:'swap'});
const evidence=(label:string)=>[{kind:'directory-category' as const,label,sourceUrl:'https://example.com/',verification:'synthetic test evidence'}];
const products:Product[]=[
 {id:'fixture-one',name:'Fixture payment tool',description:'Synthetic record for visual testing only.',sourceUrl:'https://example.com/',revision:'test',memberships:[{slug:'payments-checkout',evidence:evidence('Payment')},{slug:'developer-tools',evidence:evidence('Dev Tools')}]},
 ...Array.from({length:3},(_,i)=>({id:`fixture-community-${i}`,name:`Fixture community ${i+1}`,description:'Synthetic community example for visual testing.',sourceUrl:'https://example.com/',revision:'test',memberships:[{slug:'funding-community',evidence:evidence('Community')}]})),
 ...Array.from({length:12},(_,i)=>({id:`fixture-market-${i}`,name:`Fixture market ${i+1}`,description:'Synthetic test project, not an ecosystem record.',sourceUrl:'https://example.com/',revision:'test',memberships:[{slug:'trading-markets',evidence:evidence('DEX')}]})),
 {id:'fixture-unmapped',name:'Fixture unmapped',description:'Synthetic record without a supported group.',sourceUrl:'',revision:'test',memberships:[]},
];
export default function FixturePage(){if(process.env.NODE_ENV==='production')notFound();return <div className={`home map-page ${display.variable} ${ui.variable}`}><SiteHeader/><div className="map-shell home-inner"><p><strong>Isolated synthetic test fixture — not public project data.</strong></p><MapExplorer domains={PROBLEM_DOMAINS.map(({slug,title,summary})=>({slug,title,summary}))} products={products}/><section className="fixture-records" aria-label="Synthetic evidence examples"><h2>Synthetic evidence examples</h2><p><strong>Documented need:</strong> A fictional application needs a checkout capability.</p><p><strong>Saved proposal · unverified:</strong> The fictional builder may consider Fixture payment tool. Compatibility and any introduction remain unknown.</p></section></div></div>}
