import {redeemPlaygroundHandoff} from '../../../../lib/trials/playground-handoffs';

export async function POST(request:Request) {
 const expected=process.env.TRYCOVE_PLAYGROUND_APP_SECRET??'';
 const origin=process.env.TRYCOVE_PLAYGROUND_APP_ORIGIN??'';
 const authorization=request.headers.get('authorization')??'';
 const credential=authorization.startsWith('Bearer ')?authorization.slice(7):'';
 if(!origin || expected.length<32 || !credential || Number(request.headers.get('content-length')??'0')>1024)return new Response(null,{status:404});
 try {
  const raw=await request.text();
  if(raw.length>1024)return new Response(null,{status:400});
  const body=JSON.parse(raw);
  if(typeof body?.token!=='string')return new Response(null,{status:400});
  const result=await redeemPlaygroundHandoff(body.token,origin,credential,expected);
  if(!result)return new Response(null,{status:404,headers:{'Cache-Control':'no-store'}});
  return Response.json(result,{headers:{'Cache-Control':'no-store'}});
 } catch {return new Response(null,{status:404,headers:{'Cache-Control':'no-store'}});}
}
