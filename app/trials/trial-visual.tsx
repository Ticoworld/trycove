'use client';
import {useEffect,useRef,useState} from 'react';
export function TrialMark({name,logo}:{name:string;logo?:string}){
 const [failed,setFailed]=useState(false);const image=useRef<HTMLImageElement>(null);
 useEffect(()=>{setFailed(false);if(image.current?.complete&&image.current.naturalWidth===0)setFailed(true)},[logo]);
 return <span className="trial-mark">{logo&&!failed?<img ref={image} src={logo} alt={`${name} logo`} width="72" height="72" onError={()=>setFailed(true)}/>:<svg viewBox="0 0 100 100" aria-hidden="true"><path d="M19 27h62v50H19zM13 27l12-13h50l12 13M31 77V46h38v31" fill="#fffaf0" stroke="#29263b" strokeWidth="4" strokeLinejoin="round"/><path d="M43 55h14M43 63h14" stroke="#29263b" strokeWidth="3" strokeLinecap="round"/></svg>}</span>
}
