import {createHash} from 'node:crypto';
import {eq} from 'drizzle-orm';
import {db} from '../lib/db';
import {evidence,opportunities,projectRepositories,projects,sourceRecords} from '../lib/schema';

const revision='274ecf42890eeff5abd60e70240240d34ac10f83';
const repository='https://github.com/chukwuma619/twine';
const now=new Date();
const digest=(s:string)=>createHash('sha256').update(s).digest('hex');

async function addEvidence(input:{claim:string;sourceUrl:string;revision?:string;verification:string}){
 const already=await db.select().from(evidence).where(eq(evidence.opportunityId,'twine-cellula-lsp-invoice-routing'));
 if(already.some(x=>x.sourceUrl===input.sourceUrl&&x.claim===input.claim))return;
 await db.insert(evidence).values({opportunityId:'twine-cellula-lsp-invoice-routing',claim:input.claim,sourceUrl:input.sourceUrl,revision:input.revision??null,observedAt:now,verification:input.verification});
}

async function main(){
 const [cellula]=await db.select().from(projects).where(eq(projects.id,'cellula'));
 if(!cellula)throw new Error('Expected imported Cellula project record is missing');
 const [existingProject]=await db.select().from(projects).where(eq(projects.id,'twine'));
 if(!existingProject)await db.insert(projects).values({id:'twine',name:'Twine',description:'Non-custodial peer-to-peer desk for Nervos CKB that coordinates trades over Fiber. The inspected source revision includes Cellula LSP invoice parsing and explicit trampoline route handling.',website:null,repository,sourceUrl:`${repository}/tree/${revision}`,revision,observedAt:now});
 const repos=await db.select().from(projectRepositories).where(eq(projectRepositories.projectId,'twine'));
 if(!repos.some(x=>x.repository===repository))await db.insert(projectRepositories).values({id:`twine-repo-${digest(repository).slice(0,24)}`,projectId:'twine',repository,role:'coordinator source',sourceUrl:`${repository}/commit/${revision}`,revision,verification:'Public Git source revision inspected and pinned for the TC-01C prior-art check; external deployment and license status remain unverified.',observedAt:now});
 const [op]=await db.select().from(opportunities).where(eq(opportunities.id,'twine-cellula-lsp-invoice-routing'));
 if(!op)await db.insert(opportunities).values({id:'twine-cellula-lsp-invoice-routing',projectA:'twine',projectB:'cellula',kind:'Prior-art verification / Fiber invoice routing',problem:'Determine whether Twine already handles Cellula LSP invoice routing through Fiber trampoline hints, and separately verify the dated testnet trade report.',reasoning:'This is a capability-scoped regression for current-state verification. Twine source at the pinned revision contains an LSP invoice hint parser, Cellula payment-link handling and explicit trampoline-hop construction. That source evidence does not establish that a payment completed or that Cellula features generally are integrated.',requirements:'Observed in code: TrampolineRouteHint parsing, Cellula pay-link parsing, trampoline_hops payment parameters, and dry_run support. Unknown: current live payment success, invoice signature validation in the local fallback, production/mainnet readiness, independent reproduction, and external adoption. The cited Talk/Teapaw report bodies could not be fetched in this environment.',experiment:'Refresh the current Twine revision and cited public report, inspect the capability-specific parser and payment path, then reproduce a testnet payment only in an authorized test environment. No signature, key, or broadcast is used in this check.',status:'investigated'});
 const sourceUrl=`${repository}/tree/${revision}`;
 const priorSourceRecords=await db.select().from(sourceRecords).where(eq(sourceRecords.projectId,'twine'));
 if(!priorSourceRecords.some(x=>x.source==='public-github-prior-art'&&x.sourceUrl===sourceUrl&&x.revision===revision)){
  const raw=JSON.stringify({repository,revision,description:'Twine repository source inspected for Cellula LSP invoice route prior art',observedAt:now.toISOString()});
  const sourceId=`twine-source-${digest(`${repository}\0${revision}`).slice(0,24)}`;
  await db.insert(sourceRecords).values({id:sourceId,projectId:'twine',source:'public-github-prior-art',sourceUrl,revision,raw,observedAt:now}).onConflictDoNothing();
 }
 await addEvidence({claim:'Pinned source states Fiber before 0.10.0 does not parse LSP trampoline route-hint attribute 10; Twine locally decodes the route hint and supplies explicit trampoline_hops.',sourceUrl:`${repository}/blob/${revision}/src/fiber/hint.rs#L1-L55`,revision,verification:'Source code observed at the pinned revision. The local parser comment says it does not verify the invoice signature; no successful payment is established by this code excerpt.'});
 await addEvidence({claim:'Pinned source includes a parser regression test whose comment describes a Cellula testnet invoice captured 12 Nov 2026; assertions cover route-hint pubkey, amount and expiry. This is parser evidence, not a payment execution.',sourceUrl:`${repository}/blob/${revision}/src/fiber/hint.rs#L368-L391`,revision,verification:'Code and fixture comment observed at the pinned revision. Test validates parsing only; it does not prove a completed trade.'});
 await addEvidence({claim:'Pinned payment code builds Fiber send_payment parameters with the parsed trampoline hop and exposes dry_run; it does not establish successful settlement.',sourceUrl:`${repository}/blob/${revision}/src/fiber/payment.rs#L61-L101`,revision,verification:'Source code observed at the pinned revision. Transaction/payment result, chain status and external adoption are unknown.'});
 await addEvidence({claim:'The task supplied this public discussion as a Nov 13, 2026 report about Cellula/LSP invoice routing and a Cellula-to-Cellula testnet trade; the original page was unreachable during this verification, so the summary remains unconfirmed.',sourceUrl:'https://talk.nervos.org/t/twine-buy-and-sell-ckb-without-depositing-on-an-exchange-fiber-p2p-poc/10741',verification:'Task-provided source reference only. The page body was not retrieved; this row preserves the lead but is not independent evidence of a completed trade.'});
 await addEvidence({claim:'The task supplied this Nov 14, 2026 announcement as additional public prior-art context; the original post was unreachable during this verification.',sourceUrl:'https://teapaw.org/twineckb/status/2121412115718181181',verification:'Task-provided source reference only. The post body was not retrieved; this row preserves the lead but does not establish adoption or a successful payment.'});
 console.log(JSON.stringify({project:'twine',repository,revision,opportunity:'twine-cellula-lsp-invoice-routing',result:'registered prior-art regression without changing existing records'},null,2));
 process.exit(0);
}
main().catch(e=>{console.error(e instanceof Error?e.message:String(e));process.exit(1)});
