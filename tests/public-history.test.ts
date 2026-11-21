import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {drizzle} from 'drizzle-orm/pglite';
import {expect,it} from 'vitest';
import {importPublicHistory,sha256} from '../lib/public-history';
import {db} from '../lib/db';

it('imports reviewed public records and approved report bytes idempotently without a trial session',async()=>{
 const instance=new PGlite();
 try {
  const names=['initial','connections','footprints','intelligence','trial_evidence','project_repositories','signal_intents','candidate_lifecycle','need_items','need_taxonomy','need_lineage_and_decisions','opportunity_qualification','opportunity_prior_work_reconciliations','external_source_snapshots','guided_trial_rooms','devrel_handoffs','trial_packs','identity','participation','hosted_evidence'];
  for (const [index,name] of names.entries()) await instance.exec(await readFile('migrations/'+String(index+1).padStart(4,'0')+'_'+name+'.sql','utf8'));
  const database=drizzle(instance) as unknown as typeof db;
  const time='2026-01-01T00:00:00Z';
  const id='ckbuilder-owlpilot-67';
  const provenance={sourceUrl:'https://example.org/source',revision:'fixture',observedAt:time};
  const manifest=Buffer.from(JSON.stringify({version:1,
   projects:[{id,name:'Owl Pilot',description:'Synthetic fixture',website:null,repository:null,...provenance}],
   sources:[{id:'fixture-source',projectId:id,source:'fixture',raw:'Synthetic public source',...provenance}],repositories:[]}));
  const report=Buffer.from(JSON.stringify({schemaVersion:'trycove-approved-handoff-export/1.0',exportedAt:time,
   report:{type:'feedback',project:{name:'Owl Pilot'},tasks:[{task:'Fixture task',outcome:'completed',note:'Approved fixture note'}]}}));
  await expect(importPublicHistory(manifest,sha256(manifest),report,'0'.repeat(64),database)).rejects.toThrow('digest');
  for(let index=0;index<2;index++) {
   await expect(importPublicHistory(manifest,sha256(manifest),report,sha256(report),database))
    .resolves.toEqual({projects:1,sources:1,repositories:0,exportDigest:sha256(report)});
  }
  const counts=await instance.query('SELECT (SELECT count(*) FROM guided_trial_sessions)::int AS sessions,(SELECT count(*) FROM historical_feedback)::int AS reports');
  expect(counts.rows).toEqual([{sessions:0,reports:1}]);
 } finally {await instance.close();}
},60000);
