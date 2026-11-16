import {describe,it,expect} from 'vitest';
import {extractIssueSignals,extractRepositoryMentions,resolveIssueIdentity} from '../lib/issues';

const body=`**Link to repository:** contracts https://github.com/LusoCryptoLabs/cells-contracts; resolver https://github.com/LusoCryptoLabs/cells-resolver
**Hosted version:** https://cellula.id
The implementation references https://github.com/LusoCryptoLabs/ckb-script-pitfalls as background.`;
const existing=[{id:'cellula',name:'Cellula.id',website:'https://cellula.id/',repository:'https://github.com/LusoCryptoLabs/cells-contracts'}];
const multiLineRepositoryBody=`**Link to repository:**
Frontend / product app:
https://github.com/kayceeDev/ckb-escrow-studio

Contract / Rust CKB scripts:
https://github.com/kayceeDev/ckb-escrow`;

describe('cross-source project provenance',()=>{
 it('preserves multiple repository links from the source-backed repository section',()=>{expect(extractRepositoryMentions(body)).toEqual([{repository:'https://github.com/LusoCryptoLabs/cells-contracts',role:'contracts'},{repository:'https://github.com/LusoCryptoLabs/cells-resolver',role:'resolver'}])});
 it('preserves repository roles when issue links follow descriptive lines',()=>{expect(extractRepositoryMentions(multiLineRepositoryBody)).toEqual([{repository:'https://github.com/kayceeDev/ckb-escrow-studio',role:'Frontend / product app'},{repository:'https://github.com/kayceeDev/ckb-escrow',role:'Contract / Rust CKB scripts'}])});
 it('merges a corroborated parenthetical product alias and refuses ambiguous matches',()=>{expect(resolveIssueIdentity('Cells (cellula.id)',body,existing)).toBe('cellula');expect(resolveIssueIdentity('Cells (cellula.id)',body,[...existing,{...existing[0],id:'duplicate'}])).toBeNull();expect(resolveIssueIdentity('Cells (cellula.id)','no corroborating links',existing)).toBeNull()});
 it('ignores repository references outside explicit repository sections and rejects unsafe hosts',()=>{expect(extractRepositoryMentions('See https://github.com/LusoCryptoLabs/cells-resolver for context.\n**Repository:** https://evil.example/cells-resolver')).toEqual([])});
});

describe('source issue intent sections',()=>{
 it('keeps explicit review requests separate from missing capabilities',()=>{
  const claims=extractIssueSignals({number:3,title:'Example',body:'## Problems\nI need per-script-group cycles in the explorer.\n\n## Request for feedback\nPlease review the architecture and suggest a test plan.',updatedAt:'2026-11-01T00:00:00Z',url:'https://github.com/Nervos-Community-Catalyst/CKBuilder-projects/issues/3'});
  expect(claims.map(x=>[x.kind,x.concept])).toEqual([['obstacle','missing-capability'],['need','feedback-request']]);
 });
 it('does not flatten a problem section that is actually asking for feedback into an implementation need',()=>{
  const claims=extractIssueSignals({number:4,title:'Example',body:'## Problems\nI would like feedback on the recovery boundary after an ambiguous RPC broadcast.\n\n## Planned features\n- Add one-click test fixtures.',updatedAt:'2026-11-01T00:00:00Z',url:'https://github.com/Nervos-Community-Catalyst/CKBuilder-projects/issues/4'});
  expect(claims.map(x=>[x.kind,x.concept])).toEqual([['need','feedback-request'],['obstacle','missing-capability']]);
 });
});
