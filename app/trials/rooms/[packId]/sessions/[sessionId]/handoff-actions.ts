'use server';
import {cookies} from 'next/headers';
import {revalidatePath} from 'next/cache';
import {GUIDED_TRIAL_ACCESS_COOKIE} from '../../../../../../lib/trials/room-auth';
import {createFeedbackReport,revokeHandoff} from '../../../../../../lib/handoffs';

export async function publishFeedbackReport(input:{packId:string;sessionId:string;approvedTaskIds:string[]}){
  if(!/^[A-Za-z0-9_-]{16,40}$/.test(input.sessionId)||input.approvedTaskIds.length>12||input.approvedTaskIds.some(x=>!/^[-a-z0-9]{1,80}$/.test(x)))return {ok:false as const,error:'The report request is invalid.'};
  const token=(await cookies()).get(GUIDED_TRIAL_ACCESS_COOKIE)?.value;if(!token)return {ok:false as const,error:'This private session is unavailable.'};
  const result=await createFeedbackReport({sessionId:input.sessionId,sessionToken:token,approvedTaskIds:input.approvedTaskIds});
  if(!result)return {ok:false as const,error:'The completed session or its latest receipt could not be verified.'};
  revalidatePath('/results');
  return {ok:true as const,url:`/share/${result.token}`,exportUrl:`/reports/${result.id}/export`};
}

export async function revokeFeedbackReport(input:{sessionId:string;reportId:string}){
  if(!/^[A-Za-z0-9_-]{16,40}$/.test(input.sessionId)||!/^[A-Za-z0-9_-]{16,40}$/.test(input.reportId))return {ok:false as const,error:'The report request is invalid.'};
  const token=(await cookies()).get(GUIDED_TRIAL_ACCESS_COOKIE)?.value;if(!token)return {ok:false as const,error:'This private session is unavailable.'};
  const ok=await revokeHandoff(input.reportId,input.sessionId,token);
  if(!ok)return {ok:false as const,error:'This report could not be revoked from the current session.'};
  revalidatePath('/results');
  return {ok:true as const};
}
