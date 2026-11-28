'use server';

import {randomUUID} from 'node:crypto';
import {and,eq} from 'drizzle-orm';
import {z} from 'zod';
import {preparedResources,trialPacks} from '../../../lib/schema';
import {readPackVersion} from '../../../lib/trials/trial-packs';
import {lockProjectPermission,requireUser} from '../../../lib/authorization';
import {db} from '../../../lib/db';
import {revalidatePath} from 'next/cache';
import {registerPreparedResources} from '../../../lib/trials/register-prepared-resources';
import {confirmPlaygroundResource,playgroundApplication} from '../../../lib/trials/playground-apps';

export async function registerPreparedResource(form:FormData) {
 const user=await requireUser();
 const projectId=z.string().min(1).max(200).parse(form.get('projectId'));
 const packId=z.string().min(1).max(80).parse(form.get('packId'));
 const label=z.string().trim().min(1).max(100).parse(form.get('label'));
 const kind=z.enum(['environment','identity','access']).parse(form.get('kind'));
 const launchUrl=z.string().url().max(2048).parse(form.get('launchUrl'));
 const idText=z.string().max(4000).parse(form.get('resourceIds')??'').trim();
 const ids=idText?idText.split(/\s+/).map(value=>z.string().uuid().parse(value)):[randomUUID()];
 await registerPreparedResources({userId:user.id,projectId,packId,resources:ids.map((id,index)=>({id,label:ids.length===1?label:`${label} ${index+1}`,kind,launchUrl}))});
 revalidatePath('/builder/'+projectId);
}

export async function setPreparedResourceAvailability(form:FormData) {
 const user=await requireUser();
 const projectId=z.string().min(1).max(200).parse(form.get('projectId'));
 const id=z.string().uuid().parse(form.get('resourceId'));
 const enabled=z.enum(['true','false']).parse(form.get('enabled'))==='true';
 await db.transaction(async tx=>{
  await lockProjectPermission(tx,user.id,projectId,'edit');
  const [resource]=await tx.select().from(preparedResources).where(eq(preparedResources.id,id)).for('update');
  if(!resource)throw new Error('Resource unavailable.');
  if(enabled && resource.retired)throw new Error('An exposed identity cannot be reused.');
  const definition=await readPackVersion(resource.packId,resource.packVersion,tx);
  if(definition.product.id!==projectId)throw new Error('Project permission is required.');
  const applicationId=definition.preparedResource?.applicationId;
  if(enabled && applicationId){
   const application=playgroundApplication(applicationId);
   if(!application || new URL(resource.launchUrl).origin!==application.origin || new URL(definition.application.url).origin!==application.origin || !await confirmPlaygroundResource(applicationId,id))throw new Error('The application has not confirmed this resource is ready.');
  }
  if(enabled && resource.assignedSessionId && resource.expiresAt && resource.expiresAt>new Date())throw new Error('This resource is still allocated.');
  if(enabled && form.get('reset')!=='on')throw new Error('Confirm the external resource has been reset before enabling it.');
  await tx.update(preparedResources).set({enabled,...enabled?{assignedSessionId:null,expiresAt:null,...applicationId?{providerReady:true}:{}}:{}}).where(and(eq(preparedResources.id,id),eq(preparedResources.packId,resource.packId)));
 });
 revalidatePath('/builder/'+projectId);
}

import {isNull} from 'drizzle-orm';
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
