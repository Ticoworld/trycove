'use server';

import {redirect} from 'next/navigation';
import {db} from '../../lib/db';
import {appUsers, authorizationAudit} from '../../lib/schema';
import {requireUser} from '../../lib/authorization';
import {serverAuth} from '../../lib/neon-auth';
import {and, eq} from 'drizzle-orm';

export async function githubLogin() {
  const origin = process.env.TRYCOVE_PUBLIC_URL;
  if (!origin) throw new Error('GitHub sign-in is unavailable.');
  const {data, error} = await serverAuth().signIn.social({
    provider: 'github', callbackURL: new URL('/account', origin).href,
  });
  if (error || !data?.url) redirect('/account?error=signin');
  redirect(data.url);
}

export async function logout() {
  const {error} = await serverAuth().signOut();
  redirect(error ? '/account?error=signout' : '/account');
}

export async function bootstrapOrganizer() {
  const user = await requireUser();
  if (process.env.TRYCOVE_BOOTSTRAP_ORGANIZER_ID !== user.id) throw new Error('Organizer bootstrap is unavailable.');
  await db.transaction(async tx => {
    const [updated] = await tx.update(appUsers).set({organizer: true}).where(and(
      eq(appUsers.id, user.id), eq(appUsers.organizer, false),
    )).returning({id: appUsers.id});
    if (updated) await tx.insert(authorizationAudit).values({
      actorId: user.id, action: 'organizer-bootstrap', detail: 'Operator-configured authenticated account.',
    });
  });
  redirect('/account');
}
