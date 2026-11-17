import {createHash} from 'node:crypto';

export type HoldoutNeed={sourceUrl:string;category:string;stance:string};
export type HoldoutStratum='adoption'|'distribution'|'user-testing'|'validation'|'technical-review'|'security'|'integration'|'feature-request'|'product-feedback'|'unknown'|'ambiguous';
export type HoldoutSelection={seed:string;strata:Record<HoldoutStratum,{selectedIssue:string|null;eligibleIssueCount:number;items:number}>;selectedIssueUrls:string[];excludedFromProviderSearch:string[];selectionRule:string};
const strata:HoldoutStratum[]=['adoption','distribution','user-testing','validation','technical-review','security','integration','feature-request','product-feedback','unknown','ambiguous'];
const digest=(seed:string,stratum:HoldoutStratum,url:string)=>createHash('sha256').update(`${seed}\0${stratum}\0${url}`).digest('hex');

/** Select whole source URLs; no sibling statement from a selected issue can leak into provider search. */
export function selectNeedHoldout(items:HoldoutNeed[],seed:string):HoldoutSelection{
 const grouped=new Map<string,HoldoutNeed[]>();
 for(const item of items){if(!grouped.has(item.sourceUrl))grouped.set(item.sourceUrl,[]);grouped.get(item.sourceUrl)!.push(item)}
 const selectedIssueUrls:string[]=[],selectedSet=new Set<string>();
 const result={} as HoldoutSelection['strata'];
 for(const category of strata){
  const eligible=[...grouped.entries()].filter(([,rows])=>category==='ambiguous'?rows.some(x=>x.stance==='ambiguous'):rows.some(x=>x.category===category&&['explicit-request','reported-obstacle'].includes(x.stance)));
  eligible.sort(([a],[b])=>digest(seed,category,a).localeCompare(digest(seed,category,b))||a.localeCompare(b));
  const chosen=eligible.find(([url])=>selectedSet.has(url))?.[0]??eligible.find(([url])=>!selectedSet.has(url))?.[0]??null;
  if(chosen&&!selectedSet.has(chosen)){selectedIssueUrls.push(chosen);selectedSet.add(chosen)}
  const selectedItems=chosen?grouped.get(chosen)!.filter(x=>category==='ambiguous'?x.stance==='ambiguous':x.category===category&&['explicit-request','reported-obstacle'].includes(x.stance)).length:0;
  result[category]={selectedIssue:chosen,eligibleIssueCount:eligible.length,items:selectedItems};
 }
 const selectionRule='For each predeclared topic in fixed order, select the eligible source URL with the lowest SHA-256(seed + NUL + stratum + NUL + source URL). Reuse an already selected URL when it also covers a later stratum; otherwise select the lowest-hash URL not yet selected. Ambiguous coverage selects URLs containing an ambiguous statement. All statements from each selected URL are held out together; the same URL is excluded from provider signal search.';
 return{seed,strata:result,selectedIssueUrls,excludedFromProviderSearch:[...selectedIssueUrls],selectionRule};
}
