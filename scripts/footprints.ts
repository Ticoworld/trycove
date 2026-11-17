import {execFileSync} from 'node:child_process';
import {mkdtemp,readFile,rm,lstat} from 'node:fs/promises';
import {join,posix} from 'node:path';
import {tmpdir} from 'node:os';
import {db} from '../lib/db';
import {projects,projectRepositories,technicalFootprints,footprintObservations,signals} from '../lib/schema';
import {analyzeFootprint,type SourceFile} from '../lib/intelligence/footprint';
import {eq} from 'drizzle-orm';

type Target={projectId:string;repository:string;role:string};
function parseRepo(raw:string|null){if(!raw)return null;try{const u=new URL(raw);if(u.protocol!=='https:'||u.hostname.toLowerCase()!=='github.com'||u.username||u.password)return null;const parts=u.pathname.split('/').filter(Boolean);if(parts.length<2||!/^[\w.-]+$/.test(parts[0])||!/^[\w.-]+$/.test(parts[1]))return null;const repo=`https://github.com/${parts[0]!.toLowerCase()}/${parts[1]!.replace(/\.git$/,'').toLowerCase()}`;const scope=parts[2]==='tree'&&['main','master'].includes(parts[3])?parts.slice(4).join('/'):'';if(scope.split('/').some(x=>x==='..'||x==='.'||!x))return scope?null:{repo,scope:''};return {repo,scope}}catch{return null}}
function arg(name:string){const i=process.argv.indexOf(name);return i<0?undefined:process.argv[i+1]}
const componentRole=(role:string)=>/^(?:repository|contracts?|resolver|sdk|api|backend|frontend|service|server|client|application|app)$/i.test(role.trim())||/(?:resolver|contracts?|sdk|api|backend|frontend|service|server|client|application|\bapp\b)/i.test(role)&&!/(?:met on|background|example|issue|referenced repository)/i.test(role);
async function main(){
 const limit=Number(arg('--limit')??'5'),offset=Number(arg('--offset')??'0'),projectId=arg('--project'),pinned=arg('--revision'),repositoryUrl=arg('--repository-url');
 if(pinned&&(!projectId||!/^[a-f0-9]{40}$/.test(pinned)))throw Error('--revision requires --project and a full lowercase 40-character SHA');
 if(repositoryUrl&&!projectId)throw Error('--repository-url requires --project');
 if(!Number.isInteger(limit)||limit<1||limit>20||!Number.isInteger(offset)||offset<0)throw Error('Use --limit 1..20 and nonnegative --offset');
 const needIds=process.argv.includes('--needs-only')?new Set((await db.select({projectId:signals.projectId}).from(signals).where(eq(signals.kind,'need'))).map(x=>x.projectId)):null;
 const allProjects=(await db.select().from(projects)).filter(p=>(!projectId||p.id===projectId)&&(!needIds||needIds.has(p.id)));
 const associations=await db.select().from(projectRepositories);
 const targets:Target[]=allProjects.flatMap(p=>{
  const associated=associations.filter(x=>x.projectId===p.id&&componentRole(x.role)).map(x=>({repository:x.repository,role:x.role}));
  return [...new Map([{repository:p.repository??'',role:'primary'},...associated].filter(x=>x.repository).map(x=>[x.repository,x])).values()].map(x=>({projectId:p.id,...x}));
 }).filter(x=>Boolean(parseRepo(x.repository))).sort((a,b)=>a.projectId.localeCompare(b.projectId)||a.repository.localeCompare(b.repository));
 let scoped=targets;
 if(repositoryUrl){const parsed=parseRepo(repositoryUrl);if(!parsed||parsed.scope)throw Error('--repository-url must be a canonical GitHub repository root');scoped=targets.filter(x=>x.projectId===projectId&&parseRepo(x.repository)?.repo.toLowerCase()===parsed.repo.toLowerCase());if(!scoped.length)throw Error('Repository is not associated with this imported project in source records')}
 const chosen=scoped.slice(offset,offset+limit);if(!chosen.length)throw Error('No imported project repositories in scope');
 let succeeded=0,failed=0;const tmp=await mkdtemp(join(tmpdir(),'tc-footprints-'));
 try{for(const [index,targetSpec] of chosen.entries()){
  try{
   const target=parseRepo(targetSpec.repository);if(!target)throw Error('Repository URL or subdirectory unsupported');const dir=join(tmp,String(index));
   execFileSync('bash',['-c','ulimit -f 131072; exec git -c core.hooksPath=/dev/null -c protocol.file.allow=never clone --quiet --depth 1 --no-tags "$1" "$2"','footprint-clone',target.repo,dir],{timeout:60000,env:{...process.env,GIT_LFS_SKIP_SMUDGE:'1',GIT_TERMINAL_PROMPT:'0'},maxBuffer:1000000});
   if(pinned){execFileSync('bash',['-c','ulimit -f 131072; exec git -C "$1" fetch --quiet --depth 1 origin "$2"','footprint-fetch',dir,pinned],{timeout:60000,env:{...process.env,GIT_LFS_SKIP_SMUDGE:'1',GIT_TERMINAL_PROMPT:'0'},maxBuffer:1000000});execFileSync('git',['-C',dir,'-c','core.hooksPath=/dev/null','checkout','--quiet','--detach',pinned],{timeout:30000,env:{...process.env,GIT_LFS_SKIP_SMUDGE:'1',GIT_TERMINAL_PROMPT:'0'},maxBuffer:1000000})}
   const revision=execFileSync('git',['-C',dir,'rev-parse','HEAD'],{encoding:'utf8'}).trim();if(pinned&&revision!==pinned)throw Error('Checked out revision does not match requested SHA');
   const raw=execFileSync('git',['-C',dir,'ls-files','-z'],{encoding:'utf8',maxBuffer:10_000_000});const selected=raw.split('\0').filter(f=>f&&(!target.scope||f.startsWith(target.scope+'/'))&&(/\.(?:[cm]?[jt]sx?|rs|json|toml|ya?ml)$/.test(f)||f.endsWith('/Cargo.lock')||f==='Cargo.lock')&&!/(^|\/)(node_modules|vendor|target|dist|build|\.next|fixtures|tests?|coverage)\//i.test(f)&&!/(?:\.test|\.spec|_test)\.[cm]?[jt]sx?$/i.test(f)).sort();
   const files:SourceFile[]=[];let bytes=0,skipped=0;for(const f of selected){if(files.length>=1500||bytes>=12_000_000){skipped++;continue}if(posix.isAbsolute(f)||f.split('/').includes('..')){skipped++;continue}const full=join(dir,f);const st=await lstat(full);const maxFileSize=/(?:^|\/)(?:package-lock\.json|pnpm-lock\.yaml|Cargo\.lock)$/.test(f)?2_000_000:400_000;if(!st.isFile()||st.size>maxFileSize||bytes+st.size>12_000_000){skipped++;continue}files.push({path:f,content:await readFile(full,'utf8')});bytes+=st.size}
   const result=analyzeFootprint({projectId:targetSpec.projectId,repository:target.repo,revision,scope:target.scope||'.',files});if(skipped)result.unknowns.push(`${skipped} selected files skipped due to scan limits or unsupported file types.`);
   if((await db.select({id:technicalFootprints.id}).from(technicalFootprints).where(eq(technicalFootprints.id,result.id))).length){console.log(`Cached ${targetSpec.projectId} ${targetSpec.role} ${revision} (${result.observations.length} observations)`);succeeded++;continue}
   await db.transaction(async tx=>{await tx.insert(technicalFootprints).values({id:result.id,projectId:targetSpec.projectId,repository:target.repo,revision,analyzerVersion:result.analyzerVersion,scope:result.scope,analyzedAt:new Date(),unknowns:JSON.stringify(result.unknowns),fileCount:result.fileCount,status:result.status});for(let i=0;i<result.observations.length;i+=100){const part=result.observations.slice(i,i+100).map(o=>({...o,footprintId:result.id,unknowns:JSON.stringify(o.unknowns)}));if(part.length)await tx.insert(footprintObservations).values(part)}});
   console.log(`Analyzed ${targetSpec.projectId} ${targetSpec.role} ${revision}: ${files.length} files, ${result.observations.length} observations, ${result.unknowns.length} limitations`);succeeded++
  }catch(e){failed++;console.error(`Failed ${targetSpec.projectId} ${targetSpec.repository}: ${e instanceof Error?((e.cause instanceof Error?e.cause.message:e.message).slice(0,500)):String(e).slice(0,500)}`)}
 }}finally{await rm(tmp,{recursive:true,force:true})}
 console.log(`Processed ${chosen.length}: ${succeeded} succeeded, ${failed} failed`);process.exit(failed?1:0)
}
main().catch(e=>{console.error(e);process.exit(1)});
