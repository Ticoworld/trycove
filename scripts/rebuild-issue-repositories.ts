import {createHash} from 'node:crypto';
import {db} from '../lib/db';
import {projectRepositories,sourceRecords} from '../lib/schema';
import {extractRepositoryMentions} from '../lib/issues';
import {eq} from 'drizzle-orm';

async function main(){
 const records=await db.select().from(sourceRecords).where(eq(sourceRecords.source,'CKBuilder public issue'));
 let added=0;
 for(const record of records){
  const source=new URL(record.sourceUrl);
  if(source.hostname!=='github.com'||!/^\/Nervos-Community-Catalyst\/CKBuilder-projects\/issues\/\d+$/.test(source.pathname))continue;
  for(const mention of extractRepositoryMentions(record.raw)){
   const id=`project-repository-${createHash('sha256').update(`${record.projectId}\0${mention.repository}\0${record.sourceUrl}`).digest('hex').slice(0,32)}`;
   await db.insert(projectRepositories).values({id,projectId:record.projectId,repository:mention.repository,role:mention.role,sourceUrl:record.sourceUrl,revision:record.revision,verification:'issue author repository claim; not independently verified',observedAt:record.observedAt}).onConflictDoUpdate({target:projectRepositories.id,set:{role:mention.role,revision:record.revision,verification:'issue author repository claim; not independently verified',observedAt:record.observedAt}});
   added++;
  }
 }
 console.log(`Rebuilt ${added} source-backed repository associations from ${records.length} stored CKBuilder issues.`);
 process.exit(0);
}
main().catch(e=>{console.error(e);process.exit(1)});
