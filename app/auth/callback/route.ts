import {redirect} from 'next/navigation';
import {ensureProfile} from '../../../lib/authorization';
import {authConfigured, serverAuth} from '../../../lib/supabase-auth';

export async function GET(request: Request) {
  const code = new URL(request.url).searchParams.get('code');
  if (!code || !authConfigured()) redirect('/account?error=signin');
  const client = await serverAuth();
  const {error} = await client.auth.exchangeCodeForSession(code);
  if (error) redirect('/account?error=signin');
  const {data, error: userError} = await client.auth.getUser();
  if (userError || !data.user) redirect('/account?error=signin');
  await ensureProfile(data.user.id);
  redirect('/account');
}
