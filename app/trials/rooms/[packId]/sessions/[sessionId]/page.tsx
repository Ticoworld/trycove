import {feedbackExportPath} from '../../../../../../lib/handoffs';
﻿import {cookies} from 'next/headers';
import {notFound} from 'next/navigation';
import {db} from '../../../../../../lib/db';
import {guidedTrialStore} from '../../../../../../lib/trials/guided-room-store';
import {GUIDED_TRIAL_ACCESS_COOKIE} from '../../../../../../lib/trials/room-auth';
import type {GuidedTrialStatus} from '../../../../../../lib/trials/room-definitions';
import {evidence,handoffReports} from '../../../../../../lib/schema';
import {eq} from 'drizzle-orm';
import {TrialStudio} from './trial-studio';
import {FeedbackHandoff} from './feedback-handoff';
export const dynamic='force-dynamic';
export const revalidate=0;
export const metadata={robots:{index:false,follow:false},referrer:'no-referrer'};
export default async function GuidedTrialSessionPage({params}:{params:Promise<{packId:string;sessionId:string}>}){
 const {packId,sessionId}=await params;
 if(!/^[A-Za-z0-9_-]{16,40}$/.test(sessionId))notFound();
 const token=(await cookies()).get(GUIDED_TRIAL_ACCESS_COOKIE)?.value;
 if(!token)notFound();
 const loaded=await guidedTrialStore.loadSession(sessionId,token);
 if(!loaded || loaded.session.packId!==packId || !loaded.latestReceipt)notFound();
 const latest=Object.fromEntries(loaded.definition.tasks.map(task=>{const event=loaded.events.filter(e=>e.taskId===task.id).at(-1);return [task.id,event?{status:event.status as GuidedTrialStatus,note:event.note}:null]}));
 const [sourceRows,reportRows]=loaded.session.completedAt?await Promise.all([
  db.select().from(evidence).where(eq(evidence.opportunityId,loaded.session.problemMapOpportunityId??'')),
  db.select({id:handoffReports.id,shareToken:handoffReports.shareToken,createdAt:handoffReports.createdAt,revokedAt:handoffReports.revokedAt}).from(handoffReports).where(eq(handoffReports.sessionId,sessionId)),
 ]):[[],[]];
 const sourceClaim=(sourceRows[0]?.claim??'See the original source-backed user-testing request.').replace(/^\s*-\s*/,'').replace(/\*\*(.*?)\*\*/g,'$1').trim();
 return <><TrialStudio packId={packId} sessionId={sessionId} definition={loaded.definition} initialAnswers={latest} finished={!!loaded.session.completedAt} receiptIntact={loaded.receiptIntact} receipts={loaded.receipts.map(r=>({version:r.version,sha256:r.receiptSha256,createdAt:r.createdAt.toISOString(),receipt:r.receipt}))}/>{!!loaded.session.completedAt&&<FeedbackHandoff packId={packId} sessionId={sessionId} items={loaded.definition.tasks.map(t=>({taskId:t.id,title:t.title,outcome:latest[t.id]?.status??'not_recorded',note:latest[t.id]?.note??''}))} request={sourceClaim} sourceUrl={sourceRows[0]?.sourceUrl??loaded.definition.problemMap.sourceUrl} startedAt={loaded.session.startedAt.toISOString()} completedAt={loaded.session.completedAt.toISOString()} environment={loaded.definition.application.network} versionLimitations={loaded.definition.application.version} prerequisites={['CKB Testnet','A Pilot account and connected app were required for some tasks.']} existingReports={reportRows.map(r=>({id:r.id,createdAt:r.createdAt.toISOString(),revoked:!!r.revokedAt,url:`/share/${r.shareToken}`,exportUrl:feedbackExportPath(packId,sessionId,r.id)}))}/>}</>;
}
