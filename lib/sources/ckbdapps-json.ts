import {createHash} from 'node:crypto';
import {z} from 'zod';

const localText=z.union([z.string(),z.object({en:z.string().optional(),zh:z.string().optional()}).passthrough()]);
const optionalText=z.string().nullable().optional();
export const CkbDappsProjectSchema=z.object({
 slug:z.string().regex(/^[a-z0-9][a-z0-9-]{0,100}$/i),name:z.string().min(1).max(200),url:optionalText,
 tagline:localText.optional(),categories:z.array(z.string().min(1).max(100)).max(30).optional(),group:optionalText,
 community:z.boolean().optional(),links:z.record(z.string(),z.unknown()).optional(),github:optionalText,
 verified:z.union([z.string(),z.boolean()]).nullable().optional(),listed:optionalText,testnet:z.boolean().optional(),
 logo:optionalText,page:z.record(z.string(),z.unknown()).optional(),
}).passthrough();
export const CkbDappsFeedSchema=z.object({source:z.string().url(),count:z.number().int().nonnegative(),projects:z.array(CkbDappsProjectSchema).max(1000)}).passthrough().superRefine((feed,ctx)=>{
 if(feed.count!==feed.projects.length)ctx.addIssue({code:'custom',path:['count'],message:'Published count does not match the project array'});
 const ids=new Set<string>();for(const [i,project] of feed.projects.entries()){if(ids.has(project.slug))ctx.addIssue({code:'custom',path:['projects',i,'slug'],message:`Duplicate source identity ${project.slug}`});ids.add(project.slug)}
});
export type CkbDappsProject=z.infer<typeof CkbDappsProjectSchema>;
export type CkbDappsFeed=z.infer<typeof CkbDappsFeedSchema>;
export const CKBDAPPS_URL='https://ckbdapps.com/projects.json';
export const CKBDAPPS_PAGE='https://ckbdapps.com';
export const sha256=(text:string|Buffer)=>createHash('sha256').update(text).digest('hex');

export function parseCkbDappsFeed(raw:string){if(Buffer.byteLength(raw)>5_000_000)throw new Error('CKBdapps feed exceeds the 5 MB limit');return CkbDappsFeedSchema.parse(JSON.parse(raw))}
export function localized(value:unknown,language:'en'|'zh'='en'):string|undefined{if(typeof value==='string')return value.trim()||undefined;if(value&&typeof value==='object'&&!Array.isArray(value)){const record=value as Record<string,unknown>;const selected=record[language]??record.en??record.zh;return typeof selected==='string'&&selected.trim()?selected.trim():undefined}return undefined}
export function safeHttpUrl(value:unknown):string|undefined{if(typeof value!=='string')return undefined;try{const url=new URL(value);return ['http:','https:'].includes(url.protocol)&&!url.username&&!url.password?url.toString():undefined}catch{return undefined}}
export function repositoryUrl(value:unknown):string|undefined{if(typeof value!=='string')return undefined;const raw=value.replace(/^https:\/\/github\.com\//i,'').replace(/\.git$/,'');return /^[\w.-]+\/[\w.-]+$/.test(raw)?`https://github.com/${raw}`:undefined}

export function metadataClaims(project:CkbDappsProject):{kind:string;concept:string;claim:string}[]{
 const claims:{kind:string;concept:string;claim:string}[]=[];
 for(const category of project.categories??[])claims.push({kind:'product-category',concept:category.toLowerCase().replace(/[^a-z0-9]+/g,'-'),claim:`CKBdapps category: ${category}`});
 if(project.group)claims.push({kind:'product-group',concept:project.group,claim:`CKBdapps group: ${project.group}`});
 if(project.testnet!==undefined)claims.push({kind:'deployment-claim',concept:'testnet',claim:`CKBdapps testnet field: ${project.testnet}`});
 if(project.community!==undefined)claims.push({kind:'community-claim',concept:'community',claim:`CKBdapps community field: ${project.community}`});
 if(typeof project.verified==='string')claims.push({kind:'directory-verification-date',concept:'listed-verification-date',claim:`CKBdapps verified metadata date: ${project.verified}`});
 if(project.listed)claims.push({kind:'directory-listing-date',concept:'directory-listing-date',claim:`CKBdapps listed metadata date: ${project.listed}`});
 const website=safeHttpUrl(project.url);if(website)claims.push({kind:'website-claim',concept:'website',claim:`CKBdapps website: ${website}`});
 for(const [language,url] of Object.entries(project.page??{})){const safe=safeHttpUrl(url);if(safe)claims.push({kind:'directory-page',concept:`directory-page-${language}`,claim:`CKBdapps directory page (${language}): ${safe}`})}
 for(const [network,value] of Object.entries(project.links??{})){if(typeof value==='string'&&value.trim())claims.push({kind:'community-link',concept:network.toLowerCase(),claim:`CKBdapps ${network} link or handle: ${value.trim().slice(0,500)}`})}
 return claims;
}
