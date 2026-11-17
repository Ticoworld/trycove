import {createHash} from 'node:crypto';
import {z} from 'zod';

const OWNER_OR_REPO=/^[A-Za-z0-9_.-]{1,100}$/;
const MAX_JSON_BYTES=2_000_000;
const MAX_COMMENT_PAGES=5;
const MAX_LINKED_PRS=30;
const MAX_LINKED_REPOSITORIES=30;
const MAX_LINKED_ISSUES=5;
const API_ROOT='https://api.github.com';

export const GitHubIssueUrlSchema=z.string().url().refine(raw=>{
 try{
  const url=new URL(raw);
  return url.protocol==='https:'&&url.hostname==='github.com'&&!url.port&&!url.username&&!url.password&&/^\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/issues\/\d+\/?$/.test(url.pathname);
 }catch{return false}
},'Expected a public GitHub issue URL');

export const GitHubPullUrlSchema=z.string().url().refine(raw=>{
 try{
  const url=new URL(raw);
  return url.protocol==='https:'&&url.hostname==='github.com'&&!url.port&&!url.username&&!url.password&&/^\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/pull\/\d+\/?$/.test(url.pathname);
 }catch{return false}
},'Expected a public GitHub pull request URL');

export const RepositoryIdentitySchema=z.object({
 requestedUrl:z.string().url(),
 apiMetadataUrl:z.string().url(),
 originalFullName:z.string().min(3),
 canonicalFullName:z.string().min(3),
 canonicalUrl:z.string().url(),
 repositoryId:z.number().int().positive(),
 nodeId:z.string().min(1),
 resolvedAt:z.string().datetime({offset:true}),
 resolution:z.enum(['direct_metadata','canonical_metadata','api_redirect']),
}).strict();

export const ThreadCommentSchema=z.object({
 id:z.number().int().positive(),
 url:z.string().url(),
 author:z.string().min(1),
 authorAssociation:z.string().max(40),
 createdAt:z.string().datetime({offset:true}),
 updatedAt:z.string().datetime({offset:true}),
 body:z.string().max(100_000),
 bodyOriginalLength:z.number().int().nonnegative(),
 bodyTruncated:z.boolean(),
}).strict();

export const ThreadFailureSchema=z.object({url:z.string().url(),stage:z.enum(['repository','issue','comments','linked_pull','pull_files']),httpStatus:z.number().int().optional(),message:z.string().min(1).max(500)}).strict();

export const IssueThreadSchema=z.object({
 requestedUrl:GitHubIssueUrlSchema,
 canonicalUrl:z.string().url(),
 repository:RepositoryIdentitySchema,
 issueNumber:z.number().int().positive(),
 title:z.string().max(500),
 state:z.enum(['open','closed']),
 createdAt:z.string().datetime({offset:true}),
 updatedAt:z.string().datetime({offset:true}),
 closedAt:z.string().datetime({offset:true}).nullable(),
 author:z.string().min(1),
 body:z.string().max(200_000),
 bodyOriginalLength:z.number().int().nonnegative(),
 bodyTruncated:z.boolean(),
 bodySha256:z.string().regex(/^[a-f0-9]{64}$/),
 commentsStatus:z.enum(['complete','partial','unavailable']),
 commentsPagesFetched:z.number().int().nonnegative(),
 comments: z.array(ThreadCommentSchema).max(500),
 failures:z.array(ThreadFailureSchema),
}).strict();

export const PullFileSchema=z.object({filename:z.string().max(1000),status:z.string().max(40),additions:z.number().int().nonnegative(),deletions:z.number().int().nonnegative(),changes:z.number().int().nonnegative(),patch:z.string().max(40_000).optional(),patchSha256:z.string().regex(/^[a-f0-9]{64}$/).optional()}).strict();

export const PullRequestSchema=z.object({
 requestedUrl:GitHubPullUrlSchema,
 canonicalUrl:z.string().url(),
 repository:RepositoryIdentitySchema,
 number:z.number().int().positive(),
 title:z.string().max(500),
 state:z.enum(['open','closed']),
 merged:z.boolean(),
 createdAt:z.string().datetime({offset:true}),
 updatedAt:z.string().datetime({offset:true}),
 closedAt:z.string().datetime({offset:true}).nullable(),
 mergedAt:z.string().datetime({offset:true}).nullable(),
 author:z.string().min(1),
 headSha:z.string().regex(/^[a-f0-9]{40}$/),
 baseSha:z.string().regex(/^[a-f0-9]{40}$/),
 body:z.string().max(100_000),
 bodyOriginalLength:z.number().int().nonnegative(),
 bodyTruncated:z.boolean(),
 bodySha256:z.string().regex(/^[a-f0-9]{64}$/),
 referencedFrom:z.array(z.object({issueUrl:GitHubIssueUrlSchema,commentId:z.number().int().positive().optional(),excerpt:z.string().max(500)}).strict()).max(50),
 filesStatus:z.enum(['complete','partial','unavailable']),
 filesPagesFetched:z.number().int().nonnegative(),
 files:z.array(PullFileSchema).max(500),
 failures:z.array(ThreadFailureSchema),
}).strict();

const IssueReferenceSchema=z.object({sourceIssueUrl:GitHubIssueUrlSchema,sourceCommentId:z.number().int().positive().optional(),targetUrl:GitHubIssueUrlSchema,referenceKind:z.enum(['absolute_url','same_repository_issue_number']),collected:z.boolean()}).strict();
export const PriorWorkCollectionSchema=z.object({
 schemaVersion:z.literal(1),
 method:z.string().min(20),
 checkedAt:z.string().datetime({offset:true}),
 issueThreads:z.array(IssueThreadSchema).max(17),
 issueReferences:z.array(IssueReferenceSchema).max(200),
 pullRequests:z.array(PullRequestSchema).max(MAX_LINKED_PRS),
 referencedRepositories:z.array(z.object({sourceUrl:z.string().url(),identity:RepositoryIdentitySchema}).strict()).max(MAX_LINKED_REPOSITORIES),
 failures:z.array(ThreadFailureSchema),
}).strict();
export type RepositoryIdentity=z.infer<typeof RepositoryIdentitySchema>;
export type IssueThread=z.infer<typeof IssueThreadSchema>;
export type PullRequestEvidence=z.infer<typeof PullRequestSchema>;
export type ThreadFailure=z.infer<typeof ThreadFailureSchema>;
export type PriorWorkCollection=z.infer<typeof PriorWorkCollectionSchema>;

const sha=(value:string|Buffer)=>createHash('sha256').update(value).digest('hex');
const iso=(value:unknown)=>typeof value==='string'&&Number.isFinite(Date.parse(value))?new Date(value).toISOString():undefined;
const boundedText=(value:unknown,limit:number)=>typeof value==='string'?value.slice(0,limit):'';

type ApiJson={value:any;url:string;status:number;headers:Headers};
type Fetcher=typeof fetch;
type ApiContext={token:string;fetcher:Fetcher;checkedAt:string};

function parseIssueUrl(raw:string){
 const url=new URL(GitHubIssueUrlSchema.parse(raw));
 const [,owner,repo,kind,number]=url.pathname.split('/');
 if(kind!=='issues'||!OWNER_OR_REPO.test(owner)||!OWNER_OR_REPO.test(repo)||!/^\d+$/.test(number))throw new Error('Invalid GitHub issue URL components');
 return{owner,repo,number:Number(number),url:`https://github.com/${owner}/${repo}/issues/${number}`};
}
function parseRepositoryUrl(raw:string){
 const url=new URL(raw);if(url.protocol!=='https:'||url.hostname!=='github.com'||url.port||url.username||url.password)throw new Error('Repository reference must use public github.com HTTPS');
 const [,owner,repo,...rest]=url.pathname.split('/');
 if(!OWNER_OR_REPO.test(owner??'')||!OWNER_OR_REPO.test(repo??'')||owner.toLowerCase()==='user-attachments'||['issues','pull','discussions','actions','releases','settings','wiki'].includes((rest[0]??'').toLowerCase()))throw new Error('Invalid GitHub repository path');
 return{owner,repo,url:`https://github.com/${owner}/${repo}`};
}
function parsePullUrl(raw:string){
 const url=new URL(GitHubPullUrlSchema.parse(raw));
 const [,owner,repo,kind,number]=url.pathname.split('/');
 if(kind!=='pull'||!OWNER_OR_REPO.test(owner)||!OWNER_OR_REPO.test(repo)||!/^\d+$/.test(number))throw new Error('Invalid GitHub pull request URL components');
 return{owner,repo,number:Number(number),url:`https://github.com/${owner}/${repo}/pull/${number}`};
}
function apiUrl(path:string){
 const url=new URL(path,API_ROOT);
 if(url.origin!==API_ROOT||url.username||url.password||url.port)throw new Error('Refusing an out-of-scope GitHub API URL');
 return url;
}
async function responseBody(response:Response){
 const length=Number(response.headers.get('content-length')??0);
 if(length>MAX_JSON_BYTES)throw new Error(`GitHub response exceeds ${MAX_JSON_BYTES} bytes`);
 const reader=response.body?.getReader();if(!reader)return'';
 const chunks:Uint8Array[]=[];let size=0;
 while(true){const{done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>MAX_JSON_BYTES){await reader.cancel();throw new Error(`GitHub response exceeds ${MAX_JSON_BYTES} bytes`)}chunks.push(value)}
 return Buffer.concat(chunks).toString('utf8');
}
async function requestJson(context:ApiContext,path:string,redirects=0):Promise<ApiJson>{
 const url=apiUrl(path);
 const response=await context.fetcher(url,{method:'GET',redirect:'manual',headers:{Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28',Authorization:`Bearer ${context.token}`,'User-Agent':'Trycove-candidate-prior-work/1.0'},signal:AbortSignal.timeout(12_000)});
 if([301,302,307,308].includes(response.status)){
  if(redirects>=1)throw new Error('GitHub API redirect limit exceeded');
  const location=response.headers.get('location');if(!location)throw new Error('GitHub API redirect omitted Location');
  const next=new URL(location,url);
  const safePath=/^\/repositories\/\d+$/.test(next.pathname)||/^\/repos\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(next.pathname);
  if(next.origin!==API_ROOT||!safePath||next.search||next.hash)throw new Error('GitHub API redirect target is outside the repository metadata allowlist');
  return requestJson(context,next.pathname,redirects+1);
 }
 const text=await responseBody(response);
 let value:any;
 try{value=JSON.parse(text)}catch{throw new Error(`GitHub API returned non-JSON (${response.status})`)}
 if(!response.ok){const message=typeof value?.message==='string'?value.message:`HTTP ${response.status}`;throw Object.assign(new Error(message),{httpStatus:response.status,url:url.href})}
 return{value,url:url.href,status:response.status,headers:response.headers};
}

export async function resolveGitHubRepository(rawUrl:string,context:ApiContext):Promise<RepositoryIdentity>{
 const parsed=parseRepositoryUrl(rawUrl);
 const path=`/repos/${encodeURIComponent(parsed.owner)}/${encodeURIComponent(parsed.repo)}`;
 const response=await requestJson(context,path);
 const r=response.value;
 if(!Number.isSafeInteger(r.id)||r.id<=0||typeof r.node_id!=='string'||typeof r.full_name!=='string'||typeof r.html_url!=='string')throw new Error('GitHub repository metadata omitted stable identity fields');
 const [canonicalOwner,canonicalRepo]=r.full_name.split('/');
 if(!canonicalOwner||!canonicalRepo||!OWNER_OR_REPO.test(canonicalOwner)||!OWNER_OR_REPO.test(canonicalRepo))throw new Error('GitHub returned an invalid canonical repository name');
 const canonicalUrl=`https://github.com/${canonicalOwner}/${canonicalRepo}`;
 const requestedFullName=`${parsed.owner}/${parsed.repo}`;
 return RepositoryIdentitySchema.parse({requestedUrl:parsed.url,apiMetadataUrl:response.url,originalFullName:requestedFullName,canonicalFullName:r.full_name,canonicalUrl,repositoryId:r.id,nodeId:r.node_id,resolvedAt:context.checkedAt,resolution:response.url!==`${API_ROOT}${path}`?'api_redirect':r.full_name.toLowerCase()!==requestedFullName.toLowerCase()?'canonical_metadata':'direct_metadata'});
}

export async function collectGitHubIssueThread(rawUrl:string,context:ApiContext,repositoryCache=new Map<string,RepositoryIdentity>()):Promise<IssueThread>{
 const parsed=parseIssueUrl(rawUrl);const rootUrl=`https://github.com/${parsed.owner}/${parsed.repo}`;
 const failures:ThreadFailure[]=[];const cacheKey=`${parsed.owner.toLowerCase()}/${parsed.repo.toLowerCase()}`;
 let repository=repositoryCache.get(cacheKey);
 try{if(!repository){repository=await resolveGitHubRepository(rootUrl,context);repositoryCache.set(cacheKey,repository)}}catch(error){
  failures.push({url:`${API_ROOT}/repos/${parsed.owner}/${parsed.repo}`,stage:'repository',httpStatus:(error as any)?.httpStatus,message:String(error instanceof Error?error.message:error).slice(0,500)});
  throw Object.assign(new Error(`Repository identity could not be resolved: ${String(error instanceof Error?error.message:error)}`),{failures});
 }
 const canonicalRepo=repository.canonicalFullName.split('/');
 const issuePath=`/repos/${encodeURIComponent(canonicalRepo[0])}/${encodeURIComponent(canonicalRepo[1])}/issues/${parsed.number}`;
 let issueResponse:ApiJson;
 try{issueResponse=await requestJson(context,issuePath)}catch(error){
  failures.push({url:`${API_ROOT}${issuePath}`,stage:'issue',httpStatus:(error as any)?.httpStatus,message:String(error instanceof Error?error.message:error).slice(0,500)});
  throw Object.assign(new Error(`Issue metadata could not be retrieved: ${String(error instanceof Error?error.message:error)}`),{failures,repository});
 }
 const issue=issueResponse.value;
 const canonicalUrl=typeof issue.html_url==='string'?issue.html_url:`${repository.canonicalUrl}/issues/${parsed.number}`;
 if(issue.repository?.id&&issue.repository.id!==repository.repositoryId)throw new Error('Issue metadata repository ID conflicts with resolved repository identity');
 const comments:any[]=[];let status:'complete'|'partial'|'unavailable'='complete',pages=0;
 for(let page=1;page<=MAX_COMMENT_PAGES;page++){
  const path=`/repos/${encodeURIComponent(canonicalRepo[0])}/${encodeURIComponent(canonicalRepo[1])}/issues/${parsed.number}/comments?per_page=100&page=${page}`;
  try{
   const response=await requestJson(context,path);pages++;
   if(!Array.isArray(response.value))throw new Error('GitHub comments response was not an array');
   for(const c of response.value){
    const createdAt=iso(c.created_at),updatedAt=iso(c.updated_at);if(!createdAt||!updatedAt||!Number.isSafeInteger(c.id)||typeof c.user?.login!=='string'||typeof c.html_url!=='string')continue;
    const rawBody=typeof c.body==='string'?c.body:'';const body=boundedText(rawBody,100_000);
    comments.push({id:c.id,url:c.html_url,author:c.user.login,authorAssociation:boundedText(c.author_association,40)||'NONE',createdAt,updatedAt,body,bodyOriginalLength:rawBody.length,bodyTruncated:body.length<rawBody.length});
   }
   if(response.value.length<100)break;
   if(page===MAX_COMMENT_PAGES)status='partial';
  }catch(error){
   status=pages===0?'unavailable':'partial';failures.push({url:`${API_ROOT}${path}`,stage:'comments',httpStatus:(error as any)?.httpStatus,message:String(error instanceof Error?error.message:error).slice(0,500)});break;
  }
 }
 const createdAt=iso(issue.created_at),updatedAt=iso(issue.updated_at);
 if(!createdAt||!updatedAt||typeof issue.user?.login!=='string'||typeof issue.title!=='string'||typeof issue.body!=='string')throw new Error('GitHub issue metadata lacked required fields');
 comments.sort((a,b)=>a.createdAt.localeCompare(b.createdAt)||a.id-b.id);
 const rawBody=issue.body;const body=boundedText(rawBody,200_000);
 return IssueThreadSchema.parse({requestedUrl:parsed.url,canonicalUrl,repository,issueNumber:parsed.number,title:boundedText(issue.title,500),state:issue.state,createdAt,updatedAt,closedAt:issue.closed_at?iso(issue.closed_at)??null:null,author:issue.user.login,body,bodyOriginalLength:rawBody.length,bodyTruncated:body.length<rawBody.length,bodySha256:sha(body),commentsStatus:status,commentsPagesFetched:pages,comments,failures});
}

export function extractGitHubPullLinks(thread:IssueThread,limit=MAX_LINKED_PRS):string[]{
 const source=[thread.body,...thread.comments.map(comment=>comment.body)].join('\n');
 const values=new Set<string>();
 for(const match of source.matchAll(/https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/pull\/\d+(?:#[A-Za-z0-9_-]+)?/gi)){
  const clean=match[0].split('#')[0].replace(/\/$/,'');if(GitHubPullUrlSchema.safeParse(clean).success)values.add(clean);if(values.size>=limit)break;
 }
 return[...values].sort();
}

export function extractGitHubIssueReferences(thread:IssueThread):Array<{targetUrl:string;commentId?:number;referenceKind:'absolute_url'|'same_repository_issue_number';excerpt:string}>{
 const candidates:Array<{targetUrl:string;commentId?:number;referenceKind:'absolute_url'|'same_repository_issue_number';excerpt:string}>=[];
 const sources:Array<{text:string;commentId?:number}>=[{text:thread.body},...thread.comments.map(comment=>({text:comment.body,commentId:comment.id}))];
 for(const source of sources){
  if(!source.text)continue;
  for(const match of source.text.matchAll(/https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/issues\/\d+(?:#[A-Za-z0-9_-]+)?/gi)){
   const targetUrl=match[0].split('#')[0].replace(/\/$/,'');if(targetUrl===thread.requestedUrl||!GitHubIssueUrlSchema.safeParse(targetUrl).success)continue;
   candidates.push({targetUrl,commentId:source.commentId,referenceKind:'absolute_url',excerpt:source.text.slice(Math.max(0,match.index-160),Math.min(source.text.length,match.index+match[0].length+160)).replace(/\s+/g,' ').slice(0,500)});
  }
  for(const match of source.text.matchAll(/\(#(\d+)\)/g)){
   const targetUrl=`${thread.repository.canonicalUrl}/issues/${match[1]}`;if(targetUrl===thread.requestedUrl||!GitHubIssueUrlSchema.safeParse(targetUrl).success)continue;
   candidates.push({targetUrl,commentId:source.commentId,referenceKind:'same_repository_issue_number',excerpt:source.text.slice(Math.max(0,match.index-160),Math.min(source.text.length,match.index+match[0].length+160)).replace(/\s+/g,' ').slice(0,500)});
  }
 }
 const unique=new Map<string,typeof candidates[number]>();for(const candidate of candidates)if(!unique.has(candidate.targetUrl))unique.set(candidate.targetUrl,candidate);
 return[...unique.values()].sort((a,b)=>a.targetUrl.localeCompare(b.targetUrl)).slice(0,20);
}

export function extractGitHubPullReferences(thread:IssueThread):Array<{url:string;commentId?:number;excerpt:string}>{
 const out:Array<{url:string;commentId?:number;excerpt:string}>=[];
 const sources:Array<{text:string;commentId?:number}>=[{text:thread.body},...thread.comments.map(comment=>({text:comment.body,commentId:comment.id}))];
 for(const source of sources){
  for(const match of source.text.matchAll(/https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/pull\/\d+(?:#[A-Za-z0-9_-]+)?/gi)){
   const url=match[0].split('#')[0].replace(/\/$/,'');if(!GitHubPullUrlSchema.safeParse(url).success)continue;
   out.push({url,commentId:source.commentId,excerpt:source.text.slice(Math.max(0,match.index-160),Math.min(source.text.length,match.index+match[0].length+160)).replace(/\s+/g,' ').slice(0,500)});
  }
 }
 return out;
}

export function extractGitHubRepositoryLinks(texts:string[],limit=MAX_LINKED_REPOSITORIES):string[]{
 const values=new Set<string>();
 for(const text of texts){
  for(const match of text.matchAll(/https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)*/gi)){
   const raw=match[0].replace(/[).,;]+$/,'');
   try{const parsed=parseRepositoryUrl(raw);values.add(parsed.url)}catch{/* Not a repository-root reference. */}
   if(values.size>=limit)return[...values].sort();
  }
 }
 return[...values].sort();
}

export async function collectGitHubPullRequest(rawUrl:string,context:ApiContext,repositoryCache=new Map<string,RepositoryIdentity>()):Promise<PullRequestEvidence>{
 const parsed=parsePullUrl(rawUrl);const rootUrl=`https://github.com/${parsed.owner}/${parsed.repo}`;const cacheKey=`${parsed.owner.toLowerCase()}/${parsed.repo.toLowerCase()}`;
 let repository=repositoryCache.get(cacheKey);if(!repository){repository=await resolveGitHubRepository(rootUrl,context);repositoryCache.set(cacheKey,repository)}
 const [owner,repo]=repository.canonicalFullName.split('/');const endpoint=`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls/${parsed.number}`;
 const pullResponse=await requestJson(context,endpoint),pull=pullResponse.value;const failures:ThreadFailure[]=[];
 const files: z.infer<typeof PullFileSchema>[]=[];let filesStatus:'complete'|'partial'|'unavailable'='complete',filesPagesFetched=0;
 for(let page=1;page<=5;page++){
  const path=`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls/${parsed.number}/files?per_page=100&page=${page}`;
  try{
   const response=await requestJson(context,path);filesPagesFetched++;if(!Array.isArray(response.value))throw new Error('GitHub pull files response was not an array');
   for(const f of response.value){
    if(typeof f.filename!=='string')continue;const patch=typeof f.patch==='string'?f.patch.slice(0,40_000):undefined;
    files.push({filename:f.filename.slice(0,1000),status:boundedText(f.status,40),additions:Number.isSafeInteger(f.additions)?f.additions:0,deletions:Number.isSafeInteger(f.deletions)?f.deletions:0,changes:Number.isSafeInteger(f.changes)?f.changes:0,...(patch!==undefined?{patch,patchSha256:sha(patch)}:{})});
   }
   if(response.value.length<100)break;if(page===5)filesStatus='partial';
  }catch(error){filesStatus=filesPagesFetched===0?'unavailable':'partial';failures.push({url:`${API_ROOT}${path}`,stage:'pull_files',httpStatus:(error as any)?.httpStatus,message:String(error instanceof Error?error.message:error).slice(0,500)});break}
 }
 const createdAt=iso(pull.created_at),updatedAt=iso(pull.updated_at);if(!createdAt||!updatedAt||typeof pull.user?.login!=='string'||typeof pull.title!=='string'||typeof pull.body!=='string'||typeof pull.head?.sha!=='string'||typeof pull.base?.sha!=='string')throw new Error('GitHub pull request metadata lacked required fields');
 if(!/^[a-f0-9]{40}$/.test(pull.head.sha)||!/^[a-f0-9]{40}$/.test(pull.base.sha))throw new Error('GitHub pull request revision was not a full commit SHA');
 files.sort((a,b)=>a.filename.localeCompare(b.filename));
 const rawBody=pull.body;const body=boundedText(rawBody,100_000);
 return PullRequestSchema.parse({requestedUrl:parsed.url,canonicalUrl:typeof pull.html_url==='string'?pull.html_url:parsed.url,repository,number:parsed.number,title:boundedText(pull.title,500),state:pull.state,merged:pull.merged===true,createdAt,updatedAt,closedAt:pull.closed_at?iso(pull.closed_at)??null:null,mergedAt:pull.merged_at?iso(pull.merged_at)??null:null,author:pull.user.login,headSha:pull.head.sha,baseSha:pull.base.sha,body,bodyOriginalLength:rawBody.length,bodyTruncated:body.length<rawBody.length,bodySha256:sha(body),referencedFrom:[],filesStatus,filesPagesFetched,files,failures});
}

export async function collectCandidatePriorWork(input:{issueUrls:string[];token:string;checkedAt?:string;fetcher?:Fetcher}):Promise<PriorWorkCollection>{
 const checkedAt=input.checkedAt??new Date().toISOString();const context={token:input.token,fetcher:input.fetcher??fetch,checkedAt};
 const repositoryCache=new Map<string,RepositoryIdentity>(),failures:ThreadFailure[]=[],threads:IssueThread[]=[];
 const issueUrls=[...new Set(input.issueUrls.map(url=>GitHubIssueUrlSchema.parse(url)))].slice(0,12);
 for(const url of issueUrls){
  try{threads.push(await collectGitHubIssueThread(url,context,repositoryCache))}catch(error){
   const attached=(error as any)?.failures as ThreadFailure[]|undefined;
   failures.push(...(attached??[{url,stage:'issue' as const,httpStatus:(error as any)?.httpStatus,message:String(error instanceof Error?error.message:error).slice(0,500)}]));
  }
 }
 const linkedIssueReferences=threads.flatMap(thread=>extractGitHubIssueReferences(thread).map(reference=>({sourceIssueUrl:thread.requestedUrl,...reference})));
 const referenceCounts=new Map<string,number>();for(const reference of linkedIssueReferences)referenceCounts.set(reference.targetUrl,(referenceCounts.get(reference.targetUrl)??0)+1);
 const existingIssueUrls=new Set(threads.map(thread=>thread.requestedUrl.toLowerCase()));
 const linkedIssueUrls=[...referenceCounts.keys()].filter(url=>!existingIssueUrls.has(url.toLowerCase())).sort((a,b)=>(referenceCounts.get(b)??0)-(referenceCounts.get(a)??0)||a.localeCompare(b)).slice(0,MAX_LINKED_ISSUES);
 for(const url of linkedIssueUrls){try{threads.push(await collectGitHubIssueThread(url,context,repositoryCache))}catch(error){const attached=(error as any)?.failures as ThreadFailure[]|undefined;failures.push(...(attached??[{url,stage:'issue' as const,httpStatus:(error as any)?.httpStatus,message:String(error instanceof Error?error.message:error).slice(0,500)}]))}}
 const collectedIssueUrls=new Set(threads.map(thread=>thread.requestedUrl.toLowerCase()));
 const issueReferences=linkedIssueReferences.map(({sourceIssueUrl,commentId,targetUrl,referenceKind})=>({sourceIssueUrl,...(commentId?{sourceCommentId:commentId}:{}),targetUrl,referenceKind,collected:collectedIssueUrls.has(targetUrl.toLowerCase())}));
 const pullRefs=threads.flatMap(thread=>extractGitHubPullReferences(thread).map(reference=>({...reference,sourceIssueUrl:thread.requestedUrl})));
 const pullRefByUrl=new Map<string,typeof pullRefs>();for(const reference of pullRefs){const existing=pullRefByUrl.get(reference.url)??[];if(existing.length<50)existing.push(reference);pullRefByUrl.set(reference.url,existing)}
 const pullUrls=[...new Set(pullRefs.map(reference=>reference.url))].slice(0,MAX_LINKED_PRS);
 const pullRequests:PullRequestEvidence[]=[];
 for(const url of pullUrls){try{const pull=await collectGitHubPullRequest(url,context,repositoryCache);const referencedFrom=(pullRefByUrl.get(url)??[]).map(reference=>({issueUrl:reference.sourceIssueUrl,...(reference.commentId?{commentId:reference.commentId}:{}),excerpt:reference.excerpt}));pullRequests.push(PullRequestSchema.parse({...pull,referencedFrom}))}catch(error){failures.push({url,stage:'linked_pull',httpStatus:(error as any)?.httpStatus,message:String(error instanceof Error?error.message:error).slice(0,500)})}}
 const referenceTexts=[...threads.flatMap(thread=>[thread.body,...thread.comments.map(comment=>comment.body)]),...pullRequests.map(pull=>pull.body)];
 const seenRepositoryRequests=new Set(repositoryCache.keys());
 const referencedRepositories:{sourceUrl:string;identity:RepositoryIdentity}[]=[];
 for(const url of extractGitHubRepositoryLinks(referenceTexts)){
  try{
   const parsed=parseRepositoryUrl(url);const cacheKey=`${parsed.owner.toLowerCase()}/${parsed.repo.toLowerCase()}`;
   if(seenRepositoryRequests.has(cacheKey))continue;
   let identity=repositoryCache.get(cacheKey);if(!identity){identity=await resolveGitHubRepository(url,context);repositoryCache.set(cacheKey,identity)}
   seenRepositoryRequests.add(cacheKey);referencedRepositories.push({sourceUrl:url,identity});
  }catch(error){failures.push({url,stage:'repository',httpStatus:(error as any)?.httpStatus,message:String(error instanceof Error?error.message:error).slice(0,500)})}
 }
 const collection=PriorWorkCollectionSchema.parse({schemaVersion:1,method:'Authenticated, read-only GitHub REST issue metadata plus bounded paginated comments; up to five one-hop linked issues, directly linked pull requests and repository references; aliases resolved through GitHub metadata/allowlisted redirects; no broad search or writes.',checkedAt,issueThreads:threads.sort((a,b)=>a.requestedUrl.localeCompare(b.requestedUrl)),issueReferences,pullRequests:pullRequests.sort((a,b)=>a.canonicalUrl.localeCompare(b.canonicalUrl)),referencedRepositories,failures});
 return collection;
}

export function rankControlIssueUrls(issueUrls:string[],excludedUrls:string[],seed='tc-01d-r1-independent-control-v1'){
 const excluded=new Set(excludedUrls.map(value=>value.toLowerCase().replace(/\/$/,'')));
 return [...new Set(issueUrls.filter(url=>GitHubIssueUrlSchema.safeParse(url).success).map(url=>new URL(url).href.replace(/\/$/,'')))]
  .filter(url=>!excluded.has(url.toLowerCase()))
  .map(url=>({url,rankSha256:sha(`${seed}\0${url.toLowerCase()}`)}))
  .sort((a,b)=>a.rankSha256.localeCompare(b.rankSha256)||a.url.localeCompare(b.url));
}
