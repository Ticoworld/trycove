import matter from 'gray-matter';
import {z} from 'zod';
const Source=z.object({name:z.string().min(1),url:z.string().optional(),github:z.string().optional(),tagline:z.union([z.string(),z.object({en:z.string().optional()}).passthrough()]).optional()}).passthrough();
export function safeUrl(value:unknown):string|null {if(typeof value!=='string')return null; try {const u=new URL(value); return ['http:','https:'].includes(u.protocol)&&!u.username&&!u.password?u.toString():null}catch{return null}}
export function parseProject(id:string,content:string,revision:string){const parsed=matter(content); const x=Source.parse(parsed.data); const description=typeof x.tagline==='string'?x.tagline:x.tagline?.en ?? parsed.content.trim().split('\n')[0] ?? ''; const repo=x.github&&/^[\w.-]+\/[\w.-]+$/.test(x.github)?`https://github.com/${x.github}`:null; return {id,name:x.name,description,website:safeUrl(x.url),repository:repo,sourceUrl:`https://github.com/CKBFansDAO/ckbdapps/blob/${revision}/content/projects/${encodeURIComponent(id)}.md`,revision,observedAt:new Date()}}
// A source-local key preserves distinct products even if they share a domain or repository.
export function candidate(need:{type:string;concept:string},offer:{type:string;concept:string}){return need.type==='need'&&offer.type==='provides'&&need.concept===offer.concept?'documented_need':null}
