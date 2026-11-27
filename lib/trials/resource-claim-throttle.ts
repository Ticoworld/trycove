import {createHmac} from 'node:crypto';
import {and,lte,sql} from 'drizzle-orm';
import {db} from '../db';
import {trialResourceClaimLimits} from '../schema';

export const TRIAL_RESOURCE_CLAIM_LIMIT=8;
export const TRIAL_RESOURCE_CLAIM_WINDOW_MS=10*60_000;

export async function consumeTrialResourceClaim(ip:string,packId:string,secret:string,database=db,now=new Date()) {
 if(secret.length<32)throw new Error('Trial claim throttling is not configured.');
 const bucketKey=createHmac('sha256',secret).update(`${packId}\n${ip}`).digest('hex');
 const cutoff=new Date(now.getTime()-TRIAL_RESOURCE_CLAIM_WINDOW_MS);
 return database.transaction(async tx=>{
  await tx.delete(trialResourceClaimLimits).where(lte(trialResourceClaimLimits.windowStartedAt,new Date(now.getTime()-24*60*60_000)));
  const [bucket]=await tx.insert(trialResourceClaimLimits).values({bucketKey,windowStartedAt:now,attempts:1})
   .onConflictDoUpdate({target:trialResourceClaimLimits.bucketKey,set:{
    windowStartedAt:sql`CASE WHEN ${trialResourceClaimLimits.windowStartedAt} <= ${cutoff} THEN ${now} ELSE ${trialResourceClaimLimits.windowStartedAt} END`,
    attempts:sql`CASE WHEN ${trialResourceClaimLimits.windowStartedAt} <= ${cutoff} THEN 1 ELSE LEAST(${trialResourceClaimLimits.attempts}+1,${TRIAL_RESOURCE_CLAIM_LIMIT+1}) END`,
   }}).returning({attempts:trialResourceClaimLimits.attempts});
  return bucket.attempts<=TRIAL_RESOURCE_CLAIM_LIMIT;
 });
}
