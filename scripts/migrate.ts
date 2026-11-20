import {readFile,mkdir} from 'node:fs/promises';
import {basename} from 'node:path';
import {PGlite} from '@electric-sql/pglite';
import {Client} from 'pg';

const files=['0001_initial.sql','0002_connections.sql','0003_footprints.sql','0004_intelligence.sql','0005_trial_evidence.sql','0006_project_repositories.sql','0007_signal_intents.sql','0008_candidate_lifecycle.sql','0009_need_items.sql','0010_need_taxonomy.sql','0011_need_lineage_and_decisions.sql','0012_opportunity_qualification.sql','0013_opportunity_prior_work_reconciliations.sql','0014_external_source_snapshots.sql','0015_guided_trial_rooms.sql','0016_devrel_handoffs.sql'].map(name=>`migrations/${name}`);
async function main(){
 const migrations=await Promise.all(files.map(async path=>({version:basename(path).slice(0,4),sql:await readFile(path,'utf8')})));
 if(process.env.DATABASE_URL){
  const client=new Client({connectionString:process.env.DATABASE_URL});await client.connect();
  try{await apply({query:async(sql,params)=>{const result=await client.query(sql,params);return {rows:result.rows as Array<Record<string,unknown>>}},exec:async sql=>{await client.query(sql)}},migrations)}finally{await client.end()}
 }else{
  const path=process.env.TRYCOVE_PGLITE_PATH??'./.data/trycove';await mkdir(path.startsWith('./')?'.data':path,{recursive:true});
  const client=new PGlite(path);try{await apply({query:async(sql,params)=>{const result=await client.query(sql,params);return {rows:result.rows as Array<Record<string,unknown>>}},exec:sql=>client.exec(sql)},migrations)}finally{await client.close()}
 }
 console.log(`Applied pending migrations through ${migrations.at(-1)?.version}`);
}
type MigrationClient={query(sql:string,params?:unknown[]):Promise<{rows:Array<Record<string,unknown>>}>;exec(sql:string):Promise<unknown>};
async function apply(client:MigrationClient,migrations:Array<{version:string;sql:string}>){
 await client.exec('CREATE TABLE IF NOT EXISTS trycove_migrations(version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
 const baseline=await client.query('SELECT to_regclass(\'public.guided_trial_sessions\')::text AS name');
 if(baseline.rows[0]?.name){
  for(const migration of migrations.filter(m=>Number(m.version)<=15))await client.query('INSERT INTO trycove_migrations(version) VALUES ($1) ON CONFLICT DO NOTHING',[migration.version]);
 }
 for(const migration of migrations){
  const found=await client.query('SELECT version FROM trycove_migrations WHERE version=$1',[migration.version]);if(found.rows.length)continue;
  await client.query('BEGIN');
  try{await client.exec(migration.sql);await client.query('INSERT INTO trycove_migrations(version) VALUES ($1)',[migration.version]);await client.query('COMMIT')}
  catch(error){await client.query('ROLLBACK');throw error}
 }
}
main().catch(error=>{console.error(error);process.exit(1)});
