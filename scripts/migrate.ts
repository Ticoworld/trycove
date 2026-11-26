import {readFile,mkdir} from 'node:fs/promises';
import {basename} from 'node:path';
import {PGlite} from '@electric-sql/pglite';
import {Client} from 'pg';

const files=['0001_initial.sql','0002_connections.sql','0003_footprints.sql','0004_intelligence.sql','0005_trial_evidence.sql','0006_project_repositories.sql','0007_signal_intents.sql','0008_candidate_lifecycle.sql','0009_need_items.sql','0010_need_taxonomy.sql','0011_need_lineage_and_decisions.sql','0012_opportunity_qualification.sql','0013_opportunity_prior_work_reconciliations.sql','0014_external_source_snapshots.sql','0015_guided_trial_rooms.sql','0016_devrel_handoffs.sql','0017_trial_packs.sql','0018_identity.sql','0019_participation.sql','0020_hosted_evidence.sql','0021_connection_operations.sql','0022_prepared_resources.sql','0023_single_use_identities.sql','0024_playground_handoffs.sql','0025_playground_application.sql'].map(name=>`migrations/${name}`);
async function main(){
 const migrations=await Promise.all(files.map(async path=>({version:basename(path).slice(0,4),sql:await readFile(path,'utf8')})));
 const connectionString=process.env.TRYCOVE_MIGRATION_DATABASE_URL??process.env.DATABASE_URL;
 if(connectionString){
  const client=new Client({connectionString});await client.connect();
  try{await client.query("SELECT pg_advisory_lock(645016020)");await apply({query:async(sql,params)=>{const result=await client.query(sql,params);return {rows:result.rows as Array<Record<string,unknown>>}},exec:async sql=>{await client.query(sql)}},migrations)}finally{await client.end()}
 }else{
  if(process.env.NODE_ENV==='production'||process.env.VERCEL)throw new Error('Hosted migrations require PostgreSQL.');
  const path=process.env.TRYCOVE_PGLITE_PATH??'./.data/trycove';await mkdir(path.startsWith('./')?'.data':path,{recursive:true});
  const client=new PGlite(path);try{await apply({query:async(sql,params)=>{const result=await client.query(sql,params);return {rows:result.rows as Array<Record<string,unknown>>}},exec:sql=>client.exec(sql)},migrations)}finally{await client.close()}
 }
 console.log(`Applied pending migrations through ${migrations.at(-1)?.version}`);
}
type MigrationClient={query(sql:string,params?:unknown[]):Promise<{rows:Array<Record<string,unknown>>}>;exec(sql:string):Promise<unknown>};
async function apply(client:MigrationClient,migrations:Array<{version:string;sql:string}>){
 const existing = await client.query("SELECT to_regclass('public.projects')::text AS projects, to_regclass('public.trycove_migrations')::text AS journal");
 if (existing.rows[0]?.projects && !existing.rows[0]?.journal) {
  throw new Error('Untracked Trycove schema. Validate the schema against its original migration chain before recording a baseline.');
 }
 await client.exec('CREATE TABLE IF NOT EXISTS trycove_migrations(version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
 const journal = await client.query('SELECT version FROM trycove_migrations ORDER BY version');
 if (journal.rows.some((row,index)=>row.version!==migrations[index]?.version) || (existing.rows[0]?.projects && !journal.rows.length)) {
  throw new Error('Migration history does not match the expected chain.');
 }
 for(const migration of migrations){
  const found=await client.query('SELECT version FROM trycove_migrations WHERE version=$1',[migration.version]);if(found.rows.length)continue;
  await client.query('BEGIN');
  try{await client.exec(migration.sql);await client.query('INSERT INTO trycove_migrations(version) VALUES ($1)',[migration.version]);await client.query('COMMIT')}
  catch(error){await client.query('ROLLBACK');throw error}
 }
}
main().catch(error=>{console.error(error);process.exit(1)});
