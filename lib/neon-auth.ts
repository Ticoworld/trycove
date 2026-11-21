import {createNeonAuth} from '@neon/auth/next/server';

export function authConfigured() {
  return Boolean(process.env.NEON_AUTH_BASE_URL && process.env.NEON_AUTH_COOKIE_SECRET);
}

export function serverAuth() {
  const baseUrl = process.env.NEON_AUTH_BASE_URL;
  const secret = process.env.NEON_AUTH_COOKIE_SECRET;
  if (!baseUrl || !secret) throw new Error('Account sign-in is unavailable.');
  return createNeonAuth({baseUrl, cookies: {secret, sessionDataTtl: 1}});
}

export async function linkedGitHubId() {
  const {data, error} = await serverAuth().listAccounts();
  const accounts = data?.filter(account => account.providerId === 'github');
  const id = accounts?.length === 1 ? accounts[0]?.accountId : undefined;
  return !error && typeof id === 'string' && /^[1-9][0-9]*$/.test(id) ? id : undefined;
}
