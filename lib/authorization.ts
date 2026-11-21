import {and, eq} from 'drizzle-orm';
import {cache} from 'react';
import {db} from './db';
import {appUsers, projectMemberships} from './schema';
import {authConfigured, serverAuth} from './supabase-auth';

export const authenticatedUser = cache(async () => {
  if (!authConfigured()) return null;
  const {data, error} = await (await serverAuth()).auth.getUser();
  return error ? null : data.user;
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

export async function requireProjectPermission(projectId: string, permission: 'edit' | 'publish' | 'membership') {
  const user = await requireUser();
  const [membership] = await db.select().from(projectMemberships).where(and(
    eq(projectMemberships.projectId, projectId), eq(projectMemberships.userId, user.id),
  ));
  if (!membership || (permission !== 'edit' && membership.role !== 'owner')) {
    throw new Error('Project permission is required.');
  }
  return user;
}
