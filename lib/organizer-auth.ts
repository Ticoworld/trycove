import {createHmac,randomBytes,timingSafeEqual} from 'node:crypto';
import {cookies} from 'next/headers';

export const ORGANIZER_COOKIE='trycove_organizer';
const MAX_AGE=8*60*60;
function sign(payload:string,key:string){return createHmac('sha256',key).update(payload).digest('hex')}
export function verifyOrganizerKey(supplied:string){
 const expected=process.env.TRYCOVE_WRITE_KEY;if(!expected||supplied.length>512)return false;
 const a=Buffer.from(supplied),b=Buffer.from(expected);return a.length===b.length&&timingSafeEqual(a,b);
}
export function makeOrganizerToken(){
 const key=process.env.TRYCOVE_WRITE_KEY;if(!key)throw new Error('Organizer access is disabled.');
 const payload=`${Math.floor(Date.now()/1000)}.${randomBytes(24).toString('base64url')}`;
 return `${payload}.${sign(payload,key)}`;
}
export async function hasOrganizerSession(){
 const key=process.env.TRYCOVE_WRITE_KEY;if(!key)return false;
 const raw=(await cookies()).get(ORGANIZER_COOKIE)?.value;if(!raw)return false;
 const [issued,nonce,signature,...rest]=raw.split('.');
 if(rest.length||!/^\d{10}$/.test(issued??'')||! /^[A-Za-z0-9_-]{32}$/.test(nonce??'')||!/^[a-f0-9]{64}$/.test(signature??''))return false;
 const seconds=Number(issued);if(seconds>Date.now()/1000||Date.now()/1000-seconds>MAX_AGE)return false;
 const expected=Buffer.from(sign(`${issued}.${nonce}`,key),'hex'),actual=Buffer.from(signature,'hex');
 return expected.length===actual.length&&timingSafeEqual(expected,actual);
}
export const ORGANIZER_MAX_AGE=MAX_AGE;
