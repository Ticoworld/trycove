'use client';
import {useEffect,useRef,useState} from 'react';
import {Landmark, Mechanism} from '../../components/district-art';

export function PassportVisual({name,logo,kind}:{name:string;logo?:string;kind?:number}){
 const [failed,setFailed]=useState(false);
 const imageRef=useRef<HTMLImageElement>(null);
 useEffect(()=>{setFailed(false);const image=imageRef.current;if(image?.complete&&image.naturalWidth===0)setFailed(true)},[logo]);
 return <div className="passport-visual">
  <div className="passport-illustration" aria-hidden="true">{kind!==undefined?<svg viewBox="-120 -100 240 200"><g fill="none" stroke="#29263b" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><Landmark kind={kind}/><Mechanism kind={kind}/></g></svg>:<svg viewBox="0 0 240 180"><path d="M24 135 Q85 60 136 115 T220 65 M25 149 Q85 74 136 129 T220 79" fill="none" stroke="#29263b" strokeWidth="3"/><circle cx="169" cy="48" r="18" fill="none" stroke="#29263b" strokeWidth="3"/></svg>}</div>
  {logo&&!failed&&<div className="passport-logo"><img ref={imageRef} src={logo} alt={`${name} logo`} width={112} height={112} onError={()=>setFailed(true)}/><small>Logo: CKBdapps</small></div>}
 </div>
}
