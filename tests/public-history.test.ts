import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {drizzle} from 'drizzle-orm/pglite';
import {Client} from 'pg';
import {drizzle as pgDrizzle} from 'drizzle-orm/node-postgres';
import {expect,it} from 'vitest';
import {importPublicHistory,importApprovedFeedback,sha256} from '../lib/public-history';
import {db} from '../lib/db';

it('imports reviewed public records and approved report bytes idempotently without a trial session',async()=>{
 const nativeUrl=process.env.TRYCOVE_TEST_NEON_URL;
 const instance=nativeUrl ? null : new PGlite();
 const native=nativeUrl ? new Client({connectionString:nativeUrl}) : null;
 if (native) {
  if (process.env.NEON_BRANCH !== 'trycove-stage2-verification') throw new Error('Use the isolated Neon verification branch.');
  await native.connect();
 }
 try {
  const names=['initial','connections','footprints','intelligence','trial_evidence','project_repositories','signal_intents','candidate_lifecycle','need_items','need_taxonomy','need_lineage_and_decisions','opportunity_qualification','opportunity_prior_work_reconciliations','external_source_snapshots','guided_trial_rooms','devrel_handoffs','trial_packs','identity','participation','hosted_evidence'];
  for (const [index,name] of names.entries()) if (instance) await instance.exec(await readFile('migrations/'+String(index+1).padStart(4,'0')+'_'+name+'.sql','utf8'));
  const database=(native ? pgDrizzle(native) : drizzle(instance!)) as unknown as typeof db;
  const time='2026-01-01T00:00:00Z';
  const id='ckbuilder-owlpilot-67';
  const provenance={sourceUrl:'https://example.org/source',revision:'fixture',observedAt:time};
  const manifest=Buffer.from(JSON.stringify({version:1,
   projects:[{id,name:'Owl Pilot',description:'Synthetic fixture',website:null,repository:null,...provenance}],
   sources:[{id:'fixture-source',projectId:id,source:'fixture',raw:'Synthetic public source',...provenance}],repositories:[],opportunities:[{id:'fixture-need',projectA:id,projectB:null,kind:'user-testing',
   problem:'Fixture request',reasoning:'Fixture reason',requirements:'Fixture requirements',experiment:'Fixture experiment',status:'contact-worthy'}],
   evidence:[{id:900001,opportunityId:'fixture-need',needItemId:null,claim:'Fixture request',
    sourceUrl:'https://example.org/source',revision:null,observedAt:time,verification:'Synthetic fixture'}]}));
  const report=Buffer.from(JSON.stringify({schemaVersion:'trycove-approved-handoff-export/1.0',exportedAt:time,
   report:{type:'feedback',project:{name:'Owl Pilot'},tasks:[{task:'Fixture task',outcome:'completed',note:'Approved fixture note'}]}}));
  await expect(importApprovedFeedback(report,'0'.repeat(64),database)).rejects.toThrow('digest');
  for(let index=0;index<2;index++) {
   await expect(importPublicHistory(manifest,sha256(manifest),database))
    .resolves.toEqual({projects:1,sources:1,repositories:0,opportunities:1,evidence:1});
  }
  const conflicting=JSON.parse(manifest.toString()); conflicting.evidence[0].claim='Altered';
  const changed=Buffer.from(JSON.stringify(conflicting));
  await expect(importPublicHistory(changed,sha256(changed),database)).rejects.toThrow('conflict');
  await importApprovedFeedback(report,sha256(report),database);
  const countSql='SELECT (SELECT count(*) FROM guided_trial_sessions)::int AS sessions,(SELECT count(*) FROM historical_feedback)::int AS reports';
  const counts=native ? await native.query(countSql) : await instance!.query(countSql);
  expect(counts.rows).toEqual([{sessions:0,reports:1}]);
 } finally {await native?.end();await instance?.close();}
},60000);
