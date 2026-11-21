import {NextResponse, type NextRequest} from 'next/server';
import {authConfigured, serverAuth} from './lib/neon-auth';

export async function proxy(request: NextRequest) {
  if (!authConfigured()) return NextResponse.next();
  return serverAuth().middleware({loginUrl: '/account', publicRoutes: ['/account']})(request);
}

export const config = {matcher: ['/account', '/builder/:path*']};
