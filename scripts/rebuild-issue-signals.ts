import {createHash} from 'node:crypto';
import {like} from 'drizzle-orm';
import {db} from '../lib/db';
import {signals,sourceRecords} from '../lib/schema';
import {extractIssueSignals} from '../lib/issues';

async function main(){
 const records=await db.select().from(sourceRecords);let rebuilt=0,totalSignals=0;
 for(const row of records.filter(x=>x.source==='CKBuilder public issue')){
  const number=Number(new URL(row.sourceUrl).pathname.split('/').at(-1));if(!Number.isSafeInteger(number)||number<1)continue;
  const values=extractIssueSignals({number,title:'Imported CKBuilder issue',body:row.raw,updatedAt:row.revision,url:row.sourceUrl});
  await db.delete(signals).where(like(signals.id,`issue-${number}-%`));
  for(const signal of values){const suffix=createHash('sha256').update(`${signal.kind}\0${signal.concept}\0${signal.claim}`).digest('hex').slice(0,16);await db.insert(signals).values({id:`issue-${number}-${suffix}`,projectId:row.projectId,...signal,sourceUrl:row.sourceUrl,revision:row.revision,verification:'issue author claim; unverified',observedAt:row.observedAt}).onConflictDoNothing();totalSignals++}
  rebuilt++;
 }
 console.log(JSON.stringify({issuesRebuilt:rebuilt,signals:totalSignals,source:'stored CKBuilder issue records; no network access'}));process.exit(0)
}
main().catch(error=>{console.error(error);process.exit(1)});
