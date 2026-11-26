import {describe,it,expect} from 'vitest';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {drizzle} from 'drizzle-orm/pglite';
import * as schema from '../lib/schema';
import {db} from '../lib/db';
import {saveTrialDraft,setTrialPackState} from '../lib/trials/trial-packs';
import {createGuidedTrialStore} from '../lib/trials/guided-room-store';
import {claimPreparedResource,getPreparedResource} from '../lib/trials/prepared-resources';

describe('prepared trial resources',()=>{
 it('authorizes sessions, assigns exclusively, resumes and expires without putting access in receipts',async()=>{
  const client=new PGlite();
  try {
   const names=['initial','connections','footprints','intelligence','trial_evidence','project_repositories','signal_intents','candidate_lifecycle','need_items','need_taxonomy','need_lineage_and_decisions','opportunity_qualification','opportunity_prior_work_reconciliations','external_source_snapshots','guided_trial_rooms','devrel_handoffs','trial_packs'];
   for(let i=0;i<names.length;i++)await client.exec(await readFile(`migrations/${String(i+1).padStart(4,'0')}_${names[i]}.sql`,'utf8'));
   await client.exec(await readFile('migrations/0022_prepared_resources.sql','utf8'));
   await client.exec("INSERT INTO projects(id,name,description,source_url,revision,observed_at) VALUES ('p','Product','','https://example.com','r',now())");
   const database=drizzle(client,{schema}) as unknown as typeof db;
   await saveTrialDraft({id:'resource-room',productId:'p',description:'A trial',prerequisites:[],request:{kind:'builder-declared',text:'Try it'},application:{name:'App',url:'https://example.com',network:'test',version:'1'},tasks:[{id:'one',title:'Try',instructions:'Try it',observe:['Observe']}],safety:['No keys'],preparedResource:{description:'An environment',allocationMinutes:60}},database);
   await setTrialPackState('resource-room',1,'published',database);
   const store=createGuidedTrialStore(database);
   const one=await store.createSession('resource-room',true),two=await store.createSession('resource-room',true);
   await database.insert(schema.preparedResources).values({id:'r1',packId:'resource-room',packVersion:1,label:'Environment',kind:'environment',launchUrl:'https://example.com/private'});
   expect(await claimPreparedResource(one.sessionId,'resource-room','bad',database)).toBeNull();
   const claims=await Promise.all([claimPreparedResource(one.sessionId,'resource-room',one.accessToken,database),claimPreparedResource(two.sessionId,'resource-room',two.accessToken,database)]);
   expect(claims.filter(Boolean)).toHaveLength(1);
   const winner=claims[0]?one:two, loser=claims[0]?two:one;
   expect(await getPreparedResource(winner.sessionId,'resource-room','bad',database)).toBeNull();
   expect((await getPreparedResource(winner.sessionId,'resource-room',winner.accessToken,database))?.assigned?.id).toBe('r1');
   expect((await getPreparedResource(loser.sessionId,'resource-room',loser.accessToken,database))?.available).toBe(false);
   expect((await store.loadSession(winner.sessionId,winner.accessToken))?.latestReceipt?.receipt).not.toContain('example.com/private');
   await client.exec("UPDATE prepared_resources SET expires_at=now()-interval '1 second' WHERE id='r1'");
   expect((await getPreparedResource(winner.sessionId,'resource-room',winner.accessToken,database))?.assigned).toBeNull();
   expect(await claimPreparedResource(loser.sessionId,'resource-room',loser.accessToken,database)).toBeNull();
   await client.exec("UPDATE prepared_resources SET enabled=true, assigned_session_id=NULL, expires_at=NULL WHERE id='r1'");
   expect((await claimPreparedResource(loser.sessionId,'resource-room',loser.accessToken,database))?.id).toBe('r1');
   await store.finishSession({sessionId:loser.sessionId,accessToken:loser.accessToken});
   expect(await claimPreparedResource(loser.sessionId,'resource-room',loser.accessToken,database)).toBeNull();
  } finally {await client.close();}
 },60000);
});
