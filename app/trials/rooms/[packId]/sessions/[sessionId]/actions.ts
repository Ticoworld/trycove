'use server';

import {cookies} from 'next/headers';
import {notFound} from 'next/navigation';
import {revalidatePath} from 'next/cache';
import {GuidedTrialStatusSchema, guidedTrialStore} from '../../../../../../lib/trials/guided-room-store';
import {GUIDED_TRIAL_ACCESS_COOKIE} from '../../../../../../lib/trials/room-auth';

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
