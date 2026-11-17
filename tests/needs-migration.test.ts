import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {describe,it,expect} from 'vitest';

describe('builder need persistence migration',()=>{
 it('upgrades the taxonomy and reapplies migrations without losing source evidence',async()=>{
  const paths=['0001_initial.sql','0002_connections.sql','0003_footprints.sql','0004_intelligence.sql','0005_trial_evidence.sql','0006_project_repositories.sql','0007_signal_intents.sql','0008_candidate_lifecycle.sql','0009_need_items.sql'];
  const sql=(await Promise.all(paths.map(path=>readFile(`migrations/${path}`,'utf8')))).join('\n');
  const db=new PGlite();
  try{
   await db.exec(sql);
   await db.query(`INSERT INTO projects (id,name,description,source_url,revision,observed_at) VALUES ('p','Project','Description','https://github.com/org/repo','${'a'.repeat(40)}',now())`);
   await db.query(`INSERT INTO signals (id,project_id,kind,concept,claim,source_url,revision,verification,observed_at) VALUES ('s','p','need','feedback-request','Please review the lock design.','https://github.com/org/repo/issues/1','${'b'.repeat(40)}','issue author claim; unverified',now())`);
   await db.query(`INSERT INTO need_items (id,signal_id,project_id,source_url,revision,observed_at,excerpt,category,stance,verification,extraction_rule,start_offset,end_offset) VALUES ('n','s','p','https://github.com/org/repo/issues/1','${'b'.repeat(40)}',now(),'Please review the lock design.','technical-integration','explicit-request','automated classification only','needs-v1',0,30)`);
   const taxonomy=await readFile('migrations/0010_need_taxonomy.sql','utf8');
   await db.exec(taxonomy);
   await db.exec((await readFile('migrations/0009_need_items.sql','utf8'))+'\n'+taxonomy);
   const result=await db.query('SELECT signal_id,source_url,excerpt,category,stance FROM need_items WHERE id=$1',['n']);
   expect(result.rows).toEqual([{signal_id:'s',source_url:'https://github.com/org/repo/issues/1',excerpt:'Please review the lock design.',category:'feature-request',stance:'explicit-request'}]);
  }finally{await db.close()}
 });
});
