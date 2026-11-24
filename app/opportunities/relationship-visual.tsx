'use client';
import {useEffect,useRef,useState} from 'react';
import {Landmark} from '../components/district-art';
import type {RelationshipProfile} from './relationship-profiles';

function Identity({profile}:{profile:RelationshipProfile}){
 const [failed,setFailed]=useState(false);const image=useRef<HTMLImageElement>(null);
 useEffect(()=>{setFailed(false);if(image.current?.complete&&image.current.naturalWidth===0)setFailed(true)},[profile.logo]);
 return <div className="connection-identity"><span className="connection-mark" style={{background:profile.color??'#e6e0d3'}}>{profile.logo&&!failed?<img ref={image} src={profile.logo} alt="" title="Logo from CKBdapps" width="58" height="58" onError={()=>setFailed(true)}/>:profile.kind!==undefined?<svg viewBox="-110 -95 220 185" aria-hidden="true"><g fill="none" stroke="#29263b" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round"><Landmark kind={profile.kind}/></g></svg>:<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M10 44Q23 24 34 36T56 19M12 50Q25 30 36 42T57 25" fill="none" stroke="#29263b" strokeWidth="3" strokeLinecap="round"/></svg>}</span><strong>{profile.name}</strong></div>
}
export function RelationshipVisual({consumer,provider,tested=false}:{consumer:RelationshipProfile;provider?:RelationshipProfile;tested?:boolean}){
 return <div className="relationship" aria-label={provider?`${consumer.name} and ${provider.name}: ${tested?'trial record available':'proposed connection'}`:`${consumer.name}: provider not yet identified`}><Identity profile={consumer}/><svg className="relationship-line" viewBox="0 0 100 28" aria-hidden="true"><path d="M4 14H96" fill="none" stroke="#8d7773" strokeWidth="3" strokeDasharray="3 7" strokeLinecap="round"/><circle cx="50" cy="14" r="7" fill={tested?'#a6d4c5':'#fffaf0'} stroke="#29263b" strokeWidth="2"/>{tested&&<circle cx="50" cy="14" r="2.5" fill="#29263b"/>}</svg>{provider?<Identity profile={provider}/>:<div className="connection-identity connection-open"><span className="connection-mark" aria-hidden="true"><svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="22" fill="none" stroke="#887e7b" strokeWidth="2" strokeDasharray="4 5"/><path d="M23 32h18M32 23v18" stroke="#887e7b" strokeWidth="2"/></svg></span><strong>Open to a match</strong></div>}</div>
}
