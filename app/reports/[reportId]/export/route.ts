import {createHash} from 'node:crypto';
import {cookies} from 'next/headers';
import {eq} from 'drizzle-orm';
import {db} from '../../../../lib/db';
import {handoffReports} from '../../../../lib/schema';
import {guidedTrialStore} from '../../../../lib/trials/guided-room-store';
import {GUIDED_TRIAL_ACCESS_COOKIE} from '../../../../lib/trials/room-auth';
export const dynamic='force-dynamic';
export async function GET(_request:Request,{params}:{params:Promise<{reportId:string}>}){
 const {reportId}=await params;if(!/^[A-Za-z0-9_-]{16,40}$/.test(reportId))return new Response('Not found',{status:404});
 const token=(await cookies()).get(GUIDED_TRIAL_ACCESS_COOKIE)?.value;if(!token)return new Response('Not found',{status:404});
 const [report]=await db.select().from(handoffReports).where(eq(handoffReports.id,reportId));
 if(!report||report.kind!=='feedback'||report.revokedAt||!report.sessionId)return new Response('Not found',{status:404});
 const session=await guidedTrialStore.loadSession(report.sessionId,token);if(!session||!session.session.completedAt)return new Response('Not found',{status:404});
 const payload={schemaVersion:'trycove-approved-handoff-export/1.0',exportedAt:new Date().toISOString(),report:JSON.parse(report.content) as Record<string,unknown>};
 const body=JSON.stringify(payload,null,2),digest=createHash('sha256').update(body).digest('hex');
 return new Response(body,{headers:{'Content-Type':'application/json; charset=utf-8','Content-Disposition':`attachment; filename="trycove-approved-feedback-${reportId}.json"`,'Cache-Control':'no-store, private','Referrer-Policy':'no-referrer','X-Content-SHA256':digest}});
}
