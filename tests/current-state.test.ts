import {describe,it,expect} from 'vitest';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {buildVerificationPlan,CandidateSpecSchema,verifyCandidateCurrentState,type CandidateSpec} from '../lib/intelligence/current-state';

const sha='a'.repeat(40);
const currentCode=`https://raw.githubusercontent.com/example/provider/${sha}/src/fiber/hint.rs`;
const base:CandidateSpec={
 opportunityId:'candidate-1',
 capability:{key:'invoice-route',label:'Cellula LSP invoice routing through trampoline hints',terms:['Cellula','LSP','invoice','trampoline']},
 consumer:{id:'consumer',name:'Consumer App',aliases:['consumer-app'],repositories:['https://github.com/example/consumer']},
 provider:{id:'provider',name:'Provider Wallet',aliases:['provider-wallet'],repositories:['https://github.com/example/provider']},
 sourceUrls:['https://github.com/example/provider/issues/12'],knownUnavailableSources:[],priorEvidence:[],lifecycleBaseline:'stored',
 codeTouchpoints:[{projectId:'provider',repository:'https://github.com/example/provider',path:'src/fiber/hint.rs'}],
 searchConcepts:['LSP invoice trampoline route'],priorLifecycle:'unknown',priorCompatibility:'unknown',
};
const atom=(owner:string,repo:string)=>`<?xml version="1.0"?><feed><id>tag:github.com,2008:/${owner}/${repo}/commits/${sha}</id><updated>2026-11-16T11:00:00Z</updated><title>Recent commits</title></feed>`;
const html=(issue:{title:string;body:string;updatedAt:string})=>`<!DOCTYPE html><html><script type="application/json" data-target="react-app.embeddedData">${JSON.stringify({payload:{issueViewerRoute:{data:{repository:{issue:{title:issue.title,body:issue.body,updatedAt:issue.updatedAt}}}}}})}</script></html>`;
function mockFetch(byUrl:Record<string,string|number>){return(async(input:RequestInfo|URL)=>{const url=String(input);const value=byUrl[url];if(value===undefined&&(url.includes('/search?')||url.includes('/pulls?')||url.endsWith('/releases')))return new Response('<!DOCTYPE html><html><title>GitHub source index</title></html>',{status:200});if(value===undefined)return new Response('not found',{status:404});if(typeof value==='number')return new Response('blocked',{status:value});return new Response(value,{status:200,headers:{'content-type':url.endsWith('.atom')?'application/atom+xml':'text/html'}})}) as typeof fetch}
async function withCache(fn:(cache:string)=>Promise<void>){const cache=await mkdtemp(join(tmpdir(),'trycove-current-state-'));try{await fn(cache)}finally{await rm(cache,{recursive:true,force:true})}}

describe('candidate-scoped current-state verifier',()=>{
 it('starts the Twine prior-art regression from an unknown state',async()=>{
  const fixture=JSON.parse(await readFile(join(process.cwd(),'fixtures/current-state/twine-cellula.json'),'utf8'));
  expect(fixture.priorLifecycle).toBe('unknown');expect(fixture.priorCompatibility).toBe('unknown');
 });
 it('derives the scoped reported demonstration from source-linked evidence, preserving that it was reviewer supplied',async()=>withCache(async cache=>{
  const fixture=CandidateSpecSchema.parse(JSON.parse(await readFile(join(process.cwd(),'fixtures/current-state/twine-cellula.json'),'utf8')));
  const currentCode=`https://raw.githubusercontent.com/chukwuma619/twine/${sha}/src/fiber/hint.rs`;
  const talk='https://talk.nervos.org/t/twine-buy-and-sell-ckb-without-depositing-on-an-exchange-fiber-p2p-poc/10741.json';
  const announcement='https://teapaw.org/twineckb/status/2121412115718181181';
  const result=await verifyCandidateCurrentState(fixture,{cacheDir:cache,now:new Date('2026-11-17T04:00:00Z'),fetcher:mockFetch({
   'https://github.com/chukwuma619/twine/commits/HEAD.atom':atom('chukwuma619','twine'),
   [currentCode]:'Cellula LSP invoice parsing uses the TrampolineRouteHint field and explicit trampoline hops.',
   [talk]:403,[announcement]:403,
  })});
  expect(result.priorLifecycle).toBe('unknown');expect(result.lifecycleState).toBe('demonstrated_in_wild');expect(result.compatibilityState).toBe('unknown');expect(result.freshness).toBe('partial');
  const supplied=result.evidence.find(item=>item.sourceUrl===talk.replace(/\.json$/,''));expect(supplied?.evidenceType).toBe('maintainer_report');expect(supplied?.verification).toContain('not a verbatim excerpt');expect(supplied?.sourceSha256).toMatch(/^[a-f0-9]{64}$/);
 }));
 it('plans bounded current-ref, capability, alias and source-code checks without exact pair-only search',()=>{
  const plan=buildVerificationPlan(base);expect(plan.requests.some(x=>x.url==='https://github.com/example/provider/commits/HEAD.atom')).toBe(true);expect(plan.requests.some(x=>x.url==='https://github.com/example/provider/pulls?q=is%3Apr+is%3Amerged')).toBe(true);expect(plan.requests.some(x=>x.url==='https://github.com/example/provider/releases')).toBe(true);expect(plan.codeTouchpoints).toContainEqual(expect.objectContaining({path:'src/fiber/hint.rs'}));expect(plan.queries.some(q=>q.includes('Cellula LSP invoice routing'))).toBe(true);expect(plan.queries.some(q=>q.includes('trampoline route'))).toBe(true);expect(plan.requests.length).toBeLessThanOrEqual(16);
 });
 it('refreshes a builder need with no provider without inventing a project counterpart',async()=>withCache(async cache=>{
  const source='https://github.com/example/consumer/issues/26';
  const standalone:CandidateSpec={...base,opportunityId:'need-only',provider:undefined,capability:{key:'indexing-architecture',label:'Production indexer architecture guidance',terms:['indexing','architecture','production']},consumer:{...base.consumer,name:'Consumer App',repositories:['https://github.com/example/consumer']},sourceUrls:[source],codeTouchpoints:[],priorEvidence:[{sourceUrl:source,evidenceType:'status_update',excerpt:'The app asks for indexing architecture advice.',verification:'Imported need; live status is unverified.'}]};
  const plan=buildVerificationPlan(standalone);
  expect(plan.requests.some(x=>x.url==='https://github.com/example/consumer/commits/HEAD.atom')).toBe(true);
  expect(plan.requests.some(x=>x.url.includes('/provider/'))).toBe(false);
  const checked=await verifyCandidateCurrentState(standalone,{cacheDir:cache,now:new Date('2026-11-17T01:00:00Z'),fetcher:mockFetch({'https://github.com/example/consumer/commits/HEAD.atom':atom('example','consumer'),[source]:html({title:'Current indexing need',body:'The production app still needs a reliable indexing architecture for CKB escrow history.',updatedAt:'2026-11-16T00:00:00Z'})})});
  expect(checked.freshness).toBe('current');expect(checked.evidence.some(x=>x.sourceUrl===source)).toBe(true);expect(checked.compatibilityState).toBe('unknown');
 }));
 it('keeps currentness unresolved when a pairless source check cannot refresh its repository or issue',async()=>withCache(async cache=>{
  const source='https://github.com/example/consumer/issues/26';
  const standalone:CandidateSpec={...base,opportunityId:'need-only-blocked',provider:undefined,consumer:{...base.consumer,repositories:['https://github.com/example/consumer']},sourceUrls:[source],codeTouchpoints:[],priorEvidence:[]};
  const checked=await verifyCandidateCurrentState(standalone,{cacheDir:cache,now:new Date('2026-11-17T01:00:00Z'),fetcher:(async()=>new Response('blocked',{status:503})) as typeof fetch});
  expect(checked.freshness).toBe('unresolved');expect(checked.result).toBe('unavailable');expect(checked.evidence).toHaveLength(0);expect(checked.uncertainty).toContain('not negative evidence');
 }));
 it('recognizes scoped maintainer-reported completion while keeping compatibility separate',async()=>withCache(async cache=>{
  const source='https://github.com/example/provider/issues/12';const checkedAt=new Date('2026-11-17T01:00:00Z');
  const result=await verifyCandidateCurrentState({...base,sourceUrls:[source]}, {cacheDir:cache,now:checkedAt,fetcher:mockFetch({
   'https://github.com/example/consumer/commits/HEAD.atom':atom('example','consumer'),
   'https://github.com/example/provider/commits/HEAD.atom':atom('example','provider'),
   [source]:html({title:'Wallet update',body:'We completed Cellula LSP invoice trampoline routing and successfully tested the route in a CKB testnet payment.',updatedAt:'2026-11-14T10:00:00Z'}),
   [currentCode]:html({title:'hint parser',body:'Cellula LSP invoice parsing uses TrampolineRouteHint and explicit trampoline hops.',updatedAt:'2026-11-14T10:00:00Z'}),
  })});
  expect(result.lifecycleState).toBe('demonstrated_in_wild');expect(result.compatibilityState).toBe('unknown');expect(result.freshness).toBe('current');expect(result.evidence.some(x=>x.evidenceType==='maintainer_report')).toBe(true);expect(result.evidence.every(x=>/^[a-f0-9]{64}$/.test(x.sourceSha256))).toBe(true);
 }));
 it('reads Discourse cooked post bodies and dates before deriving scoped completion',async()=>withCache(async cache=>{
  const topic='https://talk.nervos.org/t/example-prior-art/10741';const topicJson=`${topic}.json`;
  const result=await verifyCandidateCurrentState({...base,sourceUrls:[topic],codeTouchpoints:[],consumer:{...base.consumer,repositories:[]},provider:{...base.provider!,repositories:[]}},{cacheDir:cache,now:new Date('2026-11-17T01:00:00Z'),fetcher:mockFetch({
   [topicJson]:JSON.stringify({title:'Prior art update',post_stream:{posts:[{created_at:'2026-11-13T12:02:55.764Z',cooked:'<p>A Cellula-to-Cellula trade settled on testnet after parsing a Cellula LSP invoice with Fiber trampoline routing.</p>'}]}}),
  })});
  const source=result.sources.find(x=>x.url===topicJson);expect(source?.content).toContain('Cellula LSP invoice');expect(source?.publishedAt).toBe('2026-11-13T12:02:55.764Z');expect(result.lifecycleState).toBe('demonstrated_in_wild');expect(result.evidence.some(x=>x.evidenceType==='maintainer_report'&&x.publishedAt==='2026-11-13T12:02:55.764Z'&&x.excerpt.includes('Cellula-to-Cellula trade settled on testnet'))).toBe(true);
 }));
 it('marks an old collaboration offer for reconfirmation without treating age as withdrawal',async()=>withCache(async cache=>{
  const source='https://github.com/example/provider/issues/12';const candidate:CandidateSpec={...base,capability:{key:'indexing-review',label:'Cellora indexing architecture review offer',terms:['indexing','architecture review','20-minute call']},sourceUrls:[source],codeTouchpoints:[],searchConcepts:['indexing architecture call'],consumer:{...base.consumer,repositories:[]},provider:{...base.provider!,repositories:[]}};
  const result=await verifyCandidateCurrentState(candidate,{cacheDir:cache,now:new Date('2026-11-17T01:00:00Z'),fetcher:mockFetch({[source]:html({title:'Indexing discussion',body:'Happy to jump on a 20-minute call with builders whose applications have non-trivial indexing architecture needs.',updatedAt:'2026-04-28T05:42:11Z'})})});
  expect(result.lifecycleState).toBe('stale_offer');expect(result.freshness).toBe('partial');expect(result.summary).toContain('still visible');expect(result.uncertainty).toContain('do not prove the offer was withdrawn');expect(result.nextAction).toContain('Reconfirm');expect(result.evidence[0].evidenceType).toBe('human_offer');
 }));
 it('does not erase a prior demonstrated state or turn an unreachable source into negative evidence',async()=>withCache(async cache=>{
  const result=await verifyCandidateCurrentState({...base,priorLifecycle:'demonstrated_in_wild',sourceUrls:['https://talk.nervos.org/t/example/12']},{cacheDir:cache,now:new Date('2026-11-17T01:00:00Z'),fetcher:mockFetch({'https://github.com/example/consumer/commits/HEAD.atom':503,'https://github.com/example/provider/commits/HEAD.atom':503,'https://talk.nervos.org/t/example/12.json':403})});
  expect(result.result).toBe('partial');expect(result.freshness).toBe('partial');expect(result.lifecycleState).toBe('demonstrated_in_wild');expect(result.priorLifecycle).toBe('demonstrated_in_wild');expect(result.uncertainty).toContain('not negative evidence');expect(result.evidence).toHaveLength(0);
 }));
 it('honors a recent bounded blocked-source backoff instead of retrying a known proxy denial',async()=>withCache(async cache=>{
  const blocked='https://talk.nervos.org/t/example/12.json';const requested:string[]=[];
  const fetcher=(async(input:RequestInfo|URL)=>{requested.push(String(input));return new Response('ok',{status:200})}) as typeof fetch;
  const result=await verifyCandidateCurrentState({...base,sourceUrls:['https://talk.nervos.org/t/example/12'],knownUnavailableSources:[{url:blocked,checkedAt:'2026-11-17T00:54:00Z',reason:'proxy CONNECT 403'}]},{cacheDir:cache,now:new Date('2026-11-17T01:30:00Z'),fetcher});
  expect(requested).not.toContain(blocked);expect(result.sources.find(x=>x.url===blocked)?.fetchStatus).toBe('unavailable');expect(result.sources.find(x=>x.url===blocked)?.cache).toBe('hit');expect(result.uncertainty).toContain('not negative evidence');
 }));
 it('caches a newly encountered public-source denial so repeated checks do not hammer it',async()=>withCache(async cache=>{
  const denied='https://github.com/example/provider/issues/12';let issueRequests=0;
  const fetcher=(async(input:RequestInfo|URL)=>{const url=String(input);if(url===denied){issueRequests++;return new Response('blocked',{status:403})}if(url.includes('/search?'))return new Response('<!DOCTYPE html><html><title>Search results</title></html>',{status:200});return new Response('no feed',{status:404})}) as typeof fetch;
  const first=await verifyCandidateCurrentState({...base,sourceUrls:[denied],consumer:{...base.consumer,repositories:[]},provider:{...base.provider!,repositories:[]},codeTouchpoints:[]},{cacheDir:cache,now:new Date('2026-11-17T01:00:00Z'),fetcher});
  const second=await verifyCandidateCurrentState({...base,sourceUrls:[denied],consumer:{...base.consumer,repositories:[]},provider:{...base.provider!,repositories:[]},codeTouchpoints:[]},{cacheDir:cache,now:new Date('2026-11-17T01:01:00Z'),fetcher});
  expect(first.sources.find(x=>x.url===denied)?.httpStatus).toBe(403);expect(second.sources.find(x=>x.url===denied)?.cache).toBe('hit');expect(issueRequests).toBe(1);expect(second.sources.find(x=>x.url===denied)?.error).toContain('Previously unavailable');
 }));
 it('rejects broad keyword similarity and detects conflicting completion and a continuing need',async()=>withCache(async cache=>{
  const done='https://github.com/example/provider/issues/12';const need='https://github.com/example/consumer/issues/8';const common={
   'https://github.com/example/consumer/commits/HEAD.atom':atom('example','consumer'),'https://github.com/example/provider/commits/HEAD.atom':atom('example','provider'),
  };
  const broad=await verifyCandidateCurrentState({...base,sourceUrls:[done],codeTouchpoints:[]},{cacheDir:join(cache,'broad'),now:new Date('2026-11-17T01:00:00Z'),fetcher:mockFetch({...common,[done]:html({title:'General wallet',body:'Wallet UX is important for builders and CKB users.',updatedAt:'2026-11-16T00:00:00Z'})})});
  expect(broad.lifecycleState).toBe('unknown');expect(broad.evidence).toHaveLength(0);
  const conflict=await verifyCandidateCurrentState({...base,sourceUrls:[done,need],codeTouchpoints:[]},{cacheDir:join(cache,'conflict'),now:new Date('2026-11-17T01:00:00Z'),fetcher:mockFetch({...common,[done]:html({title:'Payment complete',body:'We completed Cellula LSP invoice trampoline routing in a successful testnet payment.',updatedAt:'2026-11-16T00:00:00Z'}),[need]:html({title:'Still needed',body:'We still need Cellula LSP invoice trampoline routing for the application.',updatedAt:'2026-11-16T00:00:00Z'})})});
  expect(conflict.result).toBe('contradictory');expect(conflict.lifecycleState).toBe('in_progress');expect(conflict.nextAction).toContain('split or revise');
 }));
 it('does not branch on project names',async()=>withCache(async cache=>{
  const changed={...base,opportunityId:'candidate-renamed',consumer:{...base.consumer,id:'left-x',name:'Unrelated Left',aliases:['left-tool'],repositories:['https://github.com/example/consumer']},provider:{...base.provider!,id:'right-y',name:'Other Right',aliases:['right-tool'],repositories:['https://github.com/example/provider']},codeTouchpoints:[{projectId:'right-y',repository:'https://github.com/example/provider',path:'src/fiber/hint.rs'}]};
  const source=base.sourceUrls[0];const result=await verifyCandidateCurrentState(changed,{cacheDir:cache,now:new Date('2026-11-17T01:00:00Z'),fetcher:mockFetch({'https://github.com/example/consumer/commits/HEAD.atom':atom('example','consumer'),'https://github.com/example/provider/commits/HEAD.atom':atom('example','provider'),[source]:html({title:'Invoice done',body:'Cellula LSP invoice trampoline route was successfully tested on testnet.',updatedAt:'2026-11-16T00:00:00Z'}),[currentCode]:html({title:'route',body:'Cellula LSP invoice trampoline implementation.',updatedAt:'2026-11-16T00:00:00Z'})})});
  expect(result.lifecycleState).toBe('demonstrated_in_wild');expect(result.opportunityId).toBe('candidate-renamed');
 }));
});
