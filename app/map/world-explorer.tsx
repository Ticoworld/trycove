'use client';

import Link from 'next/link';

import {useEffect,useMemo,useState} from 'react';

import type {ClassificationEvidence} from '../../lib/problem-map';



export type Domain={slug:string;title:string;summary:string};

export type Product={id:string;name:string;description:string;sourceUrl:string;revision:string;memberships:{slug:string;evidence:ClassificationEvidence[]}[]};

type Props={domains:Domain[];products:Product[]};

const labels:Record<string,string>={'payments-checkout':'Payments','trading-markets':'Trading','accounts-identity':'Identity','developer-tools':'Build apps','chain-data-indexing':'Chain data','funding-community':'Funding','contract-safety':'Safety','digital-assets':'Digital assets','cross-chain':'Cross-chain'};

const places:Record<string,{x:number;y:number;color:string;kind:number}>={'payments-checkout':{x:110,y:260,color:'#f8cb61',kind:0},'trading-markets':{x:390,y:135,color:'#fb907d',kind:1},'accounts-identity':{x:680,y:210,color:'#b7a8ef',kind:2},'developer-tools':{x:890,y:380,color:'#81d4e4',kind:3},'chain-data-indexing':{x:660,y:475,color:'#f8cb61',kind:4},'funding-community':{x:365,y:435,color:'#f4b39e',kind:5},'contract-safety':{x:115,y:510,color:'#a6d4c5',kind:6},'digital-assets':{x:930,y:120,color:'#d5bce9',kind:7},'cross-chain':{x:550,y:640,color:'#9bcfd5',kind:8}};

const grounds=['M-95 65L-100-40Q-72-83-15-70L63-76 100-35 98 66Z','M-96 66L-90-59 0-85 92-58 99 65Z','M-99 67Q-109-7-63-59T62-62Q105-20 100 67Z','M-102 64L-97-38 -25-80 70-70 103-26 100 64Z','M-96 64Q-98-62 0-76T99 64Z','M-100 65L-96-45 -48-73 22-63 89-72 101 65Z','M-101 66L-89-55 -26-77 62-70 100-35 98 66Z','M-101 66L-101-54 -68-75 93-75 101 66Z','M-105 66Q-95-46-50-55Q0-82 53-55 97-43 105 66Z'];

function Landmark({kind}:{kind:number}){switch(kind){

 case 0:return <g><path d="M-100 35H100v20h-200zM-70 55v35m140-35v35M-76 35V5h85v30" fill="#d89c62"/><path d="M-60 5v-40h55V5z" fill="#f8cb61"/><rect x="-50" y="-27" width="35" height="20" rx="2" fill="#fff8e8"/><path d="M-39-17h13M20 35V-4q0-28 28-28t28 28v39M35-3h26M49-16v26"/><circle cx="48" cy="-4" r="22" fill="#81d4e4"/><path d="M-90 69h180"/></g>;

 case 1:return <g><path d="M-90 48h180v16H-90zM-82 48v-58h112v58M-91-10l18-42h95l17 42z" fill="#fb907d"/><path d="M-60-52v42m34-42v42M-70 13h89M-55 48V24h60v24M50 50V-2h35v52M44-2h48l-8-26H52z" fill="#fff8e8"/><circle cx="67" cy="18" r="8" fill="#f8cb61"/></g>;

 case 2:return <g><path d="M-80 62V-8q0-65 80-65T80-8v70H43V0q0-37-43-37T-43 0v62z" fill="#b7a8ef"/><path d="M-95 62h190M-60 62v-70q0-50 60-50t60 50v70M-6-57h12v20H-6z"/><rect x="48" y="8" width="20" height="25" fill="#f8cb61"/><circle cx="58" cy="18" r="3" fill="#29263b"/></g>;

 case 3:return <g><path d="M-90 52h180v15H-90zM-75 52v-70l52-37h85l18 37v70" fill="#81d4e4"/><path d="M-75-18h155M-35-55v37M-52 12h59v40h-59zM-43 22h40M35 52V10h30v42" fill="#fff8e8"/><path d="M-86-35l22 15m-17-25 22 15M40-35h24M48-43v16"/><path d="M-19 10v-15h25v15"/></g>;

 case 4:return <g><path d="M-78 57h156M-52 57V5q0-47 52-47T52 5v52z" fill="#f8cb61"/><path d="M-52 5h104M-22 57V22h44v35M0-42v-27M-30-54l60-22M-7-80l17 14"/><circle cx="30" cy="-76" r="10" fill="#fb907d"/><path d="M-65 57v16h130V57"/></g>;

 case 5:return <g><path d="M-95 40L0 10l95 30-95 30z" fill="#f5b2a4"/><path d="M-72 41L0 19l72 22-72 21z" fill="#fff8e8"/><path d="M-43 27v-36h86v36M-50-9L0-49 50-9z" fill="#f8cb61"/><path d="M-19 27V3h38v24M-74 41l-14 12m162-12 14 12"/><circle cy="-23" r="7" fill="#fb907d"/></g>;

 case 6:return <g><path d="M-87 57h174M-70 57v-71h140v71M-80-14l24-34h112l24 34" fill="#a6d4c5"/><path d="M-39 57V4h78v53M-50-48v34m100-34v34"/><path d="M0-2l25 9v16q0 17-25 29-25-12-25-29V7z" fill="#fff8e8"/><path d="M-9 21l7 7 13-15"/></g>;

 case 7:return <g><path d="M-88 56h176M-75 56v-68h150v68M-85-12l20-35h130l20 35" fill="#d5bce9"/><path d="M-53-12v68M53-12v68M-36 12h72v37h-72z" fill="#fff8e8"/><path d="M0 16l18 14-18 14-18-14z" fill="#fb907d"/><path d="M-54-31h108"/></g>;

 default:return <g><path d="M-105 42h210v15h-210z" fill="#d89c62"/><path d="M-90 42q0-75 90-75t90 75M-70 42v-43m140 43V-1M-35 42v-64m70 64v-64M-105 22h210"/><path d="M-102 73q15-9 30 0t30 0m84 0q15-9 30 0t30 0" stroke="#5aaabb"/></g>;

}}

function safeSource(url:string){try{const u=new URL(url);return u.protocol==='https:'&&!u.username&&!u.password?u.href:null}catch{return null}}

function reasonLabel(reason:ClassificationEvidence){switch(reason.kind){case 'directory-category':return `Directory category claim: ${reason.label}`;case 'source-intent':return `Structured source scope: ${reason.label}`;case 'source-claim':return `Source claim: ${reason.label}`;default:return `Recorded capability: ${reason.label}`}}

export function MapExplorer({domains,products}:Props){

 const [region,setRegion]=useState('');const [project,setProject]=useState('');const [query,setQuery]=useState('');const [browse,setBrowse]=useState(false);const [mobile,setMobile]=useState(false);const [mobileIndex,setMobileIndex]=useState(0);

 useEffect(()=>{const media=window.matchMedia('(max-width: 800px)');const sync=()=>setMobile(media.matches);sync();media.addEventListener('change',sync);return()=>media.removeEventListener('change',sync)},[]);

 useEffect(()=>{const sync=()=>{const p=new URLSearchParams(window.location.search);const slug=p.get('region')??'';setRegion(slug);setProject(p.get('project')??'');const index=domains.findIndex(d=>d.slug===slug);if(index>=0)setMobileIndex(index)};sync();window.addEventListener('popstate',sync);return()=>window.removeEventListener('popstate',sync)},[domains]);

 const validRegion=region==='unclassified'||domains.some(d=>d.slug===region);const selected=validRegion?region:'';const current=domains.find(d=>d.slug===selected);const regionProducts=useMemo(()=>products.filter(p=>selected==='unclassified'?p.memberships.length===0:p.memberships.some(m=>m.slug===selected)),[products,selected]);

 const chosen=regionProducts.find(p=>p.id===project);const needle=query.trim().toLocaleLowerCase();const categoryNeedle=needle==='wallets'?'wallet':needle;const matches=useMemo(()=>needle?products.filter(p=>`${p.name} ${p.description}`.toLocaleLowerCase().includes(needle)||p.memberships.some(m=>m.evidence.some(e=>e.kind==='directory-category'&&e.label.toLocaleLowerCase()===categoryNeedle))):[],[products,needle,categoryNeedle]);const technologyAreas:Record<string,string>={fiber:'payments-checkout',dex:'trading-markets',wallets:'accounts-identity','rgb++':'digital-assets'};const matchingAreas=needle?domains.filter(d=>`${d.title} ${labels[d.slug]??''}`.toLocaleLowerCase().includes(needle)||technologyAreas[needle]===d.slug):[];

 const setState=(nextRegion:string,nextProject='')=>{const params=new URLSearchParams();if(nextRegion)params.set('region',nextRegion);if(nextProject)params.set('project',nextProject);window.history.pushState(null,'',`${window.location.pathname}${params.size?`?${params}`:''}`);setRegion(nextRegion);setProject(nextProject);const index=domains.findIndex(d=>d.slug===nextRegion);if(index>=0)setMobileIndex(index);setQuery('');setBrowse(false)};

 const openProduct=(p:Product)=>setState(p.memberships.find(m=>m.evidence.some(e=>e.kind==='directory-category'&&e.label.toLocaleLowerCase()===categoryNeedle))?.slug??p.memberships[0]?.slug??'unclassified',p.id);

 const activePlace=places[domains[mobileIndex]?.slug];

 return <div className={`map-explorer ${needle||selected||browse?'has-panel':''}`} onKeyDown={e=>{if(e.key==='Escape'&&(needle||selected||browse)){setState('');setBrowse(false);document.getElementById('world-search')?.focus()}}}><div className="map-toolbar"><label className="sr-only" htmlFor="world-search">Search projects or areas</label><input id="world-search" type="search" placeholder="Search projects or areas" value={query} onChange={e=>{setQuery(e.target.value);setBrowse(false)}}/><button onClick={()=>{setState('');setBrowse(!browse)}} aria-expanded={browse}>Browse areas</button><button onClick={()=>setState('unclassified')}>Unmapped <span>{products.filter(p=>!p.memberships.length).length}</span></button><Link href="/projects">Project catalog</Link></div><aside className={`map-panel ${needle||selected||browse?'panel-open':''}`} aria-label="Discover projects"><button className="map-close" aria-label="Close discovery panel" onClick={()=>{setQuery('');setState('');setBrowse(false)}}>×</button>

 {needle?<div className="map-results" aria-live="polite"><h2>Search results</h2>{technologyAreas[needle]&&<p>Area results are broader problem groups; project matches require an exact recorded directory category.</p>}{matchingAreas.map(d=><button className="map-row" key={d.slug} onClick={()=>setState(d.slug)}><span><i className="map-mark" aria-hidden="true"/>{d.title}</span><small>{products.filter(p=>p.memberships.some(m=>m.slug===d.slug)).length} projects · Area</small></button>)}{matches.map(p=><button className="map-row" key={p.id} onClick={()=>openProduct(p)}><span><i className="map-mark neutral" aria-hidden="true"/>{p.name}<small className="result-description">{p.description}</small></span><small>Project</small></button>)}{!matches.length&&!matchingAreas.length&&<p>No matching projects or areas.</p>}<Link className="map-text-link" href={`/projects?q=${encodeURIComponent(query.trim())}`}>Search the full catalog</Link></div>

 :chosen?<div className="map-results"><button className="map-back" onClick={()=>setState(selected)}>Back to {current?.title??'unmapped projects'}</button><span className="map-overline">Project preview</span><h2>{chosen.name}</h2><p>{chosen.description||'No description is available in the project record.'}</p><h3>{current?.title??'Unmapped projects'}</h3>{selected==='unclassified'?<p>No supported problem-group placement is recorded.</p>:<div><p>{reasonLabel(chosen.memberships.find(m=>m.slug===selected)?.evidence[0]??{kind:'source-claim',label:'No placement reason available'})}</p><details className="map-evidence"><summary>Source details</summary><ul className="map-reasons">{(chosen.memberships.find(m=>m.slug===selected)?.evidence??[]).map((r,i)=><li key={i}>{reasonLabel(r)}{r.verification?` · ${r.verification}`:''}{r.opportunityId&&<> <Link href={`/opportunities/${encodeURIComponent(r.opportunityId)}`}>Saved record</Link></>}{r.sourceUrl&&safeSource(r.sourceUrl)&&<> <a href={safeSource(r.sourceUrl)!} target="_blank" rel="noreferrer">Source</a></>}</li>)}</ul></details></div>}<p className="map-caveat">A placement is a source-backed starting point; it does not establish compatibility.</p><Link className="map-primary" href={`/projects/${encodeURIComponent(chosen.id)}`}>Open Product Passport</Link>{safeSource(chosen.sourceUrl)&&<p><a className="map-text-link" href={safeSource(chosen.sourceUrl)!} target="_blank" rel="noreferrer">Project source</a></p>}</div>

 :selected?<div className="map-results"><button className="map-back" onClick={()=>{setState('');setBrowse(true)}}>All areas</button><span className="map-overline">Problem area</span><h2>{current?.title??'Unmapped projects'}</h2><p>{regionProducts.length} {regionProducts.length===1?'project':'projects'}</p>{regionProducts.length?<div className="map-list">{regionProducts.map(p=><button className="map-row project-row" key={p.id} onClick={()=>setState(selected,p.id)}><span><i className="map-mark neutral" aria-hidden="true"/>{p.name}</span><small>{p.description||'Open project preview'}</small></button>)}</div>:<div><h3>Nothing mapped here yet.</h3><p>No supported placements are recorded. Relevant products may exist elsewhere.</p></div>}<Link className="map-text-link" href={selected==='unclassified'?'/map/unclassified':`/map/${selected}`}>View detailed area</Link><Link className="map-text-link" href="/projects">Search all projects</Link></div>

 :browse?<div className="map-results"><div className="map-list-heading"><h2>Explore areas</h2><span>{products.length} {products.length===1?'project':'projects'}</span></div>{!products.length&&<p>No product records are currently available.</p>}<div className="map-list">{domains.map(d=>{const count=products.filter(p=>p.memberships.some(m=>m.slug===d.slug)).length;return <button className="map-row" key={d.slug} onClick={()=>setState(d.slug)}><span>{d.title}</span><small>{count}</small></button>})}</div><button className="map-unmapped" onClick={()=>setState('unclassified')}>Unmapped projects <span>{products.filter(p=>!p.memberships.length).length}</span></button><p className="map-caveat">Areas are browsing groups, not verified connections.</p></div>:null}

 </aside><section className="map-landscape" aria-label="Illustrated product world"><div className="landscape-frame"><svg viewBox={mobile&&activePlace?`${activePlace.x-190} ${activePlace.y-150} 380 300`:"0 0 1100 800"} xmlns="http://www.w3.org/2000/svg" role="group" aria-label="Choose a problem area"><rect x="-300" y="-300" width="1700" height="1400" fill="#b9dde0"/><path d="M-100 122Q75 15 245 74T545 78Q700 10 890 70T1200 80V665Q1060 605 920 670T610 696Q450 650 304 710T-100 675Z" fill="#f7f0d9" stroke="#29263b" strokeWidth="5"/><path d="M-100 575Q130 535 260 588T560 620Q720 573 835 610T1200 568V800H-100Z" fill="#a7d3d0" stroke="#29263b" strokeWidth="4"/><path d="M-40 333Q110 370 220 321T450 287Q590 330 690 318T1110 274M50 527Q200 470 322 510T570 560Q746 521 884 494T1100 470" fill="none" stroke="#e2c99c" strokeWidth="32" strokeLinecap="round"/><path d="M-40 333Q110 370 220 321T450 287Q590 330 690 318T1110 274M50 527Q200 470 322 510T570 560Q746 521 884 494T1100 470" fill="none" stroke="#fff8e8" strokeWidth="4" strokeDasharray="15 18"/><g fill="none" stroke="#729e90" strokeWidth="4"><path d="M205 152q12-30 24 0m-12-23v31M295 368q12-30 24 0m-12-23v31M770 95q12-30 24 0m-12-23v31M1000 540q12-30 24 0m-12-23v31"/><path d="M160 685q30-12 60 0m560 55q30-12 60 0"/></g>{domains.map(d=>{const place=places[d.slug];if(!place)return null;const count=products.filter(p=>p.memberships.some(m=>m.slug===d.slug)).length;return <g className={`map-place ${selected===d.slug?'selected':''} ${domains[mobileIndex]?.slug===d.slug?'mobile-current':''}`} key={d.slug} data-kind={place.kind} role="button" tabIndex={0} aria-label={`${d.title}, ${products.filter(p=>p.memberships.some(m=>m.slug===d.slug)).length} projects`} aria-pressed={selected===d.slug} onClick={()=>{setState(d.slug);}} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setState(d.slug);}}} transform={`translate(${place.x} ${place.y})`}><path className="place-ground" d={grounds[place.kind]}/><g className="place-art" stroke="#29263b" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"><Landmark kind={place.kind}/></g><text className="place-label" textAnchor="middle" y="108">{labels[d.slug]}</text>{count>0&&<g className="place-count" aria-hidden="true"><circle cx="85" cy="-70" r="18"/><text x="85" y="-64" textAnchor="middle">{count}</text></g>}</g>})}</svg></div><div className="map-mobile-nav"><button onClick={()=>setState(domains[(mobileIndex+domains.length-1)%domains.length].slug)} aria-label="Previous area">Previous</button><strong>{labels[domains[mobileIndex]?.slug]}</strong><button onClick={()=>setState(domains[(mobileIndex+1)%domains.length].slug)} aria-label="Next area">Next</button><button className="map-mobile-select" onClick={()=>setState(domains[mobileIndex].slug)}>Explore {labels[domains[mobileIndex]?.slug]}</button></div></section></div>

}
