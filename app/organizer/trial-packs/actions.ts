'use server';

import {lockProjectPermission,requireUser} from '../../../lib/authorization';
import {db} from '../../../lib/db';
import {redirect} from 'next/navigation';
import {z} from 'zod';
import {hasOrganizerSession} from '../../../lib/organizer-auth';
import {DraftSchema,trialSlug} from '../../../lib/trials/room-definitions';
import {saveTrialDraft, setTrialPackState} from '../../../lib/trials/trial-packs';

const page = '/organizer/trial-packs';

export async function saveDraft(_previous: string, form: FormData) {
  const organizer = await hasOrganizerSession();
  const user = organizer ? null : await requireUser();
  let id: string;
  let projectId: string;
  try {
    const raw = z.string().max(150_000).parse(form.get('definition'));
    const draft = DraftSchema.parse(JSON.parse(raw));
    projectId = draft.productId;
    id = (await saveTrialDraft(draft, db, user ? async (tx, productId) => {
      await lockProjectPermission(tx,user.id,productId,'edit');
    } : undefined)).id;
  } catch (error) {
    const message = error instanceof z.ZodError
      ? error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join('; ')
      : 'Check the selected product, testing request and room state.';
    return message.slice(0, 500);
  }
  redirect(`${page}?room=${id}${user ? "&project=" + encodeURIComponent(projectId) : ""}&notice=saved`);
}

export async function changeState(form: FormData) {
  const organizer = await hasOrganizerSession();
  const user = organizer ? null : await requireUser();
  const project = user ? z.string().min(1).max(200).parse(form.get('project')) : '';
  const scope = user ? '&project=' + encodeURIComponent(project) : '';
  const id = trialSlug.parse(form.get('id'));
  try {
    await setTrialPackState(id, z.coerce.number().int().positive().parse(form.get('version')),
      z.enum(['published','paused','closed']).parse(form.get('state')),db,user ? async (tx, productId) => {
      if (productId !== project) throw new Error('Project permission is required.');
      await lockProjectPermission(tx,user.id,productId,'publish');
    } : undefined);
  } catch {
    redirect(`${page}?room=${id}${scope}&error=Reload%20and%20review%20the%20room%20before%20changing%20its%20state.`);
  }
  redirect(`${page}?room=${id}${scope}&notice=updated`);
}
