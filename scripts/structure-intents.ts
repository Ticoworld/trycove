import {db} from '../lib/db';
import {footprintObservations,signalIntents,signals} from '../lib/schema';
import {extractObservationIntents,extractSignalIntents} from '../lib/intelligence/intents';
import {isNotNull} from 'drizzle-orm';

async function main(){
 const [sourceSignals,observations]=await Promise.all([db.select().from(signals),db.select().from(footprintObservations)]);
 const derived=[...extractSignalIntents(sourceSignals),...extractObservationIntents(observations)];
 await db.delete(signalIntents).where(isNotNull(signalIntents.signalId));
 await db.delete(signalIntents).where(isNotNull(signalIntents.observationId));
 for(let i=0;i<derived.length;i+=250){const batch=derived.slice(i,i+250).map(x=>({id:x.id,signalId:x.signalId??null,observationId:x.observationId??null,projectId:x.projectId,direction:x.direction,intentType:x.intentType,scope:x.scope,extractionRule:x.extractionRule,verification:x.verification,sourceUrl:x.sourceUrl,revision:x.revision,observedAt:x.observedAt??new Date()}));if(batch.length)await db.insert(signalIntents).values(batch)}
 const counts=Object.fromEntries([...new Set(derived.map(x=>`${x.direction}:${x.intentType}:${x.scope}`))].sort().map(key=>[key,derived.filter(x=>`${x.direction}:${x.intentType}:${x.scope}`===key).length]));
 console.log(JSON.stringify({inputSignals:sourceSignals.length,inputObservations:observations.length,structuredIntents:derived.length,counts},null,2));process.exit(0)
}
main().catch(e=>{console.error(e);process.exit(1)});
