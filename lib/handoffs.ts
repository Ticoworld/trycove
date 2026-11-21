import {createHash, randomBytes} from 'node:crypto';
import {asc, desc, eq} from 'drizzle-orm';
import {db} from './db';
import {candidateCapabilities, evidence, followUps, handoffReports, opportunities, projects} from './schema';
import {guidedTrialStore} from './trials/guided-room-store';

export const FOLLOW_UP_KINDS = ['report-prepared','shared-with-builder','builder-replied','fix-reported','fix-verified','retested','closed','no-response','introduction-prepared','introduction-made','trial-attempted','blocked','not-a-fit','integration-reported','integration-verified','follow-up-completed'] as const;
export type FollowUpKind = typeof FOLLOW_UP_KINDS[number];
export type HandoffContent = Record<string, unknown>;
const hash = (s: string) => createHash('sha256').update(s).digest('hex');
export function validHttpsUrl(value: string | null | undefined) { if(!value)return null;try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password?u.toString():null}catch{return null} }

export function feedbackExportPath(packId: string, sessionId: string, reportId: string) {
  return `/trials/rooms/${packId}/sessions/${sessionId}/reports/${reportId}`;
}

export async function exportFeedbackReport(
  {packId, sessionId, reportId, sessionToken}: {
    packId: string; sessionId: string; reportId: string; sessionToken?: string;
  },
  database: typeof db = db,
  trialStore = guidedTrialStore,
) {
  const unavailable = () => new Response('Not found', {status: 404});
  const idPattern = /^[A-Za-z0-9_-]{16,40}$/;
  if (!idPattern.test(reportId) || !idPattern.test(sessionId) || !sessionToken) {
    return unavailable();
  }
  const [report] = await database.select().from(handoffReports).where(eq(handoffReports.id, reportId));
  if (!report || report.kind !== 'feedback' || report.revokedAt || report.sessionId !== sessionId) {
    return unavailable();
  }
  const loaded = await trialStore.loadSession(sessionId, sessionToken);
  if (!loaded?.session.completedAt || loaded.session.packId !== packId) return unavailable();

  const body = JSON.stringify({
    schemaVersion: 'trycove-approved-handoff-export/1.0',
    exportedAt: new Date().toISOString(),
    report: JSON.parse(report.content) as HandoffContent,
  }, null, 2);
  return new Response(body, {headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Disposition': `attachment; filename="trycove-approved-feedback-${reportId}.json"`,
    'Cache-Control': 'no-store, private',
    'Referrer-Policy': 'no-referrer',
    'X-Content-SHA256': hash(body),
  }});
}

export async function createFeedbackReport(input:{sessionId:string;sessionToken:string;approvedTaskIds:string[]},database:typeof db=db,trialStore=guidedTrialStore) {
  const loaded=await trialStore.loadSession(input.sessionId,input.sessionToken);
  if(!loaded||!loaded.session.completedAt||!loaded.latestReceipt||!loaded.receiptIntact)return null;
  const opportunityId=loaded.session.problemMapOpportunityId;
  if(!opportunityId||opportunityId!==loaded.definition.problemMap.opportunityId)return null;
  const [opportunity]=await database.select().from(opportunities).where(eq(opportunities.id,opportunityId));
  if(!opportunity)return null;
  const [project]=await database.select().from(projects).where(eq(projects.id,opportunity.projectA));
  if(!project)return null;
  const sources=await database.select().from(evidence).where(eq(evidence.opportunityId,opportunityId));
  const approved=new Set(input.approvedTaskIds);
  const outcomes=loaded.definition.tasks.map(task=>{
    const events=loaded.events.filter(e=>e.taskId===task.id);const latest=events.at(-1);
    const outcomeCode=latest?.status??'not_recorded';const outcome=outcomeCode==='completed'?'It worked':outcomeCode==='failed'?'Something failed':outcomeCode==='stuck'?'Got stuck':outcomeCode==='skipped'?"Couldn't try":'Not recorded';
    return {task:task.title,outcome,outcomeCode,attempted:!!latest&&latest.status!=='skipped', ...(latest?.note&&approved.has(task.id)?{note:latest.note}:{})};
  });
  const content={type:'feedback',title:`${project.name} testing feedback`,project:{name:project.name,application:loaded.definition.application.name,url:validHttpsUrl(loaded.definition.application.url)},request:{text:sources[0]?.claim??opportunity.problem,sourceUrl:validHttpsUrl(sources[0]?.sourceUrl??loaded.definition.problemMap.sourceUrl),revision:sources[0]?.revision??null,verification:sources[0]?.verification??'Source reference from the saved testing request.'},tasks:outcomes,prerequisites:['CKB Testnet','A Pilot account and connected app were required for some tasks.'],blockers:outcomes.filter(x=>x.outcome==='stuck'||x.outcome==='skipped').map(x=>({task:x.task,outcome:x.outcome, ...(x.note?{note:x.note}:{})})),startedAt:loaded.session.startedAt.toISOString(),completedAt:loaded.session.completedAt.toISOString(),publishedAt:new Date().toISOString(),environment:loaded.definition.application.network,versionLimitations:loaded.definition.application.version,followUpStatus:'Report prepared; sharing with the builder and any reply are not recorded.',limitations:['Self-reported observations; tester identity and human participation are not independently verified.','Outcomes describe this session and are not verified product defects, compatibility findings or adoption claims.']};
  const token=randomBytes(32).toString('base64url'),id=randomBytes(18).toString('base64url'),createdAt=new Date();
  await database.transaction(async tx=>{
    await tx.insert(handoffReports).values({id,kind:'feedback',tokenSha256:hash(token),shareToken:token,projectId:project.id,opportunityId,sessionId:loaded.session.id,content:JSON.stringify(content),approvedNoteTaskIds:JSON.stringify([...approved]),createdAt,revokedAt:null});
    await tx.insert(followUps).values({opportunityId,kind:'report-prepared',note:'Builder feedback report prepared and published with tester-approved notes.',handoffReportId:id,publicNote:false,createdAt});
  });
  return {id,token,createdAt};
}

export async function createConnectionBrief(input:{opportunityId:string;capabilityId:string;approvedFields:string[]},database:typeof db=db) {
  const [opportunity]=await database.select().from(opportunities).where(eq(opportunities.id,input.opportunityId));
  const [capability]=await database.select().from(candidateCapabilities).where(eq(candidateCapabilities.id,input.capabilityId));
  if(!opportunity||!capability||capability.opportunityId!==opportunity.id)return {error:'The saved opportunity or capability is unavailable.'} as const;
  const approved=new Set(input.approvedFields);
  const [consumer,provider]=await Promise.all([
    database.select().from(projects).where(eq(projects.id,capability.consumerProjectId)).then(r=>r[0]),
    database.select().from(projects).where(eq(projects.id,capability.providerProjectId)).then(r=>r[0]),
  ]);
  if(!consumer||!provider)return {error:'The saved consumer or provider record is unavailable.'} as const;
  const [sourceRows]=await Promise.all([database.select().from(evidence).where(eq(evidence.opportunityId,opportunity.id))]);
  const sources=sourceRows.map(s=>({claim:s.claim,url:validHttpsUrl(s.sourceUrl),revision:s.revision,verification:s.verification,observedAt:s.observedAt.toISOString()})).filter(s=>s.url);
  const content={type:'connection',title:`${consumer.name} × ${provider.name}`,consumer:{name:consumer.name,url:validHttpsUrl(consumer.website)},provider:{name:provider.name,url:validHttpsUrl(provider.website)},need:approved.has('need')?opportunity.problem:null,providerOffer:approved.has('offer')?capability.capability:null,whyUseful:approved.has('why')?capability.summary:null,evidence:approved.has('evidence')?sources:[],sourceRevision:{consumer:consumer.revision,provider:provider.revision},unknowns:[capability.uncertainty,`Compatibility state: ${capability.compatibilityState}.`, `Lifecycle state: ${capability.lifecycleState}; freshness: ${capability.freshness}.`],prerequisites:opportunity.requirements,nextHumanAction:capability.nextAction,createdAt:new Date().toISOString(),limitations:['This is a source-backed introduction hypothesis, not a verified integration, endorsement or adoption claim.']};
  if(!approved.has('need')||!approved.has('offer')||!approved.has('evidence'))return {error:'Approve the need, provider offer and source evidence before publishing.'} as const;
  const token=randomBytes(32).toString('base64url'),id=randomBytes(18).toString('base64url'),createdAt=new Date();
  await database.transaction(async tx=>{
    await tx.insert(handoffReports).values({id,kind:'connection',tokenSha256:hash(token),shareToken:token,projectId:consumer.id,opportunityId:opportunity.id,sessionId:null,content:JSON.stringify(content),approvedNoteTaskIds:'[]',createdAt,revokedAt:null});
    await tx.insert(followUps).values({opportunityId:opportunity.id,kind:'introduction-prepared',note:'A source-backed Connection Brief was prepared and published for human review.',handoffReportId:id,publicNote:false,createdAt});
  });
  return {id,token,createdAt} as const;
}

export async function readPublicHandoff(token:string,database:typeof db=db) {
  if(!/^[A-Za-z0-9_-]{40,60}$/.test(token))return null;
  const [report]=await database.select().from(handoffReports).where(eq(handoffReports.tokenSha256,hash(token)));
  if(!report||report.revokedAt)return null;
  let content:HandoffContent;try{content=JSON.parse(report.content)}catch{return null}
  const timeline=await database.select().from(followUps).where(eq(followUps.handoffReportId,report.id)).orderBy(asc(followUps.createdAt),asc(followUps.id));
  return {kind:report.kind as 'feedback'|'connection',content,timeline:timeline.map(event=>({kind:event.kind,note:event.publicNote?event.note:null,sourceUrl:event.publicNote?validHttpsUrl(event.sourceUrl):null,createdAt:event.createdAt.toISOString()}))};
}

export async function revokeHandoff(reportId:string,sessionId:string,token:string,database:typeof db=db,trialStore=guidedTrialStore) {
  const [report]=await database.select().from(handoffReports).where(eq(handoffReports.id,reportId));
  if(!report||report.kind!=='feedback'||report.sessionId!==sessionId)return false;
  const loaded=await trialStore.loadSession(sessionId,token);
  if(!loaded)return false;
  await database.update(handoffReports).set({revokedAt:new Date()}).where(eq(handoffReports.id,reportId));
  return true;
}

export async function listHandoffReports(database:typeof db=db) {
  const reports=await database.select().from(handoffReports).orderBy(desc(handoffReports.createdAt));
  return reports.map(r=>({id:r.id,kind:r.kind,opportunityId:r.opportunityId,createdAt:r.createdAt,revoked:!!r.revokedAt,url:`/share/${r.shareToken}`,content:JSON.parse(r.content) as HandoffContent}));
}
