import {count,isNull,isNotNull} from 'drizzle-orm';
import {db} from '../lib/db';
import {evidence,needItems,signalIntents} from '../lib/schema';

async function main(){
 const [[allItems],[activeItems],[supersededItems],[itemsWithSignal],[intentTotal],[atomicIntents],[evidenceTotal],[atomicEvidence]] = await Promise.all([
  db.select({count:count()}).from(needItems),
  db.select({count:count()}).from(needItems).where(isNull(needItems.supersededAt)),
  db.select({count:count()}).from(needItems).where(isNotNull(needItems.supersededAt)),
  db.select({count:count()}).from(needItems).where(isNotNull(needItems.signalId)),
  db.select({count:count()}).from(signalIntents),
  db.select({count:count()}).from(signalIntents).where(isNotNull(signalIntents.needItemId)),
  db.select({count:count()}).from(evidence),
  db.select({count:count()}).from(evidence).where(isNotNull(evidence.needItemId)),
 ]);
 const result={needItems:{total:allItems.count,active:activeItems.count,superseded:supersededItems.count,retainedSignalLinks:itemsWithSignal.count},intents:{total:intentTotal.count,atomicNeedLinks:atomicIntents.count},evidence:{total:evidenceTotal.count,atomicNeedLinks:atomicEvidence.count}};
 console.log(JSON.stringify(result,null,2));
 if(result.needItems.active<1||result.needItems.total!==result.needItems.active+result.needItems.superseded)throw new Error('Need history counts are inconsistent');
 process.exit(0);
}
main().catch(error=>{console.error(error);process.exit(1)});
