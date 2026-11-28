import {and,eq} from 'drizzle-orm';
import {z} from 'zod';
import {db} from '../db';
import {lockProjectPermission} from '../authorization';
import {preparedResources,trialPacks} from '../schema';
import {readPackVersion} from './trial-packs';
import {confirmPlaygroundResource,playgroundApplication} from './playground-apps';

const resourceSchema=z.object({id:z.string().uuid(),label:z.string().trim().min(1).max(100),kind:z.enum(['environment','identity','access']),launchUrl:z.string().url().max(2048)}).strict();
export async function registerPreparedResources(input:{userId:string;projectId:string;packId:string;applicationId?:string;enableVerified?:boolean;resources:unknown[]},database=db,verify=confirmPlaygroundResource) {
 const resources=z.array(resourceSchema).min(1).max(100).parse(input.resources);
 if(new Set(resources.map(r=>r.id)).size!==resources.length)throw new Error('Resource IDs must be unique.');
 for(const resource of resources){
  const url=new URL(resource.launchUrl);
  const local=process.env.NODE_ENV!=='production' && process.env.TRYCOVE_PLAYGROUND_LOCAL==='1' && url.protocol==='http:' && url.hostname==='127.0.0.1';
  if((url.protocol!=='https:'&&!local)||url.username||url.password||url.search||url.hash||/(?:0x)?[0-9a-f]{64}/i.test(decodeURIComponent(resource.launchUrl)+' '+resource.label))throw new Error('Use an HTTPS address without credentials, keys, query parameters or fragments.');
  resource.launchUrl=url.href;
 }
 return database.transaction(async tx=>{
  await lockProjectPermission(tx,input.userId,input.projectId,'edit');
  const [pack]=await tx.select().from(trialPacks).where(eq(trialPacks.id,input.packId)).for('update');
  if(!pack||pack.state==='closed')throw new Error('Trial unavailable.');
  const definition=await readPackVersion(input.packId,pack.latestVersion,tx);
  if(definition.product.id!==input.projectId||!definition.preparedResource)throw new Error('Configure a prepared resource for this trial first.');
  const applicationId=definition.preparedResource.applicationId;
  if(input.applicationId!==undefined && input.applicationId!==applicationId)throw new Error('Application does not match this room.');
  const app=applicationId ? playgroundApplication(applicationId) : null;
  if(applicationId && (!app || new URL(definition.application.url).origin!==app.origin || resources.some(r=>new URL(r.launchUrl).origin!==app.origin)))throw new Error('Application origin does not match the configured receiver.');
  let readyCount=0;
  for(const resource of resources){
   const ready=applicationId ? await verify(applicationId,resource.id) : false;
   if(!applicationId || ready)readyCount++;
   const [existing]=await tx.select().from(preparedResources).where(eq(preparedResources.id,resource.id)).for('update');
   if(existing){
    let migratable=false;
    try {const old=new URL(existing.launchUrl),next=new URL(resource.launchUrl);migratable=!!applicationId && old.origin===next.origin && old.pathname===next.pathname && !old.hash && [...old.searchParams.keys()].length===1 && /^0x[0-9a-f]{64}$/i.test(old.searchParams.get('pocket')??'');}catch { /* Invalid URLs cannot migrate. */ }
    if(existing.packId!==input.packId||existing.packVersion!==pack.latestVersion||existing.kind!==resource.kind||existing.label!==resource.label||(existing.launchUrl!==resource.launchUrl&&!migratable))throw new Error('Resource ID already has different metadata.');
    await tx.update(preparedResources).set({providerReady:ready,launchUrl:resource.launchUrl,...(input.enableVerified && ready && !existing.assignedSessionId && !existing.retired?{enabled:true}:{})}).where(eq(preparedResources.id,resource.id));
   } else await tx.insert(preparedResources).values({...resource,packId:input.packId,packVersion:pack.latestVersion,enabled:applicationId?ready:true,providerReady:ready});
  }
  return {count:resources.length,ready:readyCount};
 });
}
