import {createHash} from 'node:crypto';
import {lstat,mkdir,readdir,readFile,stat,unlink,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {z} from 'zod';

export const LIFECYCLE_STATES=['proposed','in_progress','demonstrated_in_wild','adopted','superseded','stale_offer','unknown'] as const;
export type LifecycleState=typeof LIFECYCLE_STATES[number];
export type CompatibilityState='unknown'|'compatible'|'partially_compatible'|'incompatible';
export type Freshness='current'|'partial'|'unresolved';
export type VerificationResult='complete'|'partial'|'contradictory'|'unavailable';

const HttpsUrl=z.string().url().refine(value=>{
 try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&['github.com','raw.githubusercontent.com','talk.nervos.org','teapaw.org'].includes(u.hostname)}catch{return false}
},'Only public GitHub, Nervos Talk, and Teapaw HTTPS sources are permitted');
const Repository=HttpsUrl.refine(value=>/^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/?$/.test(value));
export const CandidateSpecSchema=z.object({
 opportunityId:z.string().min(1).max(160),
 capability:z.object({key:z.string().regex(/^[a-z0-9][a-z0-9._-]{1,100}$/),label:z.string().min(4).max(240),terms:z.array(z.string().min(2).max(100)).min(2).max(12)}).strict(),
 consumer:z.object({id:z.string().min(1),name:z.string().min(1),aliases:z.array(z.string().min(1).max(100)).max(8),repositories:z.array(Repository).max(5)}).strict(),
 provider:z.object({id:z.string().min(1),name:z.string().min(1),aliases:z.array(z.string().min(1).max(100)).max(8),repositories:z.array(Repository).max(5)}).strict(),
 sourceUrls:z.array(HttpsUrl).max(12),
 knownUnavailableSources:z.array(z.object({url:HttpsUrl,checkedAt:z.string().datetime({offset:true}),reason:z.string().min(4).max(240)}).strict()).max(8).default([]),
 codeTouchpoints:z.array(z.object({projectId:z.string().min(1),repository:Repository,path:z.string().regex(/^[A-Za-z0-9_./-]{1,240}$/)}).strict()).max(12),
 searchConcepts:z.array(z.string().min(3).max(120)).max(8),
 priorEvidence:z.array(z.object({sourceUrl:HttpsUrl,revision:z.string().min(7).max(128).optional(),publishedAt:z.string().max(40).optional(),evidenceType:z.enum(['maintainer_report','code_observed','executed_demo','independent_verification','external_adoption','human_offer','status_update']),excerpt:z.string().min(1).max(2000),verification:z.string().min(8).max(500)}).strict()).max(8).default([]),
 executionReceipt:z.string().regex(/^evidence\/[A-Za-z0-9_./-]{1,220}\.json$/).optional(),
 lifecycleBaseline:z.enum(['stored','provided']).default('stored'),
 priorLifecycle:z.enum(LIFECYCLE_STATES).default('unknown'),
 priorCompatibility:z.enum(['unknown','compatible','partially_compatible','incompatible']).default('unknown'),
}).strict().superRefine((value,ctx)=>{
 if(value.consumer.id===value.provider.id)ctx.addIssue({code:'custom',path:['provider','id'],message:'A candidate must contain distinct projects'});
 if(value.codeTouchpoints.some(x=>![value.consumer.id,value.provider.id].includes(x.projectId)))ctx.addIssue({code:'custom',path:['codeTouchpoints'],message:'Code touchpoints must belong to one of the candidate projects'});
});
export type CandidateSpec=z.infer<typeof CandidateSpecSchema>;

export type SourceKind='github-current-ref'|'github-pulls'|'github-releases'|'github-source'|'github-search'|'discourse-topic'|'announcement';
export type EvidenceType='maintainer_report'|'code_observed'|'executed_demo'|'independent_verification'|'external_adoption'|'human_offer'|'status_update';
export type RetrievedSource={url:string;kind:SourceKind;checkedAt:string;fetchStatus:'available'|'unavailable'|'not_modified';httpStatus?:number;revision?:string;publishedAt?:string;etag?:string;lastModified?:string;content:string;excerpt:string;error?:string;cache?:'hit'|'revalidated'|'miss'};
export type LifecycleEvidence={id:string;sourceUrl:string;revision?:string;path?:string;line?:number;publishedAt?:string;checkedAt:string;evidenceType:EvidenceType;excerpt:string;conclusion:string;verification:string;sourceSha256:string};
export type CandidateVerification={opportunityId:string;capabilityKey:string;checkedAt:string;result:VerificationResult;freshness:Freshness;priorLifecycle:LifecycleState;lifecycleState:LifecycleState;compatibilityState:CompatibilityState;summary:string;uncertainty:string;nextAction:string;queries:string[];sources:RetrievedSource[];evidence:LifecycleEvidence[];limitations:string[]};

const MAX_BODY_BYTES=2*1024*1024;
const MAX_CACHE_ENTRIES=20;
const CACHE_TTL_MS=6*60*60*1000;
const CACHE_MAX_AGE_MS=30*24*60*60*1000;
const USER_AGENT='Trycove-current-state-verifier/1.0 (bounded public prior-art check)';
const sha=(s:string|Buffer)=>createHash('sha256').update(s).digest('hex');
const uniq=(xs:string[])=>[...new Set(xs)];

function validatePublicUrl(raw:string):URL {
 const parsed=new URL(HttpsUrl.parse(raw));
 if(parsed.port||parsed.username||parsed.password||parsed.hash==='javascript:')throw new Error('Source URL contains a forbidden component');
 return parsed;
}

function repositoryRoot(raw:string):string {
 const parsed=Repository.parse(raw);return parsed.replace(/\/$/,'');
}

export function buildVerificationPlan(candidate:CandidateSpec):{queries:string[];requests:{url:string;kind:SourceKind}[];codeTouchpoints:CandidateSpec['codeTouchpoints']} {
 const repositories=uniq([...candidate.consumer.repositories,...candidate.provider.repositories].map(repositoryRoot));
 const requests:{url:string;kind:SourceKind}[]=[];
 for(const repo of repositories)requests.push({url:`${repo}/commits/HEAD.atom`,kind:'github-current-ref'});
 for(const repo of repositories.slice(0,4)){
  requests.push({url:`${repo}/pulls?q=is%3Apr+is%3Amerged`,kind:'github-pulls'});
  requests.push({url:`${repo}/releases`,kind:'github-releases'});
 }
 for(const sourceUrl of candidate.sourceUrls){
  const u=validatePublicUrl(sourceUrl);
 if(u.hostname==='talk.nervos.org'){
   const base=u.href.replace(/\.json$/,'').replace(/\/$/,'');requests.push({url:`${base}.json`,kind:'discourse-topic'});
  }else requests.push({url:u.href,kind:u.hostname==='teapaw.org'?'announcement':'github-source'});
 }
 const aliases=[...candidate.consumer.aliases,candidate.consumer.name,...candidate.provider.aliases,candidate.provider.name];
 const concepts=[candidate.capability.label,...candidate.searchConcepts];
 const queryBases=uniq([
  ...aliases.flatMap(alias=>concepts.slice(0,2).map(concept=>`${alias} ${concept}`)),
  ...candidate.searchConcepts.slice(0,3),
 ]).slice(0,4);
 const queries=queryBases.map(q=>`https://github.com/search?q=${encodeURIComponent(q)}&type=issues`);
 requests.push(...queries.map(url=>({url,kind:'github-search' as const})));
 const dedup=new Map<string,{url:string;kind:SourceKind}>();for(const request of requests)dedup.set(request.url,request);
 return{queries:queryBases,requests:[...dedup.values()].slice(0,16),codeTouchpoints:candidate.codeTouchpoints.slice(0,8)};
}

async function readBounded(response:Response):Promise<string>{
 const length=Number(response.headers.get('content-length')??0);if(length>MAX_BODY_BYTES)throw new Error(`source body exceeds ${MAX_BODY_BYTES} bytes`);
 const reader=response.body?.getReader();if(!reader)return'';const chunks:Uint8Array[]=[];let total=0;
 while(true){const {done,value}=await reader.read();if(done)break;total+=value.byteLength;if(total>MAX_BODY_BYTES){await reader.cancel();throw new Error(`source body exceeds ${MAX_BODY_BYTES} bytes`)}chunks.push(value)}
 return new TextDecoder().decode(Buffer.concat(chunks));
}

type CacheRecord={url:string;storedAt:string;etag?:string;lastModified?:string;status:number;content:string;failure?:string;retryUntil?:string};
async function safeCacheDir(path:string){
 await mkdir(path,{recursive:true,mode:0o700});const st=await lstat(path);if(st.isSymbolicLink()||!st.isDirectory())throw new Error('Verification cache must be a regular directory');
 const resolved=await import('node:fs/promises').then(fs=>fs.realpath(path));if(!resolved)throw new Error('Cannot resolve verification cache');
}
async function cacheRead(dir:string,url:string):Promise<CacheRecord|null>{
 const path=join(dir,`${sha(url)}.json`);try{const st=await lstat(path);if(st.isSymbolicLink()||!st.isFile()||st.size>MAX_BODY_BYTES+4096)return null;const v=JSON.parse(await readFile(path,'utf8')) as CacheRecord;if(v.url!==url||Date.now()-Date.parse(v.storedAt)>CACHE_MAX_AGE_MS)return null;return v}catch{return null}
}
async function cacheWrite(dir:string,value:CacheRecord){
 const path=join(dir,`${sha(value.url)}.json`);await writeFile(path,JSON.stringify(value),{mode:0o600});
 const files=(await readdir(dir)).filter(x=>/^[a-f0-9]{64}\.json$/.test(x));const entries=(await Promise.all(files.map(async name=>{try{return{name,mtime:(await stat(join(dir,name))).mtimeMs}}catch(error){if(error&&typeof error==='object'&&'code'in error&&error.code==='ENOENT')return null;throw error}}))).filter((entry):entry is {name:string;mtime:number}=>entry!==null);entries.sort((a,b)=>a.mtime-b.mtime);
 for(const old of entries.slice(0,Math.max(0,entries.length-MAX_CACHE_ENTRIES)))await unlink(join(dir,old.name)).catch(()=>{});
}

async function requestOne(url:string,kind:SourceKind,cacheDir:string,fetcher:typeof fetch,checkedAt:string):Promise<RetrievedSource>{
 const current=await cacheRead(cacheDir,url);const fresh=current&&(current.failure?Date.now()<Date.parse(current.retryUntil??new Date(Date.parse(current.storedAt)+CACHE_TTL_MS).toISOString()):Date.now()-Date.parse(current.storedAt)<CACHE_TTL_MS);
 if(fresh&&current.failure)return{url,kind,checkedAt:current.storedAt,fetchStatus:'unavailable',httpStatus:current.status||undefined,content:'',excerpt:'',error:`Previously unavailable; refresh suppressed until ${current.retryUntil??'the cache expires'}. ${current.failure}`,cache:'hit'};
 if(fresh)return parseSource(url,kind,current.content,checkedAt,current.status,current.etag,current.lastModified,'hit');
 const headers:Record<string,string>={Accept:kind==='discourse-topic'?'application/json, text/html':'text/html, application/atom+xml, application/json;q=0.9, */*;q=0.5','User-Agent':USER_AGENT};
 if(current?.etag)headers['If-None-Match']=current.etag;if(current?.lastModified)headers['If-Modified-Since']=current.lastModified;
 try{
  const response=await fetcher(url,{headers,redirect:'manual',signal:AbortSignal.timeout(10000)});
  if(response.status>=300&&response.status<400)throw new Error(`redirect ${response.status} requires a separate allowlisted source check`);
  if(response.status===304&&current){const updated={...current,storedAt:checkedAt};await cacheWrite(cacheDir,updated);return parseSource(url,kind,current.content,checkedAt,current.status,current.etag,current.lastModified,'revalidated')}
  if(!response.ok){const message=`HTTP ${response.status}`;if([403,404,410,429].includes(response.status)){const retryHours=response.status===429?1:6;await cacheWrite(cacheDir,{url,storedAt:checkedAt,status:response.status,content:'',failure:message,retryUntil:new Date(Date.parse(checkedAt)+retryHours*60*60*1000).toISOString(),...(response.headers.get('etag')?{etag:response.headers.get('etag')!}:{}),...(response.headers.get('last-modified')?{lastModified:response.headers.get('last-modified')!}:{})})}throw new Error(message)}
  const content=await readBounded(response);if(!content.trim())throw new Error('empty public source response');
  const record:CacheRecord={url,storedAt:checkedAt,status:response.status,content,...(response.headers.get('etag')?{etag:response.headers.get('etag')!}:{}),...(response.headers.get('last-modified')?{lastModified:response.headers.get('last-modified')!}:{})};
  await cacheWrite(cacheDir,record);return parseSource(url,kind,content,checkedAt,response.status,record.etag,record.lastModified,'miss');
 }catch(e){const message=e instanceof Error?e.message:String(e);if(/EAI_AGAIN|ENOTFOUND|ECONNREFUSED/.test(message)){await cacheWrite(cacheDir,{url,storedAt:checkedAt,status:0,content:'',failure:message,retryUntil:new Date(Date.parse(checkedAt)+30*60*1000).toISOString()})}const httpStatus=Number(message.match(/^HTTP (\d+)$/)?.[1]);return{url,kind,checkedAt,fetchStatus:'unavailable',httpStatus:httpStatus||undefined,content:'',excerpt:'',error:message,cache:current?'revalidated':'miss'}}
}

function decodeEntities(value:string){return value.replace(/&(?:amp|lt|gt|quot|apos|#39|#x27|nbsp|#(\d+)|#x([0-9a-f]+));/gi,(m,dec,hex)=>{if(dec)return String.fromCodePoint(Number(dec));if(hex)return String.fromCodePoint(parseInt(hex,16));return({'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'",'&#39;':"'",'&#x27;':"'",'&nbsp;':' '} as Record<string,string>)[m.toLowerCase()]??' '})}
function htmlText(html:string){return decodeEntities(html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/\\u003c/gi,'<').replace(/\\u003e/gi,'>').replace(/\\u0026/gi,'&').replace(/\\n/g,' ')).replace(/\s+/g,' ').trim()}
function embeddedGithubText(html:string):{content:string;publishedAt?:string;revision?:string}{
 const match=html.match(/<script[^>]*data-target="react-app\.embeddedData"[^>]*>([\s\S]*?)<\/script>/i);
 if(!match)return{content:htmlText(html)};
 try{
  const json=JSON.parse(match[1]);const values:string[]=[];const dates:string[]=[];const revisions:string[]=[];
  const walk=(value:unknown,key='')=>{if(typeof value==='string'){if(/^(createdAt|updatedAt|committedDate|publishedAt)$/.test(key)&&!Number.isNaN(Date.parse(value)))dates.push(value);if(/^(oid|sha|commitOid)$/.test(key)&&/^[a-f0-9]{40}$/i.test(value))revisions.push(value);if(/^(title|body|bodyHTML|message|nameWithOwner|state|stateReason|displayName)$/.test(key))values.push(value)}else if(Array.isArray(value))value.forEach(x=>walk(x,key));else if(value&&typeof value==='object')for(const [k,v] of Object.entries(value))walk(v,k)};
  walk(json);return{content:htmlText(values.join('\n')),publishedAt:dates.sort((a,b)=>Date.parse(b)-Date.parse(a))[0],revision:revisions[0]};
 }catch{return{content:htmlText(html)}}
}
function parseSource(url:string,kind:SourceKind,raw:string,checkedAt:string,httpStatus:number,etag?:string,lastModified?:string,cache?:RetrievedSource['cache']):RetrievedSource{
 let content='',publishedAt:string|undefined,revision:string|undefined;
 if(kind==='github-current-ref'){
  const link=raw.match(/<link[^>]*>([\s\S]*?)<\/link>/i)?.[1];const date=raw.match(/<updated>([^<]+)<\/updated>/i)?.[1];revision=(link??'').match(/([a-f0-9]{40})/i)?.[1]??raw.match(/\/commits\/([a-f0-9]{40})/i)?.[1];publishedAt=date;content=[revision,date,raw.match(/<title>([^<]+)<\/title>/i)?.[1]].filter(Boolean).join(' ');
  if(!revision)content=htmlText(raw);
 }else if(kind==='discourse-topic'){
  try{const data=JSON.parse(raw);const posts=data?.post_stream?.posts??[];publishedAt=posts.map((p:any)=>p.created_at).filter(Boolean).sort((a:string,b:string)=>Date.parse(b)-Date.parse(a))[0]??data?.created_at;content=[data.title,...posts.map((p:any)=>typeof p.raw==='string'&&p.raw.trim()?p.raw:htmlText(typeof p.cooked==='string'?p.cooked:''))].filter(Boolean).join('\n')}catch{content=htmlText(raw)}
}else if(new URL(url).hostname==='raw.githubusercontent.com')content=raw.trim();
 else if(raw.trimStart().startsWith('<!DOCTYPE html')||raw.includes('react-app.embeddedData')){
  const embedded=embeddedGithubText(raw);content=embedded.content;publishedAt=embedded.publishedAt;revision=embedded.revision;
  const rel=raw.match(/<relative-time[^>]*datetime="([^"]+)"/i)?.[1];if(rel)publishedAt=rel;
  const meta=raw.match(/<meta[^>]+property="article:published_time"[^>]+content="([^"]+)"/i)?.[1];if(meta&&!publishedAt)publishedAt=meta;
 }else content=htmlText(raw);
 const revInUrl=url.match(/\/(?:commit|blob|tree)\/([a-f0-9]{40})(?:\/|$)/i)?.[1]??url.match(/^https:\/\/raw\.githubusercontent\.com\/[^/]+\/[^/]+\/([a-f0-9]{40})\//i)?.[1];revision=revision??revInUrl;
 const excerpt=content.length>7000?content.slice(0,7000):content;
 return{url,kind,checkedAt,fetchStatus:'available',httpStatus,publishedAt,revision,etag,lastModified,content,excerpt,cache};
}

function matchCount(content:string,terms:string[]){const lower=content.toLowerCase();return terms.filter(term=>lower.includes(term.toLowerCase())).length}
function meaningful(source:RetrievedSource,terms:string[]){return source.fetchStatus==='available'&&matchCount(source.content,terms)>=Math.min(2,terms.length)}
const COMPLETION_PATTERN=/(?:completed|successfully (?:tested|used|integrated|executed)|demonstrated|testnet trade|working end[- ]to[- ]end|used on testnet|settled on testnet)/i;
function sourceDate(source:RetrievedSource){const parsed=source.publishedAt?Date.parse(source.publishedAt):NaN;return Number.isFinite(parsed)?new Date(parsed):null}
function bestExcerpt(content:string,terms:string[]){
 const completions=[...content.matchAll(new RegExp(COMPLETION_PATTERN.source,'gi'))];
 for(const match of completions){const at=match.index??0;const start=Math.max(0,at-480);const excerpt=content.slice(start,Math.min(content.length,at+620)).trim();if(matchCount(excerpt,terms)>=Math.min(2,terms.length))return excerpt}
 const lower=content.toLowerCase();const at=terms.map(t=>lower.indexOf(t.toLowerCase())).filter(n=>n>=0).sort((a,b)=>a-b)[0]??0;const start=Math.max(0,at-320);return content.slice(start,Math.min(content.length,start+1100)).trim();
}
function evidenceType(source:RetrievedSource,content:string):EvidenceType{
 if(source.kind==='github-source'&&(/\/blob\//.test(source.url)||/^https:\/\/raw\.githubusercontent\.com\//.test(source.url)||/\.atom$/.test(source.url)))return'code_observed';
 if(/happy to (?:jump on|help|review|set up)|available to (?:review|help)|offering (?:an?|to)/i.test(content)&&(/\/issues\/|talk\.nervos\.org/.test(source.url)))return'human_offer';
 if(/teapaw\.org/.test(source.url))return'maintainer_report';
 if(COMPLETION_PATTERN.test(content))return'maintainer_report';
 return'status_update';
}
function inferLifecycle(candidate:CandidateSpec,sources:RetrievedSource[],checkedAt:string):Pick<CandidateVerification,'result'|'freshness'|'lifecycleState'|'compatibilityState'|'summary'|'uncertainty'|'nextAction'|'evidence'|'limitations'>{
 const materials=sources.filter(x=>meaningful(x,candidate.capability.terms));
 const priorEvidence=candidate.priorEvidence.filter(x=>matchCount(x.excerpt,candidate.capability.terms)>=Math.min(2,candidate.capability.terms.length));
 const available=sources.filter(x=>x.fetchStatus==='available');const unavailable=sources.filter(x=>x.fetchStatus==='unavailable');
 const hasCurrentRef=sources.some(x=>x.kind==='github-current-ref'&&x.fetchStatus==='available'&&Boolean(x.revision));
 const freshness:Freshness=unavailable.length===0&&hasCurrentRef?'current':available.length>0?'partial':'unresolved';
 const allContent=[...materials.map(x=>x.content),...priorEvidence.map(x=>x.excerpt)];
 const hasOffer=allContent.some(x=>/happy to (?:jump on|help|review|set up)|available to (?:review|help)|offering (?:an?|to)/i.test(x));
 const suppliedCompletion=priorEvidence.some(x=>x.evidenceType==='maintainer_report'&&COMPLETION_PATTERN.test(x.excerpt));
 const hasCurrentCompletion=materials.some(x=>COMPLETION_PATTERN.test(x.content));
 const hasCompletion=hasCurrentCompletion||suppliedCompletion;
 const requestPattern=/\b(?:(?:we|they|i)\s+(?:still\s+)?(?:need|require)|(?:we|they|i)\s+(?:are\s+)?(?:looking for|seeking|requesting)|(?:still\s+)?(?:need|needs|require|requires)\s+(?:a|an|the)\s+(?:capability|integration|feature|support|review))\b/i;
 const scopedRequest=(content:string)=>content.split(/[.!?\n]+/).some(sentence=>requestPattern.test(sentence)&&matchCount(sentence,candidate.capability.terms)>=Math.min(2,candidate.capability.terms.length));
 const requestSources=materials.filter(source=>source.kind==='discourse-topic'||/\/issues\/\d+(?:$|[?#])/.test(source.url));
 const priorRequestEvidence=priorEvidence.filter(item=>item.evidenceType==='status_update'&&(/\/issues\/\d+(?:$|[?#])|talk\.nervos\.org/.test(item.sourceUrl)));
 const asksAgain=requestSources.some(source=>scopedRequest(source.content))||priorRequestEvidence.some(item=>scopedRequest(item.excerpt));
 const hasSupersession=allContent.some(x=>/(?:superseded|replaced by|deprecated in favor of|no longer supported)/i.test(x));
 const code=materials.some(x=>x.kind==='github-source'&&(/\/blob\//.test(x.url)||/^https:\/\/raw\.githubusercontent\.com\//.test(x.url)));
 const humanOfferSources=materials.filter(x=>/\/issues\/|talk\.nervos\.org/.test(x.url));
 const offerDates=[...humanOfferSources.map(sourceDate),...priorEvidence.filter(x=>x.evidenceType==='human_offer'&&x.publishedAt).map(x=>new Date(x.publishedAt!))].filter((x):x is Date=>x instanceof Date&&!Number.isNaN(x.getTime()));
 const offerDate=offerDates.sort((a,b)=>b.getTime()-a.getTime())[0];
 const oldOffer=hasOffer&&offerDate!==undefined&&Date.parse(checkedAt)-offerDate.getTime()>90*24*60*60*1000;
 const contradictory=hasCompletion&&asksAgain;
 let lifecycleState:LifecycleState='unknown',result:VerificationResult='unavailable',summary='',uncertainty='',nextAction='Refresh the cited public sources and inspect the relevant capability before promoting this opportunity.';
 if(materials.length||priorEvidence.length){result=unavailable.length?'partial':'complete';
  if(contradictory){lifecycleState='in_progress';result='contradictory';summary='Current source text contains both completion language and a continuing request for the same scoped capability.';uncertainty='The sources may refer to different versions, environments, or deliverables; the evidence does not identify which work remains.';nextAction='Compare the dated implementation and request, then split or revise the capability scope before promoting it.'}
  else if(hasSupersession){lifecycleState='superseded';summary='A current relevant source says this capability was replaced or deprecated.';uncertainty='The replacement path and affected releases must be confirmed against the consuming project.';nextAction='Inspect the replacement interface and update the candidate to the current capability.'}
  else if(oldOffer){lifecycleState='stale_offer';summary='A public human collaboration offer is still visible, but its last recorded update is older than 90 days.';uncertainty='Age and lack of a newer confirmation do not prove the offer was withdrawn or remains available.';nextAction='Reconfirm the offer before presenting it as available; do not contact the project automatically.'}
  else if(hasOffer){lifecycleState='proposed';summary='A relevant source records a human collaboration offer.';uncertainty='The offer is not evidence of a code capability, accepted introduction, or completed work.';nextAction='Ask the builder to reconfirm the offer and agree on scope before recording an introduction.'}
  else if(hasCompletion){lifecycleState='demonstrated_in_wild';summary=suppliedCompletion&&!hasCurrentCompletion?'A preserved source-linked reviewer summary attributes a scoped testnet demonstration to the maintainer report.':'A current relevant source reports a scoped execution or demonstration.';uncertainty=suppliedCompletion&&!hasCurrentCompletion?'The underlying public report was not retrieved in this check; the supplied summary is not verbatim, and it does not establish independent reproduction, production readiness, or adoption.':'The report does not establish independent reproduction, production readiness, or adoption.';nextAction=suppliedCompletion&&!hasCurrentCompletion?'Retrieve the cited report when accessible, then independently check the exact environment and release.':'Preserve the dated report and run an independent check against the exact environment and release.'}
  else if(code){lifecycleState=candidate.priorLifecycle==='unknown'||candidate.priorLifecycle==='proposed'?'in_progress':candidate.priorLifecycle;summary=candidate.priorLifecycle==='unknown'||candidate.priorLifecycle==='proposed'?'Current source code contains relevant implementation touchpoints for this capability.':'Current source code contains relevant implementation touchpoints; the stronger previously recorded lifecycle event is retained.';uncertainty='Source presence does not prove successful end-to-end execution, deployment, maintainer readiness, or adoption. Prior reported events remain attributed to their original source.';nextAction='Run a bounded cross-project test against the exact interface and preserve positive and negative results.'}
  else{lifecycleState='proposed';summary='Relevant current source material discusses the scoped capability, but does not demonstrate completion.';uncertainty='The source does not establish implementation or compatible runtime behavior.';nextAction='Inspect the cited code and record a reproducible compatibility check before promotion.'}
 }else if(available.length){result=unavailable.length?'partial':'complete';lifecycleState=candidate.priorLifecycle;summary='Sources were fetched, but none contained enough capability-specific evidence to change the recorded lifecycle state.';uncertainty='This is not evidence that the capability is absent or that the opportunity is new.'}
  else{result='unavailable';lifecycleState=candidate.priorLifecycle;summary=candidate.priorLifecycle==='unknown'?'No targeted source could be fetched during this check.':'No targeted source could be fetched; the last recorded lifecycle state is retained without claiming it is current.';uncertainty='Freshness and current implementation status remain unresolved; an unavailable source is not negative evidence.'}
 if(unavailable.length){const failures=unavailable.map(x=>`${new URL(x.url).hostname}: ${x.error??'unavailable'}`);uncertainty=[uncertainty,`Source refresh was incomplete; unavailable sources are not negative evidence: ${failures.join('; ')}.`].filter(Boolean).join(' ');if(result==='complete')result='partial'}
 const sourceEvidence=materials.map(source=>{
  const excerpt=bestExcerpt(source.content,candidate.capability.terms);const type=evidenceType(source,source.content);const sourceCompletion=COMPLETION_PATTERN.test(source.content);const sourceOffer=/happy to (?:jump on|help|review|set up)|available to (?:review|help)|offering (?:an?|to)/i.test(source.content);const conclusion=type==='human_offer'?sourceOffer&&oldOffer?'offer requires reconfirmation':'human offer reported':sourceCompletion?'maintainer-reported scoped demonstration':type==='code_observed'?'relevant source implementation observed':'relevant current source material';
  return{id:sha(`${candidate.opportunityId}\0${candidate.capability.key}\0${source.url}\0${source.revision??''}\0${source.checkedAt}`),sourceUrl:source.url,...(source.revision?{revision:source.revision}:{}),...(sourceDate(source)?{publishedAt:sourceDate(source)!.toISOString()}:{}),checkedAt:source.checkedAt,evidenceType:type,excerpt,conclusion,verification:type==='code_observed'?'Source file was retrieved; code presence is independently observable, runtime behavior is unverified.':'Public source content was retrieved and matched the specific capability terms; interpretation is automated and attributed to the source.',sourceSha256:sha(source.content)};
 });
 const suppliedEvidence:LifecycleEvidence[]=priorEvidence.map(item=>({id:sha(`${candidate.opportunityId}\0${candidate.capability.key}\0supplied\0${item.sourceUrl}\0${item.revision??''}\0${item.excerpt}`),sourceUrl:item.sourceUrl,...(item.revision?{revision:item.revision}:{}),...(item.publishedAt?{publishedAt:item.publishedAt}:{}),checkedAt,evidenceType:item.evidenceType,excerpt:item.excerpt,conclusion:'Reviewer-supplied source summary; not presented as a verbatim source excerpt.',verification:item.verification,sourceSha256:sha(item.excerpt)}));
 const evidence=[...suppliedEvidence,...sourceEvidence];
 const limitations=[
  'This bounded check is not an exhaustive search of every repository, forum, private channel, or alternate project alias.',
  'Automated text interpretation distinguishes source claims from code observation but does not prove capability correctness or adoption.',
  'Technical lifecycle and compatibility are separate; no network or release match alone establishes compatibility.',
  ...(unavailable.length?['Unavailable sources leave freshness unresolved and are not treated as evidence that prior work does not exist.']:[]),
 ];
 return{result,freshness,lifecycleState,compatibilityState:candidate.priorCompatibility,summary,uncertainty,nextAction,evidence,limitations};
}

export async function verifyCandidateCurrentState(input:unknown,options:{cacheDir:string;now?:Date;fetcher?:typeof fetch}):Promise<CandidateVerification>{
 const candidate=CandidateSpecSchema.parse(input);const checkedAt=(options.now??new Date()).toISOString();const plan=buildVerificationPlan(candidate);await safeCacheDir(options.cacheDir);
 const sources:RetrievedSource[]=[];
 const suppressed=new Map(candidate.knownUnavailableSources.filter(x=>Date.parse(checkedAt)-Date.parse(x.checkedAt)<CACHE_TTL_MS).map(x=>[x.url,x]));
 for(const [url,prior] of suppressed){const request=plan.requests.find(x=>x.url===url);if(request)sources.push({url,kind:request.kind,checkedAt:prior.checkedAt,fetchStatus:'unavailable',content:'',excerpt:'',error:`Previously blocked; refresh suppressed until the six-hour retry window expires. ${prior.reason}`,cache:'hit'})}
 const activeRequests=plan.requests.filter(r=>!suppressed.has(r.url));
 for(let i=0;i<activeRequests.length;i+=3){const batch=activeRequests.slice(i,i+3);sources.push(...await Promise.all(batch.map(r=>requestOne(r.url,r.kind,options.cacheDir,options.fetcher??fetch,checkedAt))))}
 const touchpointRequests=plan.codeTouchpoints.map(point=>{
  const root=repositoryRoot(point.repository);const ref=sources.find(s=>s.kind==='github-current-ref'&&s.url===`${root}/commits/HEAD.atom`&&s.fetchStatus==='available'&&s.revision)?.revision;const [,owner,name]=new URL(root).pathname.split('/');
  return ref?{url:`https://raw.githubusercontent.com/${owner}/${name}/${ref}/${point.path}`,kind:'github-source' as const}:{url:`https://raw.githubusercontent.com/${owner}/${name}/HEAD/${point.path}`,kind:'github-source' as const};
 });
 for(let i=0;i<touchpointRequests.length;i+=3){const batch=touchpointRequests.slice(i,i+3);sources.push(...await Promise.all(batch.map(r=>requestOne(r.url,r.kind,options.cacheDir,options.fetcher??fetch,checkedAt))))}
 const evaluated=inferLifecycle(candidate,sources,checkedAt);
 return{opportunityId:candidate.opportunityId,capabilityKey:candidate.capability.key,checkedAt,priorLifecycle:candidate.priorLifecycle,...evaluated,queries:plan.queries,sources,summary:evaluated.summary||'No lifecycle conclusion was produced.'};
}

export function appendExecutionEvidence(result:CandidateVerification,evidence:{sourceUrl:string;revision:string;path:string;line?:number;excerpt:string;conclusion:string;checkedAt?:string}):CandidateVerification{
 const checkedAt=evidence.checkedAt??result.checkedAt;const record:LifecycleEvidence={id:sha(`${result.opportunityId}\0${result.capabilityKey}\0${evidence.sourceUrl}\0${evidence.revision}\0${checkedAt}`),sourceUrl:evidence.sourceUrl,revision:evidence.revision,path:evidence.path,...(evidence.line?{line:evidence.line}:{}),checkedAt,evidenceType:'executed_demo',excerpt:evidence.excerpt,conclusion:evidence.conclusion,verification:'Trycove local isolated execution receipt; not a public-chain acceptance or maintainer adoption claim.',sourceSha256:sha(evidence.excerpt)};
 return{...result,evidence:[...result.evidence,record],lifecycleState:result.lifecycleState==='demonstrated_in_wild'?result.lifecycleState:'in_progress',compatibilityState:result.compatibilityState==='incompatible'?'incompatible':'partially_compatible',summary:`${result.summary} A reproducible offline integration experiment was executed and attached.`,nextAction:'Assess release, chain-state, signer, and end-to-end submission requirements before claiming live compatibility.'};
}
