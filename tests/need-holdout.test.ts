import {describe,it,expect} from 'vitest';
import {selectNeedHoldout} from '../lib/intelligence/need-holdout';

describe('issue-level discovery evaluation holdout',()=>{
 it('selects deterministic whole issue groups and excludes all groups from providers',()=>{
  const rows=[
   {sourceUrl:'https://github.com/o/r/issues/1',category:'adoption',stance:'explicit-request'},
   {sourceUrl:'https://github.com/o/r/issues/1',category:'feature-request',stance:'roadmap'},
   {sourceUrl:'https://github.com/o/r/issues/2',category:'technical-review',stance:'explicit-request'},
   {sourceUrl:'https://github.com/o/r/issues/2',category:'unknown',stance:'ambiguous'},
   {sourceUrl:'https://github.com/o/r/issues/3',category:'validation',stance:'reported-obstacle'},
  ];
  const a=selectNeedHoldout(rows,'fixed-seed'),b=selectNeedHoldout(rows,'fixed-seed');
  expect(a).toEqual(b);
  expect(new Set(a.selectedIssueUrls).size).toBe(a.selectedIssueUrls.length);
  expect(a.excludedFromProviderSearch).toEqual(a.selectedIssueUrls);
  expect(a.strata['user-testing']).toMatchObject({selectedIssue:null,eligibleIssueCount:0});
  expect(a.strata.ambiguous.selectedIssue).toBe('https://github.com/o/r/issues/2');
 });
});
