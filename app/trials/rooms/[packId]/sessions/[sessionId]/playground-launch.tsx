'use client';
import {useEffect,useRef,useState} from 'react';
import {beginPlayground} from './actions';

export function PlaygroundLaunch({packId,sessionId,launchUrl,label}:{packId:string;sessionId:string;launchUrl:string;label:string}) {
 const [error,setError]=useState('');
 const [launched,setLaunched]=useState(false);
 const [preparing,setPreparing]=useState(false);
 const target=useRef<Window|null>(null);
 const ticket=useRef<{token:string;origin:string;expiresAt:string}|null>(null);
 const ready=useRef(false);
 function deliver(){if(target.current && ticket.current && ready.current && Date.parse(ticket.current.expiresAt)>Date.now()) {target.current.postMessage({type:'trycove-playground-handoff',token:ticket.current.token},ticket.current.origin);ticket.current=null;}}
 useEffect(()=>{const onMessage=(event:MessageEvent)=>{if(event.source===target.current && event.origin===new URL(launchUrl).origin && event.data?.type==='trycove-playground-ready' && event.data?.version===1){ready.current=true;deliver();}};window.addEventListener('message',onMessage);return()=>window.removeEventListener('message',onMessage)},[launchUrl]);
 async function open(){
  setError('');ready.current=false;setPreparing(true);
  const popup=window.open(launchUrl,'_blank');
  if(!popup){setPreparing(false);setError('Allow pop-ups to open this Playground.');return;}
  target.current=popup;
  const form=new FormData();form.set('packId',packId);form.set('sessionId',sessionId);
  try {const result=await beginPlayground(form);if(!result || result.launchUrl!==launchUrl || result.origin!==new URL(launchUrl).origin){popup.close();setError('The Playground handoff is unavailable.');return;}ticket.current=result;deliver();setLaunched(true);}
  catch {popup.close();setError('Could not start the Playground.');} finally {setPreparing(false);}
 }
 return <><button type="button" className="studio-launch" onClick={open} disabled={preparing}>{preparing?'Preparing access…':launched?'Resume access':label}</button>{launched&&<p>Return to this Trycove tab to record your feedback. If the application closes or refreshes, use Resume access.</p>}{error&&<p role="alert">{error}</p>}</>;
}
