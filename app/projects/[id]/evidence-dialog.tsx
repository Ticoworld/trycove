'use client';
import {useEffect,useRef,useState} from 'react';
export function EvidenceDialog({title,children}:{title:string;children:React.ReactNode}){
 const ref=useRef<HTMLDialogElement>(null);
 const timer=useRef<ReturnType<typeof setTimeout>|null>(null);
 const [closing,setClosing]=useState(false);
 useEffect(()=>()=>{if(timer.current)clearTimeout(timer.current)},[]);
 const close=()=>{
  if(closing)return;
  if(window.matchMedia('(prefers-reduced-motion: reduce)').matches){ref.current?.close();return}
  setClosing(true);timer.current=setTimeout(()=>{ref.current?.close();setClosing(false);timer.current=null},180);
 };
 return <><button className="passport-evidence-button" onClick={()=>ref.current?.showModal()}>{title}<span aria-hidden="true">+</span></button><dialog className={`passport-dialog ${closing?'is-closing':''}`} ref={ref} aria-label={title} onCancel={event=>{event.preventDefault();close()}}><div className="passport-dialog-head"><h2>{title}</h2><button onClick={close} aria-label="Close details">×</button></div><div className="passport-dialog-body">{children}</div></dialog></>
}
