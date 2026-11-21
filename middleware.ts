import {createServerClient} from '@supabase/ssr';
import {NextResponse, type NextRequest} from 'next/server';

export async function middleware(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  let response = NextResponse.next({request});
  if (!url || !key) return response;
  const client = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookies, headers) => {
        for (const {name, value} of cookies) request.cookies.set(name, value);
        response = NextResponse.next({request});
        for (const {name, value, options} of cookies) response.cookies.set(name, value, options);
        for (const [name, value] of Object.entries(headers ?? {})) response.headers.set(name, value);
      },
    },
  });
  await client.auth.getUser();
  return response;
}

export const config = {
  matcher: ['/account/:path*', '/organizer/:path*', '/builder/:path*', '/results', '/opportunities/:path*', '/trials/rooms/:path*'],
};
