import {createServerClient} from '@supabase/ssr';
import {cookies} from 'next/headers';

export function authConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
}

export function emailOtpEnabled() {
  return authConfigured() && process.env.TRYCOVE_CUSTOM_SMTP_READY === 'true';
}

export async function serverAuth() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error('Account sign-in is unavailable.');
  const jar = await cookies();
  return createServerClient(url, key, {
    cookies: {
      getAll: () => jar.getAll(),
      setAll: values => {
        try {
          for (const {name, value, options} of values) jar.set(name, value, options);
        } catch {
          // Next.js only allows cookie writes in actions and route handlers.
        }
      },
    },
  });
}
