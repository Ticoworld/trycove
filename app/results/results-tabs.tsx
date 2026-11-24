'use client';
import {useEffect,useState} from 'react';
type View='feedback'|'connections'|'technical';
function readView():View{const url=new URL(window.location.href);if(url.hash==='#builder-connections')return 'connections';if(url.hash==='#product-testing')return 'feedback';const value=url.searchParams.get('view');return value==='connections'||value==='technical'?value:'feedback'}
export function ResultsTabs({feedback,connections,technical,initialView='feedback'}:{feedback:React.ReactNode;connections:React.ReactNode;technical:React.ReactNode;initialView?:View}){
 const [view,setView]=useState<View>(initialView);
 useEffect(()=>{const sync=()=>setView(readView());sync();window.addEventListener('popstate',sync);window.addEventListener('hashchange',sync);return()=>{window.removeEventListener('popstate',sync);window.removeEventListener('hashchange',sync)}},[]);
 function choose(event:React.MouseEvent<HTMLAnchorElement>,next:View){if(event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;event.preventDefault();const url=new URL(window.location.href);url.hash='';url.searchParams.set('view',next);window.history.pushState(null,'',url);setView(next)}
 return <><nav className="results-tabs" aria-label="Results sections">{([['feedback','Product feedback'],['connections','Builder connections'],['technical','Technical executions']] as const).map(([key,label])=><a key={key} href={`?view=${key}`} aria-current={view===key?'page':undefined} onClick={event=>choose(event,key)}>{label}</a>)}</nav><div id="product-testing" hidden={view!=='feedback'}>{feedback}</div><div id="builder-connections" hidden={view!=='connections'}>{connections}</div><div id="technical-executions" hidden={view!=='technical'}>{technical}</div></>
}
