import {describe,it,expect} from 'vitest';
import {decomposeNeedSignal,decomposeNeedSignals,type NeedSignal} from '../lib/intelligence/needs';

const signal=(x:Partial<NeedSignal>={}):NeedSignal=>({id:'issue:1',projectId:'project-a',kind:'need',claim:'Please review the design.',sourceUrl:'https://github.com/org/repo/issues/1',revision:'a'.repeat(40),observedAt:new Date('2026-11-14T00:00:00Z'),verification:'issue author claim; unverified',...x});

describe('source-backed builder need decomposition',()=>{
 it('splits distinct list items and labels review, testing and distribution requests separately',()=>{
  const claim='**Review:**\n- Please review whether the TEE trust model is sound.\n- Please test the browser flow on Safari.\n- A hosted read-only demo would make it easier to try.';
  const items=decomposeNeedSignal(signal({claim}));
  expect(items.map(x=>[x.category,x.stance])).toEqual([
   ['security','explicit-request'],['validation','explicit-request'],['distribution','roadmap'],
  ]);
  expect(items.every(x=>claim.slice(x.startOffset,x.endOffset).trim()===x.excerpt)).toBe(true);
  expect(items.every(x=>x.sourceUrl===signal().sourceUrl&&x.revision===signal().revision)).toBe(true);
 });

 it('keeps broad language and unclear status visibly unknown instead of inventing a technical scope',()=>{
  const [item]=decomposeNeedSignal(signal({claim:'The community is important to our project and we welcome everyone.'}));
  expect(item).toMatchObject({category:'unknown',stance:'ambiguous'});
 });

 it('distinguishes an explicit user request from a reported implementation obstacle and roadmap item',()=>{
  const items=decomposeNeedSignal(signal({claim:'Please test the install flow.\n- The demo does not yet support public sign-in.\n- For v2, we plan to add a read-only hosted environment.'}));
  expect(items.map(x=>x.stance)).toEqual(['explicit-request','reported-obstacle','roadmap']);
  expect(items[1].category).toBe('feature-request');
  expect(items[2].category).toBe('infrastructure');
 });

 it('does not treat capability and status records as builder needs',()=>{
  const claims=[signal({kind:'capability'}),signal({kind:'status'})];
  expect(decomposeNeedSignals(claims)).toEqual([]);
 });

 it('is deterministic and separates multi-question statements without losing source text',()=>{
  const source=signal({claim:'Would you review the security model? Could a tester try the CKB app?' });
  const first=decomposeNeedSignal(source),second=decomposeNeedSignal(source);
  expect(first.map(x=>x.id)).toEqual(second.map(x=>x.id));
  expect(first.map(x=>x.excerpt)).toEqual(['Would you review the security model?','Could a tester try the CKB app?']);
  expect(first.map(x=>source.claim.slice(x.startOffset,x.endOffset).trim())).toEqual(first.map(x=>x.excerpt));
 });

 it('identifies requests for real outside use separately from usability testing and feature requests',()=>{
  const items=decomposeNeedSignal(signal({claim:'1. Which contract repos would try the PR Action?\n2. Please test the browser flow on Safari.\n3. The app needs support for sign-in wallets.'}));
  expect(items.map(x=>x.category)).toEqual(['adoption','validation','feature-request']);
  expect(items.map(x=>x.stance)).toEqual(['explicit-request','explicit-request','ambiguous']);
 });

 it('splits multiple questions within one bullet while retaining each exact source span',()=>{
  const claim='- Would you review the lock design? Could a tester try the CKB app?';
  const items=decomposeNeedSignal(signal({claim}));
  expect(items.map(x=>x.excerpt)).toEqual(['- Would you review the lock design?','Could a tester try the CKB app?']);
  expect(items.every(x=>claim.slice(x.startOffset,x.endOffset).trim()===x.excerpt)).toBe(true);
 });

 it('does not turn broad architecture review or ecosystem feedback questions into integration offers',()=>{
  const items=decomposeNeedSignal(signal({claim:'- Is the separation between on-chain contracts and off-chain verification a sound architectural approach?\n- Are there features or integrations that would strengthen the project value?'}));
  expect(items.map(x=>[x.category,x.stance])).toEqual([
   ['technical-review','explicit-request'],['product-feedback','explicit-request'],
  ]);
 });
});
