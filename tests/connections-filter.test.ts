import {describe,it,expect} from 'vitest';
import {matchesReviewedCopy,needsConnectionAttention} from '../lib/connections-filter';
describe('Connections filters',()=>{
 it('matches reviewed copies by search and their selected category',()=>{
  const copy={public_kind:'proposal',public_title:'Fiber connector',public_summary:'A source-backed idea'};
  expect(matchesReviewedCopy(copy,'FIBER','potential')).toBe(true);
  expect(matchesReviewedCopy(copy,'fiber','needs')).toBe(false);
  expect(matchesReviewedCopy(copy,'missing','potential')).toBe(false);
 });
 it('includes private review candidates with no action or due date',()=>{
  expect(needsConnectionAttention('needs-review',undefined)).toBe(true);
  expect(needsConnectionAttention('needs-review',{publication:'private',progress:'done',nextAction:'',watchlist:false,dueDate:null})).toBe(true);
  expect(needsConnectionAttention('open',{publication:'legacy',progress:'done',nextAction:'Follow up',watchlist:false,dueDate:null})).toBe(false);
 });
});
