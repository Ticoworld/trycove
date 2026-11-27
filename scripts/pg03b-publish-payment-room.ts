import {and,eq} from 'drizzle-orm';
import {db} from '../lib/db';
import {preparedResources,projects,trialPacks} from '../lib/schema';
import {readPackVersion,saveTrialDraft,setTrialPackState} from '../lib/trials/trial-packs';

const applicationId='quotacell-playground';
const packId='quotacell-delegated-payment';
const productId='pg03b-quotacell';
const expectedBranch='trycove-stage2-verification';

async function main(){
 if(process.env.NEON_BRANCH!==expectedBranch)throw new Error('This publisher only targets the isolated verification branch.');
 const origin=process.env.TRYCOVE_PG03B_QUOTACELL_ORIGIN;
 const revision=process.env.TRYCOVE_PG03B_QUOTACELL_REVISION;
 const resourcePockets=JSON.parse(process.env.TRYCOVE_PG03B_RESOURCE_POCKETS??'null') as unknown;
 if(origin!=='https://trycove-quotacell-playground.netlify.app'||!revision||!/^[0-9a-f]{40}$/.test(revision))throw new Error('Set the exact hosted receiver origin and source commit.');
 if(!resourcePockets||typeof resourcePockets!=='object'||Array.isArray(resourcePockets))throw new Error('Set a resource ID to Pocket mapping.');
 const pocketMap=resourcePockets as Record<string,string>,resourceIds=Object.keys(pocketMap);
 if(resourceIds.length!==3||resourceIds.some(id=>!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)||!/^0x[0-9a-f]{64}$/i.test(pocketMap[id]))||new Set(Object.values(pocketMap)).size!==3)throw new Error('Exactly three distinct resource IDs and Pocket IDs are required.');

 const [product]=await db.select().from(projects).where(eq(projects.id,productId));
 if(!product)throw new Error('The existing QuotaCell project record is unavailable.');
 await db.update(projects).set({name:'QuotaCell',description:'A shared spending Pocket app with owner-defined rules and independent wallet keys.',sourceUrl:'https://github.com/Ticoworld/QuotaCell',revision,observedAt:new Date()}).where(eq(projects.id,productId));

 const definition={
  id:packId,productId,
  description:'Send one 61 CKB delegated payment from a prepared QuotaCell Pocket on Pudge testnet, then confirm the payment and updated Pocket state.',
  prerequisites:['No wallet extension, QuotaCell account, or invitation is needed.','This room uses Pudge testnet CKB, which has no mainnet value.'],
  request:{kind:'builder-declared' as const,text:'Run one delegated payment through QuotaCell on Pudge testnet and check the resulting Pocket state.'},
  application:{name:'QuotaCell',url:`${origin}/app`,network:'CKB Pudge Testnet',version:revision},
  tasks:[
   {id:'open-pocket',title:'Open your test Pocket',instructions:'Select Claim a test Pocket, then Open QuotaCell. Confirm the Pudge network and Pocket shown for this session.',observe:['Did the prepared Pocket open on Pudge in QuotaCell?']},
   {id:'review-payment',title:'Review the payment',instructions:'Open the prepared payment request. Confirm the displayed amount is 61 CKB and the recipient is the one preconfigured in QuotaCell. Stop if either differs or the app shows another network.',observe:['Did the amount and recipient match the prepared payment?']},
   {id:'send-payment',title:'Send one payment',instructions:'Sign and submit exactly one 61 CKB delegated payment. Wait for QuotaCell to confirm it and show a transaction hash. Do not retry while a payment is pending.',observe:['Was the payment confirmed on Pudge, with a transaction hash shown?']},
   {id:'check-pocket',title:'Check the updated Pocket',instructions:'Confirm the payment appears in Pocket activity and the remaining allowance changed. Refresh QuotaCell, resume this room access if prompted, then confirm the same Pocket and transaction history load again.',observe:['After refresh, did the same Pocket show the confirmed payment and updated allowance?']},
  ],
  safety:['Use Pudge testnet only. Testnet CKB has no mainnet value.','Send at most one 61 CKB payment to the preconfigured recipient shown in QuotaCell. Stop if the amount, recipient, or network differs.','Never enter or share a recovery phrase or private key. Keep Pocket addresses and transaction details out of public trial notes.'],
  preparedResource:{description:'Claim a dedicated Pudge test Pocket. Access is assigned only to your room session and is never reassigned.',allocationMinutes:180,applicationId,claimLabel:'Claim a test Pocket',launchLabel:'Open QuotaCell'},
 };

 let [existingPack]=await db.select().from(trialPacks).where(eq(trialPacks.id,packId));
 let version:number;
 if(!existingPack){
  const saved=await saveTrialDraft(definition);
  version=saved.latestVersion;
 }else{
  const savedDefinition=await readPackVersion(packId,existingPack.latestVersion);
  if(savedDefinition.product.id!==productId||savedDefinition.application.url!==`${origin}/app`||savedDefinition.request?.text!==definition.request.text||savedDefinition.tasks.map(task=>task.id).join(',')!=='open-pocket,review-payment,send-payment,check-pocket')throw new Error('An unrelated room already uses the requested ID.');
  version=existingPack.latestVersion;
 }

 await db.transaction(async tx=>{
  const existing=await tx.select().from(preparedResources).where(and(eq(preparedResources.packId,packId),eq(preparedResources.packVersion,version)));
  if(existing.length){
   const currentIds=new Set(existing.map(row=>row.id));
   if(existing.length!==3||resourceIds.some(id=>!currentIds.has(id))||existing.some(row=>row.kind!=='identity'||row.launchUrl!==`${origin}/app?pocket=${pocketMap[row.id]}`))throw new Error('The room already has a different resource allocation.');
  }else{
   await tx.insert(preparedResources).values(resourceIds.map((id,index)=>({id,packId,packVersion:version,label:`Pudge test Pocket ${index+1}`,kind:'identity',launchUrl:`${origin}/app?pocket=${pocketMap[id]}`,enabled:true,retired:false})));
  }
 });
 await setTrialPackState(packId,version,'published');
 console.log(JSON.stringify({packId,productId,applicationId,resourceIds,pockets:Object.values(pocketMap),launchUrl:`${origin}/app`,version,available:3}));
}

main().catch(error=>{console.error(error instanceof Error?error.message:'Room publishing failed.');process.exit(1)});
