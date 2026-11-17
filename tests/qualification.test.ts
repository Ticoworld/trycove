import {describe,it,expect} from 'vitest';
import {buildQualificationPool,aggregateQualificationOutcome,enforceQualificationGates,type QualificationNeed,type QualificationMatch} from '../lib/intelligence/qualification';
import type {SignalIntent} from '../lib/intelligence/intents';

const need=(id:string,project:string,type:QualificationNeed['intentType'],date:string,source='https://github.com/org/repo/issues/1'):QualificationNeed=>({
 id,needItemId:id,lineageKey:`lineage-${id}`,projectId:project,direction:'need',intentType:type,scope:`ckb-${type}`,extractionRule:'fixture-only',verification:'imported fixture claim; unverified',sourceUrl:source,revision:date,claim:`Please review the specific CKB ${type.replaceAll('-',' ')} requirement for this project.`,signalKind:'need_item',sourceClaim:`Parent source claim: ${type}`,category:type,stance:'explicit-request',startOffset:0,endOffset:100,
});
const provider=(project:string,type:SignalIntent['intentType'],source='https://github.com/org/provider/issues/2'):SignalIntent=>({id:`provider-${project}`,projectId:project,direction:'offer',intentType:type,scope:'ckb-technical-review',extractionRule:'fixture-only',verification:'public offer; current availability unverified',sourceUrl:source,revision:'2026-04-28T00:00:00Z',claim:'Happy to review this technical issue for CKB builders.',signalKind:'need_item'});

describe('TC-01D opportunity qualification',()=>{
 it('builds a deterministic bounded pool from engine output and diverse unmatched needs without pair rules',()=>{
  const latest=need('latest','left','technical-integration','2026-11-11T10:00:00Z','https://github.com/org/left/issues/6');
  const older=need('older','other-left','security-review','2026-11-01T00:00:00Z','https://github.com/org/other/issues/3');
  const matched=need('matched','consumer','technical-review','2026-08-03T00:00:00Z','https://github.com/org/consumer/issues/4');
  const offer=provider('reviewer','technical-review');
  const match:QualificationMatch={id:'match-1',need:matched,provider:offer,relation:'explicit-offer',source:'structured_match',scope:matched.scope,intentType:matched.intentType};
  const inputs={needs:[latest,older,matched],matches:[match],providerIntents:[offer,provider('other-provider','security-review')]};
  const first=buildQualificationPool(inputs),again=buildQualificationPool(inputs);
  expect(first).toEqual(again);expect(first).toHaveLength(3);
  expect(first.some(x=>x.id===match.id)).toBe(false);
  expect(first.find(x=>x.need.needItemId==='latest')?.source).toBe('unmatched_need');
  expect(first.find(x=>x.need.needItemId==='latest')?.provider).toBeUndefined();
  expect(first.find(x=>x.need.needItemId==='latest')?.selectionReason).toContain('technical integration');
 });

 it('keeps a same-scope human offer as a recorded engine rejection when the activity types differ',()=>{
  const p=provider('reviewer','technical-review');
  const n={...need('need','consumer','technical-integration','2026-11-11T00:00:00Z'),scope:p.scope};
  const row=buildQualificationPool({needs:[n],matches:[],providerIntents:[p]})[0];
  expect(row.provider).toBeUndefined();
  expect(row.rejectedAlternatives).toEqual([expect.objectContaining({providerProjectId:'reviewer',reason:'offer_type_mismatch'})]);
 });

 it('keeps separate atomic needs from one issue distinct in the review pool',()=>{
  const issue='https://github.com/org/builder/issues/6';
  const architecture=need('architecture','builder','technical-review','2026-11-11T00:00:00Z',issue);
  const indexing=need('indexing','builder','technical-integration','2026-11-11T00:00:00Z',issue);
  const rows=buildQualificationPool({needs:[architecture,indexing],matches:[],providerIntents:[]});
  expect(rows.map(x=>x.need.needItemId).sort()).toEqual(['architecture','indexing']);
  expect(rows.every(x=>x.need.sourceUrl===issue&&x.need.sourceClaim.includes(x.need.needItemId==='architecture'?'technical-review':'technical-integration'))).toBe(true);
 });

 it('keeps human review, user testing and distribution needs without requiring code footprints or a code provider',()=>{
  const needs=[need('review','reviewer-needed','technical-review','2026-11-11T00:00:00Z','https://github.com/org/review/issues/1'),need('testers','tester-needed','user-testing','2026-11-12T00:00:00Z','https://github.com/org/test/issues/2'),need('reach','audience-needed','distribution','2026-11-13T00:00:00Z','https://github.com/org/distribution/issues/3')];
  const rows=buildQualificationPool({needs,matches:[],providerIntents:[]});
  expect(rows).toHaveLength(3);expect(rows.every(x=>x.source==='unmatched_need'&&!x.provider)).toBe(true);
  expect(rows.map(x=>x.intentType).sort()).toEqual(['distribution','technical-review','user-testing']);
 });

 it('does not qualify an old unconfirmed human offer, an already demonstrated capability, or a partial fit',()=>{
  const base={candidateId:'candidate',proposedOutcome:'QUALIFIED' as const,currentNeed:'confirmed_unresolved' as const,sourceFreshness:'current' as const,fit:'specific' as const,providerKind:'human_offer' as const,providerAvailability:'unconfirmed' as const,priorWork:'none_found' as const,rationale:'The sources describe an unresolved, bounded builder problem and a relevant historical offer.',value:'A focused review could give the builder an actionable production design.',participation:'The builder shares the current design; a reviewer would inspect the source and return findings.',experiment:'Run a 30-minute architecture review with a written checklist and no code changes.',successCriteria:['A documented architecture decision and unresolved risk list'],alternatives:[{name:'Use existing project documentation',evidenceUrl:'https://github.com/org/docs',finding:'Docs are available but do not confirm the project-specific design.'}],unknowns:['Current offer availability has not been reconfirmed.'],nextAction:'Ask the user whether to approve a reconfirmation request.',evidence:[{sourceUrl:'https://github.com/org/app/issues/6',revision:'2026-11-11T00:00:00Z',excerpt:'Please advise on production architecture.',evidenceType:'builder_need' as const,verification:'Imported source claim; current applicability checked.'},{sourceUrl:'https://github.com/org/reviewer/issues/12',revision:'2026-04-28T00:00:00Z',excerpt:'Happy to review indexing needs.',evidenceType:'provider_offer' as const,verification:'Historical offer; availability unconfirmed.'}]};
  expect(enforceQualificationGates(base).outcome).toBe('NEEDS_CONFIRMATION');
  expect(enforceQualificationGates({...base,providerAvailability:'confirmed',priorWork:'exact_capability_demonstrated'}).outcome).toBe('ALREADY_ADDRESSED');
  expect(enforceQualificationGates({...base,providerAvailability:'confirmed',fit:'partial'}).outcome).toBe('NEEDS_CONFIRMATION');
 });

 it('blocks unsupported, providerless, and source-unavailable actions while retaining a legitimate no-pilot outcome',()=>{
  const base={candidateId:'gap',proposedOutcome:'QUALIFIED' as const,currentNeed:'confirmed_unresolved' as const,sourceFreshness:'current' as const,fit:'specific' as const,providerKind:'none' as const,providerAvailability:'not_applicable' as const,priorWork:'none_found' as const,rationale:'The source records a concrete need but the inventory has no suitable provider evidence.',value:'A correct provider could remove a defined implementation or validation burden.',participation:'The builder would first confirm the unresolved requirement; no outside participant is represented.',experiment:'Write a one-page requirements brief and use it to search for a provider through human review.',successCriteria:['The requirement is confirmed by the builder','A provider has source evidence for the required expertise'],alternatives:[{name:'Proceed without an introduction',finding:'This avoids presenting an unsupported provider.'}],unknowns:['No provider offer or specific capability has been established.'],nextAction:'Confirm the requirement and identify evidence-backed providers before proposing outreach.',evidence:[{sourceUrl:'https://github.com/org/app/issues/6',revision:'2026-11-11T00:00:00Z',excerpt:'We need production guidance.',evidenceType:'builder_need' as const,verification:'Imported source claim; exact request retained.'}]};
  expect(enforceQualificationGates(base).outcome).toBe('BLOCKED');
  expect(enforceQualificationGates({...base,providerKind:'technical_capability',fit:'unsupported'}).outcome).toBe('REJECTED');
  expect(enforceQualificationGates({...base,sourceFreshness:'partial'}).outcome).toBe('BLOCKED');
  expect(aggregateQualificationOutcome([{outcome:'BLOCKED'}])).toBe('NO_QUALIFIED_PILOT');
  expect(aggregateQualificationOutcome([{outcome:'QUALIFIED'}])).toBe('QUALIFIED');
 });
});
