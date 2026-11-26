import {describe,it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import {Pool} from 'pg';
import {drizzle} from 'drizzle-orm/node-postgres';
import * as schema from '../lib/schema';
import {db} from '../lib/db';
import {saveTrialDraft,setTrialPackState} from '../lib/trials/trial-packs';
import {createGuidedTrialStore} from '../lib/trials/guided-room-store';
import {claimPreparedResource,getPreparedResource} from '../lib/trials/prepared-resources';

const url=process.env.PG02_TEST_DATABASE_URL;
const expectedHost=process.env.PG02_TEST_EXPECTED_HOST;
describe.skipIf(!url || !expectedHost)('isolated PostgreSQL resource allocation',()=>{
 it('serializes independent connections and preserves private session access',async()=>{
  if(new URL(url!).hostname!==expectedHost || !expectedHost!.startsWith('ep-plain-flower-')) throw new Error('Unexpected test database target');
  const pools=[new Pool({connectionString:url,max:1}),new Pool({connectionString:url,max:1})];
  const [a,b]=pools.map(pool=>drizzle(pool,{schema}) as unknown as typeof db);
  const suffix=randomUUID().slice(0,8), product=`pg02-${suffix}`, pack=`pg02-${suffix}`;
  try {
   await a.insert(schema.projects).values({id:product,name:'Isolated fixture',description:'Test',sourceUrl:'https://example.com',revision:'test',observedAt:new Date()});
   await saveTrialDraft({id:pack,productId:product,description:'Isolated test',prerequisites:[],request:{kind:'builder-declared',text:'Test'},application:{name:'Fixture',url:'https://example.com',network:'test',version:'1'},tasks:[{id:'one',title:'Try',instructions:'Try',observe:['Observe']}],safety:['Test only'],preparedResource:{description:'Fixture',allocationMinutes:10}},a);
   await setTrialPackState(pack,1,'published',a);
   const store=createGuidedTrialStore(a), one=await store.createSession(pack,true),two=await store.createSession(pack,true);
   await a.insert(schema.preparedResources).values({id:randomUUID(),packId:pack,packVersion:1,label:'Fixture',kind:'environment',launchUrl:`https://example.com/${suffix}`});
   expect(await claimPreparedResource(one.sessionId,pack,'invalid',a)).toBeNull();
   const results=await Promise.all([claimPreparedResource(one.sessionId,pack,one.accessToken,a),claimPreparedResource(two.sessionId,pack,two.accessToken,b)]);
   expect(results.filter(Boolean)).toHaveLength(1);
   const winner=results[0]?one:two,loser=results[0]?two:one;
   expect((await getPreparedResource(winner.sessionId,pack,winner.accessToken,b))?.assigned).toBeTruthy();
   expect((await getPreparedResource(loser.sessionId,pack,loser.accessToken,b))?.available).toBe(false);
   expect(await getPreparedResource(winner.sessionId,pack,'invalid',b)).toBeNull();
   expect((await store.loadSession(winner.sessionId,winner.accessToken))?.latestReceipt?.receipt).not.toContain(`https://example.com/${suffix}`);
   await pools[0].query('UPDATE prepared_resources SET expires_at=now()-interval \'1 second\' WHERE pack_id=$1',[pack]);
   expect((await getPreparedResource(winner.sessionId,pack,winner.accessToken,b))?.assigned).toBeNull();
   expect(await claimPreparedResource(loser.sessionId,pack,loser.accessToken,b)).toBeNull();
  } finally {await Promise.all(pools.map(pool=>pool.end()));}
 },60000);
});
