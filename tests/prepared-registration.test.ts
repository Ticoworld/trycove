import {describe,it,expect} from 'vitest';
import {readdir,readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import {drizzle} from 'drizzle-orm/pglite';
import * as schema from '../lib/schema';
import {db} from '../lib/db';
import {saveTrialDraft} from '../lib/trials/trial-packs';
import {registerPreparedResources} from '../lib/trials/register-prepared-resources';

describe('prepared resource registration',()=>{
 it('checks ownership and application and makes verified retries idempotent',async()=>{
  const client=new PGlite();
  const old=process.env.TRYCOVE_PLAYGROUND_APPLICATIONS;
  try{
   const files=(await readdir('migrations')).filter(f=>/^\d{4}_.*\.sql$/.test(f)).sort();
   for(const file of files)await client.exec(await readFile(`migrations/${file}`,'utf8'));
   const database=drizzle(client,{schema}) as unknown as typeof db;
   const user=randomUUID(),id1=randomUUID(),id2=randomUUID();
   await database.insert(schema.projects).values([{id:'p',name:'P',description:'',sourceUrl:'https://example.com',revision:'r',observedAt:new Date()},{id:'other',name:'Other',description:'',sourceUrl:'https://example.com',revision:'r',observedAt:new Date()}]);
   await database.insert(schema.appUsers).values({id:user});
   await database.insert(schema.projectMemberships).values({userId:user,projectId:'p',role:'owner'});
   process.env.TRYCOVE_PLAYGROUND_APPLICATIONS=JSON.stringify({fixture:{origin:'https://example.com',secret:'x'.repeat(40)}});
   await saveTrialDraft({id:'room',productId:'p',description:'Fixture',prerequisites:[],request:{kind:'builder-declared',text:'Try'},application:{name:'Fixture',url:'https://example.com/app',network:'test',version:'1'},tasks:[{id:'one',title:'Try',instructions:'Try',observe:['Observe']}],safety:['Test'],preparedResource:{description:'Access',allocationMinutes:10,applicationId:'fixture'}},database);
   const input={userId:user,projectId:'p',packId:'room',applicationId:'fixture',resources:[{id:id1,label:'One',kind:'identity',launchUrl:'https://example.com/app'},{id:id2,label:'Two',kind:'identity',launchUrl:'https://example.com/app'}]};
   await expect(registerPreparedResources({...input,projectId:'other'},database,async()=>true)).rejects.toThrow();
   await expect(registerPreparedResources({...input,applicationId:'wrong'},database,async()=>true)).rejects.toThrow();
   await expect(registerPreparedResources({...input,resources:[{...input.resources[0],launchUrl:'https://wrong.example/app'}]},database,async()=>true)).rejects.toThrow();
   await registerPreparedResources(input,database,async(_app,id)=>id===id1);
   await registerPreparedResources(input,database,async(_app,id)=>id===id1);
   const rows=await database.select().from(schema.preparedResources);
   expect(rows).toHaveLength(2);
   expect(rows.find(r=>r.id===id1)?.providerReady).toBe(true);
   expect(rows.find(r=>r.id===id2)?.providerReady).toBe(false);
   await database.update(schema.preparedResources).set({enabled:false}).where((await import('drizzle-orm')).eq(schema.preparedResources.id,id1));
   await registerPreparedResources({...input,enableVerified:true},database,async(_app,id)=>id===id1);
   const refreshed=await database.select().from(schema.preparedResources);
   expect(refreshed.find(r=>r.id===id1)?.enabled).toBe(true);
   expect(refreshed.find(r=>r.id===id2)?.enabled).toBe(false);
   await expect(registerPreparedResources({...input,resources:[{...input.resources[0],label:'Changed'}]},database,async()=>true)).rejects.toThrow();
  }finally{if(old===undefined)delete process.env.TRYCOVE_PLAYGROUND_APPLICATIONS;else process.env.TRYCOVE_PLAYGROUND_APPLICATIONS=old;await client.close();}
 },60000);
});
