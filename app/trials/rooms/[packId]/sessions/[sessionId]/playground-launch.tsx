'use client';
import {useEffect,useRef,useState} from 'react';
import {beginPlayground} from './actions';

export function PlaygroundLaunch({packId,sessionId,launchUrl}:{packId:string;sessionId:string;launchUrl:string}) {
 const [error,setError]=useState('');
 const target=useRef<Window|null>(null);
 const ticket=useRef<{token:string;origin:string;expiresAt:string}|null>(null);
 const ready=useRef(false);
 function deliver(){if(target.current && ticket.current && ready.current && Date.parse(ticket.current.expiresAt)>Date.now()) {target.current.postMessage({type:'trycove-playground-handoff',token:ticket.current.token},ticket.current.origin);ticket.current=null;}}
 useEffect(()=>{const onMessage=(event:MessageEvent)=>{if(event.source===target.current && event.origin===new URL(launchUrl).origin && event.data?.type==='quotacell-playground-ready'){ready.current=true;deliver();}};window.addEventListener('message',onMessage);return()=>window.removeEventListener('message',onMessage)},[launchUrl]);
 async function open(){
  setError('');ready.current=false;
  const popup=window.open(launchUrl,'_blank');
  if(!popup){setError('Allow pop-ups to open this Playground.');return;}
  target.current=popup;
  const form=new FormData();form.set('packId',packId);form.set('sessionId',sessionId);
  try {const result=await beginPlayground(form);if(!result || result.launchUrl!==launchUrl || result.origin!==new URL(launchUrl).origin){popup.close();setError('The Playground handoff is unavailable or already used.');return;}ticket.current=result;deliver();}
  catch {popup.close();setError('Could not start the Playground.');}
 }
 return <><button type="button" className="button" onClick={open}>Open Playground</button>{error&&<p role="alert">{error}</p>}</>;
}
