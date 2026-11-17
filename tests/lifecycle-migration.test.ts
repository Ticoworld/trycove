import {describe,it,expect} from 'vitest';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {join} from 'node:path';

const files=['0001_initial.sql','0002_connections.sql','0003_footprints.sql','0004_intelligence.sql','0005_trial_evidence.sql','0006_project_repositories.sql','0007_signal_intents.sql','0008_candidate_lifecycle.sql','0009_need_items.sql','0010_need_taxonomy.sql','0011_need_lineage_and_decisions.sql','0012_opportunity_qualification.sql'];
async function migrate(db:PGlite){for(const file of files)await db.exec(await readFile(join(process.cwd(),'migrations',file),'utf8'))}

describe('candidate lifecycle persistence migration',()=>{
 it('is repeatable, isolates two capabilities on one pair, and appends conflicting observations',async()=>{
  const db=new PGlite();
  try{
   await migrate(db);await migrate(db);
   await db.exec("INSERT INTO projects(id,name,description,source_url,revision,observed_at) VALUES ('left','Left','left','https://github.com/example/left','a',now()),('right','Right','right','https://github.com/example/right','b',now())");
   await db.exec("INSERT INTO opportunities(id,project_a,project_b,kind,problem,reasoning,requirements,experiment,status) VALUES ('pair','left','right','candidate','need','reason','unknown','test','discovered')");
   await db.exec("INSERT INTO candidate_capabilities(id,opportunity_id,capability_key,capability,consumer_project_id,provider_project_id,lifecycle_state,compatibility_state,freshness,summary,uncertainty,next_action,created_at,updated_at) VALUES ('invoice','pair','invoice-route','invoice route','left','right','demonstrated_in_wild','unknown','partial','reported demonstration','adoption unknown','reconfirm','2026-01-01Z','2026-01-01Z'),('review','pair','review-offer','human architecture review','left','right','stale_offer','unknown','current','old offer','availability unknown','reconfirm offer','2026-01-01Z','2026-01-01Z')");
   await db.exec("INSERT INTO lifecycle_verification_runs(id,capability_id,checked_at,result,freshness,prior_lifecycle,evaluated_lifecycle,method,queries,conclusion,limitations,next_action,source_count) VALUES ('run-1','invoice','2026-01-02Z','partial','partial','demonstrated_in_wild','demonstrated_in_wild','live refresh','[]','source unavailable','unverified','recheck','1'),('run-2','invoice','2026-01-03Z','contradictory','partial','demonstrated_in_wild','in_progress','live refresh','[]','conflicting report','scope differs','split scope','2')");
   await db.exec("INSERT INTO lifecycle_evidence(id,capability_id,verification_run_id,evidence_type,source_url,checked_at,excerpt,conclusion,verification,source_sha256) VALUES ('evidence-1','invoice','run-1','maintainer_report','https://talk.nervos.org/t/topic/1','2026-01-02Z','reported testnet trade','reported only','not retrieved','aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'),('evidence-2','invoice','run-2','status_update','https://github.com/example/repo/issues/2','2026-01-03Z','still requests routing','conflicting evidence','source fetched','bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb')");
   const claims=await db.query("SELECT capability_key,lifecycle_state FROM candidate_capabilities WHERE opportunity_id='pair' ORDER BY capability_key");
   expect(claims.rows).toEqual([{capability_key:'invoice-route',lifecycle_state:'demonstrated_in_wild'},{capability_key:'review-offer',lifecycle_state:'stale_offer'}]);
   const history=await db.query("SELECT id,evaluated_lifecycle FROM lifecycle_verification_runs WHERE capability_id='invoice' ORDER BY checked_at");
   const evidence=await db.query("SELECT id FROM lifecycle_evidence WHERE capability_id='invoice' ORDER BY checked_at");
   expect(history.rows).toEqual([{id:'run-1',evaluated_lifecycle:'demonstrated_in_wild'},{id:'run-2',evaluated_lifecycle:'in_progress'}]);expect(evidence.rows).toHaveLength(2);
   const snapshot='a'.repeat(64);
   for(let i=0;i<2;i++)await db.exec(`INSERT INTO opportunity_qualification_reviews(id,opportunity_id,input_snapshot_sha256,outcome,action_status,review,created_at) VALUES ('review-1','pair','${snapshot}','NO_QUALIFIED_PILOT','NO_QUALIFIED_PILOT','{}',now()) ON CONFLICT (opportunity_id,input_snapshot_sha256) DO NOTHING`);
   const reviews=await db.query("SELECT id,outcome,action_status FROM opportunity_qualification_reviews WHERE opportunity_id='pair'");
   expect(reviews.rows).toEqual([{id:'review-1',outcome:'NO_QUALIFIED_PILOT',action_status:'NO_QUALIFIED_PILOT'}]);
   await expect(db.exec("INSERT INTO candidate_capabilities(id,opportunity_id,capability_key,capability,consumer_project_id,provider_project_id,lifecycle_state,compatibility_state,freshness,summary,uncertainty,next_action,created_at,updated_at) VALUES ('duplicate','pair','invoice-route','duplicate','left','right','proposed','unknown','unresolved','x','x','x',now(),now())")).rejects.toThrow();
   await expect(db.exec("INSERT INTO candidate_capabilities(id,opportunity_id,capability_key,capability,consumer_project_id,provider_project_id,lifecycle_state,compatibility_state,freshness,summary,uncertainty,next_action,created_at,updated_at) VALUES ('orphan','missing','orphan','orphan','left','right','unknown','unknown','unresolved','x','x','x',now(),now())")).rejects.toThrow();
  }finally{await db.close()}
 });
});
