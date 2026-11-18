'use server';

import {cookies} from 'next/headers';
import {getGuidedTrialDefinition} from '../../../../lib/trials/room-definitions';
import {guidedTrialStore} from '../../../../lib/trials/guided-room-store';
import {GUIDED_TRIAL_ACCESS_COOKIE, GUIDED_TRIAL_ACCESS_MAX_AGE_SECONDS} from '../../../../lib/trials/room-auth';

export async function startGuidedTrial(packId: string, selfReported: boolean) {
  const definition = getGuidedTrialDefinition(packId);
  if (!definition || selfReported !== true) throw new Error('Confirm the private-session and self-report note before starting.');
  const created = await guidedTrialStore.createSession(definition.id, selfReported);
  const path = `/trials/rooms/${definition.id}/sessions/${created.sessionId}`;
  (await cookies()).set(GUIDED_TRIAL_ACCESS_COOKIE, created.accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path,
    maxAge: GUIDED_TRIAL_ACCESS_MAX_AGE_SECONDS,
  });
  return {sessionId: created.sessionId, startedAt: created.startedAt.toISOString()};
}
