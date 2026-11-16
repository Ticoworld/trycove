import {createHash} from 'node:crypto';

export type BlindEligible={projectId:string;name:string;needClaims:string[];footprints:{repository:string;revision:string;scope:string;observationCount:number}[]};
export const BLIND_SEED='trycove-blind-20261116';
export const BLIND_STRATA=[
 {name:'technical-integration',pattern:/\b(?:integration|integrate|SDK|API|wallet|address|transaction|RPC|resolver|adapter|signing|broadcast)\b/i},
 {name:'testing-and-reproduction',pattern:/\b(?:tester|testing|testnet|reproduc|audit|QA)\b/i},
 {name:'distribution-and-adoption',pattern:/\b(?:distribution|marketplace|listing|publish|launch|onboard|adoption|discoverability|demo|hosted deployment)\b/i},
 {name:'ecosystem-feedback-and-review',pattern:/\b(?:feedback|community|ecosystem|technical review|guidance|maintainer|reviewer|review)\b/i},
] as const;
const digest=(seed:string,id:string)=>createHash('sha256').update(`${seed}\0${id}`).digest('hex');
/** Pair-blind deterministic project sampling; no candidate pair or project identity is an input. */
export function selectBlindSample(input:BlindEligible[],seed=BLIND_SEED,size=8){
 if(!seed.trim()||!Number.isInteger(size)||size<1)throw Error('Seed and positive sample size are required');
 // Choose consumers from source-recorded needs before inspecting whether code
 // footprints are available. Requiring an existing footprint here would bias
 // the blind cohort toward repositories selected by prior investigators.
 const eligible=input.filter(x=>x.needClaims.length>0);
 const byId=new Map(eligible.map(x=>[x.projectId,x]));const selected=new Map<string,string>();
 for(const stratum of BLIND_STRATA){const row=eligible.filter(x=>x.needClaims.some(c=>stratum.pattern.test(c))).sort((a,b)=>digest(seed,a.projectId).localeCompare(digest(seed,b.projectId))||a.projectId.localeCompare(b.projectId))[0];if(row&&!selected.has(row.projectId))selected.set(row.projectId,stratum.name)}
 for(const row of eligible.sort((a,b)=>digest(seed,a.projectId).localeCompare(digest(seed,b.projectId))||a.projectId.localeCompare(b.projectId))){if(selected.size>=size)break;if(!selected.has(row.projectId))selected.set(row.projectId,'seed-fill')}
 const rows=[...selected].map(([projectId,stratum])=>({...byId.get(projectId)!,sampledFrom:stratum,strataMatched:BLIND_STRATA.filter(s=>byId.get(projectId)!.needClaims.some(c=>s.pattern.test(c))).map(s=>s.name),selectionDigest:digest(seed,projectId)})).sort((a,b)=>a.selectionDigest.localeCompare(b.selectionDigest));
 return {seed,size,eligibleProjectCount:eligible.length,strataCoverage:BLIND_STRATA.map(s=>({name:s.name,selectedProjects:rows.filter(x=>x.strataMatched.includes(s.name)).length})),selected:rows};
}
