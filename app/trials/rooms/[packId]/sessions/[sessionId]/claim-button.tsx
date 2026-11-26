'use client';
import {useFormStatus} from 'react-dom';
export function ClaimButton({label,disabled}:{label:string;disabled:boolean}) {
 const {pending}=useFormStatus();
 return <button className="studio-launch" disabled={pending || disabled}>{pending?'Preparing access…':label}</button>;
}
