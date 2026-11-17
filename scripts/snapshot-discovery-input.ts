import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {db} from '../lib/db';
import {candidateCapabilities,evidence,footprintObservations,intelligenceAssessments,opportunities,projects,signals,needItems,signalIntents,technicalFootprints,lifecycleEvidence,lifecycleVerificationRuns} from '../lib/schema';

const arg=(name:string)=>{const i=process.argv.indexOf(name);return i<0?undefined:process.argv[i+1]};
const sha=(value:string|Buffer)=>createHash('sha256').update(value).digest('hex');

async function main(){
 const output=arg('--out')??'evidence/needs-discovery-input-2026-11-17.json.gz';
 if(!/^evidence\/[A-Za-z0-9_.-]+\.json\.gz$/.test(output))throw Error('--out must be a .json.gz file under evidence/');
 const [projectRows,sourceSignals,sourceNeeds,intents,footprints,observations,opportunityRows,evidenceRows,capabilities,runs,lifecycle,assessments]=await Promise.all([
  db.select().from(projects),db.select().from(signals),db.select().from(needItems),db.select().from(signalIntents),db.select().from(technicalFootprints),db.select().from(footprintObservations),db.select().from(opportunities),db.select().from(evidence),db.select().from(candidateCapabilities),db.select().from(lifecycleVerificationRuns),db.select().from(lifecycleEvidence),db.select().from(intelligenceAssessments),
 ]);
 const stable=(rows:{id:string|number}[])=>rows.sort((a,b)=>String(a.id).localeCompare(String(b.id)));
 const payload={projects:stable(projectRows),signals:stable(sourceSignals),needItems:stable(sourceNeeds),signalIntents:stable(intents),technicalFootprints:stable(footprints),footprintObservations:stable(observations),opportunities:stable(opportunityRows),evidence:stable(evidenceRows),candidateCapabilities:stable(capabilities),lifecycleVerificationRuns:stable(runs),lifecycleEvidence:stable(lifecycle),intelligenceAssessments:stable(assessments)};
 const canonical=JSON.stringify(payload),inputSha256=sha(canonical);
 const artifact=JSON.stringify({schemaVersion:1,codeRevision:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),createdAt:new Date().toISOString(),inputSha256,counts:Object.fromEntries(Object.entries(payload).map(([key,value])=>[key,value.length])),input:payload});
 const compressed=gzipSync(Buffer.from(artifact),{level:9});
 await writeFile(output,compressed);
 console.log(JSON.stringify({output,bytes:compressed.length,inputSha256,counts:Object.fromEntries(Object.entries(payload).map(([key,value])=>[key,value.length]))},null,2));
 process.exit(0);
}
main().catch(error=>{console.error(error instanceof Error?error.message:String(error));process.exit(1)});
