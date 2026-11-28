import {and,eq} from 'drizzle-orm';
import {db} from '../lib/db';
import {projects,trialPacks} from '../lib/schema';
import {readPackVersion,saveTrialDraft,setTrialPackState} from '../lib/trials/trial-packs';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {registerPreparedResources} from '../lib/trials/register-prepared-resources';
import {lockProjectPermission} from '../lib/authorization';

const applicationId='quotacell-playground';
const packId='quotacell-delegated-payment';
const productId='pg03b-quotacell';
const expectedBranch='trycove-stage2-verification';

async function main(){
 if(process.env.NEON_BRANCH!==expectedBranch)throw new Error('This publisher only targets the isolated verification branch.');
 const origin=process.env.TRYCOVE_PG03B_QUOTACELL_ORIGIN;
 const revision=process.env.TRYCOVE_PG03B_QUOTACELL_REVISION;
 const directory=process.env.PG03B_SCENARIO_DIR,userId=process.env.TRYCOVE_REGISTRATION_USER_ID;
 if(origin!=='https://trycove-quotacell-playground.netlify.app'||!revision||!/^[0-9a-f]{40}$/.test(revision))throw new Error('Set the exact hosted receiver origin and source commit.');
 if(!directory||!userId)throw new Error('Set PG03B_SCENARIO_DIR and TRYCOVE_REGISTRATION_USER_ID.');
 const scenarios=JSON.parse(await readFile(join(directory,'public.json'),'utf8')) as Array<{resourceId:string}>;
 if(!Array.isArray(scenarios)||!scenarios.length||scenarios.length>100)throw new Error('Invalid scenario metadata.');
 const resourceIds=scenarios.map(s=>s.resourceId);

 const [product]=await db.select().from(projects).where(eq(projects.id,productId));
 if(!product)throw new Error('The existing QuotaCell project record is unavailable.');

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
  const saved=await saveTrialDraft(definition,db,async(tx,id)=>lockProjectPermission(tx,userId,id,'edit'));
  version=saved.latestVersion;
 }else{
  const savedDefinition=await readPackVersion(packId,existingPack.latestVersion);
  if(savedDefinition.product.id!==productId||savedDefinition.application.url!==`${origin}/app`||savedDefinition.request?.text!==definition.request.text||savedDefinition.tasks.map(task=>task.id).join(',')!=='open-pocket,review-payment,send-payment,check-pocket')throw new Error('An unrelated room already uses the requested ID.');
  version=existingPack.latestVersion;
 }

 const registered=await registerPreparedResources({userId,projectId:productId,packId,applicationId,enableVerified:true,resources:resourceIds.map((id,index)=>({id,label:`Pudge test Pocket ${index+1}`,kind:'identity',launchUrl:`${origin}/app`}))});
 if(registered.ready!==registered.count)throw new Error(`Receiver confirmed ${registered.ready} of ${registered.count} resources; unconfirmed resources remain unavailable.`);
 await setTrialPackState(packId,version,'published',db,async(tx,id)=>lockProjectPermission(tx,userId,id,'publish'));
 console.log(JSON.stringify({packId,productId,applicationId,resourceIds,launchUrl:`${origin}/app`,version}));
}

main().catch(error=>{console.error(error instanceof Error?error.message:'Room publishing failed.');process.exit(1)});
