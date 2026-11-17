import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {rankControlIssueUrls} from '../lib/intelligence/prior-work';

const poolPath='evidence/tc-01d/candidate-pool-257ae9da5f65b7bd.json';
const sha=(value:string|Buffer)=>createHash('sha256').update(value).digest('hex');
async function main(){
 const poolBytes=await readFile(poolPath),pool=JSON.parse(poolBytes.toString('utf8'));
 if(pool.schemaVersion!==1||pool.candidates?.length!==10)throw new Error('The fixed original ten-candidate pool is required.');
 const snapshot=gunzipSync(await readFile(pool.inputSnapshot.path));
 if(sha(snapshot)!==pool.inputSnapshot.sha256)throw new Error('Frozen source snapshot does not match the original pool.');
 const data=JSON.parse(snapshot.toString('utf8'));
 const issueUrls=(data.input.activeNeedItems as Array<{sourceUrl?:string}>).map(item=>item.sourceUrl??'').filter(Boolean);
 const excluded=(pool.candidates as Array<{need:{sourceUrl:string}}>).map(row=>row.need.sourceUrl);
 const ranked=rankControlIssueUrls(issueUrls,excluded);
 if(ranked.length===0)throw new Error('No independent source issue remains for a control.');
 const report={schemaVersion:1,selectionMethod:'Before retrieving any control thread, rank distinct imported issue URLs not present in the fixed ten-candidate pool by SHA-256(seed + NUL + lowercase URL); select the first. This is a sampling rule, not a relevance or outcome filter.',seed:'tc-01d-r1-independent-control-v1',inputSnapshotSha256:pool.inputSnapshot.sha256,candidatePoolSha256:sha(poolBytes),excludedCandidateIssueCount:new Set(excluded).size,eligibleDistinctIssueCount:ranked.length,selected:ranked[0],rankedIssueUrls:ranked};
 const out='evidence/tc-01d-r1/control-selection.json';await mkdir('evidence/tc-01d-r1',{recursive:true});const bytes=Buffer.from(JSON.stringify(report,null,2)+'\n');await writeFile(out,bytes);await writeFile(`${out}.sha256`,`${sha(bytes)}  control-selection.json\n`);
 console.log(JSON.stringify({path:out,sha256:sha(bytes),eligible:ranked.length,selected:ranked[0]},null,2));
}
main().catch(error=>{console.error(error instanceof Error?error.stack??error.message:String(error));process.exit(1)});
