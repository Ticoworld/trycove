import {feedbackExportPath,feedbackRequest} from '../../../../../../lib/handoffs';
﻿import {cookies} from 'next/headers';
import {notFound} from 'next/navigation';
import {db} from '../../../../../../lib/db';
import {guidedTrialStore} from '../../../../../../lib/trials/guided-room-store';
import {GUIDED_TRIAL_ACCESS_COOKIE} from '../../../../../../lib/trials/room-auth';
import type {GuidedTrialStatus} from '../../../../../../lib/trials/room-definitions';
import {feedbackListingConsents,handoffReports,trialParticipations} from '../../../../../../lib/schema';
import {eq} from 'drizzle-orm';
import {TrialStudio} from './trial-studio';
import Link from 'next/link';
import {authenticatedUser} from '../../../../../../lib/authorization';
import {changeListingConsent,linkTrialParticipation,claimResource} from './actions';
import {getPreparedResource} from '../../../../../../lib/trials/prepared-resources';
import {FeedbackHandoff} from './feedback-handoff';
import {PlaygroundLaunch} from './playground-launch';
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
 const resource=loaded.definition.preparedResource ? await getPreparedResource(sessionId,packId,token) : null;
 const latest=Object.fromEntries(loaded.definition.tasks.map(task=>{const event=loaded.events.filter(e=>e.taskId===task.id).at(-1);return [task.id,event?{status:event.status as GuidedTrialStatus,note:event.note}:null]}));
 const [user, [participation]] = await Promise.all([
  authenticatedUser(),
  db.select({sessionId: trialParticipations.sessionId}).from(trialParticipations).where(eq(trialParticipations.sessionId,sessionId)),
 ]);
 const [request,reportRows]=loaded.session.completedAt?await Promise.all([
  feedbackRequest(loaded.definition),
  db.select({id:handoffReports.id,shareToken:handoffReports.shareToken,createdAt:handoffReports.createdAt,revokedAt:handoffReports.revokedAt, listed:feedbackListingConsents.reportId}).from(handoffReports).leftJoin(feedbackListingConsents,eq(feedbackListingConsents.reportId,handoffReports.id)).where(eq(handoffReports.sessionId,sessionId)),
 ]):[null,[]];
 return <>{resource && <section id="prepared-resource" className="section shell card stack"><h2>Prepared testing resource</h2><p>{loaded.definition.preparedResource?.description}</p>{resource.assigned ? <><p>{resource.assigned.label} · available until {resource.assigned.expiresAt?.toISOString()}</p>{resource.assigned.kind==='identity'&&!loaded.session.completedAt?<PlaygroundLaunch packId={packId} sessionId={sessionId} launchUrl={resource.assigned.launchUrl}/>:resource.assigned.kind==='identity'?<p>Playground session completed.</p>:<a className="button" href={resource.assigned.launchUrl} target="_blank" rel="noreferrer">Open prepared resource</a>}</> : loaded.session.completedAt ? <p>This session is complete.</p> : <><p>{resource.available?'A resource is available to claim.':'No resources are currently available. Check back later.'}</p><form action={claimResource}><input type="hidden" name="packId" value={packId}/><input type="hidden" name="sessionId" value={sessionId}/><button className="button" disabled={!resource.available}>Claim resource</button></form></>}</section>}<TrialStudio packId={packId} sessionId={sessionId} definition={loaded.definition} initialAnswers={latest} finished={!!loaded.session.completedAt} receiptIntact={loaded.receiptIntact} receipts={loaded.receipts.map(r=>({version:r.version,sha256:r.receiptSha256,createdAt:r.createdAt.toISOString(),receipt:r.receipt}))}/>{!!loaded.session.completedAt&&request&&<FeedbackHandoff productName={loaded.definition.product.name} packId={packId} sessionId={sessionId} items={loaded.definition.tasks.map(t=>({taskId:t.id,title:t.title,outcome:latest[t.id]?.status??'not_recorded',note:latest[t.id]?.note??''}))} request={request.text} requestKind={request.kind} sourceUrl={request.sourceUrl} startedAt={loaded.session.startedAt.toISOString()} completedAt={loaded.session.completedAt.toISOString()} environment={loaded.definition.application.network} versionLimitations={loaded.definition.application.version} prerequisites={loaded.definition.prerequisites??[]} existingReports={reportRows.map(r=>({id:r.id,createdAt:r.createdAt.toISOString(),revoked:!!r.revokedAt,url:`/share/${r.shareToken}`,exportUrl:feedbackExportPath(packId,sessionId,r.id)}))}/>}
 <section className="section shell stack">
   <h2>Participation</h2>
   {participation ? <p>This session has been linked to an account.</p> : user ? <form action={linkTrialParticipation} className="stack">
     <input type="hidden" name="sessionId" value={sessionId}/><input type="hidden" name="packId" value={packId}/>
     <label><input type="checkbox" name="consent" required/> Link this specific trial to my signed-in account</label>
     <button className="button">Link trial</button>
   </form> : <p><Link href="/account" target="_blank" rel="noreferrer">Sign in in another tab</Link> and reload this session to link it to your account.</p>}
   {reportRows.filter(report => !report.revokedAt).map(report => <form action={changeListingConsent} key={report.id} className="stack">
     <input type="hidden" name="reportId" value={report.id}/><input type="hidden" name="sessionId" value={sessionId}/><input type="hidden" name="packId" value={packId}/>
     <label><input type="checkbox" name="consent" defaultChecked={!!report.listed}/> List this approved report on the public Results page</label>
     <button className="button secondary">Save listing preference</button>
   </form>)}
 </section>
 </>;
}
