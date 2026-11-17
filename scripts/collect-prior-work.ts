import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {collectCandidatePriorWork,PriorWorkCollectionSchema} from '../lib/intelligence/prior-work';

const sha=(value:string|Buffer)=>createHash('sha256').update(value).digest('hex');
const stamp=(iso:string)=>iso.replace(/[-:]/g,'').replace(/\.\d{3}Z$/,'Z');
async function main(){
 const poolPath=process.argv[2]??'evidence/tc-01d/candidate-pool-257ae9da5f65b7bd.json';
 const controlPath=process.argv[3]??'evidence/tc-01d-r1/control-selection.json';
 const [poolBytes,controlBytes]=await Promise.all([readFile(poolPath),readFile(controlPath)]);
 const pool=JSON.parse(poolBytes.toString('utf8')),control=JSON.parse(controlBytes.toString('utf8'));
 if(pool.schemaVersion!==1||pool.candidates?.length!==10||control.schemaVersion!==1||control.inputSnapshotSha256!==pool.inputSnapshot.sha256||control.candidatePoolSha256!==sha(poolBytes))throw new Error('The frozen TC-01D pool and preselected independent control must match.');
 const threadUrls=[...new Set([...pool.candidates.map((row:any)=>row.need.sourceUrl),control.selected.url])];
 if(threadUrls.length>12)throw new Error('Issue-thread cap exceeded.');
 const token=process.env.GH_TOKEN?.trim()||execFileSync('gh',['auth','token'],{encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim();
 if(!token)throw new Error('No authenticated GitHub read token is available.');
 const checkedAt=new Date().toISOString();
 const report=PriorWorkCollectionSchema.parse(await collectCandidatePriorWork({issueUrls:threadUrls,token,checkedAt}));
 const outDir='evidence/tc-01d-r1';await mkdir(outDir,{recursive:true});
 const name=`source-collection-${stamp(checkedAt)}.json`,out=join(outDir,name),bytes=Buffer.from(JSON.stringify(report,null,2)+'\n');
 await writeFile(out,bytes,{flag:'wx',mode:0o644});await writeFile(`${out}.sha256`,`${sha(bytes)}  ${name}\n`,{flag:'wx',mode:0o644});
 console.log(JSON.stringify({path:out,sha256:sha(bytes),checkedAt,issues:report.issueThreads.map(x=>({url:x.canonicalUrl,requestedUrl:x.requestedUrl,repositoryId:x.repository.repositoryId,canonicalRepository:x.repository.canonicalFullName,commentsStatus:x.commentsStatus,comments:x.comments.length,failures:x.failures.length})),pullRequests:report.pullRequests.map(x=>({url:x.canonicalUrl,state:x.state,merged:x.merged,headSha:x.headSha,files:x.files.length,filesStatus:x.filesStatus})),referencedRepositories:report.referencedRepositories.map(x=>({sourceUrl:x.sourceUrl,canonicalUrl:x.identity.canonicalUrl,repositoryId:x.identity.repositoryId})),failures:report.failures},null,2));
}
main().catch(error=>{console.error(error instanceof Error?error.stack??error.message:String(error));process.exit(1)});
