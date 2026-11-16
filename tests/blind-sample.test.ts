import {describe,it,expect} from 'vitest';
import {selectBlindSample} from '../lib/intelligence/blind-sample';

const fp={repository:'https://github.com/org/repo',revision:'a'.repeat(40),scope:'.',observationCount:1};
const item=(projectId:string,needClaims:string[])=>({projectId,name:projectId,needClaims,footprints:[fp]});
describe('pair-blind project sample',()=>{
 it('selects the same stratified project set from the seed and eligibility data alone',()=>{
  const input=[item('integration',['Need an SDK integration']),item('testing',['Need a testnet replay']),item('distribution',['Need a hosted demo']),item('review',['Need community technical review']),item('extra',['Need independent CKB reproduction'])];
  const a=selectBlindSample(input,'predeclared-seed',4),b=selectBlindSample([...input].reverse(),'predeclared-seed',4);
  expect(a.selected.map(x=>x.projectId).sort()).toEqual(b.selected.map(x=>x.projectId).sort());
  expect(new Set(a.selected.map(x=>x.sampledFrom)).size).toBeGreaterThanOrEqual(3);
 });
 it('selects need-bearing projects before checking for a code footprint',()=>{
  const input=[item('eligible',['Need detailed source review']),{...item('no-observation',['Need testing']),footprints:[{...fp,observationCount:0}]},{...item('no-footprint',['Need distribution'])},{...item('no-need',[])}];
  const run=selectBlindSample(input,'predeclared-seed',8);expect(run.eligibleProjectCount).toBe(3);expect(run.selected.map(x=>x.projectId)).toContain('no-footprint');expect(run.selected.map(x=>x.projectId)).toContain('no-observation');
 });
});
