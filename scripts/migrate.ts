import {readFile,mkdir} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {Client} from 'pg';
async function main(){const sql=await readFile('migrations/0001_initial.sql','utf8'); if(process.env.DATABASE_URL){const c=new Client({connectionString:process.env.DATABASE_URL}); await c.connect(); await c.query(sql); await c.end()}else{await mkdir('.data',{recursive:true});const c=new PGlite('./.data/trycove'); await c.exec(sql); await c.close()} console.log('Migration applied');} main().catch(e=>{console.error(e);process.exit(1)});
