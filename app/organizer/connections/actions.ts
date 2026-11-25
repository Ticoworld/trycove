'use server';
import {randomUUID,createHash} from 'node:crypto';
import {eq, and, sql} from 'drizzle-orm';
import {z} from 'zod';
import {redirect} from 'next/navigation';
import {revalidatePath} from 'next/cache';
import {db} from '../../../lib/db';
import {appUsers, connectionOperations, evidence, opportunities, projects, projectRepositories, sourceRecords} from '../../../lib/schema';
import {authenticatedUser} from '../../../lib/authorization';
import {hasOrganizerSession} from '../../../lib/organizer-auth';
import {validHttpsUrl} from '../../../lib/handoffs';

async function organizer() {
  if (!await hasOrganizerSession()) throw new Error('Organizer access is required.');
  return authenticatedUser();
}
const text = (form: FormData, key: string, max = 2000) => z.string().trim().min(1).max(max).parse(form.get(key));
export async function registerProjectReference(form: FormData) {
  await organizer();
  const name=text(form,'name',200),description=text(form,'description'),revision=text(form,'revision',200);
  const sourceUrl=validHttpsUrl(text(form,'sourceUrl',2048));
  const websiteInput=String(form.get('website')||'').trim();
  const repositoryInput=String(form.get('repository')||'').trim();
  const website=websiteInput?validHttpsUrl(websiteInput):null;
  const repository=repositoryInput?validHttpsUrl(repositoryInput):null;
  if(!sourceUrl||(websiteInput&&!website)||(repositoryInput&&!repository))throw new Error('Source and optional links must use HTTPS.');
  const normalize=(value:string|null)=>{
    if(!value)return '';
    const trimmed=value.trim().replace(/\s+/g,' ');
    try{const url=new URL(trimmed);url.hash='';url.search='';let path=url.pathname.replace(/\/+$/,'');if(url.hostname.toLowerCase()==='github.com')path=path.replace(/\.git$/i,'');return `${url.hostname}${path}`.toLocaleLowerCase()}catch{return trimmed.toLocaleLowerCase()}
  };
  const id=`organizer-ref-${createHash('sha256').update(normalize(name)).digest('hex').slice(0,24)}`;
  await db.transaction(async tx=>{
    await tx.execute(sql`select pg_advisory_xact_lock(645016021)`);
    const existing=await tx.select({id:projects.id,name:projects.name,website:projects.website,repository:projects.repository,sourceUrl:projects.sourceUrl}).from(projects);
    const repositories=await tx.select({repository:projectRepositories.repository}).from(projectRepositories);
    const sources=await tx.select({sourceUrl:sourceRecords.sourceUrl}).from(sourceRecords);
    const duplicate=existing.some(row=>normalize(row.name)===normalize(name)||normalize(row.sourceUrl)===normalize(sourceUrl)||!!website&&normalize(row.website)===normalize(website)||!!repository&&normalize(row.repository)===normalize(repository)) ||
      (!!repository&&repositories.some(row=>normalize(row.repository)===normalize(repository))) || sources.some(row=>normalize(row.sourceUrl)===normalize(sourceUrl));
    if(duplicate)throw new Error('A project with this name, source, website or repository already exists. Review and select the existing project.');
    const observedAt=new Date();
    await tx.insert(projects).values({id,name,description,website,repository,sourceUrl,revision,observedAt});
    await tx.insert(sourceRecords).values({id:`${id}-source`,projectId:id,source:'Organizer project reference',sourceUrl,revision,observedAt,raw:JSON.stringify({name,description,website,repository,sourceUrl,revision})});
  });
  revalidatePath('/organizer/connections');
}
export async function createOpportunity(form: FormData) {
  await organizer();
  const projectA=text(form,'projectA',150), projectB=String(form.get('projectB')||'').trim()||null;
  const sourceUrl=validHttpsUrl(text(form,'sourceUrl',2048));
  if (!sourceUrl) throw new Error('A public HTTPS source is required.');
  const id=`manual-${randomUUID()}`;
  await db.transaction(async tx=>{
    await tx.insert(opportunities).values({id,projectA,projectB,kind:projectB?'proposed':'documented-need',problem:text(form,'problem'),reasoning:text(form,'reasoning'),requirements:'',experiment:'',status:'needs-review'});
    await tx.insert(evidence).values({opportunityId:id,claim:text(form,'claim'),sourceUrl,revision:String(form.get('revision')||'').trim()||null,observedAt:new Date(),verification:'organizer-recorded source claim; not independently verified'});
    await tx.insert(connectionOperations).values({opportunityId:id});
  });
  redirect(`/organizer/connections/${id}`);
}
export async function saveOperations(form: FormData) {
  const actor=await organizer(); const id=text(form,'id',150);
  const nextAction=String(form.get('nextAction')||'').trim().slice(0,2000);
  const responsible=String(form.get('responsible')||'').trim()||null;
  if(responsible){const [user]=await db.select().from(appUsers).where(and(eq(appUsers.id,responsible),eq(appUsers.organizer,true)));if(!user)throw new Error('Responsible person must be an organizer.');}
  const dueDate=String(form.get('dueDate')||'').trim()||null;
  if(dueDate&&!/^\d{4}-\d{2}-\d{2}$/.test(dueDate))throw new Error('Invalid due date.');
  const progress=z.enum(['open','in-progress','blocked','done']).parse(form.get('progress'));
  const publication=z.enum(['legacy','private','published']).parse(form.get('publication'));
  if(publication==='published') {
    const [row]=await db.select().from(opportunities).where(eq(opportunities.id,id));
    if(!row)throw new Error('Opportunity not found.');
    const [source]=await db.select().from(evidence).where(eq(evidence.opportunityId,id));
    if(!source||!validHttpsUrl(source.sourceUrl))throw new Error('Publication requires source evidence.');
    if(!actor)throw new Error('An authenticated organizer must approve publication.');
  }
  const publicTitle=publication==='published'?text(form,'publicTitle'):null;
  const publicSummary=publication==='published'?text(form,'publicSummary'):null;
  const publicSourceUrl=publication==='published'?validHttpsUrl(text(form,'publicSourceUrl',2048)):null;
  const publicKind=publication==='published'?z.enum(['need','proposal','evidenced']).parse(form.get('publicKind')):null;
  if(publication==='published'&&!publicSourceUrl)throw new Error('Public source must be HTTPS.');
  if(publication==='published') {
    const sources=await db.select().from(evidence).where(eq(evidence.opportunityId,id));
    if(!sources.some(source=>validHttpsUrl(source.sourceUrl)===publicSourceUrl))throw new Error('The public source must match recorded evidence.');
  }
  const values={nextAction,responsibleUserId:responsible,dueDate,watchlist:form.has('watchlist'),progress,publication,reviewedBy:publication==='published'?actor!.id:null,reviewedAt:publication==='published'?new Date():null,publicTitle,publicSummary,publicSourceUrl,publicKind};
  await db.insert(connectionOperations).values({opportunityId:id,...values}).onConflictDoUpdate({target:connectionOperations.opportunityId,set:values});
  revalidatePath('/opportunities');revalidatePath(`/opportunities/${id}`);revalidatePath('/organizer/connections');revalidatePath(`/organizer/connections/${id}`);
}
