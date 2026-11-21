'use server';

import {redirect} from 'next/navigation';
import {z} from 'zod';
import {db} from '../../lib/db';
import {appUsers, authorizationAudit} from '../../lib/schema';
import {requireUser} from '../../lib/authorization';
import {emailOtpEnabled, serverAuth} from '../../lib/supabase-auth';
import {and, eq} from 'drizzle-orm';

export async function githubLogin() {
  const origin = process.env.TRYCOVE_PUBLIC_URL;
  if (!origin) throw new Error('GitHub sign-in is unavailable.');
  const {data, error} = await (await serverAuth()).auth.signInWithOAuth({
    provider: 'github',
    options: {redirectTo: new URL('/auth/callback', origin).href},
  });
  if (error || !data.url) redirect('/account?error=signin');
  redirect(data.url);
}

export async function sendCode(form: FormData) {
  if (!emailOtpEnabled()) throw new Error('Email sign-in is unavailable.');
  const email = z.email().max(254).parse(form.get('email'));
  const {error} = await (await serverAuth()).auth.signInWithOtp({email});
  redirect(error ? '/account?error=signin' : '/account?otp=sent');
}

export async function verifyCode(form: FormData) {
  if (!emailOtpEnabled()) throw new Error('Email sign-in is unavailable.');
  const email = z.email().max(254).parse(form.get('email'));
  const token = z.string().regex(/^\d{6,10}$/).parse(form.get('code'));
  const {error} = await (await serverAuth()).auth.verifyOtp({email, token, type: 'email'});
  redirect(error ? '/account?otp=sent&error=signin' : '/account');
}

export async function logout() {
  const {error} = await (await serverAuth()).auth.signOut({scope: 'local'});
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
