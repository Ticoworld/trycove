'use client';
import {useEffect,useRef} from 'react';

export function WorkspaceDialog({label,buttonLabel,children,initialOpen=false,closeOnBackdrop=false}:{label:string;buttonLabel?:string;children:React.ReactNode;initialOpen?:boolean;closeOnBackdrop?:boolean}) {
 const ref=useRef<HTMLDialogElement>(null);
 const backdropPress=useRef(false);
 useEffect(()=>{if(initialOpen&&!ref.current?.open)ref.current?.showModal()},[initialOpen]);
 const outside=(event:React.PointerEvent<HTMLDialogElement>)=>{
  if(event.target!==event.currentTarget)return false;
  const bounds=event.currentTarget.getBoundingClientRect();
  return event.clientX<bounds.left||event.clientX>bounds.right||event.clientY<bounds.top||event.clientY>bounds.bottom;
 };
 return <><button type="button" className="workspace-dialog-trigger" aria-label={label} onClick={()=>ref.current?.showModal()}>{buttonLabel ?? label}</button><dialog ref={ref} aria-label={label} className="workspace-dialog" onPointerDown={event=>{backdropPress.current=closeOnBackdrop&&outside(event)}} onPointerUp={event=>{if(backdropPress.current&&outside(event))event.currentTarget.close();backdropPress.current=false}}><div className="workspace-dialog-head"><h2>{label}</h2><button type="button" aria-label="Close" onClick={()=>ref.current?.close()}>Close</button></div>{children}</dialog></>;
}
