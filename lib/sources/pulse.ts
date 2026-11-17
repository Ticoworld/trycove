import {createHash} from 'node:crypto';
import {z} from 'zod';

const RepoPath=z.string().regex(/^[\w.-]+\/[\w.-]+$/);
const PulseRepoSummary=z.object({name:RepoPath,group:z.string().optional(),desc:z.string().optional(),stars:z.number().optional(),lang:z.string().optional(),n:z.number().optional(),n24:z.number().optional(),b24:z.number().optional(),lastAt:z.string().nullable().optional(),lastKind:z.string().nullable().optional(),lastBotAt:z.string().nullable().optional(),pushedAt:z.string().nullable().optional(),tags:z.array(z.string()).optional(),createdAt:z.string().nullable().optional(),isNew:z.boolean().optional(),onchain:z.boolean().optional()}).passthrough();
export const PulseStateSchema=z.object({now:z.string().datetime({offset:true}),keepDays:z.number().optional(),stats:z.record(z.string(),z.unknown()).optional(),repos:z.array(PulseRepoSummary).max(2000)}).passthrough().superRefine((state,ctx)=>{const names=new Set<string>();for(const [index,repo] of state.repos.entries()){const key=repo.name.toLowerCase();if(names.has(key))ctx.addIssue({code:'custom',path:['repos',index,'name'],message:`Duplicate Pulse repository ${repo.name}`});names.add(key)}});
const PulseEvent=z.object({at:z.string(),kind:z.string(),actor:z.string().optional(),title:z.string().optional(),url:z.string().optional(),ref:z.string().optional(),commits:z.number().optional()}).passthrough();
export const PulseRepoSchema=z.object({name:RepoPath,url:z.string().url(),group:z.string().nullable().optional(),desc:z.string().nullable().optional(),stars:z.number().nullable().optional(),lang:z.string().nullable().optional(),topics:z.array(z.string()).nullable().optional(),pushedAt:z.string().nullable().optional(),createdAt:z.string().nullable().optional(),daily:z.object({days:z.number(),people:z.array(z.number()),bots:z.array(z.number())}).passthrough().nullable().optional(),months:z.array(z.unknown()).nullable().optional(),onchain:z.boolean().nullable().optional(),contributors:z.array(z.unknown()).nullable().optional(),events:z.array(PulseEvent).max(250).nullable().optional()}).passthrough();
export type PulseState=z.infer<typeof PulseStateSchema>;
export type PulseRepo=z.infer<typeof PulseRepoSchema>;
export type PulseRepoSummary=z.infer<typeof PulseRepoSummary>;
export const PULSE_BASE='https://pulse-lab.lusocryptolabs.com';
export const PULSE_STATE_URL=`${PULSE_BASE}/api/state`;
export const pulseRepoUrl=(name:string)=>`${PULSE_BASE}/api/repo?name=${encodeURIComponent(name)}`;
export const sha256=(value:string|Buffer)=>createHash('sha256').update(value).digest('hex');

export function parsePulseState(raw:string):PulseState{if(Buffer.byteLength(raw)>2_000_000)throw new Error('Pulse state exceeds the 2 MB limit');return PulseStateSchema.parse(JSON.parse(raw))}
export function parsePulseRepo(raw:string):PulseRepo{if(Buffer.byteLength(raw)>1_000_000)throw new Error('Pulse repository response exceeds the 1 MB limit');return PulseRepoSchema.parse(JSON.parse(raw))}
export function githubRepoPath(value:string):string|null{try{const url=new URL(value);const parts=url.pathname.split('/').filter(Boolean);if(url.protocol!=='https:'||url.hostname.toLowerCase()!=='github.com'||url.username||url.password||parts.length!==2)return null;return `${parts[0]!.toLowerCase()}/${parts[1]!.replace(/\.git$/i,'').toLowerCase()}`}catch{return null}}
export type GithubRepositoryIdentity={id:number;node_id?:string;full_name:string;html_url?:string;default_branch?:string};
export function normalizedIdentityPath(value:string){return value.replace(/^https:\/\/github\.com\//i,'').replace(/\.git$/,'').toLowerCase()}
/** Only a GitHub API response for the requested repository can authorize a rename alias. */
export function resolvePulseAlias(input:{requestedPath:string;identity?:GithubRepositoryIdentity|null;rows:PulseRepoSummary[]}):{repo:PulseRepoSummary;matchedBy:'exact'|'authoritative-alias'}|null{
 const rows=new Map(input.rows.map(row=>[row.name.toLowerCase(),row]));const exact=rows.get(input.requestedPath.toLowerCase());if(exact)return{repo:exact,matchedBy:'exact'};
 const identity=input.identity;if(!identity||!Number.isSafeInteger(identity.id)||identity.id<=0||normalizedIdentityPath(identity.full_name)===input.requestedPath.toLowerCase())return null;
 const canonical=rows.get(normalizedIdentityPath(identity.full_name));return canonical?{repo:canonical,matchedBy:'authoritative-alias'}:null;
}
export function isCkbPulseLead(repo:PulseRepoSummary):boolean{return Boolean(repo.onchain||repo.tags?.some(tag=>/^(?:ckb|nervos|fiber)$/i.test(tag))||/\b(?:ckb|nervos)\b/i.test(repo.desc??''))}
