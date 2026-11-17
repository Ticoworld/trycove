import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {existsSync} from 'node:fs';
import {readFile,writeFile} from 'node:fs/promises';
import {asc,eq} from 'drizzle-orm';
import {db} from '../../lib/db';
import {externalSourceSnapshots,sourceRecords,technicalFootprints} from '../../lib/schema';
import {repositoryUrl} from '../../lib/sources/ckbdapps-json';

const output='evidence/tc-01e/product-source-cohort.json';const limit=12;
const sha=(value:string)=>createHash('sha256').update(value).digest('hex');
function pin(path:string){try{const result=execFileSync('git',['ls-remote',`https://github.com/${path}.git`,'HEAD'],{encoding:'utf8',timeout:20000,stdio:['ignore','pipe','ignore']}).trim();const revision=result.split(/\s+/)[0]??'';return/^[a-f0-9]{40}$/.test(revision)?{revision}: {error:'Git remote returned no full HEAD revision'}}catch(error){return{error:String(error).slice(0,250)}}}

async function main(){
 if(process.argv.includes('--verify')){
  if(!existsSync(output))throw new Error(`Missing frozen cohort ${output}`);const x=JSON.parse(await readFile(output,'utf8')) as {selection:{limit:number;algorithm:string};selected:{repositoryPath:string;revision:string}[];baselineCommit:string};
  if(x.baselineCommit!=='21708af1d2cfe19e420d84d67f51f5c8fb64550e'||x.selected.length!==x.selection.limit||x.selected.some(row=>!/^[a-f0-9]{40}$/.test(row.revision)))throw new Error('Frozen product cohort failed validation');console.log(`${x.selected.length} source-linked repositories verified from ${output}; sha256 ${sha(await readFile(output,'utf8'))}`);process.exit(0)
 }
 if(existsSync(output))throw new Error(`Refusing to replace frozen cohort ${output}; use --verify`);
 const [records,footprints,pulse]=await Promise.all([
  db.select().from(sourceRecords).where(eq(sourceRecords.source,'CKBdapps JSON')).orderBy(asc(sourceRecords.projectId),asc(sourceRecords.observedAt)),
  db.select().from(technicalFootprints),
  db.select().from(externalSourceSnapshots).where(eq(externalSourceSnapshots.source,'ckb-pulse-state')).orderBy(asc(externalSourceSnapshots.checkedAt)),
 ]);
 const products=new Map<string,{projectId:string;name:string;repositoryPath:string;feedRevision:string;recordObservedAt:string}[]>();for(const source of records){try{const raw=JSON.parse(source.raw) as {record?:{github?:unknown;name?:unknown}};const url=repositoryUrl(raw.record?.github);if(!url)continue;const repositoryPath=new URL(url).pathname.split('/').filter(Boolean).join('/').toLowerCase();const rows=products.get(repositoryPath)??[];rows.push({projectId:source.projectId,name:typeof raw.record?.name==='string'?raw.record.name:source.projectId,repositoryPath,feedRevision:source.revision,recordObservedAt:source.observedAt.toISOString()});products.set(repositoryPath,rows)}catch{}}
 const scannedRepositories=new Set(footprints.map(f=>f.repository.toLowerCase()));const candidates=[...products.entries()].map(([repositoryPath,claims])=>({repositoryPath,productIds:[...new Set(claims.map(x=>x.projectId))].sort(),productNames:[...new Set(claims.map(x=>x.name))].sort(),claims,selectionDigest:sha(repositoryPath),alreadyScanned:scannedRepositories.has(`https://github.com/${repositoryPath}`),identityAmbiguous:new Set(claims.map(x=>x.projectId)).size>1}));
 const eligible=candidates.filter(x=>!x.alreadyScanned&&!x.identityAmbiguous).sort((a,b)=>a.selectionDigest.localeCompare(b.selectionDigest));if(eligible.length<limit)throw new Error(`Only ${eligible.length} unscanned, unambiguous CKBdapps repository claims are available; required deterministic sample is ${limit}`);
 const chosen=eligible.slice(0,limit);const pinned=chosen.map(row=>({...row,...pin(row.repositoryPath)}));const failed=pinned.filter((x):x is typeof x&{error:string}=>'error'in x);if(failed.length)throw new Error(`Could not pin ${failed.length} cohort repositories: ${failed.map(x=>`${x.repositoryPath} (${x.error})`).join('; ')}`);
 const pulseRows=pulse.filter(x=>x.status==='ok'||x.status==='not_modified');const latestPulse=pulseRows.at(-1);
 const frozen={schemaVersion:'tc-01e-product-cohort-v1',baselineCommit:'21708af1d2cfe19e420d84d67f51f5c8fb64550e',frozenAt:new Date().toISOString(),source:{name:'CKBdapps published JSON record claims',url:'https://ckbdapps.com/projects.json',feedRevision:records.at(-1)?.revision??null,recordCount:records.length,pulseStateRevision:latestPulse?.sourceRevision??null,pulseStateSha256:latestPulse?.contentSha256??null},selection:{algorithm:'From CKBdapps JSON repository claims, exclude repository identities already source-scanned at the baseline and claims associated with multiple product identities; sort the remaining repository paths by SHA-256(lowercase owner/repository); take the first 12; pin each with git ls-remote HEAD before any relationship evaluation.',limit,preexistingRepositories:candidates.filter(x=>x.alreadyScanned).length,ambiguousRepositoryClaims:candidates.filter(x=>x.identityAmbiguous).length,eligibleCount:eligible.length},eligible:eligible.map(({claims,...row})=>({...row,sourceProjectClaims:claims})),excluded:candidates.filter(x=>x.alreadyScanned||x.identityAmbiguous).map(({claims,...row})=>({...row,reason:row.alreadyScanned?'repository identity was scanned at baseline':'repo claim maps to multiple product identities',sourceProjectClaims:claims})),selected:pinned.map(({claims,...row})=>({...row,sourceProjectClaims:claims}))};
 await writeFile(output,JSON.stringify(frozen,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({output,sha256:sha(await readFile(output,'utf8')),sourceProjects:records.length,cohort:frozen.selection,selected:frozen.selected.map(x=>({repositoryPath:x.repositoryPath,productIds:x.productIds,revision:x.revision}))},null,2));process.exit(0)
}
main().catch(error=>{console.error(error);process.exit(1)});
