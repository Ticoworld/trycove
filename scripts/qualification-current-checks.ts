import {createHash} from 'node:crypto';
import {lstat,mkdir,readFile,writeFile} from 'node:fs/promises';
import {join,resolve,relative,isAbsolute} from 'node:path';
import {desc} from 'drizzle-orm';
import {z} from 'zod';
import {db} from '../lib/db';
import {projects,projectRepositories} from '../lib/schema';
import {CandidateSpecSchema,verifyCandidateCurrentState} from '../lib/intelligence/current-state';

const root=process.cwd(),sha=(v:string|Buffer)=>createHash('sha256').update(v).digest('hex');
const PoolSchema=z.object({schemaVersion:z.literal(1),inputSnapshot:z.object({sha256:z.string().regex(/^[a-f0-9]{64}$/)}),candidates:z.array(z.any()).min(1).max(10)});
const stop=new Set(['about','after','again','also','been','before','being','between','could','does','from','have','into','more','most','other','should','their','there','these','they','this','those','through','what','when','where','which','while','with','would','your','they','will','than','that','then','them','were','currently','please','project','builder','ckb','need','needs','using','used','using']);
function termsFor(claim:string,scope:string){const words=claim.toLowerCase().match(/[a-z][a-z0-9-]{3,}/g)??[];return[...new Set([...scope.replace(/^ckb-/,'').split('-'),...words.filter(x=>!stop.has(x))])].filter(x=>x.length>=3).slice(0,8)}
function stamp(){return new Date().toISOString().replace(/[-:.]/g,'')}
function rootRepo(raw:string|null|undefined){if(!raw)return null;try{const u=new URL(raw);if(u.protocol!=='https:'||u.hostname!=='github.com'||u.username||u.password||u.port||!/^\/[^/]+\/[^/]+\/?$/.test(u.pathname))return null;return u.href.replace(/\/$/,'')}catch{return null}}

async function main(){
 const argument=process.argv[2]??'evidence/tc-01d/candidate-pool-257ae9da5f65b7bd.json';
 const file=resolve(root,argument),rel=relative(root,file);
 if(rel.startsWith('..')||isAbsolute(rel)||!rel.startsWith('evidence/tc-01d/candidate-pool-'))throw new Error('Input must be a saved TC-01D candidate-pool artifact.');
 const st=await lstat(file);if(!st.isFile()||st.isSymbolicLink()||st.size>2_000_000)throw new Error('Candidate-pool input is not a bounded regular file.');
 const parsed=PoolSchema.parse(JSON.parse(await readFile(file,'utf8')));
 const [projectRows,repositoryRows]=await Promise.all([db.select().from(projects),db.select().from(projectRepositories)]);
 const allRepositories=(projectId:string,preferred:string|null)=>[...new Set([...repositoryRows.filter(x=>x.projectId===projectId).map(x=>rootRepo(x.repository)),rootRepo(preferred)].filter((x):x is string=>Boolean(x)))].slice(0,5);
 const checks=[];
 for(const row of parsed.candidates){
  const consumer=projectRows.find(x=>x.id===row.need?.projectId);if(!consumer)throw new Error(`Missing consumer project ${row.need?.projectId}`);
  const sameScopeAlternative=row.rejectedAlternatives?.find((x:any)=>x.reason==='offer_type_mismatch');
  const providerId=row.provider?.projectId??sameScopeAlternative?.providerProjectId;
  const provider=providerId?projectRows.find(x=>x.id===providerId):undefined;
  if(providerId&&!provider)throw new Error(`Missing alternative provider ${providerId}`);
  const pairedForCheck=Boolean(row.provider||sameScopeAlternative);
  const need=row.need;
  const capabilityLabel=need.excerpt.replace(/\s+/g,' ').trim().slice(0,180);
  const terms=termsFor(need.excerpt,row.scope);
  if(terms.length<2)throw new Error(`Need ${need.needItemId} lacks two bounded current-check terms`);
  const sourceUrls=[need.sourceUrl,...(row.provider?[row.provider.sourceUrl]:sameScopeAlternative?[sameScopeAlternative.sourceUrl]:[])];
  const priorEvidence=[{sourceUrl:need.sourceUrl,revision:need.revision,evidenceType:'status_update' as const,excerpt:need.excerpt.slice(0,1800),verification:`Imported atomic need; ${need.verification}`},...(row.provider?[{sourceUrl:row.provider.sourceUrl,revision:row.provider.revision,evidenceType:row.provider.direction==='offer'?'human_offer' as const:'code_observed' as const,excerpt:row.provider.claim.slice(0,1800),verification:row.provider.verification}]:sameScopeAlternative?[{sourceUrl:sameScopeAlternative.sourceUrl,revision:sameScopeAlternative.revision,evidenceType:'human_offer' as const,excerpt:sameScopeAlternative.providerClaim.slice(0,1800),verification:`Same-scope offer rejected by matcher as ${sameScopeAlternative.reason}; live availability is not yet checked.`}]:[])];
  const rawSpec={
   opportunityId:row.id,capability:{key:row.scope,label:capabilityLabel,terms},
   consumer:{id:consumer.id,name:consumer.name,aliases:[],repositories:allRepositories(consumer.id,consumer.repository)},
   ...(pairedForCheck&&provider?{provider:{id:provider.id,name:provider.name,aliases:[],repositories:allRepositories(provider.id,provider.repository)}}:{}),
   sourceUrls:[...new Set(sourceUrls)].slice(0,12),knownUnavailableSources:[],codeTouchpoints:[],searchConcepts:[capabilityLabel.slice(0,120),row.scope.replaceAll('-',' '),...terms.slice(0,4)].slice(0,8),priorEvidence,priorLifecycle:'unknown',priorCompatibility:'unknown',
  };
  const spec=CandidateSpecSchema.parse(rawSpec);
  const checked=await verifyCandidateCurrentState(spec,{cacheDir:join(root,'.data/current-state-cache')});
  checks.push({
   candidateId:row.id,needItemId:need.needItemId,sourceUrl:need.sourceUrl,sourceRevision:need.revision,
   engineDisposition:row.source==='structured_match'?'surfaced_match':sameScopeAlternative?`rejected_alternative:${sameScopeAlternative.reason}`:'no_supported_provider',
   checkedPair:provider?{consumer:{id:consumer.id,name:consumer.name},alternativeProvider:{id:provider.id,name:provider.name}}:null,
   check:{checkedAt:checked.checkedAt,result:checked.result,freshness:checked.freshness,lifecycleState:checked.lifecycleState,compatibilityState:checked.compatibilityState,summary:checked.summary,uncertainty:checked.uncertainty,nextAction:checked.nextAction,queries:checked.queries,limitations:checked.limitations,sources:checked.sources.map(s=>({url:s.url,kind:s.kind,checkedAt:s.checkedAt,fetchStatus:s.fetchStatus,httpStatus:s.httpStatus,revision:s.revision,publishedAt:s.publishedAt,etag:s.etag,lastModified:s.lastModified,error:s.error,cache:s.cache,contentSha256:sha(s.content),excerpt:s.excerpt.slice(0,2000)})),evidence:checked.evidence},
  });
 }
 const report={schemaVersion:1,sourcePool:relative(root,file),sourcePoolSha256:sha(await readFile(file)),sourceSnapshotSha256:parsed.inputSnapshot.sha256,verificationMethod:'Existing bounded candidate-scoped current-state verifier. Need-only checks omit a provider. Same-scope matcher-rejected alternatives are fetched only as alternatives and remain rejected in the engine record. No contacts or external writes.',checks};
 const bytes=Buffer.from(JSON.stringify(report,null,2)+'\n'),outDir=join(root,'evidence/tc-01d');await mkdir(outDir,{recursive:true});const name=`current-checks-${parsed.inputSnapshot.sha256.slice(0,16)}-${stamp()}.json`;await writeFile(join(outDir,name),bytes,{flag:'wx',mode:0o644});await writeFile(join(outDir,`${name}.sha256`),`${sha(bytes)}  ${name}\n`,{flag:'wx',mode:0o644});
 console.log(JSON.stringify({path:`evidence/tc-01d/${name}`,sha256:sha(bytes),checks:checks.map(x=>({candidateId:x.candidateId,engineDisposition:x.engineDisposition,result:x.check.result,freshness:x.check.freshness,lifecycleState:x.check.lifecycleState,sources:x.check.sources.length,available:x.check.sources.filter((s:any)=>s.fetchStatus==='available').length}))},null,2));process.exit(0);
}
main().catch(error=>{console.error(error instanceof Error?error.message:String(error));process.exit(1)});
