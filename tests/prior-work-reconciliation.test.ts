import {describe,it,expect} from 'vitest';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {collectGitHubIssueThread,resolveGitHubRepository,PriorWorkCollectionSchema} from '../lib/intelligence/prior-work';
import {candidateEvidenceCompleteness,deriveActionReadiness,reconcilePriorWorkCandidate,PriorWorkCandidateInputSchema,verifyPriorWorkReferences} from '../lib/intelligence/prior-work-reconciliation';

const root=process.cwd();
async function frozen(){
 const [collection,oldReview,annotations]=await Promise.all([
  readFile(join(root,'evidence/tc-01d-r1/source-collection-20261117T171343Z.json'),'utf8').then(x=>PriorWorkCollectionSchema.parse(JSON.parse(x))),
  readFile(join(root,'evidence/tc-01d/qualification-review-3b32928287de878a.json'),'utf8').then(JSON.parse),
  readFile(join(root,'evidence/tc-01d-r1/review-annotations.json'),'utf8').then(JSON.parse),
 ]);
 const candidate=(projectName:string)=>{
  const old=oldReview.candidateReviews.find((row:any)=>row.projectName===projectName);const note=annotations.candidates[old.candidateId];
  return PriorWorkCandidateInputSchema.parse({candidateId:old.candidateId,projectId:old.projectId,projectName:old.projectName,capabilityKey:note.capabilityKey,issueUrl:old.need.sourceUrl,needExcerpt:old.need.excerpt,previousConclusion:{outcome:old.assessment.outcome,rationale:old.assessment.rationale},needAssessment:note.needAssessment,currentNeedRationale:note.currentNeedRationale,events:note.events,remainingUnknowns:note.remainingUnknowns,nextAction:note.nextAction,contactProposal:note.contactProposal,priorContactEvidence:[],participantInterestEvidence:[],pilotAgreement:note.pilotAgreement,pilotAgreementEvidence:[]});
 };
 const control=PriorWorkCandidateInputSchema.parse({...annotations.control,priorContactEvidence:[],participantInterestEvidence:[],pilotAgreementEvidence:[]});
 return{collection,oldReview,annotations,candidate,control};
}
const apiContext=(fetcher:typeof fetch)=>({token:'test-token',fetcher,checkedAt:'2026-11-17T17:30:00.000Z'});
const json=(value:unknown,status=200)=>new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json'}});

describe('candidate-scoped prior-work reconciliation',()=>{
 it('reconciles the actual Kickstarter thread without claiming production readiness',async()=>{
  const {collection,candidate}=await frozen();const result=reconcilePriorWorkCandidate(candidate('CKB Kickstarter'),collection);
  expect(result.questionState).toBe('answered');expect(result.implementationEvidence).toMatchObject({reported:true,observed:true,demonstrated:false,adopted:false});
  expect(result.needState).toBe('answered');expect(result.actionReadiness).toBe('ALREADY_ADDRESSED');
  expect(result.relatedIntegrationMilestones).toEqual({proposed:true,inProgress:true,demonstrated:true,adopted:false});
  expect(result.relatedIntegrationDemonstration).toBe('maintainer_reported');
  expect(result.relatedPullRequests).toHaveLength(1);expect(result.relatedPullRequests[0]).toMatchObject({state:'open',merged:false,headSha:'1a92a016b21dc53eae3a2d2540e05a736cd7b031'});
  expect(result.remainingUnknowns.join(' ')).toContain('production hosting');
 });

 it('keeps comment replies scoped to the exact need and allows a first question without an agreed collaborator',async()=>{
  const {collection,candidate}=await frozen();const input=candidate('Owl Pilot');
  const result=reconcilePriorWorkCandidate({...input,projectName:'Renamed sample app'},collection);
  expect(result.actionReadiness).toBe('CONTACT_WORTHY');expect(result.pilotReadiness).toBe('NOT_READY');
  expect(result.questionState).toBe('unanswered');expect(result.contactDraft?.status).toBe('NOT_SENT_AWAITING_USER_APPROVAL');expect(result.contactDraft?.sent).toBe(false);
  expect(result.events.some(event=>event.capabilityKey==='owl-on-chain-revocation-design'&&event.effect==='answers')).toBe(true);
  expect(result.relatedIntegrationMilestones.inProgress).toBe(false);
 });

 it('does not treat a reviewer response or reported fixes as a formal audit',async()=>{
  const {collection,candidate}=await frozen();const result=reconcilePriorWorkCandidate(candidate('CKAutomata'),collection);
  expect(result.actionReadiness).toBe('ALREADY_ADDRESSED');expect(result.implementationEvidence.reported).toBe(true);
  expect(result.remainingUnknowns.join(' ')).toContain('formal independent security audit');
 });

 it('uses the preselected control to retain a partial testnet review without calling it mainnet-ready',async()=>{
  const {collection,control}=await frozen();const result=reconcilePriorWorkCandidate(control,collection);
  expect(result.needState).toBe('partially_addressed');expect(result.actionReadiness).toBe('NEEDS_CONFIRMATION');
  expect(result.pilotReadiness).toBe('NOT_READY');expect(result.questionState).toBe('partially_answered');
 });

 it('blocks when comments are unavailable instead of interpreting failure as an empty issue thread',async()=>{
  const {collection,candidate}=await frozen();const input=candidate('Owl Pilot');
  const incomplete={...collection,issueThreads:collection.issueThreads.map(thread=>thread.issueNumber===51?{...thread,commentsStatus:'unavailable' as const,comments:[]}:thread)};
  const result=reconcilePriorWorkCandidate(input,incomplete);
  expect(result.discussion.completeness).toBe('unavailable');expect(result.questionState).toBe('unknown');expect(result.actionReadiness).toBe('BLOCKED');
 });

 it('keeps a candidate blocked when the entire issue thread is unreachable',async()=>{
  const {collection,candidate}=await frozen();const input=candidate('Owl Pilot');
  const incomplete={...collection,issueThreads:collection.issueThreads.filter(thread=>thread.issueNumber!==51)};
  const result=reconcilePriorWorkCandidate(input,incomplete);
  expect(result.discussion.completeness).toBe('unavailable');expect(result.actionReadiness).toBe('BLOCKED');expect(result.contactDraft).toBeNull();
 });

 it('blocks reconciliation when a directly cited pull request cannot be inspected',async()=>{
  const {collection,candidate}=await frozen();const input=candidate('CKB Kickstarter');
  const incomplete={...collection,pullRequests:collection.pullRequests.map(pull=>pull.number===14?{...pull,filesStatus:'unavailable' as const,files:[]}:pull)};
  expect(candidateEvidenceCompleteness(input,incomplete)).toBe('partial');
  const result=reconcilePriorWorkCandidate(input,incomplete);
  expect(result.discussion.completeness).toBe('partial');expect(result.questionState).toBe('unknown');expect(result.actionReadiness).toBe('BLOCKED');
 });

 it('requires all participant, scope, prerequisite and experiment confirmations for pilot readiness',()=>{
  const ref={sourceKind:'issue_comment' as const,sourceUrl:'https://github.com/example/app/issues/1#issuecomment-1',commentId:1,quote:'We agree on the experiment scope.'};
  const dimensions=['participants','scope','prerequisites','experiment'] as const;
  const base={discussionComplete:true,needAssessment:'active_unresolved' as const,contactProposal:{targetLogin:'builder',targetRole:'builder' as const,purpose:'confirm the request',question:'is it still open?',draft:'A sufficiently long draft explaining the request and asking whether it remains useful.',needEvidence:[{sourceKind:'issue_body' as const,sourceUrl:'https://github.com/example/app/issues/1',quote:'The original request asks for review.'}]},priorContactEvidence:[],participantInterestEvidence:[],pilotAgreement:{participants:true,scope:true,prerequisites:true,experiment:true},pilotAgreementEvidence:dimensions.map(dimension=>({dimension,reference:ref}))};
  expect(deriveActionReadiness(base)).toBe('PILOT_READY');
  expect(deriveActionReadiness({...base,pilotAgreement:{...base.pilotAgreement,participants:false}})).toBe('CONTACT_WORTHY');
  expect(deriveActionReadiness({...base,pilotAgreementEvidence:base.pilotAgreementEvidence.filter(item=>item.dimension!=='participants')})).toBe('CONTACT_WORTHY');
  expect(deriveActionReadiness({...base,participantInterestEvidence:[ref],pilotAgreement:{participants:false,scope:false,prerequisites:false,experiment:false}})).toBe('INTEREST_CONFIRMED');
  expect(deriveActionReadiness({...base,needAssessment:'stale_or_unconfirmed',participantInterestEvidence:[],pilotAgreement:{participants:false,scope:false,prerequisites:false,experiment:false},pilotAgreementEvidence:[]})).toBe('NEEDS_CONFIRMATION');
 });

 it('verifies every cited quote against collected source content',async()=>{
  const {collection,candidate}=await frozen();const input=candidate('CKB Kickstarter');
  const code=collection.issueThreads.flatMap(()=>[]);
  const wrong={...input,events:input.events.map((event,index)=>index===0?{...event,references:[{...event.references[0],quote:'a quote not in the issue body'}]}:event)};
  const errors=verifyPriorWorkReferences(wrong.events,collection,[{sourceUrl:'https://github.com/example/repo/blob/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/src/index.ts',revision:'a'.repeat(40),excerpt:'code'}]);
  expect(errors.some(error=>error.includes('issue body quote not found'))).toBe(true);expect(code).toEqual([]);
 });

 it('records renamed repositories by stable GitHub ID and keeps similarly named repositories distinct',async()=>{
  const replies:Record<string,unknown>={
   'https://api.github.com/repos/acme/old-project':{id:44,node_id:'R_kgDO44',full_name:'acme/current-project',html_url:'https://github.com/acme/current-project'},
   'https://api.github.com/repos/acme/current-project':{id:44,node_id:'R_kgDO44',full_name:'acme/current-project',html_url:'https://github.com/acme/current-project'},
   'https://api.github.com/repos/acme/current-project-tools':{id:45,node_id:'R_kgDO45',full_name:'acme/current-project-tools',html_url:'https://github.com/acme/current-project-tools'},
  };
  const fetcher=(async(input:RequestInfo|URL)=>{const value=replies[String(input)];return value?json(value):json({message:'not found'},404)}) as typeof fetch;
  const context=apiContext(fetcher);
  const old=await resolveGitHubRepository('https://github.com/acme/old-project',context);
  const canonical=await resolveGitHubRepository('https://github.com/acme/current-project',context);
  const similar=await resolveGitHubRepository('https://github.com/acme/current-project-tools',context);
  expect(old.repositoryId).toBe(canonical.repositoryId);expect(old.canonicalUrl).toBe(canonical.canonicalUrl);
  expect(similar.repositoryId).not.toBe(old.repositoryId);
 });

 it('marks a failed comment request incomplete, never empty',async()=>{
  const fetcher=(async(input:RequestInfo|URL)=>{
   const url=String(input);
   if(url==='https://api.github.com/repos/acme/app')return json({id:3,node_id:'R_kgDO3',full_name:'acme/app',html_url:'https://github.com/acme/app'});
   if(url==='https://api.github.com/repos/acme/app/issues/2')return json({html_url:'https://github.com/acme/app/issues/2',state:'open',created_at:'2026-11-01T00:00:00Z',updated_at:'2026-11-02T00:00:00Z',closed_at:null,user:{login:'builder'},title:'Need',body:'A detailed issue request.',repository:{id:3}});
   return json({message:'rate limited'},403);
  }) as typeof fetch;
  const thread=await collectGitHubIssueThread('https://github.com/acme/app/issues/2',apiContext(fetcher));
  expect(thread.commentsStatus).toBe('unavailable');expect(thread.comments).toHaveLength(0);expect(thread.failures[0]?.httpStatus).toBe(403);
 });

 it('follows paginated comment pages and retains chronological order',async()=>{
  const comment=(id:number,createdAt:string)=>({id,html_url:`https://github.com/acme/app/issues/2#issuecomment-${id}`,user:{login:'person'},author_association:'NONE',created_at:createdAt,updated_at:createdAt,body:`comment ${id}`});
  const many=Array.from({length:100},(_,index)=>comment(index+1,new Date(Date.UTC(2026,10,1+index)).toISOString()));
  const fetcher=(async(input:RequestInfo|URL)=>{
   const url=String(input);
   if(url==='https://api.github.com/repos/acme/app')return json({id:3,node_id:'R_kgDO3',full_name:'acme/app',html_url:'https://github.com/acme/app'});
   if(url==='https://api.github.com/repos/acme/app/issues/2')return json({html_url:'https://github.com/acme/app/issues/2',state:'open',created_at:'2026-11-01T00:00:00Z',updated_at:'2026-11-02T00:00:00Z',closed_at:null,user:{login:'builder'},title:'Need',body:'A detailed issue request.',repository:{id:3}});
   if(url.endsWith('comments?per_page=100&page=1'))return json(many);
   if(url.endsWith('comments?per_page=100&page=2'))return json([comment(101,'2026-10-31T00:00:00.000Z')]);
   return json({message:'unexpected'},404);
  }) as typeof fetch;
  const thread=await collectGitHubIssueThread('https://github.com/acme/app/issues/2',apiContext(fetcher));
  expect(thread.commentsStatus).toBe('complete');expect(thread.commentsPagesFetched).toBe(2);expect(thread.comments).toHaveLength(101);
  expect(thread.comments[0]?.id).toBe(101);expect(thread.comments.at(-1)?.id).toBe(100);
 });
});
