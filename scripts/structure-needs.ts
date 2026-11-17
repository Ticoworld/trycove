import {db} from '../lib/db';
import {needItems,signals} from '../lib/schema';
import {decomposeNeedSignals} from '../lib/intelligence/needs';

async function main(){
 const source=await db.select().from(signals);
 const items=decomposeNeedSignals(source);
 await db.transaction(async tx=>{
  await tx.delete(needItems);
  for(let i=0;i<items.length;i+=250){
   const batch=items.slice(i,i+250).map(x=>({id:x.id,signalId:x.signalId,projectId:x.projectId,sourceUrl:x.sourceUrl,revision:x.revision,observedAt:x.observedAt,excerpt:x.excerpt,category:x.category,stance:x.stance,verification:x.verification,extractionRule:x.rule,startOffset:x.startOffset,endOffset:x.endOffset}));
   if(batch.length)await tx.insert(needItems).values(batch);
  }
 });
 const categoryCounts=Object.fromEntries([...new Set(items.map(x=>x.category))].sort().map(category=>[category,items.filter(x=>x.category===category).length]));
 const stanceCounts=Object.fromEntries([...new Set(items.map(x=>x.stance))].sort().map(stance=>[stance,items.filter(x=>x.stance===stance).length]));
 console.log(JSON.stringify({inputSignals:source.length,eligibleSignals:source.filter(x=>['need','obstacle'].includes(x.kind)).length,needItems:items.length,projects:[...new Set(items.map(x=>x.projectId))].length,sources:[...new Set(items.map(x=>x.sourceUrl))].length,categoryCounts,stanceCounts},null,2));
 process.exit(0);
}
main().catch(error=>{console.error(error);process.exit(1)});
