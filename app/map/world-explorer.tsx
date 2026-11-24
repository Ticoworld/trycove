'use client';

import Link from 'next/link';

import {useEffect,useMemo,useRef,useState} from 'react';
import type {CSSProperties} from 'react';
import {motion, useReducedMotion} from 'motion/react';

import type {ClassificationEvidence} from '../../lib/problem-map';



export type Domain={slug:string;title:string;summary:string};

export type Product={id:string;name:string;description:string;sourceUrl:string;revision:string;memberships:{slug:string;evidence:ClassificationEvidence[]}[]};

type Props={domains:Domain[];products:Product[]};

const labels:Record<string,string>={'payments-checkout':'Payments','trading-markets':'Trading','accounts-identity':'Identity','developer-tools':'Build apps','chain-data-indexing':'Chain data','funding-community':'Funding','contract-safety':'Safety','digital-assets':'Digital assets','cross-chain':'Cross-chain'};

const places:Record<string,{x:number;y:number;color:string;kind:number}>={'payments-checkout':{x:110,y:260,color:'#f8cb61',kind:0},'trading-markets':{x:390,y:135,color:'#fb907d',kind:1},'accounts-identity':{x:680,y:210,color:'#b7a8ef',kind:2},'developer-tools':{x:890,y:380,color:'#81d4e4',kind:3},'chain-data-indexing':{x:660,y:475,color:'#f8cb61',kind:4},'funding-community':{x:365,y:435,color:'#f4b39e',kind:5},'contract-safety':{x:115,y:510,color:'#a6d4c5',kind:6},'digital-assets':{x:930,y:120,color:'#d5bce9',kind:7},'cross-chain':{x:550,y:640,color:'#9bcfd5',kind:8}};

const grounds=['M-95 65L-100-40Q-72-83-15-70L63-76 100-35 98 66Z','M-96 66L-90-59 0-85 92-58 99 65Z','M-99 67Q-109-7-63-59T62-62Q105-20 100 67Z','M-102 64L-97-38 -25-80 70-70 103-26 100 64Z','M-96 64Q-98-62 0-76T99 64Z','M-100 65L-96-45 -48-73 22-63 89-72 101 65Z','M-101 66L-89-55 -26-77 62-70 100-35 98 66Z','M-101 66L-101-54 -68-75 93-75 101 66Z','M-105 66Q-95-46-50-55Q0-82 53-55 97-43 105 66Z'];

function Landmark({kind}:{kind:number}){switch(kind){

 case 0:return <g><path d="M-100 35H100v20h-200zM-70 55v35m140-35v35M-76 35V5h85v30" fill="#d89c62"/><path d="M-60 5v-40h55V5z" fill="#f8cb61"/><rect x="-50" y="-27" width="35" height="20" rx="2" fill="#fff8e8"/><path d="M-39-17h13M-52 4h39M20 35V-4q0-28 28-28t28 28v39M35-3h26M49-16v26"/><circle cx="48" cy="-4" r="22" fill="#81d4e4"/><path d="M-90 69h180"/></g>;

 case 1:return <g><path d="M-90 48h180v16H-90zM-82 48v-58h112v58" fill="#fb907d"/><path d="M-91-10l18-42h95l17 42z" fill="#fb907d"/><path d="M-60-52v42m34-42v42M-72-7h92v55h-92z" fill="#fff8e8"/><path d="M-65 30h78M-55 30V12h14v18m10 0V5h14v25m10 0V16H7v14M50 50V-2h35v52M44-2h48l-8-26H52z" fill="#f8cb61"/><circle cx="67" cy="18" r="8" fill="#f8cb61"/></g>;

 case 2:return <g><path d="M-80 62V-8q0-65 80-65T80-8v70H43V0q0-37-43-37T-43 0v62z" fill="#b7a8ef"/><path d="M-95 62h190M-60 62v-70q0-50 60-50t60 50v70M-6-57h12v20H-6z"/></g>;

 case 3:return <g><path d="M-90 52h180v15H-90zM-75 52v-70l52-37h85l18 37v70" fill="#81d4e4"/><path d="M-75-18h155M-35-55v37M-52 12h59v40h-59zM-43 22h40M35 52V10h30v42" fill="#fff8e8"/><path d="M-86-35l22 15m-17-25 22 15M40-35h24M48-43v16"/><path d="M-19 10v-15h25v15M-40 20v21m-7-15 7-7 7 7m12-6v21m-5-21h10"/></g>;

 case 4:return <g><path d="M-78 57h156M-52 57V5q0-47 52-47T52 5v52z" fill="#f8cb61"/><path d="M-52 5h104M-22 57V22h44v35M0-42v-27M-30-54l60-22M-7-80l17 14"/><circle cx="30" cy="-76" r="10" fill="#fb907d"/><path d="M-65 57v16h130V57"/></g>;

 case 5:return <g><path d="M-95 40L0 10l95 30-95 30z" fill="#f5b2a4"/><path d="M-72 41L0 19l72 22-72 21z" fill="#fff8e8"/><path d="M-43 27v-36h86v36M-50-9L0-49 50-9z" fill="#f8cb61"/><path d="M-19 27V3h38v24M-74 41l-14 12m162-12 14 12"/><circle cy="-23" r="7" fill="#fb907d"/></g>;

 case 6:return <g><path d="M-87 57h174M-70 57v-71h140v71M-80-14l24-34h112l24 34" fill="#a6d4c5"/><path d="M-39 57V4h78v53M-50-48v34m100-34v34"/></g>;

 case 7:return <g><path d="M-88 56h176M-75 56v-68h150v68M-85-12l20-35h130l20 35" fill="#d5bce9"/><path d="M-53-12v68M53-12v68M-36 12h72v37h-72z" fill="#fff8e8"/><path d="M-54-31h108"/></g>;

 default:return <g><path d="M-105 42h210v15h-210z" fill="#d89c62"/><path d="M-90 42q0-75 90-75t90 75M-70 42v-43m140 43V-1M-35 42v-64m70 64v-64M-105 22h210"/><path d="M-102 73q15-9 30 0t30 0m84 0q15-9 30 0t30 0" stroke="#5aaabb"/></g>;

}}

function Mechanism({kind}:{kind:number}) {
 const shapes = [
  <g key="receipt"><path d="M-48 5h31v32l-5-4-5 4-5-4-5 4-5-4-6 4z" fill="#fffaf0"/><path d="M-43 13h21m-21 7h18m-18 7h15"/></g>,
  <g key="awning"><path d="M-72-7h92v55h-92z" fill="#e57e6d"/><path d="M-69 4h86m-86 10h86m-86 10h86m-86 10h86"/></g>,
  <g key="lock"><path d="M-39 60V2q0-34 39-34t39 34v58z" fill="#b7a8ef"/><path d="M0-32v92"/><path d="M48 8v-8q0-12 10-12t10 12" fill="none"/><rect x="48" y="8" width="20" height="25" fill="#f8cb61"/><circle cx="58" cy="18" r="3" fill="#29263b"/></g>,
  <g key="tools"><path d="M-52 12h59v40h-59z" fill="#d89c62"/><path d="M-48 22h51m-51 10h51m-51 10h51"/></g>,
  <g key="signal" fill="none"><path d="M43-89q13 13 0 26M52-98q23 22 0 44" stroke="#b14d48"/></g>,
  <g key="proposal"><path d="M-18-34h36v42h-36z" fill="#fffaf0"/><path d="M-11-24h22m-22 8h22m-22 8h15"/></g>,
  <g key="shield"><path d="M0-2l25 9v16q0 17-25 29-25-12-25-29V7z" fill="#fff8e8"/><path d="M-9 21l7 7 13-15"/></g>,
  <g key="art"><path d="M-36 12h72v37h-72z" fill="#fff8e8"/></g>,
  <g key="bridge"><path d="M0 42h105v15H0z" fill="#d89c62"/><path d="M0 22h105M35 22v20m35-20v20"/></g>,
 ];
 return <g className="place-mechanism">{shapes[kind]}</g>;
}

function safeSource(url:string){try{const u=new URL(url);return u.protocol==='https:'&&!u.username&&!u.password?u.href:null}catch{return null}}

function reasonLabel(reason:ClassificationEvidence){switch(reason.kind){case 'directory-category':return `Directory category claim: ${reason.label}`;case 'source-intent':return `Structured source scope: ${reason.label}`;case 'source-claim':return `Source claim: ${reason.label}`;default:return `Recorded capability: ${reason.label}`}}

export function MapExplorer({domains,products}:Props){

 const reducedMotion=useReducedMotion();
 const panelRef=useRef<HTMLElement>(null);
 const [visibleResults,setVisibleResults]=useState(5);const [region,setRegion]=useState('');const [project,setProject]=useState('');const [query,setQuery]=useState('');const [browse,setBrowse]=useState(false);const [mobile,setMobile]=useState(false);const [fullMap,setFullMap]=useState(false);

 useEffect(()=>{const media=window.matchMedia('(max-width: 800px)');const sync=()=>setMobile(media.matches);sync();media.addEventListener('change',sync);return()=>media.removeEventListener('change',sync)},[]);

 useEffect(()=>{const sync=()=>{const p=new URLSearchParams(window.location.search);const slug=p.get('region')??'';setRegion(slug);setProject(p.get('project')??'');setFullMap(p.get('view')==='world');setQuery('');setBrowse(false)};sync();window.addEventListener('popstate',sync);return()=>window.removeEventListener('popstate',sync)},[domains]);

 useEffect(()=>{if(panelRef.current)panelRef.current.scrollTop=0},[region,project]);

 const validRegion=region==='unclassified'||domains.some(d=>d.slug===region);const selected=validRegion?region:'';const current=domains.find(d=>d.slug===selected);const regionProducts=useMemo(()=>products.filter(p=>selected==='unclassified'?p.memberships.length===0:p.memberships.some(m=>m.slug===selected)),[products,selected]);

 const chosen=regionProducts.find(p=>p.id===project);const needle=query.trim().toLocaleLowerCase();const categoryNeedle=needle==='wallets'?'wallet':needle;const matches=useMemo(()=>needle?products.filter(p=>`${p.name} ${p.description}`.toLocaleLowerCase().includes(needle)||p.memberships.some(m=>m.evidence.some(e=>e.kind==='directory-category'&&e.label.toLocaleLowerCase()===categoryNeedle))):[],[products,needle,categoryNeedle]);const technologyAreas:Record<string,string>={fiber:'payments-checkout',dex:'trading-markets',wallets:'accounts-identity','rgb++':'digital-assets'};const matchingAreas=needle?domains.filter(d=>`${d.title} ${labels[d.slug]??''}`.toLocaleLowerCase().includes(needle)||technologyAreas[needle]===d.slug):[];

 const setState=(nextRegion:string,nextProject='',showWorld=false)=>{const params=new URLSearchParams();if(nextRegion)params.set('region',nextRegion);if(nextProject)params.set('project',nextProject);if(showWorld)params.set('view','world');window.history.pushState(null,'',`${window.location.pathname}${params.size?`?${params}`:''}`);setRegion(nextRegion);setProject(nextProject);setFullMap(showWorld);setQuery('');setBrowse(false)};

 const openProduct=(p:Product)=>setState(p.memberships.find(m=>m.evidence.some(e=>e.kind==='directory-category'&&e.label.toLocaleLowerCase()===categoryNeedle))?.slug??p.memberships[0]?.slug??'unclassified',p.id);

 const mobileIndex=domains.findIndex(d=>d.slug===selected);
 const activePlace=mobile&&!fullMap?places[selected]:undefined;

 return <div style={{'--district-accent':places[selected]?.color??'#b7a8ef'} as CSSProperties} className={`map-explorer ${needle||selected||browse?'has-panel':''} ${selected&&!needle?'has-district':''}`} onKeyDown={e=>{if(e.key==='Escape'&&(needle||selected||browse)){setState('');setBrowse(false);document.getElementById('world-search')?.focus()}}}><div className="map-toolbar"><label className="sr-only" htmlFor="world-search">Search projects or areas</label><input id="world-search" type="search" placeholder="Search projects or areas" value={query} onChange={e=>{setQuery(e.target.value);setVisibleResults(5);setBrowse(false)}}/><button onClick={()=>{setState('');setBrowse(!browse)}} aria-expanded={browse}>Browse areas</button><button onClick={()=>setState('unclassified')}>Unmapped <span>{products.filter(p=>!p.memberships.length).length}</span></button><Link href="/projects">Project catalog</Link></div><aside ref={panelRef} id="map-inspector" style={{borderTopColor:places[selected]?.color}} className={`map-panel ${needle||selected||browse?'panel-open':''}`} aria-label="Discover projects"><div className="map-panel-header">{selected&&!needle&&!chosen&&<div className="map-district-heading"><h2>{current?.title??'Unmapped projects'}</h2><p>{regionProducts.length} {regionProducts.length===1?'project':'projects'}</p></div>}<button className="map-close" aria-label="Close discovery panel" onClick={()=>{setQuery('');setState('');setBrowse(false);document.getElementById('world-search')?.focus()}}>×</button></div>

 {needle?<div className="map-results" aria-live="polite"><h2>Search results</h2>{technologyAreas[needle]&&<p>Area results are broader problem groups; project matches require an exact recorded directory category.</p>}{matchingAreas.map(d=><button className="map-row" key={d.slug} onClick={()=>setState(d.slug)}><span><svg className="result-landmark" viewBox="-110 -95 220 185" aria-hidden="true"><g fill="none" stroke="#29263b" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round"><Landmark kind={places[d.slug]?.kind??0}/></g></svg>{d.title}</span><small>{products.filter(p=>p.memberships.some(m=>m.slug===d.slug)).length} projects · Area</small></button>)}{matches.slice(0,visibleResults).map(p=><button className="map-row" key={p.id} onClick={()=>openProduct(p)}><span><i className="map-mark neutral" aria-hidden="true"/>{p.name}<small className="result-description">{p.description}</small></span><small>Project</small></button>)}{matches.length>visibleResults&&<button className="map-more" onClick={()=>setVisibleResults(n=>n+5)}>Show more projects ({matches.length-visibleResults} remaining)</button>}{!matches.length&&!matchingAreas.length&&<p>No matching projects or areas.</p>}<Link className="map-text-link" href={`/projects?q=${encodeURIComponent(query.trim())}`}>Search the full catalog</Link></div>

 :chosen?<div className="map-results map-passport"><button className="map-back" onClick={()=>setState(selected)}>Back to {current?.title??'unmapped projects'}</button><span className="map-overline">Product passport · Preview</span><h2>{chosen.name}</h2><p>{chosen.description||'No description is available in the project record.'}</p><p className="map-caveat">Historical listing · Current availability unknown</p><h3>{current?.title??'Unmapped projects'}</h3>{selected==='unclassified'?<p>No supported problem-group placement is recorded.</p>:<div><p>{reasonLabel(chosen.memberships.find(m=>m.slug===selected)?.evidence[0]??{kind:'source-claim',label:'No placement reason available'})}</p><details className="map-evidence"><summary>Source details</summary><ul className="map-reasons">{(chosen.memberships.find(m=>m.slug===selected)?.evidence??[]).map((r,i)=><li key={i}>{reasonLabel(r)}{r.verification?` · ${r.verification}`:''}{r.opportunityId&&<> <Link href={`/opportunities/${encodeURIComponent(r.opportunityId)}`}>Saved record</Link></>}{r.sourceUrl&&safeSource(r.sourceUrl)&&<> <a href={safeSource(r.sourceUrl)!} target="_blank" rel="noreferrer">Source</a></>}</li>)}</ul></details></div>}<p className="map-caveat">A placement is a source-backed starting point; it does not establish compatibility.</p><Link className="map-primary" href={`/projects/${encodeURIComponent(chosen.id)}`}>Open Product Passport</Link>{safeSource(chosen.sourceUrl)&&<p><a className="map-text-link" href={safeSource(chosen.sourceUrl)!} target="_blank" rel="noreferrer">Project source</a></p>}</div>

 :selected?<div className="map-results"><button className="map-back" onClick={()=>{setState('');setBrowse(true)}}>All areas</button><div key={selected} className="district-portrait" style={{background:places[selected]?.color}}>{places[selected]&&<svg className="map-place selected" data-kind={places[selected].kind} viewBox="-110 -95 220 185" aria-hidden="true"><g fill="none" stroke="#29263b" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"><Landmark kind={places[selected].kind}/><Mechanism kind={places[selected].kind}/></g></svg>}</div><span className="map-overline">Explore the district</span>{regionProducts.length?<div className="map-list">{regionProducts.map(p=><button className="map-row project-row" key={p.id} onClick={()=>setState(selected,p.id)}><span><i className="map-mark neutral" aria-hidden="true"/>{p.name}</span><small>{p.description||'Open project preview'}</small></button>)}</div>:<div><h3>Nothing mapped here yet.</h3><p>No supported placements are recorded. Relevant products may exist elsewhere.</p></div>}<Link className="map-text-link" href={selected==='unclassified'?'/map/unclassified':`/map/${selected}`}>View detailed area</Link><Link className="map-text-link" href="/projects">Search all projects</Link></div>

 :browse?<div className="map-results"><div className="map-list-heading"><h2>Explore areas</h2><span>{products.length} {products.length===1?'project':'projects'}</span></div>{!products.length&&<p>No product records are currently available.</p>}<div className="map-list">{domains.map(d=>{const count=products.filter(p=>p.memberships.some(m=>m.slug===d.slug)).length;return <button className="map-row" key={d.slug} onClick={()=>setState(d.slug)}><span>{d.title}</span><small>{count}</small></button>})}</div><button className="map-unmapped" onClick={()=>setState('unclassified')}>Unmapped projects <span>{products.filter(p=>!p.memberships.length).length}</span></button><p className="map-caveat">Areas are browsing groups, not verified connections.</p></div>:null}

 </aside><section className="map-landscape" aria-label="Illustrated product world"><div className="landscape-frame" data-focused={Boolean(activePlace)}><motion.svg width="1100" height="800" viewBox="0 0 1100 800" initial={false} animate={{viewBox: mobile&&activePlace?`${activePlace.x-190} ${activePlace.y-150} 380 300`:"0 0 1100 800"}} transition={{duration:reducedMotion?0:.4,ease:[.22,1,.36,1]}} xmlns="http://www.w3.org/2000/svg" role="group" aria-label="Choose a problem area"><rect x="-300" y="-300" width="1700" height="1400" fill="#b9dde0"/><path d="M-100 122Q75 15 245 74T545 78Q700 10 890 70T1200 80V665Q1060 605 920 670T610 696Q450 650 304 710T-100 675Z" fill="#f7f0d9" stroke="#29263b" strokeWidth="5"/><path d="M-100 575Q130 535 260 588T560 620Q720 573 835 610T1200 568V800H-100Z" fill="#a7d3d0" stroke="#29263b" strokeWidth="4"/><path d="M-40 333Q110 370 220 321T450 287Q590 330 690 318T1110 274M50 527Q200 470 322 510T570 560Q746 521 884 494T1100 470" fill="none" stroke="#e2c99c" strokeWidth="32" strokeLinecap="round"/><path d="M-40 333Q110 370 220 321T450 287Q590 330 690 318T1110 274M50 527Q200 470 322 510T570 560Q746 521 884 494T1100 470" fill="none" stroke="#fff8e8" strokeWidth="4" strokeDasharray="15 18"/><g fill="none" stroke="#729e90" strokeWidth="4"><path d="M205 152q12-30 24 0m-12-23v31M295 368q12-30 24 0m-12-23v31M770 95q12-30 24 0m-12-23v31M1000 540q12-30 24 0m-12-23v31"/><path d="M160 685q30-12 60 0m560 55q30-12 60 0"/></g>{domains.map(d=>{const place=places[d.slug];if(!place)return null;const count=products.filter(p=>p.memberships.some(m=>m.slug===d.slug)).length;return <g className={`map-place ${selected===d.slug?'selected':''} ${activePlace&&selected===d.slug?'mobile-current':''}`} key={d.slug} data-kind={place.kind} role="button" tabIndex={activePlace&&selected!==d.slug?-1:0} aria-hidden={Boolean(activePlace&&selected!==d.slug)} aria-label={`${d.title}, ${products.filter(p=>p.memberships.some(m=>m.slug===d.slug)).length} projects`} aria-pressed={selected===d.slug} onClick={()=>{setState(d.slug);}} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setState(d.slug);}}} transform={`translate(${place.x} ${place.y})`}><path className="place-ground" d={grounds[place.kind]}/><g className="place-art" stroke="#29263b" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"><Landmark kind={place.kind}/><Mechanism kind={place.kind}/></g><text className="place-label" textAnchor="middle" y="108">{labels[d.slug]}</text>{count>0&&<g className="place-count" aria-hidden="true"><circle cx="85" cy="-70" r="18"/><text x="85" y="-64" textAnchor="middle">{count}</text></g>}</g>})}</motion.svg></div>{activePlace&&<div className="map-mobile-nav"><button onClick={()=>setState(domains[(mobileIndex+domains.length-1)%domains.length].slug)} aria-label="Previous area">Previous</button><strong>{labels[domains[mobileIndex]?.slug]}</strong><button onClick={()=>setState(domains[(mobileIndex+1)%domains.length].slug)} aria-label="Next area">Next</button><button className="map-mobile-select" onClick={()=>setState(selected,project,true)}>View full map</button><button className="map-mobile-inspector" onClick={()=>panelRef.current?.scrollIntoView({behavior:reducedMotion?'auto':'smooth',block:'start'})}>Explore {labels[selected]} projects ↓</button></div>}</section></div>

}
