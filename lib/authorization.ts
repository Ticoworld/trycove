import {and, eq} from 'drizzle-orm';
import {cache} from 'react';
import {db} from './db';
import {appUsers, projectMemberships, projects} from './schema';
import {authConfigured, serverAuth} from './neon-auth';

export const authenticatedUser = cache(async () => {
  if (!authConfigured()) return null;
  const {data, error} = await serverAuth().getSession();
  return error ? null : data?.user ?? null;
});

export async function ensureProfile(id: string) {
  await db.insert(appUsers).values({id}).onConflictDoNothing();
}

export async function requireUser() {
  const user = await authenticatedUser();
  if (!user) throw new Error('Sign in to continue.');
  await ensureProfile(user.id);
  return user;
}

export async function isOrganizer(id: string) {
  const [profile] = await db.select({organizer: appUsers.organizer}).from(appUsers).where(eq(appUsers.id, id));
  return profile?.organizer === true;
}

export async function requireOrganizer() {
  const user = await requireUser();
  if (!await isOrganizer(user.id)) throw new Error('Organizer access is required.');
  return user;
}

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export async function checkProjectPermission(reader: typeof db | Transaction, userId: string, projectId: string,
  permission: 'edit' | 'publish' | 'membership') {
  const [membership] = await reader.select().from(projectMemberships).where(and(
    eq(projectMemberships.projectId, projectId), eq(projectMemberships.userId, userId),
  ));
  if (!membership || (permission !== 'edit' && membership.role !== 'owner')) {
    throw new Error('Project permission is required.');
  }
}

export async function lockProjectPermission(tx: Transaction, userId: string, projectId: string,
  permission: 'edit' | 'publish') {
  await tx.select({id: projects.id}).from(projects).where(eq(projects.id, projectId)).for('update');
  await checkProjectPermission(tx, userId, projectId, permission);
}

export async function requireProjectPermission(projectId: string, permission: 'edit' | 'publish' | 'membership') {
  const user = await requireUser();
  await checkProjectPermission(db, user.id, projectId, permission);
  return user;
}
