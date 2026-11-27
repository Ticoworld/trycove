'use client';
import {useActionState} from 'react';
import type {claimResource} from './actions';
export function ClaimButton({action,packId,sessionId,label,disabled}:{action:typeof claimResource;packId:string;sessionId:string;label:string;disabled:boolean}) {
 const [message,formAction,pending]=useActionState(action,'');
 return <form action={formAction}>
  <input type="hidden" name="packId" value={packId}/><input type="hidden" name="sessionId" value={sessionId}/>
  <button className="studio-launch" disabled={pending || disabled}>{pending?'Preparing access…':label}</button>
  {message&&<p role="status">{message}</p>}
 </form>;
}
