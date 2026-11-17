import {createHash} from 'node:crypto';

export type NeedCategory='user-testing'|'validation'|'adoption'|'technical-review'|'security'|'product-feedback'|'integration'|'feature-request'|'infrastructure'|'distribution'|'unknown';
export type NeedStance='explicit-request'|'reported-obstacle'|'explicit-offer'|'roadmap'|'status-update'|'ambiguous';
export type NeedSignal={id:string;projectId:string;kind:string;claim:string;sourceUrl:string;revision:string;observedAt:Date;verification:string};
export type NeedItem={id:string;lineageKey:string;signalId:string;projectId:string;sourceUrl:string;revision:string;sourceClaim:string;observedAt:Date;excerpt:string;category:NeedCategory;stance:NeedStance;verification:string;rule:string;startOffset:number;endOffset:number};

const hash=(value:string)=>createHash('sha256').update(value).digest('hex');
const request=/\b(?:please|would you|could you|can you|anyone (?:able|willing)|looking for|seeking|we need|i need|need help|would appreciate|i'd appreciate|feedback (?:is )?welcome|try (?:it|this|the)|run it against|who would|which .* would|any suggestions|any advice|happy to (?:receive|hear))\b|\?(?:\s|$)/i;
const obstacle=/\b(?:not implemented|no (?:outside|external|real) (?:user|adoption|deployment)|does(?:n't| not) (?:yet )?(?:support|work|handle|verify)|cannot|can't|unable to|fails? (?:at|when|because)|blocked by|missing (?:a |the )?(?:capability|feature|support)|unsure whether|haven't been able to|not yet (?:available|supported|verified|tested)|challenge is|currently (?:runs|uses|lacks))\b/i;
const roadmap=/\b(?:roadmap|for v\d|planned feature|plan to|planning to|would like to|would (?:make|allow|enable)|want to|should (?:we|i|it)|considering (?:adding|building|implementing)|next (?:we|i|step|phase)|future (?:support|version)|we hope to|goal is to|first (?:real|outside) (?:user|use|adoption))\b/i;
const progress=/\b(?:released|shipped|implemented|added|completed|deployed|settled|works with)\b/i;
const humanOffer=/\b(?:happy to (?:jump on|help|set up|pair|test|review|audit)|i would set it up|i can (?:set up|help|review|run|test|audit|validate)|we can (?:set up|help|review|run|test|audit|validate)|offering to|available to (?:review|help|test|audit|validate)|i(?:'m| am) willing to (?:review|help|test|audit|validate))\b/i;

function splitQuestions(line:string,base:number){
 const parts=line.match(/[^?]+\?(?:\s|$)|[^?]+$/g);if(!parts||parts.length<2)return null;
 let cursor=0;const split:{text:string;start:number;end:number}[]=[];
 for(const part of parts){const at=line.indexOf(part,cursor);const text=part.trim();if(text)split.push({text,start:base+at,end:base+at+part.length});cursor=at+part.length}
 return split;
}

function fragments(claim:string):{text:string;start:number;end:number}[]{
 const lines=claim.split(/\n/);const result:{text:string;start:number;end:number}[]=[];let offset=0;let current:{text:string;start:number;end:number}|null=null;
 const flush=()=>{if(current&&current.text.trim())result.push({...current,text:current.text.trim()});current=null};
 for(const line of lines){
  const start=offset;offset+=line.length+1;const trimmed=line.trim();
  if(!trimmed){flush();continue}
  if(/^\s*(?:\|?\s*:?-{3,}:?\s*\|)+\s*$/.test(line)||/^\s*\|?\s*[-| ]+\s*\|\s*$/.test(line)){flush();continue}
  const marker=/^\s*(?:[-*+]\s+|\d+[.)]\s+|>\s?)/.test(line);
  // Headings ending in a colon provide context for the following extracted quote.
  if(!marker&&/^\s*(?:\*\*)?[^?\n]{2,90}(?:\*\*)?:\s*$/.test(line)){flush();continue}
  if(marker){flush();const split=splitQuestions(line,start);if(split)result.push(...split);else current={text:line,start,end:start+line.length};continue}
  if(current){current.text+=`\n${line}`;current.end=start+line.length;continue}
  // Keep free text intact unless it contains multiple explicit questions. This avoids
  // manufacturing sentence boundaries that could change the source claim's meaning.
  const questionParts=splitQuestions(line,start);
  if(questionParts)result.push(...questionParts);
  else current={text:line,start,end:start+line.length};
 }
 flush();
 return result.filter(x=>x.text.length>=14&&!/^\s*(?:\||#{1,6}\s|---|\*\*?source:)/i.test(x.text));
}

function categoryOf(text:string):NeedCategory{
 if(/\b(?:testers?|user testing|external testing|outside users? to test|recruit testers?)\b/i.test(text))return 'user-testing';
 if(/\b(?:no (?:outside|external|real) user|first real use|first real app using|first outside user|outside user for|looking for (?:an? )?(?:outside )?user|who would use|real app using|app to adopt|which (?:contract )?(?:apps?|projects?|repos?) would try)\b/i.test(text))return 'adoption';
 if(/\b(?:test (?:this|it|your|the)|try (?:this|it|the)|run it against|reproducible test|test case|validation|validate)\b/i.test(text))return 'validation';
 if(/\b(?:security|attack|threat model|trust model|custody|key theft|exploit|audit)\b/i.test(text))return 'security';
 if(/\b(?:review|reviewer|audit|architecture|architectural|design sound|sound (?:architecture|approach|design)|best practices?|guidance|advice|recommendation|how (?:should|could) (?:the )?(?:architecture|protocol|design|contract))\b/i.test(text))return 'technical-review';
 if(/\b(?:ux|user experience|usability|clear enough|easy to use|confusing|interface feedback|feature feedback|any feedback|feedback (?:is )?welcome|what(?:'s| is) missing|what .* make .* useful|which (?:interface|api|sdk|option|approach|pattern) would|would strengthen|features? or integrations? .* value)\b/i.test(text))return 'product-feedback';
 if(/\b(?:marketplace|distribution|listing|hosted(?: read-only)? demo|public demo|showcase|audience|promotion|find users)\b/i.test(text))return 'distribution';
 if(/\b(?:deploy(?:ment)?|host(?:ing)?|hosted environment|infrastructure|indexer|node|rpc|production environment|server|cloud)\b/i.test(text))return 'infrastructure';
 if(/\b(?:integrat(?:e|ion|ions|ing)|compatible with|connect(?:ion|ing)? to|api integration|sdk integration|cross[- ]project|interoperab(?:ility|le))\b/i.test(text))return 'integration';
 if(/\b(?:support(?:s|ed)? (?:for )?|api|sdk|contract|script|cell|wallet|transaction|on-chain|on chain|feature|implement|auth(?:entication)?|sign-in|add(?:ing)?|missing capability)\b/i.test(text))return 'feature-request';
 return 'unknown';
}
function stanceOf(text:string):NeedStance{
 const asks=request.test(text),offers=humanOffer.test(text);
 if(asks&&offers)return 'ambiguous';
 if(offers)return 'explicit-offer';
 if(asks)return 'explicit-request';
 if(obstacle.test(text))return 'reported-obstacle';
 if(roadmap.test(text))return 'roadmap';
 if(progress.test(text))return 'status-update';
 return 'ambiguous';
}

/** Extracts literal, independently reviewable statements from imported need/obstacle claims. */
export function decomposeNeedSignal(signal:NeedSignal):NeedItem[]{
 if(!['need','obstacle'].includes(signal.kind))return [];
 const occurrences=new Map<string,number>();
 return fragments(signal.claim).map(fragment=>{
  const category=categoryOf(fragment.text),stance=stanceOf(fragment.text),rule='needs-v1:literal-fragments;bounded-lexical-taxonomy';
  const occurrence=occurrences.get(fragment.text)??0;occurrences.set(fragment.text,occurrence+1);
  // The lineage follows a verbatim statement across source revisions; the row id
  // additionally identifies the revision and source span so history is append-only.
  const lineageKey=`${signal.sourceUrl}#need#${createHash('md5').update(fragment.text).digest('hex')}#${occurrence}`;
  const id=hash([lineageKey,signal.revision,String(fragment.start),String(fragment.end),rule].join('\0'));
  return{id,lineageKey,signalId:signal.id,projectId:signal.projectId,sourceUrl:signal.sourceUrl,revision:signal.revision,sourceClaim:signal.claim,observedAt:signal.observedAt,excerpt:fragment.text,category,stance,verification:`automated classification only; source claim remains unverified`,rule,startOffset:fragment.start,endOffset:fragment.end};
 });
}
export function decomposeNeedSignals(signals:NeedSignal[]):NeedItem[]{
 const rows=signals.flatMap(decomposeNeedSignal).sort((a,b)=>a.sourceUrl.localeCompare(b.sourceUrl)||a.startOffset-b.startOffset||a.signalId.localeCompare(b.signalId)||a.id.localeCompare(b.id));
 const occurrences=new Map<string,number>();
 return rows.map(item=>{
  const key=`${item.sourceUrl}#need#${createHash('md5').update(item.excerpt).digest('hex')}`,occurrence=occurrences.get(key)??0;occurrences.set(key,occurrence+1);
  const lineageKey=`${key}#${occurrence}`;const id=hash([lineageKey,item.revision,String(item.startOffset),String(item.endOffset),item.rule].join('\0'));
  return{...item,id,lineageKey};
 });
}
