import {describe,it,expect} from 'vitest';
import {decomposeNeedSignal,type NeedSignal} from '../lib/intelligence/needs';
import {interpretNeedItems} from '../lib/intelligence/need-discovery';
import {classifySignal,discoverIntentCandidates,extractSignalIntents} from '../lib/intelligence/intents';

const source=(x:Partial<NeedSignal>={}):NeedSignal=>({id:'issue-1-signal',projectId:'consumer',kind:'need',claim:'The application parses usernames and wallet addresses.\n- Please review the security of CKB wallet recovery before mainnet.',sourceUrl:'https://github.com/org/repo/issues/1',revision:'a'.repeat(40),observedAt:new Date('2026-11-17T00:00:00Z'),verification:'issue author claim; unverified',...x});

describe('atomic builder-need discovery bridge',()=>{
 it('changes a mixed source claim into a separate, source-traceable human review decision',()=>{
  const consumer=source(),oldNeed=classifySignal({id:consumer.id,projectId:consumer.projectId,kind:consumer.kind,concept:'feedback-request',claim:consumer.claim,sourceUrl:consumer.sourceUrl,revision:consumer.revision,verification:consumer.verification});
  const provider=source({id:'issue-2-signal',projectId:'reviewer',sourceUrl:'https://github.com/org/reviewer/issues/2',claim:'Happy to review the security of CKB wallet recovery for builders preparing a testnet release.'});
  const offerSignal=classifySignal({id:provider.id,projectId:provider.projectId,kind:provider.kind,concept:'feedback-request',claim:provider.claim,sourceUrl:provider.sourceUrl,revision:provider.revision,verification:provider.verification});
  const oldCandidates=discoverIntentCandidates([...(oldNeed?[oldNeed]:[]),...(offerSignal?[offerSignal]:[])]);
  const consumerItems=decomposeNeedSignal(consumer),providerItems=decomposeNeedSignal(provider);
  const interpreted=interpretNeedItems([...consumerItems,...providerItems]);
  const candidates=discoverIntentCandidates(interpreted.intents);
  expect(oldNeed?.scope).toBe('ckb-username-to-address-resolution');
  expect(oldCandidates).toHaveLength(0);
  expect(candidates).toHaveLength(1);
  expect(candidates[0]).toMatchObject({relation:'explicit-offer',scope:'ckb-human-security-review',intentType:'security-review'});
  expect(candidates[0].need).toMatchObject({needItemId:consumerItems[1].id,claim:consumerItems[1].excerpt,sourceUrl:consumer.sourceUrl,revision:consumer.revision,startOffset:consumerItems[1].startOffset,endOffset:consumerItems[1].endOffset});
  expect(candidates[0].provider.needItemId).toBe(providerItems[0].id);
  expect(consumer.claim.slice(candidates[0].need.startOffset!,candidates[0].need.endOffset!).trim()).toBe(candidates[0].need.claim);
 });

 it('accepts a human test offer without code observations and rejects unmatched capability claims',()=>{
  const need=source({id:'need',projectId:'app',claim:'I am looking for testers for my CKB dapp before testnet release.',sourceUrl:'https://github.com/org/app/issues/3'});
  const offer=source({id:'offer',projectId:'tester',claim:'Happy to test your CKB dapp and file reproducible issues.',sourceUrl:'https://github.com/org/tester/issues/4'});
  const capability=source({id:'cap',projectId:'tool',kind:'capability',claim:'A browser utility can test applications.',sourceUrl:'https://github.com/org/tool/issues/5'});
  const items=[...decomposeNeedSignal(need),...decomposeNeedSignal(offer),...decomposeNeedSignal(capability)];
  const interpreted=interpretNeedItems(items);
  expect(discoverIntentCandidates(interpreted.intents)).toMatchObject([{relation:'explicit-offer',intentType:'user-testing',scope:'ckb-external-user-testing'}]);
  expect(interpreted.intents.some(x=>x.projectId==='tool')).toBe(false);
  // No footprint input exists in this workflow; only explicit human evidence is used.
 });

 it('abstains on roadmap, status, ambiguous text, scope mismatch and shared generic terms',()=>{
  const needs=source({id:'need',projectId:'consumer',claim:'We plan to add wallet support for CKB apps next year.\nThe product is part of the broader CKB ecosystem.\nReleased the wallet UI last week.',sourceUrl:'https://github.com/org/repo/issues/6'});
  const providers=source({id:'provider',projectId:'provider',claim:'Happy to review CKB security and audit a lock script.',sourceUrl:'https://github.com/org/provider/issues/7'});
  const interpreted=interpretNeedItems([...decomposeNeedSignal(needs),...decomposeNeedSignal(providers)]);
  expect(interpreted.intents.filter(x=>x.projectId==='consumer')).toHaveLength(0);
  expect(interpreted.rejections.some(x=>x.reason==='non_actionable_stance')).toBe(true);
  const broadNeed=source({id:'broad',projectId:'broad',claim:'Please review the wallet and transaction experience for CKB users.',sourceUrl:'https://github.com/org/broad/issues/8'});
  const techOffer=source({id:'tech',projectId:'tech',claim:'Happy to audit security for CKB smart contracts.',sourceUrl:'https://github.com/org/tech/issues/9'});
  const broad=interpretNeedItems([...decomposeNeedSignal(broadNeed),...decomposeNeedSignal(techOffer)]);
  expect(discoverIntentCandidates(broad.intents)).toHaveLength(0);
 });

 it('does not use a deleted signal link as a reason to lose the preserved source atom',()=>{
  const rows=decomposeNeedSignal(source());
  const derived=interpretNeedItems(rows.map(row=>({...row,signalId:null})));
  expect(derived.intents.some(x=>x.sourceClaim===source().claim&&x.needItemId===rows[1].id)).toBe(true);
 });
});
