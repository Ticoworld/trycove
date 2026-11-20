'use server';
import {cookies} from 'next/headers';
import {redirect} from 'next/navigation';
import {hasOrganizerSession,makeOrganizerToken,ORGANIZER_COOKIE,ORGANIZER_MAX_AGE,verifyOrganizerKey} from '../../lib/organizer-auth';
function safeReturn(value:string){return value.startsWith('/')&&!value.startsWith('//')&&!value.startsWith('/\\')?value:'/results'}
export async function signInOrganizer(form:FormData){
 const password=form.get('key'),returnTo=form.get('returnTo');
 if(typeof password!=='string'||!verifyOrganizerKey(password))redirect('/organizer?error=invalid');
 const cookieStore=await cookies();cookieStore.set(ORGANIZER_COOKIE,makeOrganizerToken(),{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/',maxAge:ORGANIZER_MAX_AGE});
 redirect(safeReturn(typeof returnTo==='string'?returnTo:'/results'));
}
export async function signOutOrganizer(form:FormData){
 if(await hasOrganizerSession())(await cookies()).delete(ORGANIZER_COOKIE);
 const returnTo=form.get('returnTo');redirect(safeReturn(typeof returnTo==='string'?returnTo:'/results'));
}
