import {createHmac} from 'node:crypto';
import {eq,lte,sql} from 'drizzle-orm';
import {db} from '../db';
import {trialResourceClaimLimits,preparedResources} from '../schema';

export const TRIAL_RESOURCE_CLAIM_LIMIT=1;
export const TRIAL_RESOURCE_CLAIM_WINDOW_MS=10*60_000;

export async function consumeTrialResourceClaim(ip:string,packId:string,secret:string,database=db,now=new Date()) {
 if(secret.length<32)throw new Error('Trial claim throttling is not configured.');
 const bucketKey=createHmac('sha256',secret).update(`${packId}\n${ip}`).digest('hex');
 const cutoff=new Date(now.getTime()-TRIAL_RESOURCE_CLAIM_WINDOW_MS);
 return database.transaction(async tx=>{
  const configured=Number(process.env.TRYCOVE_RESOURCE_CLAIM_LIMIT ?? TRIAL_RESOURCE_CLAIM_LIMIT);
  const requested=Number.isInteger(configured)&&configured>=1&&configured<=100?configured:TRIAL_RESOURCE_CLAIM_LIMIT;
  const [pool]=await tx.select({size:sql<number>`count(*)::int`}).from(preparedResources).where(eq(preparedResources.packId,packId));
  const limit=Math.min(requested,Math.max(1,Math.floor(Number(pool.size)/3)));
  await tx.delete(trialResourceClaimLimits).where(lte(trialResourceClaimLimits.windowStartedAt,new Date(now.getTime()-24*60*60_000)));
  const [bucket]=await tx.insert(trialResourceClaimLimits).values({bucketKey,windowStartedAt:now,attempts:1})
   .onConflictDoUpdate({target:trialResourceClaimLimits.bucketKey,set:{
    windowStartedAt:sql`CASE WHEN ${trialResourceClaimLimits.windowStartedAt} <= ${cutoff} THEN ${now} ELSE ${trialResourceClaimLimits.windowStartedAt} END`,
    attempts:sql`CASE WHEN ${trialResourceClaimLimits.windowStartedAt} <= ${cutoff} THEN 1 ELSE LEAST(${trialResourceClaimLimits.attempts}+1,${limit+1}) END`,
   }}).returning({attempts:trialResourceClaimLimits.attempts});
  return bucket.attempts<=limit;
 });
}
