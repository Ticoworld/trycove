import {describe,expect,it} from 'vitest';
import {metadataClaims,parseCkbDappsFeed,repositoryUrl} from '../lib/sources/ckbdapps-json';
import {githubRepoPath,isCkbPulseLead,parsePulseRepo,parsePulseState,resolvePulseAlias} from '../lib/sources/pulse';

describe('TC-01E source schemas and product identity',()=>{
 it('validates the actual CKBdapps envelope and keeps a stable source-local slug',()=>{
  const feed=parseCkbDappsFeed(JSON.stringify({source:'https://ckbdapps.com',count:1,projects:[{slug:'sample-app',name:'Sample App',url:'https://example.org',tagline:{en:'A CKB application',zh:'CKB 应用'},categories:['Wallet','Payment'],group:'apps',community:false,links:{x:'sample'},verified:'2026-11-03',listed:'2026-11-03',testnet:true,page:{en:'https://ckbdapps.com/en/projects/sample-app'}}]}));
  expect(feed.projects[0]?.slug).toBe('sample-app');expect(metadataClaims(feed.projects[0]!)).toContainEqual({kind:'deployment-claim',concept:'testnet',claim:'CKBdapps testnet field: true'});
  expect(metadataClaims(feed.projects[0]!).some(x=>x.kind==='directory-page')).toBe(true);
  expect(metadataClaims(feed.projects[0]!).some(x=>x.kind==='capability')).toBe(false);
 });
 it('rejects mismatched record counts and duplicate source identity',()=>{
  expect(()=>parseCkbDappsFeed(JSON.stringify({source:'https://ckbdapps.com',count:2,projects:[{slug:'sample',name:'A'},{slug:'sample',name:'B'}]}))).toThrow();
 });
 it('does not invent or normalize an invalid GitHub repository association',()=>{
  expect(repositoryUrl('owner/repo')).toBe('https://github.com/owner/repo');expect(repositoryUrl('https://evil.example/owner/repo')).toBeUndefined();expect(githubRepoPath('https://github.com/Owner/Repo.git')).toBe('owner/repo');expect(githubRepoPath('https://github.com/owner/repo/issues/1')).toBeNull();
 });
 it('parses Pulse state and repo activity as activity rather than usage',()=>{
  const state=parsePulseState(JSON.stringify({now:'2026-11-17T20:19:40.589Z',keepDays:90,stats:{tracked:1},repos:[{name:'owner/repo',group:'builders',desc:'CKB repo',stars:3,lang:'TypeScript',n:10,n24:2,b24:1,lastAt:'2026-11-17T19:00:00Z',lastKind:'push',tags:['ckb'],isNew:false,onchain:false}]}));
  expect(state.repos[0]?.name).toBe('owner/repo');expect(isCkbPulseLead(state.repos[0]!)).toBe(true);
  const detail=parsePulseRepo(JSON.stringify({name:'owner/repo',url:'https://github.com/owner/repo',daily:{days:1,people:[1],bots:[0]},months:null,onchain:null,events:[{at:'2026-11-17T19:00:00Z',kind:'push',title:'change'}]}));expect(detail.events?.[0]?.kind).toBe('push');expect(detail.onchain).toBeNull();
 });
 it('requires authoritative repository identity to bridge a rename',()=>{
  const rows=[{name:'new-owner/new-name'}];
  expect(resolvePulseAlias({requestedPath:'old-owner/old-name',rows})).toBeNull();
  expect(resolvePulseAlias({requestedPath:'old-owner/old-name',rows,identity:{id:42,full_name:'new-owner/new-name'}})?.matchedBy).toBe('authoritative-alias');
  expect(resolvePulseAlias({requestedPath:'old-owner/old-name',rows,identity:{id:43,full_name:'new-owner/new-name'}})?.repo.name).toBe('new-owner/new-name');
  expect(resolvePulseAlias({requestedPath:'old-owner/old-name',rows,identity:{id:0,full_name:'new-owner/new-name'}})).toBeNull();
 });
 it('does not create a product from absent Pulse coverage',()=>{
  const result=resolvePulseAlias({requestedPath:'untracked/project',rows:[]});expect(result).toBeNull();
 });
});
