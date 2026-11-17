import {createHash} from 'node:crypto';
import {classifySignal,type IntentType,type SignalIntent} from './intents';
import type {NeedCategory,NeedStance} from './needs';

export type NeedItemSource={
 id:string;lineageKey:string;signalId:string|null;projectId:string;sourceUrl:string;revision:string;
 sourceClaim:string;excerpt:string;category:NeedCategory;stance:NeedStance;verification:string;
 extractionRule?:string;startOffset:number;endOffset:number;observedAt:Date;supersededAt?:Date|null;
};
export type InterpretedNeed=SignalIntent&{
 needItemId:string;lineageKey:string;sourceClaim:string;category:NeedCategory;stance:NeedStance;
 startOffset:number;endOffset:number;interpretationMethod:'bounded-scope-v2'|'explicit-human-category-v1';unresolvedContext:string[];
};
export type NeedRejection={needItemId:string;projectId:string;sourceUrl:string;revision:string;excerpt:string;category:NeedCategory;stance:NeedStance;reason:'superseded'|'non_actionable_stance'|'unknown_category'|'invalid_source'|'no_bounded_scope'|'mixed_offer_and_need';};

const actionableStances=new Set<NeedStance>(['explicit-request','reported-obstacle','explicit-offer']);
const usableCategories=new Set<NeedCategory>(['user-testing','validation','adoption','technical-review','security','product-feedback','integration','feature-request','infrastructure','distribution']);
const itemConcept=(category:NeedCategory)=>category==='technical-review'||category==='security'?'feedback-request':category==='product-feedback'?'feedback-request':category==='user-testing'||category==='validation'?'test-request':category==='adoption'||category==='distribution'?'adoption-request':'missing-capability';
const hash=(value:string)=>createHash('sha256').update(value).digest('hex');
const ckbContext=/\b(?:ckb|nervos|fiber|ckbuilder|cell|lock script|since field|ckb app|ckb dapp)\b/i;
const humanTypes:Partial<Record<NeedCategory,IntentType>>={'user-testing':'user-testing','validation':'validation','technical-review':'technical-review','security':'security-review','product-feedback':'product-feedback','adoption':'adoption','distribution':'distribution'};
const humanActivity:Partial<Record<NeedCategory,RegExp>>={
 'user-testing':/\b(?:test(?:er|ing)?|try|run|exercise)\b/i,
 validation:/\b(?:validat(?:e|ion)|verify|reproducib(?:le|ility)|test(?:ing)?)\b/i,
 'technical-review':/\b(?:review(?:er)?|architecture|architectural|guidance|advice|design)\b/i,
 security:/\b(?:security|audit|threat|attack|exploit|custody)\b/i,
 'product-feedback':/\b(?:feedback|ux|usability|user experience|what(?:'s| is) missing)\b/i,
 adoption:/\b(?:adopt(?:ion)?|users?|first real use|outside user|try the (?:tool|app|project))\b/i,
 distribution:/\b(?:distribut(?:e|ion)|promot(?:e|ion)|marketplace|listing|audience|find users)\b/i,
};
function genericHumanScope(item:NeedItemSource,direction:'need'|'offer'):{scope:string;intentType:IntentType;rule:string}|null{
 const intentType=humanTypes[item.category],activity=humanActivity[item.category];
 if(!intentType||!activity||!ckbContext.test(item.sourceClaim)||!activity.test(item.excerpt))return null;
 if(direction==='offer'&&item.stance!=='explicit-offer')return null;
 return{scope:`ckb-human-${intentType}`,intentType,rule:`need-item:explicit-human-${direction};category:${item.category};ckb-context-required;taxonomy:v1`};
}

/** Converts only active, actionable atomic claims with a bounded CKB scope. */
export function interpretNeedItem(item:NeedItemSource):{intent:InterpretedNeed|null;rejection:NeedRejection|null}{
 const reject=(reason:NeedRejection['reason'])=>({intent:null,rejection:{needItemId:item.id,projectId:item.projectId,sourceUrl:item.sourceUrl,revision:item.revision,excerpt:item.excerpt,category:item.category,stance:item.stance,reason}});
 if(item.supersededAt)return reject('superseded');
 if(!actionableStances.has(item.stance))return reject('non_actionable_stance');
 if(!usableCategories.has(item.category))return reject('unknown_category');
 if(item.endOffset<item.startOffset||item.startOffset<0||item.endOffset-item.startOffset<item.excerpt.length||!item.sourceClaim.slice(item.startOffset,item.endOffset).trim().includes(item.excerpt.trim()))return reject('invalid_source');
 const interpreted=classifySignal({id:item.id,projectId:item.projectId,kind:'need',concept:itemConcept(item.category),claim:item.excerpt,sourceUrl:item.sourceUrl,revision:item.revision,verification:item.verification,observedAt:item.observedAt});
 const direction=item.stance==='explicit-offer'?'offer':'need';
 if(interpreted&&interpreted.direction!==direction)return reject('mixed_offer_and_need');
 const generic=interpreted?null:genericHumanScope(item,direction);
 if(!interpreted&&!generic)return reject('no_bounded_scope');
 const base:SignalIntent=interpreted??{
  id:item.id,projectId:item.projectId,direction,intentType:humanTypes[item.category]!,scope:generic!.scope,
  extractionRule:generic!.rule,verification:'automated category and explicit-offer interpretation; source claim unverified',
  sourceUrl:item.sourceUrl,revision:item.revision,observedAt:item.observedAt,claim:item.excerpt,signalKind:'need_item',
 };
 const intent:InterpretedNeed={...base,id:hash(`${item.id}\0${base.extractionRule}`),signalId:undefined,needItemId:item.id,lineageKey:item.lineageKey,sourceClaim:item.sourceClaim,category:item.category,stance:item.stance,startOffset:item.startOffset,endOffset:item.endOffset,interpretationMethod:generic?'explicit-human-category-v1':'bounded-scope-v2',unresolvedContext:['Automated lexical interpretation; builder intent and current applicability are unverified.','The exact source atom may omit surrounding context; inspect the parent source claim before action.']};
 return{intent,rejection:null};
}

export function interpretNeedItems(items:NeedItemSource[]){
 const intents:InterpretedNeed[]=[],rejections:NeedRejection[]=[];
 for(const item of items){const result=interpretNeedItem(item);if(result.intent)intents.push(result.intent);else if(result.rejection)rejections.push(result.rejection)}
 intents.sort((a,b)=>a.id.localeCompare(b.id));rejections.sort((a,b)=>a.needItemId.localeCompare(b.needItemId));
 return{intents,rejections};
}

export function needIntentType(intent:InterpretedNeed):IntentType{return intent.intentType}
