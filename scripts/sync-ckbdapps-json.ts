import {createHash} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {and,desc,eq,inArray} from 'drizzle-orm';
import {db} from '../lib/db';
import {externalSourceSnapshots,projectRepositories,projects,signals,sourceRecords} from '../lib/schema';
import {CKBDAPPS_URL,localized,metadataClaims,parseCkbDappsFeed,repositoryUrl,safeHttpUrl,sha256} from '../lib/sources/ckbdapps-json';
import {readBoundedBody} from '../lib/sources/http';

const maxBytes=5_000_000;
const markdownProjectPath=(url:string,id:string)=>/^https:\/\/github\.com\/CKBFansDAO\/ckbdapps\/blob\/[a-f0-9]{40}\/content\/projects\//i.test(url)&&url.endsWith(`/${encodeURIComponent(id)}.md`);
async function responseText(response:Response){return(await readBoundedBody(response,maxBytes)).toString('utf8')}
async function main(){
 const checkedAt=new Date();const url=new URL(CKBDAPPS_URL);
 const prior=await db.select().from(externalSourceSnapshots).where(and(eq(externalSourceSnapshots.source,'ckbdapps-json'),eq(externalSourceSnapshots.key,'projects'),inArray(externalSourceSnapshots.status,['ok','not_modified']))).orderBy(desc(externalSourceSnapshots.checkedAt)).limit(1);
 const priorBody=await db.select().from(externalSourceSnapshots).where(and(eq(externalSourceSnapshots.source,'ckbdapps-json'),eq(externalSourceSnapshots.key,'projects'),eq(externalSourceSnapshots.status,'ok'))).orderBy(desc(externalSourceSnapshots.checkedAt)).limit(1);
 const headers:Record<string,string>={accept:'application/json','user-agent':'Trycove-TC01E/1.0'};if(prior[0]?.etag)headers['if-none-match']=prior[0].etag;
 let response:Response;try{response=await fetch(url,{headers,redirect:'error',signal:AbortSignal.timeout(15000)})}catch(error){await recordFailure(error);throw error}
 let raw:string;let etag=response.headers.get('etag');let fetchedAt=new Date();let status:'ok'|'not_modified'='ok';
 if(response.status===304){const cached=priorBody[0]?.raw;if(!cached)throw new Error('CKBdapps returned 304 without a retained body');raw=cached;status='not_modified';fetchedAt=priorBody[0]?.fetchedAt??fetchedAt;etag=etag??prior[0]?.etag??null}
 else {if(!response.ok)throw new Error(`CKBdapps HTTP ${response.status}`);raw=await responseText(response)}
 let feed;try{feed=parseCkbDappsFeed(raw)}catch(error){const checkedAt=new Date(),digest=sha256(raw);await persistSnapshot({id:sha256(`ckbdapps-json\0projects\0${checkedAt.toISOString()}\0invalid\0${digest}`).slice(0,40),source:'ckbdapps-json',key:'projects',requestedUrl:CKBDAPPS_URL,canonicalUrl:CKBDAPPS_URL,contentSha256:digest,status:'invalid',raw,error:String(error).slice(0,500),checkedAt,fetchedAt});throw error}
 const digest=sha256(raw);const observedAt=new Date();const sourceUrl=CKBDAPPS_URL;const snapshotPath=await storeSourceFile(`ckbdapps-projects-${digest.slice(0,16)}.json`,raw,digest);
 await persistSnapshot({id:sha256(`ckbdapps-json\0projects\0${observedAt.toISOString()}\0${digest}`).slice(0,40),source:'ckbdapps-json',key:'projects',requestedUrl:CKBDAPPS_URL,canonicalUrl:CKBDAPPS_URL,sourceRevision:digest,etag,contentSha256:digest,status,raw:status==='ok'?raw:null,error:null,checkedAt:observedAt,fetchedAt});
 const [known,previousJson]=await Promise.all([db.select().from(projects),db.select({projectId:sourceRecords.projectId}).from(sourceRecords).where(eq(sourceRecords.source,'CKBdapps JSON'))]);const byId=new Map(known.map(p=>[p.id,p]));const knownJsonIds=new Set(previousJson.map(x=>x.projectId));const observedCkb=known.filter(p=>markdownProjectPath(p.sourceUrl,p.id)).length;
 let inserted=0,updated=0,collisions=0,claims=0,repositories=0;
 for(const row of feed.projects){
  const existing=byId.get(row.slug);if(existing&&!markdownProjectPath(existing.sourceUrl,row.slug)&&!knownJsonIds.has(row.slug)){collisions++;console.error(`Skipped source identity collision for CKBdapps slug ${row.slug}: project ${existing.id} has source ${existing.sourceUrl}`);continue}
  const description=localized(row.tagline)??'';const website=safeHttpUrl(row.url)??null;const repo=repositoryUrl(row.github)??null;
  const project={id:row.slug,name:row.name,description,website,repository:repo,sourceUrl:CKBDAPPS_URL,revision:digest,observedAt};
  if(!existing){await db.insert(projects).values(project);inserted++;byId.set(row.slug,project as typeof known[number])}else updated++;
  const item={feedSource:CKBDAPPS_URL,feedSha256:digest,feedObservedAt:observedAt.toISOString(),record:row};
  await db.insert(sourceRecords).values({id:`ckbdapps-json-${row.slug}-${digest.slice(0,16)}`,projectId:row.slug,source:'CKBdapps JSON',sourceUrl,revision:digest,raw:JSON.stringify(item),observedAt}).onConflictDoNothing();
  const claimsForRow=metadataClaims(row);for(const claim of claimsForRow){const id=`ckbdapps-meta-${sha256(`${row.slug}\0${claim.kind}\0${claim.concept}\0${claim.claim}`).slice(0,24)}`;await db.insert(signals).values({id,projectId:row.slug,kind:claim.kind,concept:claim.concept,claim:claim.claim,sourceUrl,revision:digest,verification:'imported_claim; not independently verified',observedAt}).onConflictDoUpdate({target:signals.id,set:{claim:claim.claim,sourceUrl,revision:digest,verification:'imported_claim; not independently verified',observedAt}});claims++}
  if(repo){const repoId=`ckbdapps-repo-${sha256(`${row.slug}\0${repo.toLowerCase()}`).slice(0,28)}`;await db.insert(projectRepositories).values({id:repoId,projectId:row.slug,repository:repo,role:'CKBdapps JSON repository claim',sourceUrl,revision:digest,verification:'imported_claim; product/repository relationship not independently verified',observedAt}).onConflictDoUpdate({target:projectRepositories.id,set:{sourceUrl,revision:digest,verification:'imported_claim; product/repository relationship not independently verified',observedAt}});repositories++}
 }
 const snapshot=await db.select({id:externalSourceSnapshots.id}).from(externalSourceSnapshots).where(and(eq(externalSourceSnapshots.source,'ckbdapps-json'),eq(externalSourceSnapshots.key,'projects')));
 const receipt={source:'CKBdapps JSON',url:CKBDAPPS_URL,checkedAt:observedAt.toISOString(),fetchedAt:fetchedAt.toISOString(),httpStatus:response.status,etag,revision:digest,recordCount:feed.count,existingMarkdownProjects:observedCkb,inserted,updated,skippedIdentityCollisions:collisions,structuredClaimsAdded:claims,repositoryAssociationsAdded:repositories,storedSnapshots:snapshot.length,exactSnapshot:snapshotPath};
 await storeSourceFile(`ckbdapps-import-${observedAt.toISOString().replace(/[:.]/g,'-')}.json`,JSON.stringify(receipt,null,2)+'\n',null);
 console.log(JSON.stringify(receipt,null,2));process.exit(collisions?1:0);
}
async function persistSnapshot(row:typeof externalSourceSnapshots.$inferInsert){await db.insert(externalSourceSnapshots).values(row).onConflictDoNothing()}
async function recordFailure(error:unknown){const at=new Date();const message=String(error).slice(0,500);await persistSnapshot({id:sha256(`ckbdapps-json\0projects\0${at.toISOString()}\0unavailable`).slice(0,40),source:'ckbdapps-json',key:'projects',requestedUrl:CKBDAPPS_URL,canonicalUrl:CKBDAPPS_URL,status:'unavailable',raw:null,error:message,checkedAt:at,fetchedAt:null})}
async function storeSourceFile(name:string,body:string,expectedDigest:string|null){const dir='evidence/tc-01e/sources';await mkdir(dir,{recursive:true});const path=`${dir}/${name}`;try{await writeFile(path,body,{flag:'wx'})}catch(error){if((error as NodeJS.ErrnoException).code!=='EEXIST')throw error;const existing=await readFile(path,'utf8');if(expectedDigest&&sha256(existing)!==expectedDigest)throw new Error(`Evidence file digest mismatch at ${path}`);if(!expectedDigest&&existing!==body)throw new Error(`Evidence receipt already exists with different content at ${path}`)}return path}
main().catch(error=>{console.error(error);process.exit(1)});
