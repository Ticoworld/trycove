'use server';

import {cookies,headers} from 'next/headers';
import {isIP} from 'node:net';
import {notFound} from 'next/navigation';
import {revalidatePath} from 'next/cache';
import {GuidedTrialStatusSchema, guidedTrialStore} from '../../../../../../lib/trials/guided-room-store';
import {GUIDED_TRIAL_ACCESS_COOKIE} from '../../../../../../lib/trials/room-auth';
import {claimPreparedResource,getPreparedResource} from '../../../../../../lib/trials/prepared-resources';
import {consumeTrialResourceClaim} from '../../../../../../lib/trials/resource-claim-throttle';
import {issuePlaygroundHandoff} from '../../../../../../lib/trials/playground-handoffs';
import {playgroundApplication} from '../../../../../../lib/trials/playground-apps';

export async function beginPlayground(form:FormData) {
  const loaded=await authorizedTrial(form);
  const token=(await cookies()).get(GUIDED_TRIAL_ACCESS_COOKIE)?.value;
  const applicationId=loaded.definition.preparedResource?.applicationId ?? 'legacy';
  const application=playgroundApplication(applicationId);
  if(!token || !application || !loaded.definition.preparedResource || loaded.session.completedAt) {
    return null;
  }
  const ticket=await issuePlaygroundHandoff(loaded.session.id,loaded.session.packId,token,application.origin,undefined,applicationId);
  if(!ticket) return null;
  const origin=application.origin;
  return {token:ticket.token,launchUrl:ticket.launchUrl,origin,expiresAt:ticket.expiresAt.toISOString()};
}

export async function claimResource(_state:string,form:FormData):Promise<string> {
  const loaded=await authorizedTrial(form);
  const config=loaded.definition.preparedResource;
  if(!config || loaded.session.completedAt) notFound();
  const token=(await cookies()).get(GUIDED_TRIAL_ACCESS_COOKIE)?.value;
  if(!token)notFound();
  const existing=await getPreparedResource(loaded.session.id,loaded.session.packId,token);
  if(existing?.assigned)return '';
  if(existing?.expired || !existing?.available)return 'No prepared test identity is available right now. Your trial session remains open.';
  const requestHeaders=await headers();
  const candidate=requestHeaders.get('x-nf-client-connection-ip')?.trim() || (process.env.NODE_ENV!=='production'?'local-development':'');
  if(!candidate || (candidate!=='local-development' && !isIP(candidate)))return 'Test access could not verify this connection. Please retry shortly.';
  const application=playgroundApplication(config.applicationId ?? 'legacy');
  const throttleSecret=application?.secret ?? process.env.TRYCOVE_CLAIM_THROTTLE_SECRET;
  if(!throttleSecret)return 'Test access is temporarily unavailable. Your trial session remains open.';
  if(!await consumeTrialResourceClaim(candidate,loaded.session.packId,throttleSecret))return 'Too many test access requests came from this connection. Please retry later; your trial session remains open.';
  const assigned=await claimPreparedResource(loaded.session.id,loaded.session.packId,token);
  revalidatePath(`/trials/rooms/${loaded.session.packId}/sessions/${loaded.session.id}`);
  return assigned?'':'No prepared test identity is available right now. Your trial session remains open.';
}

function field(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === 'string' ? value : '';
}

export async function saveGuidedTrialStep(formData: FormData) {
  const packId = field(formData, 'packId');
  const sessionId = field(formData, 'sessionId');
  if (!/^[A-Za-z0-9_-]{16,40}$/.test(sessionId)) notFound();
  const token = (await cookies()).get(GUIDED_TRIAL_ACCESS_COOKIE)?.value;
  if (!token) notFound();
  const parsedStatus = GuidedTrialStatusSchema.safeParse(field(formData, 'status'));
  const taskId = field(formData, 'taskId');
  const note = field(formData, 'note');
  if (!parsedStatus.success || note.length > 1200) throw new Error('Choose an outcome and keep notes under 1,200 characters.');
  const result = await guidedTrialStore.recordStep({sessionId, packId, accessToken: token, taskId, status: parsedStatus.data, note});
  if (!result.ok) {
    if (result.reason === 'unavailable') notFound();
    throw new Error(result.reason === 'finished' ? 'This session is finished and read-only.' : 'The task or note is invalid.');
  }
  revalidatePath(`/trials/rooms/${packId}/sessions/${sessionId}`);
}

export async function finishGuidedTrial(formData: FormData) {
  const packId = field(formData, 'packId');
  const sessionId = field(formData, 'sessionId');
  if (!/^[A-Za-z0-9_-]{16,40}$/.test(sessionId)) notFound();
  const token = (await cookies()).get(GUIDED_TRIAL_ACCESS_COOKIE)?.value;
  if (!token) notFound();
  const result = await guidedTrialStore.finishSession({sessionId, packId, accessToken: token});
  if (!result.ok) notFound();
  revalidatePath(`/trials/rooms/${packId}/sessions/${sessionId}`);
  return {ok: true};
}

export async function linkTrialParticipation(form: FormData) {
  const {requireUser} = await import('../../../../../../lib/authorization');
  const {db} = await import('../../../../../../lib/db');
  const {trialParticipations} = await import('../../../../../../lib/schema');
  const user = await requireUser();
  if (form.get('consent') !== 'on') throw new Error('Explicit account-linking consent is required.');
  const loaded = await authorizedTrial(form);
  const [linked] = await db.insert(trialParticipations).values({
    sessionId: loaded.session.id, userId: user.id,
  }).onConflictDoNothing().returning();
  if (!linked) throw new Error('This session has already been linked.');
  revalidatePath('/account');
  revalidatePath('/trials/rooms/' + loaded.session.packId + '/sessions/' + loaded.session.id);
}

async function authorizedTrial(form: FormData) {
  const sessionId = field(form, 'sessionId');
  if (!/^[A-Za-z0-9_-]{16,40}$/.test(sessionId)) notFound();
  const token = (await cookies()).get(GUIDED_TRIAL_ACCESS_COOKIE)?.value;
  const loaded = token ? await guidedTrialStore.loadSession(sessionId,token) : null;
  if (!loaded || loaded.session.packId !== field(form, 'packId')) notFound();
  return loaded;
}

export async function changeListingConsent(form: FormData) {
  const {and, eq, isNull} = await import('drizzle-orm');
  const {db} = await import('../../../../../../lib/db');
  const {feedbackListingConsents, handoffReports} = await import('../../../../../../lib/schema');
  const loaded = await authorizedTrial(form);
  const reportId = field(form, 'reportId');
  const [report] = await db.select({id: handoffReports.id}).from(handoffReports).where(and(
    eq(handoffReports.id, reportId), eq(handoffReports.sessionId, loaded.session.id),
    eq(handoffReports.kind, 'feedback'), isNull(handoffReports.revokedAt),
  ));
  if (!report) notFound();
  if (form.get('consent') === 'on') await db.insert(feedbackListingConsents).values({reportId}).onConflictDoNothing();
  else await db.delete(feedbackListingConsents).where(eq(feedbackListingConsents.reportId, reportId));
  revalidatePath('/results');
  revalidatePath('/trials/rooms/' + loaded.session.packId + '/sessions/' + loaded.session.id);
}
