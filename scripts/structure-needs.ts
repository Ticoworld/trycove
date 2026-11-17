import {db} from '../lib/db';
import {needItems,signals} from '../lib/schema';
import {decomposeNeedSignals} from '../lib/intelligence/needs';
import {eq,inArray,sql} from 'drizzle-orm';

async function main(){
 const source=await db.select().from(signals);
 const latestByUrl=new Map<string,Date>();
 for(const row of source.filter(x=>['need','obstacle'].includes(x.kind))){const previous=latestByUrl.get(row.sourceUrl);if(!previous||row.observedAt>previous)latestByUrl.set(row.sourceUrl,row.observedAt)}
 const currentSignals=source.filter(row=>['need','obstacle'].includes(row.kind)&&latestByUrl.get(row.sourceUrl)?.getTime()===row.observedAt.getTime());
 const items=decomposeNeedSignals(currentSignals);
 const timestamp=new Date();
 await db.transaction(async tx=>{
  for(let i=0;i<items.length;i+=200){
   const rows=items.slice(i,i+200).map(x=>({id:x.id,lineageKey:x.lineageKey,signalId:x.signalId,projectId:x.projectId,sourceUrl:x.sourceUrl,revision:x.revision,sourceClaim:x.sourceClaim,observedAt:x.observedAt,excerpt:x.excerpt,category:x.category,stance:x.stance,verification:x.verification,extractionRule:x.rule,startOffset:x.startOffset,endOffset:x.endOffset,supersededAt:null,supersededBy:null}));
   if(rows.length)await tx.insert(needItems).values(rows).onConflictDoUpdate({target:needItems.id,set:{lineageKey:sql`excluded.lineage_key`,signalId:sql`excluded.signal_id`,projectId:sql`excluded.project_id`,sourceUrl:sql`excluded.source_url`,revision:sql`excluded.revision`,sourceClaim:sql`excluded.source_claim`,observedAt:sql`excluded.observed_at`,excerpt:sql`excluded.excerpt`,category:sql`excluded.category`,stance:sql`excluded.stance`,verification:sql`excluded.verification`,extractionRule:sql`excluded.extraction_rule`,startOffset:sql`excluded.start_offset`,endOffset:sql`excluded.end_offset`,supersededAt:null,supersededBy:null}});
  }
  const currentIds=new Set(items.map(x=>x.id));
  const replacementByLineage=new Map(items.map(x=>[x.lineageKey,x.id]));
  const sourceUrls=[...latestByUrl.keys()];
  for(let i=0;i<sourceUrls.length;i+=500){
   const rows=await tx.select().from(needItems).where(inArray(needItems.sourceUrl,sourceUrls.slice(i,i+500)));
   for(const previous of rows){if(currentIds.has(previous.id)||previous.supersededAt)continue;await tx.update(needItems).set({supersededAt:timestamp,supersededBy:replacementByLineage.get(previous.lineageKey)??null}).where(eq(needItems.id,previous.id));}
  }
 });
 const categoryCounts=Object.fromEntries([...new Set(items.map(x=>x.category))].sort().map(category=>[category,items.filter(x=>x.category===category).length]));
 const stanceCounts=Object.fromEntries([...new Set(items.map(x=>x.stance))].sort().map(stance=>[stance,items.filter(x=>x.stance===stance).length]));
 console.log(JSON.stringify({sourceSignals:source.length,currentNeedSignals:currentSignals.length,activeNeedItems:items.length,historicalRowsPreserved:true,projects:[...new Set(items.map(x=>x.projectId))].length,sources:[...new Set(items.map(x=>x.sourceUrl))].length,categoryCounts,stanceCounts},null,2));
 process.exit(0);
}
main().catch(error=>{console.error(error);process.exit(1)});
