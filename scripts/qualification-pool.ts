import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {desc,eq,inArray,isNull} from 'drizzle-orm';
import {db} from '../lib/db';
import {footprintObservations,intelligenceRuns,needItems,projects,projectRepositories,signals,technicalFootprints} from '../lib/schema';
import {discoverCorpus} from '../lib/intelligence/corpus';
import {discoverIntentCandidates,extractObservationIntents,extractSignalIntents,type SignalIntent} from '../lib/intelligence/intents';
import {interpretNeedItems,type InterpretedNeed, type NeedItemSource} from '../lib/intelligence/need-discovery';
import {buildQualificationPool,type QualificationMatch,type QualificationNeed} from '../lib/intelligence/qualification';
import {execFileSync} from 'node:child_process';
import {z} from 'zod';

const sha=(value:string|Buffer)=>createHash('sha256').update(value).digest('hex');
const root=process.cwd();
const intentTypeByDiscoveryKind={
 'exact-interface':'technical-integration','name-to-ckb-address':'technical-integration','transaction-recovery-adapter':'technical-integration',
} as const;
function currentCommit(){const pinned=process.env.TC01D_BASELINE_COMMIT;if(pinned){if(!/^[a-f0-9]{40}$/.test(pinned))throw new Error('TC01D_BASELINE_COMMIT must be a full Git SHA.');return pinned}try{return execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim()}catch{return'unknown'}}
function asQualificationNeed(item:InterpretedNeed):QualificationNeed{return item}
function sourceLinkedNeed(item:NeedItemSource,projectIntents:InterpretedNeed[],scope:string):QualificationNeed{
 const interpreted=projectIntents.find(x=>x.needItemId===item.id);
 if(interpreted)return interpreted;
 return{id:item.id,needItemId:item.id,lineageKey:item.lineageKey,signalId:item.signalId??undefined,projectId:item.projectId,direction:'need',intentType:'technical-integration',scope,extractionRule:'code-observation candidate; bounded needs-to-code workflow',verification:item.verification,sourceUrl:item.sourceUrl,revision:item.revision,observedAt:item.observedAt,claim:item.excerpt,signalKind:'need_item',sourceClaim:item.sourceClaim,category:item.category,stance:item.stance,startOffset:item.startOffset,endOffset:item.endOffset};
}

async function main(){
 const NeedCategorySchema=z.enum(['user-testing','validation','adoption','technical-review','security','product-feedback','integration','feature-request','infrastructure','distribution','unknown']);
 const NeedStanceSchema=z.enum(['explicit-request','reported-obstacle','explicit-offer','roadmap','status-update','ambiguous']);
 const [allProjects,allSignals,needRows,footprintRows,repoRows]=await Promise.all([
  db.select().from(projects),db.select().from(signals),db.select().from(needItems).where(isNull(needItems.supersededAt)),
  db.select().from(technicalFootprints).orderBy(desc(technicalFootprints.analyzedAt)),
  db.select({projectId:projectRepositories.projectId,repository:projectRepositories.repository,revision:projectRepositories.revision,sourceUrl:projectRepositories.sourceUrl,role:projectRepositories.role,verification:projectRepositories.verification}).from(projectRepositories),
 ]);
 const latest=new Map<string,typeof footprintRows[number]>();
 for(const f of footprintRows){const k=`${f.projectId}\0${f.repository}\0${f.scope}`;if(!latest.has(k))latest.set(k,f)}
 const selected=[...latest.values()].sort((a,b)=>a.projectId.localeCompare(b.projectId)||a.repository.localeCompare(b.repository)||a.scope.localeCompare(b.scope));
 const observationRows=selected.length?await db.select().from(footprintObservations).where(inArray(footprintObservations.footprintId,selected.map(x=>x.id))):[];
 const observations=observationRows.sort((a,b)=>a.id.localeCompare(b.id));
 const activeNeeds:NeedItemSource[]=needRows.map(row=>({...row,category:NeedCategorySchema.parse(row.category),stance:NeedStanceSchema.parse(row.stance)}));
 const interpreted=interpretNeedItems(activeNeeds);
 const observationIntents=extractObservationIntents(observations);
 const providerIntents=[...extractSignalIntents(allSignals).filter(x=>x.direction!=='need'),...observationIntents,...interpreted.intents.filter(x=>x.direction==='offer')];
 const needs=interpreted.intents.filter(x=>x.direction==='need').map(asQualificationNeed);
 const structured=discoverIntentCandidates([...needs,...providerIntents]);
 const corpusNeeds=needs.map(n=>({projectId:n.projectId,claim:n.claim,sourceUrl:n.sourceUrl,revision:n.revision,needItemId:n.needItemId,sourceClaim:n.sourceClaim,category:n.category,stance:n.stance,startOffset:n.startOffset,endOffset:n.endOffset}));
 const code=discoverCorpus(observations,corpusNeeds);
 const byNeedId=new Map(needs.map(n=>[n.needItemId,n]));
 const matches:QualificationMatch[]=[
  ...structured.map(x=>({id:x.id,need:byNeedId.get(x.need.needItemId??'')??(x.need as QualificationNeed),provider:x.provider,relation:x.relation,source:'structured_match' as const,scope:x.scope,intentType:x.intentType})),
  ...code.candidates.map(x=>{
   const codeScope=`ckb-${x.discoveryKind}`;
   const rawNeed=activeNeeds.find(n=>n.id===x.need.needItemId);if(!rawNeed)throw new Error(`Corpus candidate ${x.id} has no active need source ${x.need.needItemId??'(missing)'}`);
   const need=byNeedId.get(x.need.needItemId??'')??sourceLinkedNeed(rawNeed,interpreted.intents,codeScope);
   const providerObservation=x.providerObservation;
   const observationId=providerObservation.id??sha(`${providerObservation.repository}\0${providerObservation.revision}\0${providerObservation.path}\0${providerObservation.startLine}`);
   const provider:SignalIntent={id:observationId,observationId,projectId:providerObservation.projectId,direction:'capability',intentType:intentTypeByDiscoveryKind[x.discoveryKind],scope:codeScope,extractionRule:`source-footprint:${x.discoveryKind}`,verification:'Pinned source observation; runtime compatibility unknown.',sourceUrl:`${providerObservation.repository}/blob/${providerObservation.revision}/${providerObservation.path}#L${providerObservation.startLine}`,revision:providerObservation.revision,claim:providerObservation.fact,signalKind:'footprint_observation'};
   return{id:x.id,need,provider,relation:'documented-need' as const,source:'code_observation_match' as const,scope:codeScope,intentType:intentTypeByDiscoveryKind[x.discoveryKind]};
  }),
 ];
 const pool=buildQualificationPool({needs,matches,providerIntents,limit:10});
 const input={
  projects:allProjects.map(({id,name,description,website,repository,sourceUrl,revision,observedAt})=>({id,name,description,website,repository,sourceUrl,revision,observedAt})).sort((a,b)=>a.id.localeCompare(b.id)),
  repositories:repoRows.sort((a,b)=>`${a.projectId}\0${a.repository}`.localeCompare(`${b.projectId}\0${b.repository}`)),
  signals:allSignals.map(({id,projectId,kind,concept,claim,sourceUrl,revision,verification,observedAt})=>({id,projectId,kind,concept,claim,sourceUrl,revision,verification,observedAt})).sort((a,b)=>a.id.localeCompare(b.id)),
  activeNeedItems:activeNeeds.sort((a,b)=>a.id.localeCompare(b.id)),
  latestFootprints:selected.map(({id,projectId,repository,revision,analyzerVersion,scope,analyzedAt,status,unknowns,fileCount})=>({id,projectId,repository,revision,analyzerVersion,scope,analyzedAt,status,unknowns,fileCount})),
  observations,
 };
 const inputBytes=Buffer.from(JSON.stringify({schemaVersion:1,input}));
 const inputSha256=sha(inputBytes),compressed=gzipSync(inputBytes,{level:9});
 const snapshotName=`source-snapshot-${inputSha256.slice(0,16)}.json.gz`;
 const poolName=`candidate-pool-${inputSha256.slice(0,16)}.json`;
 const outDir=join(root,'evidence/tc-01d');await mkdir(outDir,{recursive:true});
 await writeFile(join(outDir,snapshotName),compressed,{mode:0o644});
 const classCounts=Object.fromEntries([...new Set(needs.map(x=>x.intentType))].sort().map(type=>[type,needs.filter(x=>x.intentType===type).length]));
 const runRows=await db.select().from(intelligenceRuns).orderBy(desc(intelligenceRuns.createdAt)).limit(1);
 const runSummary=runRows[0]?JSON.parse(runRows[0].summary):{};
 const candidateRows=pool.map(row=>{
  const need=row.need;
  return{
   id:row.id,source:row.source,selectionReason:row.selectionReason,scope:row.scope,intentType:row.intentType,relation:row.relation??null,
   need:{needItemId:need.needItemId,lineageKey:need.lineageKey,projectId:need.projectId,sourceUrl:need.sourceUrl,revision:need.revision,sourceClaim:need.sourceClaim,excerpt:need.claim,category:need.category,stance:need.stance,interpretationMethod:need.interpretationMethod??'code-observation',startOffset:need.startOffset,endOffset:need.endOffset,verification:need.verification,unresolvedContext:need.unresolvedContext??[]},
   provider:row.provider?{projectId:row.provider.projectId,direction:row.provider.direction,intentType:row.provider.intentType,scope:row.provider.scope,sourceUrl:row.provider.sourceUrl,revision:row.provider.revision,claim:row.provider.claim,verification:row.provider.verification}:null,
   rejectedAlternatives:row.rejectedAlternatives,
  };
 });
 const report={
  schemaVersion:1,baselineCommit:currentCommit(),selectionAlgorithm:'qualification-pool-v1: retain all engine candidates first; then select the newest active actionable need per intent class from a distinct source issue; then fill remaining slots by source revision recency; cap 10; stable ids break ties.',
  inputSnapshot:{path:`evidence/tc-01d/${snapshotName}`,sha256:inputSha256,compressedSha256:sha(compressed),byteLength:inputBytes.length,compressedByteLength:compressed.length},
  corpus:{projectCount:allProjects.length,signalCount:allSignals.length,activeNeedItemCount:activeNeeds.length,needBearingProjects:new Set(activeNeeds.map(x=>x.projectId)).size,latestFootprintCount:selected.length,observationCount:observations.length,actionableNeedCount:needs.length,actionableNeedClassCounts:classCounts,needRejections:interpreted.rejections.reduce((o,x)=>({...o,[x.reason]:(o[x.reason]??0)+1}),{} as Record<string,number>),providerIntentCount:providerIntents.length,structuredCandidateCount:structured.length,codeObservationCandidateCount:code.candidates.length,codeObservationRejections:code.rejected,sourceClaimCurrentDiscoverySummary:{candidateCount:runSummary.candidateCount??null,sourceCorpusCandidateCount:runSummary.sourceCorpusCandidates?.length??null}},
  coverage:{userTestingNeeds:needs.filter(x=>x.intentType==='user-testing').length,adoptionNeeds:needs.filter(x=>x.intentType==='adoption').length,distributionNeeds:needs.filter(x=>x.intentType==='distribution').length,productFeedbackNeeds:needs.filter(x=>x.intentType==='product-feedback').length,securityReviewNeeds:needs.filter(x=>x.intentType==='security-review').length,validationNeeds:needs.filter(x=>x.intentType==='validation').length,technicalReviewNeeds:needs.filter(x=>x.intentType==='technical-review').length,technicalIntegrationNeeds:needs.filter(x=>x.intentType==='technical-integration').length},
  candidates:candidateRows,
 };
 const poolBytes=Buffer.from(JSON.stringify(report,null,2)+'\n');await writeFile(join(outDir,poolName),poolBytes,{mode:0o644});
 await writeFile(join(outDir,`${poolName}.sha256`),`${sha(poolBytes)}  ${poolName}\n`,{mode:0o644});
 console.log(JSON.stringify({path:`evidence/tc-01d/${poolName}`,sha256:sha(poolBytes),inputSha256,candidates:pool.length,corpus:report.corpus,candidateSummaries:candidateRows.map(x=>({id:x.id,source:x.source,projectId:x.need.projectId,scope:x.scope,intentType:x.intentType,providerProjectId:x.provider?.projectId??null,need:x.need.excerpt.slice(0,220),sourceUrl:x.need.sourceUrl,selectionReason:x.selectionReason}))},null,2));
 process.exit(0);
}
main().catch(error=>{console.error(error instanceof Error?error.message:String(error));process.exit(1)});
