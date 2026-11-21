'use server';

import {redirect} from 'next/navigation';
import {z} from 'zod';
import {hasOrganizerSession} from '../../../lib/organizer-auth';
import {trialSlug} from '../../../lib/trials/room-definitions';
import {saveTrialDraft, setTrialPackState} from '../../../lib/trials/trial-packs';

const page = '/organizer/trial-packs';

export async function saveDraft(_previous: string, form: FormData) {
  if (!await hasOrganizerSession()) throw new Error('Organizer access is required.');
  let id: string;
  try {
    const raw = z.string().max(150_000).parse(form.get('definition'));
    id = (await saveTrialDraft(JSON.parse(raw))).id;
  } catch (error) {
    const message = error instanceof z.ZodError
      ? error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join('; ')
      : 'Check the selected product, testing request and room state.';
    return message.slice(0, 500);
  }
  redirect(`${page}?room=${id}`);
}

export async function changeState(form: FormData) {
  if (!await hasOrganizerSession()) throw new Error('Organizer access is required.');
  const id = trialSlug.parse(form.get('id'));
  try {
    await setTrialPackState(id, z.coerce.number().int().positive().parse(form.get('version')),
      z.enum(['published','paused','closed']).parse(form.get('state')));
  } catch {
    redirect(`${page}?room=${id}&error=Reload%20and%20review%20the%20room%20before%20changing%20its%20state.`);
  }
  redirect(`${page}?room=${id}`);
}
