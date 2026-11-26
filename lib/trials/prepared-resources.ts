import {and,eq,gt,isNull,lte} from 'drizzle-orm';
import {db} from '../db';
import {guidedTrialSessions,preparedResources,trialPackVersions} from '../schema';
import {createHash} from 'node:crypto';
import {DefinitionSchema} from './room-definitions';
import {tokenMatches} from './guided-room-store';

// The session and pack-version rows serialize claims, including retries and expiry.
export async function claimPreparedResource(sessionId:string, packId:string, token:string, database= db) {
 return database.transaction(async tx=>{
  const [session]=await tx.select().from(guidedTrialSessions).where(and(eq(guidedTrialSessions.id,sessionId),eq(guidedTrialSessions.packId,packId))).for('update');
  if(!session || session.completedAt || !tokenMatches(token,session.accessTokenSha256,session.startedAt)) return null;
  if(createHash('sha256').update(session.definitionSnapshot).digest('hex')!==session.definitionSha256)return null;
  const parsed=DefinitionSchema.safeParse(JSON.parse(session.definitionSnapshot));
  if(!parsed.success || !parsed.data.preparedResource)return null;
  const version=Number(session.definitionVersion), minutes=parsed.data.preparedResource.allocationMinutes;
  if(!Number.isSafeInteger(version)||version<1)return null;
  await tx.select().from(trialPackVersions).where(and(eq(trialPackVersions.packId,packId),eq(trialPackVersions.version,version))).for('update');
  const now=new Date();
  // Retired identities remain attached to their session after expiry so a
  // retry can never silently provision a second identity.
  const [previousIdentity]=await tx.select().from(preparedResources).where(and(eq(preparedResources.assignedSessionId,sessionId),eq(preparedResources.kind,'identity'))).for('update');
  if(previousIdentity) return previousIdentity.expiresAt && previousIdentity.expiresAt>now ? previousIdentity : null;
  await tx.update(preparedResources).set({assignedSessionId:null,expiresAt:null,enabled:false}).where(and(eq(preparedResources.packId,packId),eq(preparedResources.packVersion,version),eq(preparedResources.kind,'environment'),lte(preparedResources.expiresAt,now)));
  const [existing]=await tx.select().from(preparedResources).where(and(eq(preparedResources.assignedSessionId,sessionId),gt(preparedResources.expiresAt,now)));
  if(existing)return existing;
  const [available]=await tx.select().from(preparedResources).where(and(eq(preparedResources.packId,packId),eq(preparedResources.packVersion,version),eq(preparedResources.enabled,true),eq(preparedResources.retired,false),isNull(preparedResources.assignedSessionId))).limit(1).for('update');
  if(!available)return null;
  const [assigned]=await tx.update(preparedResources).set({assignedSessionId:sessionId,expiresAt:new Date(now.getTime()+minutes*60000),...(available.kind==='identity'?{retired:true,enabled:false}:{})}).where(eq(preparedResources.id,available.id)).returning();
  return assigned;
 });
}

export async function getPreparedResource(sessionId:string, packId:string, token:string, database=db) {
 const [session]=await database.select().from(guidedTrialSessions).where(and(eq(guidedTrialSessions.id,sessionId),eq(guidedTrialSessions.packId,packId)));
 if(!session || !tokenMatches(token,session.accessTokenSha256,session.startedAt))return null;
 const version=Number(session.definitionVersion);
 const now=new Date();
 const [assigned]=await database.select().from(preparedResources).where(and(eq(preparedResources.assignedSessionId,sessionId),eq(preparedResources.packId,packId),eq(preparedResources.packVersion,version),gt(preparedResources.expiresAt,now)));
 const [retiredIdentity]=await database.select({id:preparedResources.id}).from(preparedResources).where(and(eq(preparedResources.assignedSessionId,sessionId),eq(preparedResources.kind,'identity'),eq(preparedResources.retired,true)));
 const available=await database.select({id:preparedResources.id}).from(preparedResources).where(and(eq(preparedResources.packId,packId),eq(preparedResources.packVersion,version),eq(preparedResources.enabled,true),eq(preparedResources.retired,false),isNull(preparedResources.assignedSessionId))).limit(1);
 return {assigned:assigned??null,available:available.length>0 && !retiredIdentity,expired:!!retiredIdentity && !assigned};
}
