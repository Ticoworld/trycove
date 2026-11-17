import {createHash} from 'node:crypto';
import {lstat,mkdir,readFile,writeFile} from 'node:fs/promises';
import {join,relative,resolve,isAbsolute} from 'node:path';
import {desc,eq} from 'drizzle-orm';
import {db} from '../lib/db';
import {CandidateSpecSchema,appendExecutionEvidence,verifyCandidateCurrentState} from '../lib/intelligence/current-state';
import {candidateCapabilities,evidence,lifecycleEvidence,lifecycleVerificationRuns,opportunities,projects,projectRepositories,trialEvidenceRecords,trialRuns} from '../lib/schema';

const root=process.cwd();
const sha=(value:string|Buffer)=>createHash('sha256').update(value).digest('hex');
function usage(){throw new Error('Usage: pnpm verify:candidate fixtures/current-state/<candidate>.json')}
async function readSmallJson(path:string,maxBytes:number){const stat=await lstat(path);if(!stat.isFile()||stat.isSymbolicLink()||stat.size>maxBytes)throw new Error(`Expected a small regular file: ${path}`);return JSON.parse(await readFile(path,'utf8'))}
async function executionEvidence(spec:{executionReceipt?:string},cycleOpportunityId:string){
 if(!spec.executionReceipt)return null;
 const absolute=resolve(root,spec.executionReceipt);const rel=relative(root,absolute);if(rel.startsWith('..')||isAbsolute(rel)||!rel.startsWith('evidence/'))throw new Error('Execution receipt path must stay inside evidence/');
 const bytes=await readFile(absolute);if(bytes.length>1_000_000)throw new Error('Execution receipt exceeds 1 MB');
 const parsed=JSON.parse(bytes.toString('utf8'));
 const digestPath=`${absolute}.sha256`;const sidecar=await readFile(digestPath,'utf8');const expected=sidecar.trim().split(/\s+/)[0];if(!/^[a-f0-9]{64}$/.test(expected)||sha(bytes)!==expected)throw new Error('Execution receipt SHA-256 does not match its saved sidecar');
 if(parsed.schemaVersion!==1||parsed.experiment!=='CKB Devnet Explorer rawTransaction → ckb-cycle-tools real script-group replay')throw new Error('Unexpected execution receipt');
 if(parsed.fixture?.rawTransactionDeepEqual!==true||parsed.cases?.valid?.aggregateMatches!==true||parsed.cases?.valid?.groups?.some((g:any)=>g.result!==0)||parsed.cases?.modifiedOutputCapacity?.groups?.find((g:any)=>g.role==='lock')?.result===0||parsed.cases?.missingResolvedCellDeps?.rejected!==true||parsed.cases?.missingResolvedCellDeps?.measurementsTrusted!==false)throw new Error('Execution receipt lacks the required raw transaction, positive, negative, or dependency failure checks');
 if(parsed.sources?.explorer?.revision!=='b6aef5571bbe5a112b4809881a1b6229095f6da7'||parsed.sources?.cycleTools?.revision!=='23182e2abce64d0574cae7acd3229bc87424d0d0')throw new Error('Execution receipt source revisions do not match the candidate experiment pins');
 return{bytes,parsed,digest:expected,id:`ckb-cycle-offline-${expected.slice(0,20)}`,opportunityId:cycleOpportunityId};
}

async function main(){
 const argument=process.argv[2];if(!argument)usage();
 const file=resolve(root,argument);const rel=relative(root,file);if(rel.startsWith('..')||isAbsolute(rel)||!rel.startsWith('fixtures/current-state/'))throw new Error('Candidate definition must be within fixtures/current-state');
 const raw=await readSmallJson(file,65536);const spec=CandidateSpecSchema.parse(raw);
 if(!spec.provider)throw new Error('Lifecycle persistence requires a consumer/provider opportunity; use the standalone need verifier for a providerless source refresh.');
 const specProvider=spec.provider;
 const [opportunity]=await db.select().from(opportunities).where(eq(opportunities.id,spec.opportunityId));if(!opportunity)throw new Error(`No stored opportunity ${spec.opportunityId}`);
 if(opportunity.projectA!==spec.consumer.id||opportunity.projectB!==specProvider.id)throw new Error('Candidate direction and project identities must match the saved opportunity');
 const projectRows=await db.select().from(projects);const consumer=projectRows.find(x=>x.id===spec.consumer.id),provider=projectRows.find(x=>x.id===specProvider.id);if(!consumer||!provider)throw new Error('A candidate project record is missing');
 const repoRows=await db.select().from(projectRepositories);
 const validateRepositories=(id:string,preferred:string[])=>{
  const known=new Set([...repoRows.filter(x=>x.projectId===id).map(x=>x.repository.replace(/\/$/,'')),...(projectRows.find(x=>x.id===id)?.repository?[projectRows.find(x=>x.id===id)!.repository!.replace(/\/$/,'')]:[])]);
  for(const repo of preferred)if(!known.has(repo.replace(/\/$/,'')))throw new Error(`Repository ${repo} is not associated with project ${id} in the imported source records`);
  return preferred;
 };
 const priorRows=await db.select().from(candidateCapabilities).where(eq(candidateCapabilities.opportunityId,spec.opportunityId));
 const prior=priorRows.find(x=>x.capabilityKey===spec.capability.key);
 const previousRuns=prior?await db.select().from(lifecycleVerificationRuns).where(eq(lifecycleVerificationRuns.capabilityId,prior.id)).orderBy(desc(lifecycleVerificationRuns.checkedAt)):[];
 const useStoredBaseline=spec.lifecycleBaseline==='stored';
 let priorLifecycle=useStoredBaseline?(prior?.lifecycleState??spec.priorLifecycle):spec.priorLifecycle;
 const latestRun=previousRuns[0];
 const priorDemonstration=previousRuns.find(x=>x.evaluatedLifecycle==='demonstrated_in_wild'||x.evaluatedLifecycle==='adopted');
 if(useStoredBaseline&&priorDemonstration&&latestRun?.result!=='contradictory'&&latestRun?.evaluatedLifecycle!=='superseded'&&priorLifecycle!=='demonstrated_in_wild'&&priorLifecycle!=='adopted')priorLifecycle=priorDemonstration.evaluatedLifecycle as typeof priorLifecycle;
 const historical=await db.select().from(evidence).where(eq(evidence.opportunityId,spec.opportunityId));
 const termWords=spec.capability.terms.map(x=>x.toLowerCase());
 const matchingHistorical=historical.filter(x=>termWords.some(t=>x.claim.toLowerCase().includes(t))).slice(0,6).map(x=>x.sourceUrl);
 const candidate=CandidateSpecSchema.parse({
  ...spec,consumer:{...spec.consumer,name:consumer.name,repositories:validateRepositories(spec.consumer.id,spec.consumer.repositories)},
  provider:{...specProvider,name:provider.name,repositories:validateRepositories(specProvider.id,specProvider.repositories)},
  sourceUrls:[...new Set([...spec.sourceUrls,...matchingHistorical])].slice(0,12),
  priorLifecycle,priorCompatibility:useStoredBaseline?(prior?.compatibilityState??spec.priorCompatibility):spec.priorCompatibility,
 });
 const cacheDir=join(root,'.data/current-state-cache');
 let result=await verifyCandidateCurrentState(candidate,{cacheDir});
 const trial=await executionEvidence(candidate,spec.opportunityId);
 if(trial){
  result=appendExecutionEvidence(result,{sourceUrl:`${trial.parsed.sources.cycleTools.repository}/blob/${trial.parsed.sources.cycleTools.revision}/src/replay.ts`,revision:trial.parsed.sources.cycleTools.revision,path:'src/replay.ts',line:382,checkedAt:result.checkedAt,excerpt:`Explorer rawTransaction returned the exact archived transaction. Pinned ckb-debugger ${trial.parsed.runtime.debugger}, CKB-VM ${trial.parsed.runtime.vmVersion}: input.0.lock=${trial.parsed.cases.valid.groups[0].cycles} cycles; input.0.type=${trial.parsed.cases.valid.groups[1].cycles}; modified capacity lock result ${trial.parsed.cases.modifiedOutputCapacity.groups.find((x:any)=>x.role==='lock').result}; missing CellDeps rejected. Offline only.` ,conclusion:'Actual offline script-group execution using pinned Explorer and cycle-tools source; not public-chain acceptance.'});
 }
 const checkedAt=new Date(result.checkedAt);const id=`candidate-cap-${sha(`${spec.opportunityId}\0${spec.capability.key}`).slice(0,28)}`;const runId=`lifecycle-${sha(`${id}\0${result.checkedAt}`).slice(0,28)}`;
 const capabilityValue={id,opportunityId:spec.opportunityId,capabilityKey:spec.capability.key,capability:spec.capability.label,consumerProjectId:spec.consumer.id,providerProjectId:specProvider.id,lifecycleState:result.lifecycleState,compatibilityState:result.compatibilityState,freshness:result.freshness,summary:result.summary,uncertainty:result.uncertainty,nextAction:result.nextAction,lastVerifiedAt:result.freshness==='current'?checkedAt:null,createdAt:prior?.createdAt??checkedAt,updatedAt:checkedAt};
 await db.insert(candidateCapabilities).values(capabilityValue).onConflictDoUpdate({target:[candidateCapabilities.opportunityId,candidateCapabilities.capabilityKey],set:{lifecycleState:capabilityValue.lifecycleState,compatibilityState:capabilityValue.compatibilityState,freshness:capabilityValue.freshness,summary:capabilityValue.summary,uncertainty:capabilityValue.uncertainty,nextAction:capabilityValue.nextAction,lastVerifiedAt:capabilityValue.lastVerifiedAt,updatedAt:checkedAt}});
 const method=`Bounded just-in-time source refresh: current GitHub commit Atom refs, relevant cited source pages, capability/alias GitHub issue searches, and current-revision code touchpoints. Lifecycle baseline: ${spec.lifecycleBaseline}. Conditional ETag cache: six hours; maximum 20 sources.`;
 const sourceRecord=result.sources.map(s=>({url:s.url,kind:s.kind,checkedAt:s.checkedAt,fetchStatus:s.fetchStatus,httpStatus:s.httpStatus,revision:s.revision,publishedAt:s.publishedAt,error:s.error,cache:s.cache}));
 await db.insert(lifecycleVerificationRuns).values({id:runId,capabilityId:id,checkedAt,freshness:result.freshness,result:result.result,priorLifecycle:result.priorLifecycle,evaluatedLifecycle:result.lifecycleState,method,queries:JSON.stringify({queries:result.queries,sources:sourceRecord}),conclusion:result.summary,limitations:JSON.stringify(result.limitations),nextAction:result.nextAction,sourceCount:result.sources.length}).onConflictDoNothing();
 for(const item of result.evidence)await db.insert(lifecycleEvidence).values({id:`lifecycle-evidence-${item.id.slice(0,40)}`,capabilityId:id,verificationRunId:runId,evidenceType:item.evidenceType,sourceUrl:item.sourceUrl,revision:item.revision??null,path:item.path??null,line:item.line??null,publishedAt:item.publishedAt?new Date(item.publishedAt):null,checkedAt:new Date(item.checkedAt),excerpt:item.excerpt,conclusion:item.conclusion,verification:item.verification,sourceSha256:item.sourceSha256}).onConflictDoNothing();
 if(trial){
  await db.insert(trialEvidenceRecords).values({id:trial.id,opportunityId:trial.opportunityId,mode:'offline-script-group-replay',evidenceLevel:3,result:'partial',receiptSha256:trial.digest,receipt:trial.bytes.toString('utf8'),createdAt:checkedAt}).onConflictDoNothing();
  const trialDetails=`Executed pinned CKB Devnet Explorer rawTransaction through a localhost fixture RPC and pinned ckb-cycle-tools with ckb-debugger 0.200.1 / CKB-VM v2. Positive: input.0.lock ${trial.parsed.cases.valid.groups[0].cycles} cycles; input.0.type ${trial.parsed.cases.valid.groups[1].cycles}; sum ${trial.parsed.cases.valid.measuredCycles} matches the fixture's archived aggregate. Negative: +1 shannon output-capacity mutation rejected by lock script (${trial.parsed.cases.modifiedOutputCapacity.groups.find((x:any)=>x.role==='lock').result}). Missing CellDeps: debugger rejected with an unprovided dependency error and no trusted measurements. This is offline historical fixture execution, not new CKB-chain acceptance.`;
  const oldTrials=await db.select().from(trialRuns).where(eq(trialRuns.opportunityId,trial.opportunityId));if(!oldTrials.some(x=>x.details===trialDetails))await db.insert(trialRuns).values({opportunityId:trial.opportunityId,result:'partial',details:trialDetails,observedAt:checkedAt});
 }
 const report={schemaVersion:1,candidate:{opportunityId:result.opportunityId,capabilityKey:result.capabilityKey,lifecycleBaseline:spec.lifecycleBaseline,consumer:{id:candidate.consumer.id,name:consumer.name},provider:{id:candidate.provider!.id,name:provider.name},capability:candidate.capability.label},verification:{checkedAt:result.checkedAt,result:result.result,freshness:result.freshness,priorLifecycle:result.priorLifecycle,lifecycleState:result.lifecycleState,compatibilityState:result.compatibilityState,summary:result.summary,uncertainty:result.uncertainty,nextAction:result.nextAction,queries:result.queries,limitations:result.limitations,sources:result.sources.map(s=>({...sourceRecord.find(x=>x.url===s.url),excerpt:s.excerpt.slice(0,2500)})),evidence:result.evidence},executionReceipt:trial?{path:candidate.executionReceipt,sha256:trial.digest,mode:'offline-script-group-replay'}:null};
 const outDir=join(root,'evidence/current-state');await mkdir(outDir,{recursive:true});const timestamp=checkedAt.toISOString().replace(/[-:.]/g,'');const filename=`${candidate.capability.key}-${timestamp}.json`;const outPath=join(outDir,filename);const bytes=Buffer.from(JSON.stringify(report,null,2)+'\n');await writeFile(outPath,bytes,{flag:'wx',mode:0o644});await writeFile(`${outPath}.sha256`,`${sha(bytes)}  ${filename}\n`,{flag:'wx',mode:0o644});
 console.log(JSON.stringify({opportunityId:spec.opportunityId,capability:spec.capability.label,lifecycle:result.lifecycleState,compatibility:result.compatibilityState,freshness:result.freshness,result:result.result,sourceChecks:result.sources.length,availableSources:result.sources.filter(x=>x.fetchStatus==='available').length,evidence:result.evidence.length,trialReceipt:trial?{id:trial.id,sha256:trial.digest,result:'partial'}:null,report:`evidence/current-state/${filename}`,reportSha256:sha(bytes)},null,2));
 process.exit(0);
}
main().catch(e=>{console.error(e instanceof Error?e.message:String(e));process.exit(1)});
