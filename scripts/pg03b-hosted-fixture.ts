import {randomUUID} from 'node:crypto';
import {and,eq} from 'drizzle-orm';
import {db} from '../lib/db';
import {preparedResources,projects,trialPacks,trialPackVersions} from '../lib/schema';
import {saveTrialDraft,setTrialPackState} from '../lib/trials/trial-packs';

const applicationId='quotacell-playground';
const packId='pg03b-quotacell-playground';
const productId='pg03b-quotacell';
const resourceId=randomUUID();

async function main(){
 const origin=process.env.TRYCOVE_PG03B_QUOTACELL_ORIGIN;
 const revision=process.env.TRYCOVE_PG03B_QUOTACELL_REVISION;
 if(!origin||!revision||!/^[0-9a-f]{40}$/.test(revision))throw new Error('Set the exact receiver origin and source commit.');
 const url=new URL(origin);
 if(url.protocol!=='https:'||url.origin!==origin||url.username||url.password||url.search||url.hash)throw new Error('Receiver origin must be an exact HTTPS origin.');
 const [existingProject]=await db.select({id:projects.id}).from(projects).where(eq(projects.id,productId));
 const [existingPack]=await db.select({id:trialPacks.id}).from(trialPacks).where(eq(trialPacks.id,packId));
 if(existingProject||existingPack)throw new Error('PG03B fixture already exists; refusing to reuse its one-time identity.');

 await db.insert(projects).values({id:productId,name:'QuotaCell Playground',description:'Isolated PG03B receiver acceptance fixture; not a compatibility or adoption claim.',sourceUrl:'https://github.com/Ticoworld/QuotaCell',revision,observedAt:new Date()});
 const pack=await saveTrialDraft({
  id:packId,productId,description:'Verify that an authorized Trycove handoff opens the hosted QuotaCell receiver.',
  prerequisites:['No wallet extension is needed for the handoff check.','Stop after the receiver confirms Playground access.'],
  request:{kind:'builder-declared',text:'Accept a single authorized Playground handoff from the isolated Trycove environment.'},
  application:{name:'QuotaCell Playground',url:origin,network:'CKB Pudge Testnet',version:revision},
  tasks:[{id:'accept-handoff',title:'Accept the authorized handoff',instructions:'Open the prepared Playground, wait for the test identity to appear, and stop before preparing or submitting a transaction.',observe:['Whether the hosted receiver accepts the authorized handoff and identifies the Playground test identity.']}],
  safety:['Use the isolated hosted receiver and Pudge testnet identity only.','Do not prepare, sign, or submit a transaction during this receiver check.','Do not enter or record private keys, passwords, or seed phrases.'],
  preparedResource:{description:'One dedicated Pudge test identity for receiver acceptance. This room authorizes the handoff check only.',allocationMinutes:30,applicationId,claimLabel:'Get test access',launchLabel:'Open QuotaCell Playground'},
 },db);
 const launchUrl=`${origin}/app`;
 await db.insert(preparedResources).values({id:resourceId,packId,packVersion:pack.latestVersion,label:'PG03B receiver test identity',kind:'identity',launchUrl,enabled:true});
 await setTrialPackState(packId,pack.latestVersion,'published',db);
 const [saved]=await db.select({id:trialPackVersions.packId,version:trialPackVersions.version}).from(trialPackVersions).where(and(eq(trialPackVersions.packId,packId),eq(trialPackVersions.version,pack.latestVersion)));
 if(!saved)throw new Error('PG03B fixture version was not persisted.');
 console.log(JSON.stringify({packId,productId,applicationId,resourceId,launchUrl,version:pack.latestVersion}));
}

main().catch(error=>{console.error(error instanceof Error?error.message:'PG03B fixture setup failed.');process.exit(1)});
