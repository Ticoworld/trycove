import {readFile,writeFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {selectNeedHoldout} from '../lib/intelligence/need-holdout';

async function main(){
 const snapshotPath='evidence/needs-discovery-input-2026-11-17.json.gz';
 const snapshot=JSON.parse(gunzipSync(await readFile(snapshotPath)).toString('utf8'));
 const needs=snapshot.input.needItems;
 const selection=selectNeedHoldout(needs,'trycove-2b1-heldout-v1');
 const selected=new Set(selection.selectedIssueUrls);
 const issues=selection.selectedIssueUrls.map(sourceUrl=>({sourceUrl,projects:[...new Set(snapshot.input.signals.filter((s:any)=>s.sourceUrl===sourceUrl).map((s:any)=>s.projectId))].sort(),signalIds:snapshot.input.signals.filter((s:any)=>s.sourceUrl===sourceUrl).map((s:any)=>s.id).sort(),needItemIds:needs.filter((n:any)=>n.sourceUrl===sourceUrl).map((n:any)=>n.id).sort(),needItemCount:needs.filter((n:any)=>n.sourceUrl===sourceUrl).length}));
 const manifest={schemaVersion:1,createdAt:new Date().toISOString(),codeBaseline:snapshot.codeRevision,inputSha256:snapshot.inputSha256,inputFile:snapshotPath,seed:selection.seed,unit:'whole source URL / issue',selectionRule:selection.selectionRule,strata:selection.strata,selectedIssueUrls:selection.selectedIssueUrls,excludedFromProviderSearch:selection.excludedFromProviderSearch,issues,heldoutNeedItemCount:needs.filter((n:any)=>selected.has(n.sourceUrl)).length,limitations:['Topic labels are deterministic automated interpretations; source truth was not independently annotated before selection.','No imported atomic item was categorized as user-testing. The validation stratum is included as a technical testing proxy; tester-room demand is not evaluated.','A selected issue is entirely held out; all its signal and need rows are excluded from provider matching.']};
 const output='evidence/needs-discovery-heldout-2026-11-17.json';
 await writeFile(output,JSON.stringify(manifest,null,2)+'\n');
 console.log(JSON.stringify({output,selectedIssues:issues.length,heldoutNeedItemCount:manifest.heldoutNeedItemCount,selectedIssueUrls:selection.selectedIssueUrls,strata:selection.strata},null,2));
}
main().catch(error=>{console.error(error instanceof Error?error.message:String(error));process.exit(1)});
