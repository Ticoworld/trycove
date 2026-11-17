import {createHash} from 'node:crypto';
import {existsSync} from 'node:fs';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {gzipSync,gunzipSync} from 'node:zlib';
import {asc,inArray} from 'drizzle-orm';
import {db} from '../../lib/db';
import {footprintObservations,projectRepositories,projects,technicalFootprints} from '../../lib/schema';

const output='evidence/tc-01e/frozen-source-cohort.json.gz';
const sha=(data:Buffer|string)=>createHash('sha256').update(data).digest('hex');

async function main(){
 const verify=process.argv.includes('--verify');
 if(!existsSync(output)&&verify)throw new Error(`Missing frozen cohort: ${output}`);
 if(!existsSync(output)){
  const [allProjects,allAssociations,allFootprints]=await Promise.all([
   db.select().from(projects).orderBy(asc(projects.id)),
   db.select().from(projectRepositories).orderBy(asc(projectRepositories.id)),
   db.select().from(technicalFootprints).orderBy(asc(technicalFootprints.repository),asc(technicalFootprints.revision),asc(technicalFootprints.id)),
  ]);
  const byIdentity=new Map<string,typeof allFootprints>();
  for(const footprint of allFootprints){const key=`${footprint.repository}\0${footprint.revision}`;const list=byIdentity.get(key)??[];list.push(footprint);byIdentity.set(key,list)}
  const cohort=[...byIdentity.entries()].map(([key,rows])=>({selectionKey:sha(key),repository:rows[0]!.repository,revision:rows[0]!.revision,footprintIds:rows.map(x=>x.id).sort(),projectIds:[...new Set(rows.map(x=>x.projectId))].sort()})).sort((a,b)=>a.selectionKey.localeCompare(b.selectionKey)).slice(0,24).sort((a,b)=>a.repository.localeCompare(b.repository)||a.revision.localeCompare(b.revision));
  const selectedIds=cohort.flatMap(x=>x.footprintIds).sort();
  const observations=selectedIds.length?await db.select().from(footprintObservations).where(inArray(footprintObservations.footprintId,selectedIds)).orderBy(asc(footprintObservations.footprintId),asc(footprintObservations.path),asc(footprintObservations.startLine),asc(footprintObservations.id)):[];
  const selectedProjects=new Set(cohort.flatMap(x=>x.projectIds));
  const source={schemaVersion:'tc-01e-cohort-v1',createdAt:new Date().toISOString(),baselineCommit:'21708af1d2cfe19e420d84d67f51f5c8fb64550e',selection:{algorithm:'sha256(repository + NUL + fullRevision), ascending; first 24 distinct repository/revision identities; all identities are frozen before relationship evaluation',limit:24},inventory:{projectCount:allProjects.length,repositoryAssociationCount:allAssociations.length,footprintRecordCount:allFootprints.length,uniquePinnedRepositoryCount:byIdentity.size,selectedPinnedRepositoryCount:cohort.length,selectedFootprintRecordCount:selectedIds.length,selectedObservationCount:observations.length},products:allProjects.filter(p=>selectedProjects.has(p.id)),repositories:allAssociations.filter(a=>selectedProjects.has(a.projectId)),cohort,footprints:allFootprints.filter(f=>selectedIds.includes(f.id)),observations};
  await mkdir('evidence/tc-01e',{recursive:true});const bytes=gzipSync(Buffer.from(JSON.stringify(source)),{level:9});await writeFile(output,bytes,{flag:'wx'});console.log(`Frozen ${cohort.length} pinned repositories and ${observations.length} observations; gzip sha256 ${sha(bytes)}; ${bytes.length} bytes`);
 }else{
  const bytes=await readFile(output);const source=JSON.parse(gunzipSync(bytes).toString('utf8')) as {baselineCommit:string;inventory:Record<string,number>;cohort:{repository:string;revision:string}[];observations:unknown[]};
  if(source.baselineCommit!=='21708af1d2cfe19e420d84d67f51f5c8fb64550e')throw new Error('Baseline commit mismatch');
  if(source.cohort.length!==source.inventory.selectedPinnedRepositoryCount||source.observations.length!==source.inventory.selectedObservationCount)throw new Error('Frozen cohort counts mismatch');
  console.log(`Verified ${source.cohort.length} repositories, ${source.observations.length} observations; gzip sha256 ${sha(bytes)}; ${bytes.length} bytes`);
 }
 process.exit(0);
}
main().catch(error=>{console.error(error);process.exit(1)});
