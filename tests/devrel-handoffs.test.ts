import {describe,expect,it} from 'vitest';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {drizzle} from 'drizzle-orm/pglite';
import * as schema from '../lib/schema';
import {db} from '../lib/db';
import {createGuidedTrialStore} from '../lib/trials/guided-room-store';
import {createConnectionBrief,createFeedbackReport,readPublicHandoff,revokeHandoff} from '../lib/handoffs';
import {verifyOrganizerKey} from '../lib/organizer-auth';
import {eq} from 'drizzle-orm';

const migrationNames=['initial','connections','footprints','intelligence','trial_evidence','project_repositories','signal_intents','candidate_lifecycle','need_items','need_taxonomy','need_lineage_and_decisions','opportunity_qualification','opportunity_prior_work_reconciliations','external_source_snapshots','guided_trial_rooms','devrel_handoffs'];
async function migrate(instance:PGlite){for(let i=0;i<migrationNames.length;i++)await instance.exec(await readFile(`migrations/${String(i+1).padStart(4,'0')}_${migrationNames[i]}.sql`,'utf8'))}
async function fixture(instance:PGlite){
 await instance.exec("INSERT INTO projects(id,name,description,source_url,revision,observed_at) VALUES ('ckbuilder-owlpilot-67','Owl Pilot test fixture','','https://invalid.example/owl','test-fixture-r0',now()),('consumer-test','Consumer test fixture','','https://invalid.example/consumer','test-fixture-r1',now()),('provider-test','Provider test fixture','','https://invalid.example/provider','test-fixture-r2',now())");
 await instance.exec("INSERT INTO opportunities(id,project_a,project_b,kind,problem,reasoning,requirements,experiment,status) VALUES ('need-bdf6f13b14eed451c7158856d0fd6f7b','ckbuilder-owlpilot-67','provider-test','user-testing','Test consumer need','Test-only fixture; not a real opportunity','Test-only prerequisite','Test-only experiment','contact-worthy')");
 await instance.exec("INSERT INTO evidence(opportunity_id,claim,source_url,revision,observed_at,verification) VALUES ('need-bdf6f13b14eed451c7158856d0fd6f7b','Test-only source claim','https://invalid.example/issue/51','fixture-r1',now(),'test fixture only; not source evidence')");
 await instance.exec("INSERT INTO candidate_capabilities(id,opportunity_id,capability_key,capability,consumer_project_id,provider_project_id,lifecycle_state,compatibility_state,freshness,summary,uncertainty,next_action,created_at,updated_at) VALUES ('candidate-test','need-bdf6f13b14eed451c7158856d0fd6f7b','test-cap','Provider test capability','consumer-test','provider-test','proposed','unknown','unresolved','Test-only consumer summary','Test-only unknowns','Invite a human conversation','2026-01-01Z','2026-01-01Z')");
}

describe('TC-03 handoff records',()=>{
 it('publishes only tester-approved notes, keeps private receipts unchanged and supports session-authorized revocation',async()=>{
  const instance=new PGlite();
  try{
   await migrate(instance);await fixture(instance);
   const testDb=drizzle(instance,{schema}) as unknown as typeof db;const store=createGuidedTrialStore(testDb);
   const started=await store.createSession('owl-pilot-ux',true);
   await store.recordStep({sessionId:started.sessionId,accessToken:started.accessToken,taskId:'account-addresses',status:'completed',note:'Approved note A'});
   await store.recordStep({sessionId:started.sessionId,accessToken:started.accessToken,taskId:'app-permissions',status:'stuck',note:'Private note B'});
   await store.finishSession({sessionId:started.sessionId,accessToken:started.accessToken});
   const before=await store.loadSession(started.sessionId,started.accessToken);expect(before?.receiptIntact).toBe(true);const beforeReceipt=before?.latestReceipt;
   const published=await createFeedbackReport({sessionId:started.sessionId,sessionToken:started.accessToken,approvedTaskIds:['account-addresses']},testDb,store);expect(published).not.toBeNull();
   const report=await readPublicHandoff(published!.token,testDb);expect(report?.kind).toBe('feedback');
   const tasks=report?.content.tasks as Array<{task:string;outcome:string;note?:string}>;
   expect(tasks.find(x=>x.task.includes('owner'))?.note).toBe('Approved note A');expect(JSON.stringify(report?.content)).not.toContain('Private note B');
   const after=await store.loadSession(started.sessionId,started.accessToken);expect(after?.latestReceipt?.version).toBe(beforeReceipt?.version);expect(after?.latestReceipt?.receiptSha256).toBe(beforeReceipt?.receiptSha256);
   expect(await revokeHandoff(published!.id,started.sessionId,'wrong-token',testDb,store)).toBe(false);expect(await readPublicHandoff(published!.token,testDb)).not.toBeNull();
   expect(await revokeHandoff(published!.id,started.sessionId,started.accessToken,testDb,store)).toBe(true);expect(await readPublicHandoff(published!.token,testDb)).toBeNull();
  }finally{await instance.close()}
 },30000);

 it('keeps connection hypotheses, uncertainty and append-only follow-up explicit',async()=>{
  const instance=new PGlite();const original=process.env.TRYCOVE_WRITE_KEY;
  try{
   await migrate(instance);await fixture(instance);const testDb=drizzle(instance,{schema}) as unknown as typeof db;
   process.env.TRYCOVE_WRITE_KEY='test-organizer-key';expect(verifyOrganizerKey('bad')).toBe(false);expect(verifyOrganizerKey('test-organizer-key')).toBe(true);
   const result=await createConnectionBrief({opportunityId:'need-bdf6f13b14eed451c7158856d0fd6f7b',capabilityId:'candidate-test',approvedFields:['need','offer','why','evidence']},testDb);expect('token'in result).toBe(true);
   const token='token'in result&&typeof result.token==='string'?result.token:'';const reportId='id'in result&&typeof result.id==='string'?result.id:'';if(!token||!reportId)throw new Error('Connection fixture was not published.');
   const publicBrief=await readPublicHandoff(token,testDb);expect(publicBrief?.kind).toBe('connection');expect(publicBrief?.content).toMatchObject({need:'Test consumer need',providerOffer:'Provider test capability',whyUseful:'Test-only consumer summary'});expect((publicBrief?.content.unknowns as string[]).some(x=>x.includes('unknown'))).toBe(true);
   const [row]=await testDb.select().from(schema.handoffReports).where(eq(schema.handoffReports.id,reportId));
   await testDb.insert(schema.followUps).values({opportunityId:row.opportunityId,handoffReportId:row.id,kind:'introduction-made',note:'Private test fixture event only',sourceUrl:'https://invalid.example/private-event',publicNote:false,createdAt:new Date()});
   await expect(testDb.update(schema.followUps).set({note:'changed'}).where(eq(schema.followUps.handoffReportId,row.id))).rejects.toThrow();
   const publicTimeline=(await readPublicHandoff(token,testDb))?.timeline;expect(publicTimeline?.map(x=>x.kind)).toContain('introduction-made');expect(publicTimeline?.find(x=>x.kind==='introduction-made')).toMatchObject({note:null,sourceUrl:null});
  }finally{if(original===undefined)delete process.env.TRYCOVE_WRITE_KEY;else process.env.TRYCOVE_WRITE_KEY=original;await instance.close()}
 },30000);
});
