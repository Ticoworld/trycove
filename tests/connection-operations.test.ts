import {describe,it,expect} from 'vitest';
import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';

describe('connection operations migration',()=>{
 it('persists private operational state without changing qualification and enforces valid progress',async()=>{
  const db=new PGlite();
  try{
   const files=['0001_initial.sql','0002_connections.sql','0003_footprints.sql','0004_intelligence.sql','0005_trial_evidence.sql','0006_project_repositories.sql','0007_signal_intents.sql','0008_candidate_lifecycle.sql','0009_need_items.sql','0010_need_taxonomy.sql','0011_need_lineage_and_decisions.sql','0012_opportunity_qualification.sql','0013_opportunity_prior_work_reconciliations.sql','0014_external_source_snapshots.sql','0015_guided_trial_rooms.sql','0016_devrel_handoffs.sql','0017_trial_packs.sql','0018_identity.sql','0019_participation.sql','0020_hosted_evidence.sql','0021_connection_operations.sql'];
   for(const file of files)await db.exec(await readFile(`migrations/${file}`,'utf8'));
   await db.query("insert into projects(id,name,description,source_url,revision,observed_at) values ('p','Fixture','','https://example.test','r',now())");
   await db.query("insert into opportunities(id,project_a,kind,problem,reasoning,requirements,experiment,status) values ('o','p','documented-need','Need','Context','','','needs-review')");
   await db.query("insert into connection_operations(opportunity_id,next_action,due_date,watchlist,progress) values ('o','Contact','2026-12-01',true,'in-progress')");
   const result=await db.query<{status:string;publication:string;next_action:string;watchlist:boolean;progress:string}>("select o.status,c.publication,c.next_action,c.watchlist,c.progress from opportunities o join connection_operations c on c.opportunity_id=o.id");
   expect(result.rows[0]).toMatchObject({status:'needs-review',publication:'private',next_action:'Contact',watchlist:true,progress:'in-progress'});
   await expect(db.query("update connection_operations set progress='compatible'")).rejects.toThrow();
  }finally{await db.close()}
 },60000);
});
