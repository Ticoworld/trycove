'use client';
import {useEffect,useState} from 'react';
export function RemainingTime({expiresAt}:{expiresAt:string}) {
 const [now,setNow]=useState<number|null>(null);
 useEffect(()=>{setNow(Date.now());const timer=setInterval(()=>setNow(Date.now()),30000);return()=>clearInterval(timer)},[]);
 if(now===null)return <span>Checking remaining time…</span>;
 const minutes=Math.max(0,Math.ceil((Date.parse(expiresAt)-now)/60000));
 return <span>{minutes ? `${minutes} minute${minutes===1?'':'s'} remaining` : 'Access expired'}</span>;
}
