'use server';

import {linkedGitHubId} from '../../lib/neon-auth';
import {randomUUID} from 'node:crypto';
import {and, eq, gt} from 'drizzle-orm';
import {redirect} from 'next/navigation';
import {z} from 'zod';
import {requireOrganizer, requireProjectPermission, requireUser} from '../../lib/authorization';
import {db} from '../../lib/db';
import {authorizationAudit, ownershipClaims, projectMemberships, projects} from '../../lib/schema';

const repoPath = /^https:\/\/github\.com\/([\w-]+\/[\w.-]+)\/?$/i;
const repositorySchema = z.object({
  id: z.number().int().positive(),
  full_name: z.string(),
  fork: z.boolean(), private: z.boolean(),
  default_branch: z.string().min(1),
  owner: z.object({id: z.number().int().positive(), type: z.enum(['User','Organization'])}),
});

async function github(path: string) {
  const response = await fetch('https://api.github.com/' + path, {
    redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(8000),
    headers: {Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28'},
  });
  if (!response.ok) throw new Error('GitHub could not verify the repository.');
  return response.json();
}

async function authority(projectId: string) {
  const [project] = await db.select().from(projects).where(eq(projects.id, projectId));
  if (!project) throw new Error('Choose an existing Product Passport.');
  const name = project.repository?.match(repoPath)?.[1]?.replace(/\.git$/i, '');
  if (!name) return {project, repository: null};
  const result = repositorySchema.safeParse(await github('repos/' + name).catch(() => null));
  const repository = result.data;
  if (!repository || repository.fork || repository.private || repository.full_name.toLowerCase() !== name.toLowerCase()) {
    return {project, repository: null};
  }
  const records = await db.select({id: projects.id, repository: projects.repository}).from(projects);
  const aliases = records.filter(row => row.repository?.match(repoPath)?.[1]?.replace(/\.git$/i, '').toLowerCase() === name.toLowerCase());
  return {project, repository: aliases.length === 1 ? repository : null};
}

export async function startClaim(form: FormData) {
  const user = await requireUser();
  const projectId = z.string().min(1).max(200).parse(form.get('projectId'));
  const {project, repository} = await authority(projectId);
  const githubId = await linkedGitHubId().catch(() => undefined);
  const method = repository && githubId
    ? repository.owner.type === 'Organization' ? 'organization' : String(repository.owner.id) === githubId ? 'personal' : 'review'
    : 'review';
  const id = randomUUID();
  await db.insert(ownershipClaims).values({
    id, projectId, userId: user.id, repository: project.repository ?? project.sourceUrl, method,
    status: 'pending', expiresAt: new Date(Date.now() + (method === 'review' ? 7 * 86400000 : 1800000)),
    evidence: JSON.stringify({repositoryId: repository?.id, githubId, source: project.sourceUrl}),
  });
  redirect('/account?claim=' + id + '&notice=claim');
}

async function decide(claim: typeof ownershipClaims.$inferSelect, actorId: string, status: 'approved' | 'rejected', detail: string, review: boolean) {
  await db.transaction(async tx => {
    await tx.select({id: projects.id}).from(projects).where(eq(projects.id, claim.projectId)).for('update');
    const owner = await tx.select().from(projectMemberships).where(and(
      eq(projectMemberships.projectId, claim.projectId), eq(projectMemberships.role, 'owner'),
    ));
    if (status === 'approved' && owner.length > 0) {
      throw new Error('This project already has an owner. An organizer must resolve the existing claim first.');
    }
    const now = new Date();
    const [updated] = await tx.update(ownershipClaims).set({
      status, reviewerId: review ? actorId : null, decidedAt: now,
    }).where(and(eq(ownershipClaims.id, claim.id), eq(ownershipClaims.status, 'pending'),
      gt(ownershipClaims.expiresAt, now))).returning();
    if (!updated) throw new Error('Claim is no longer pending.');
    if (status === 'approved') await tx.insert(projectMemberships).values({
      projectId: claim.projectId, userId: claim.userId, role: 'owner',
    }).onConflictDoUpdate({target: [projectMemberships.projectId, projectMemberships.userId], set: {role: 'owner'}});
    await tx.insert(authorizationAudit).values({
      actorId, projectId: claim.projectId, action: 'ownership-' + status,
      detail: JSON.stringify({claimId: claim.id, method: claim.method, detail}),
    });
  });
}

export async function verifyClaim(form: FormData) {
  const user = await requireUser();
  const id = z.uuid().parse(form.get('claimId'));
  const [claim] = await db.select().from(ownershipClaims).where(and(
    eq(ownershipClaims.id, id), eq(ownershipClaims.userId, user.id), eq(ownershipClaims.status, 'pending'),
    gt(ownershipClaims.expiresAt, new Date()),
  ));
  if (!claim || claim.method === 'review') throw new Error('Claim is unavailable for automatic verification.');
  const {repository} = await authority(claim.projectId);
  const evidence = JSON.parse(claim.evidence) as {repositoryId?: number; githubId?: string};
  const githubId = await linkedGitHubId().catch(() => undefined);
  if (!repository || repository.id !== evidence.repositoryId || !githubId || githubId !== evidence.githubId) {
    throw new Error('Repository or GitHub identity changed. Request organizer review.');
  }
  let detail = 'GitHub repository ' + repository.id + ' and account ' + githubId;
  if (claim.method === 'personal') {
    if (repository.owner.type !== 'User' || String(repository.owner.id) !== githubId) throw new Error('Repository ownership changed.');
  } else {
    if (repository.owner.type !== 'Organization') throw new Error('Repository ownership changed.');
    const branch = await github('repos/' + repository.full_name + '/branches/' + encodeURIComponent(repository.default_branch));
    const sha = z.string().regex(/^[a-f0-9]{40}$/).parse(branch.commit?.sha);
    const file = await github('repos/' + repository.full_name + '/contents/.trycove-ownership?ref=' + sha);
    if (file.type !== 'file' || file.encoding !== 'base64' || typeof file.content !== 'string' ||
      file.content.length > 2048 || Buffer.from(file.content, 'base64').toString('utf8').trim() !== claim.id) {
      throw new Error('The challenge was not found on the default branch.');
    }
    detail += ' default branch commit ' + sha;
  }
  await decide(claim, user.id, 'approved', detail, false);
  redirect('/account?notice=verified');
}

export async function reviewClaim(form: FormData) {
  const organizer = await requireOrganizer();
  const id = z.uuid().parse(form.get('claimId'));
  const status = z.enum(['approved','rejected']).parse(form.get('decision'));
  const detail = z.string().trim().min(10).max(2000).parse(form.get('detail'));
  const [claim] = await db.select().from(ownershipClaims).where(eq(ownershipClaims.id, id));
  if (!claim || claim.userId === organizer.id) throw new Error('A separate organizer must review this claim.');
  await decide(claim, organizer.id, status, detail, true);
  redirect('/account?notice=saved');
}

export async function manageMaintainer(form: FormData) {
  const projectId = z.string().min(1).max(200).parse(form.get('projectId'));
  const userId = z.uuid().parse(form.get('userId'));
  const operation = z.enum(['add','remove']).parse(form.get('operation'));
  const actor = await requireProjectPermission(projectId, 'membership');
  await db.transaction(async tx => {
    await tx.select({id: projects.id}).from(projects).where(eq(projects.id, projectId)).for('update');
    const [owner] = await tx.select().from(projectMemberships).where(and(eq(projectMemberships.projectId, projectId),
      eq(projectMemberships.userId, actor.id), eq(projectMemberships.role, 'owner')));
    if (!owner) throw new Error('Project owner permission is required.');
    const affected = operation === 'add'
      ? await tx.insert(projectMemberships).values({projectId, userId, role: 'maintainer'}).onConflictDoNothing().returning()
      : await tx.delete(projectMemberships).where(and(eq(projectMemberships.projectId, projectId),
        eq(projectMemberships.userId, userId), eq(projectMemberships.role, 'maintainer'))).returning();
    if (!affected.length) throw new Error(operation === 'add' ? 'That account already has access.' : 'No maintainer was found for that account.');
    await tx.insert(authorizationAudit).values({
      actorId: actor.id, projectId, action: 'maintainer-' + operation, detail: userId,
    });
  });
  redirect('/account?notice=saved');
}

export async function revokeClaim(form: FormData) {
  const actor = await requireOrganizer();
  const id = z.uuid().parse(form.get('claimId'));
  const detail = z.string().trim().min(10).max(2000).parse(form.get('detail'));
  await db.transaction(async tx => {
    const [claim] = await tx.select().from(ownershipClaims).where(eq(ownershipClaims.id, id));
    if (!claim) throw new Error('Claim is unavailable.');
    await tx.select({id: projects.id}).from(projects).where(eq(projects.id, claim.projectId)).for('update');
    const [updated] = await tx.update(ownershipClaims).set({status: 'revoked', reviewerId: actor.id, decidedAt: new Date()})
      .where(and(eq(ownershipClaims.id, id), eq(ownershipClaims.status, 'approved'))).returning();
    if (!updated) throw new Error('Claim is no longer approved.');
    await tx.delete(projectMemberships).where(eq(projectMemberships.projectId, claim.projectId));
    await tx.update(ownershipClaims).set({status: 'revoked', reviewerId: actor.id, decidedAt: new Date()})
      .where(and(eq(ownershipClaims.projectId, claim.projectId), eq(ownershipClaims.status, 'approved')));
    await tx.insert(authorizationAudit).values({
      actorId: actor.id, projectId: claim.projectId, action: 'ownership-revoked', detail: JSON.stringify({claimId: id, detail}),
    });
  });
  redirect('/account?notice=saved');
}
