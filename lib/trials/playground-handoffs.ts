import {createHash,randomBytes,timingSafeEqual} from 'node:crypto';
import {and,eq,gt,isNull,lte} from 'drizzle-orm';
import {db} from '../db';
import {guidedTrialSessions,playgroundHandoffs,preparedResources} from '../schema';
import {tokenMatches} from './guided-room-store';

const digest=(value:string)=>createHash('sha256').update(value).digest('hex');
export async function issuePlaygroundHandoff(sessionId:string,packId:string,sessionToken:string,expectedOrigin:string,database=db) {
 return database.transaction(async tx=>{
  const [session]=await tx.select().from(guidedTrialSessions).where(and(eq(guidedTrialSessions.id,sessionId),eq(guidedTrialSessions.packId,packId))).for('update');
  if(!session || session.completedAt || !tokenMatches(sessionToken,session.accessTokenSha256,session.startedAt))return null;
  const now=new Date();
  const [resource]=await tx.select().from(preparedResources).where(and(eq(preparedResources.assignedSessionId,sessionId),eq(preparedResources.packId,packId),eq(preparedResources.packVersion,Number(session.definitionVersion)),eq(preparedResources.kind,'identity'),eq(preparedResources.retired,true),gt(preparedResources.expiresAt,now))).for('update');
  if(!resource || !resource.expiresAt)return null;
  const origin=new URL(resource.launchUrl).origin;
  if(origin!==expectedOrigin)return null;
  await tx.delete(playgroundHandoffs).where(and(eq(playgroundHandoffs.resourceId,resource.id),isNull(playgroundHandoffs.consumedAt),lte(playgroundHandoffs.expiresAt,now)));
  const token=randomBytes(32).toString('base64url');
  const expiresAt=new Date(Math.min(resource.expiresAt.getTime(),now.getTime()+120000));
  const [created]=await tx.insert(playgroundHandoffs).values({digest:digest(token),resourceId:resource.id,sessionId,applicationOrigin:origin,expiresAt}).onConflictDoNothing().returning();
  return created?{token,launchUrl:resource.launchUrl,expiresAt}:null;
 });
}

export async function redeemPlaygroundHandoff(token:string,origin:string,credential:string,expectedCredential:string,database=db) {
 if(!/^[A-Za-z0-9_-]{43}$/.test(token) || expectedCredential.length<32)return null;
 const a=Buffer.from(credential),b=Buffer.from(expectedCredential);
 if(a.length!==b.length || !timingSafeEqual(a,b))return null;
 return database.transaction(async tx=>{
  const now=new Date();
  const [ticket]=await tx.update(playgroundHandoffs).set({consumedAt:now}).where(and(eq(playgroundHandoffs.digest,digest(token)),eq(playgroundHandoffs.applicationOrigin,origin),isNull(playgroundHandoffs.consumedAt),gt(playgroundHandoffs.expiresAt,now))).returning();
  if(!ticket)return null;
  const [session]=await tx.select().from(guidedTrialSessions).where(eq(guidedTrialSessions.id,ticket.sessionId)).for('update');
  const [resource]=await tx.select().from(preparedResources).where(and(eq(preparedResources.id,ticket.resourceId),eq(preparedResources.assignedSessionId,ticket.sessionId),eq(preparedResources.kind,'identity'),eq(preparedResources.retired,true),gt(preparedResources.expiresAt,now))).for('update');
  if(!session || session.completedAt || !resource || !resource.expiresAt || resource.expiresAt<=new Date() || ticket.expiresAt<=new Date())throw new Error('Allocation expired.');
  return {resourceId:resource.id,expiresAt:resource.expiresAt};
 });
}
