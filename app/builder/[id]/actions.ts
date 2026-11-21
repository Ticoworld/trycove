'use server';

import {randomUUID} from 'node:crypto';
import {and,eq,isNull} from 'drizzle-orm';
import {z} from 'zod';
import {revalidatePath} from 'next/cache';
import {lockProjectPermission, requireUser} from '../../../lib/authorization';
import {db} from '../../../lib/db';
import {authorizationAudit, followUps, handoffReports, projectDeclarations} from '../../../lib/schema';

const project = z.string().min(1).max(200);

export async function saveDeclaration(form: FormData) {
  const user = await requireUser();
  const projectId = project.parse(form.get('projectId'));
  const previousId = z.uuid().optional().parse(form.get('previousId') || undefined);
  const state = z.enum(['published','withdrawn']).parse(form.get('state'));
  await db.transaction(async tx => {
    await lockProjectPermission(tx,user.id,projectId,'edit');
    const [previous] = previousId ? await tx.select().from(projectDeclarations).where(and(
      eq(projectDeclarations.id,previousId),eq(projectDeclarations.projectId,projectId),
    )) : [];
    if (previousId && (!previous || previous.moderation !== 'visible')) throw new Error('Declaration is unavailable.');
    if (!previous && state === 'withdrawn') throw new Error('Choose a published declaration.');
    const kind = previous?.kind ?? z.enum(['testing-need','product-need','capability']).parse(form.get('kind'));
    const content = state === 'withdrawn' ? previous!.content : z.string().trim().min(1).max(2000).parse(form.get('content'));
    const prerequisites = state === 'withdrawn' ? previous!.prerequisites : z.string().trim().max(2000).parse(form.get('prerequisites'));
    await tx.insert(projectDeclarations).values({id:randomUUID(),projectId,authorId:user.id,kind,content,prerequisites,state,supersedesId:previousId});
  });
  revalidatePath('/builder/' + projectId);
  revalidatePath('/projects/' + projectId);
  revalidatePath('/map');
  revalidatePath('/trials');
}

export async function respondToFeedback(form: FormData) {
  const user = await requireUser();
  const projectId = project.parse(form.get('projectId'));
  const reportId = z.string().regex(/^[A-Za-z0-9_-]{16,40}$/).parse(form.get('reportId'));
  const note = z.string().trim().min(1).max(2000).parse(form.get('note'));
  await db.transaction(async tx => {
    await lockProjectPermission(tx,user.id,projectId,'edit');
    const [report] = await tx.select().from(handoffReports).where(and(
      eq(handoffReports.id,reportId),eq(handoffReports.projectId,projectId),
      eq(handoffReports.kind,'feedback'),isNull(handoffReports.revokedAt),
    )).for('update');
    if (!report) throw new Error('Approved feedback is unavailable.');
    const [event] = await tx.insert(followUps).values({
      handoffReportId:report.id,kind:'builder-responded',note,publicNote:false,
    }).returning({id:followUps.id});
    await tx.insert(authorizationAudit).values({
      actorId:user.id,projectId,action:'builder-feedback-response',detail:String(event.id),
    });
  });
  revalidatePath('/builder/' + projectId);
}
