import {authConfigured, serverAuth} from '../../../../lib/neon-auth';

type Context = {params: Promise<{path: string[]}>};

export async function GET(request: Request, context: Context) {
  if (!authConfigured()) return new Response('Sign-in unavailable', {status: 503});
  return serverAuth().handler().GET(request, context);
}

export async function POST(request: Request, context: Context) {
  if (!authConfigured()) return new Response('Sign-in unavailable', {status: 503});
  return serverAuth().handler().POST(request, context);
}
