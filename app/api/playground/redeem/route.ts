import {redeemPlaygroundHandoff} from '../../../../lib/trials/playground-handoffs';
import {playgroundApplication} from '../../../../lib/trials/playground-apps';

export async function POST(request:Request) {
 const authorization=request.headers.get('authorization')??'';
 const credential=authorization.startsWith('Bearer ')?authorization.slice(7):'';
 if(!credential || Number(request.headers.get('content-length')??'0')>1024)return new Response(null,{status:404});
 try {
  const raw=await request.text();
  if(raw.length>1024)return new Response(null,{status:400});
  const body=JSON.parse(raw);
  if(typeof body?.token!=='string' || (body.applicationId !== undefined && (typeof body.applicationId !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(body.applicationId))))return new Response(null,{status:400});
  const app=playgroundApplication(body.applicationId ?? 'legacy');
  if(!app)return new Response(null,{status:404});
  const result=await redeemPlaygroundHandoff(body.token,app.origin,credential,app.secret,undefined,body.applicationId ?? 'legacy');
  if(!result)return new Response(null,{status:404,headers:{'Cache-Control':'no-store'}});
  return Response.json(result,{headers:{'Cache-Control':'no-store'}});
 } catch {return new Response(null,{status:404,headers:{'Cache-Control':'no-store'}});}
}
