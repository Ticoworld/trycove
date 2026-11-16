import {describe,it,expect} from 'vitest';
import {extractRepositoryMentions,resolveIssueIdentity} from '../lib/issues';

const body=`**Link to repository:** contracts https://github.com/LusoCryptoLabs/cells-contracts; resolver https://github.com/LusoCryptoLabs/cells-resolver
**Hosted version:** https://cellula.id
The implementation references https://github.com/LusoCryptoLabs/ckb-script-pitfalls as background.`;
const existing=[{id:'cellula',name:'Cellula.id',website:'https://cellula.id/',repository:'https://github.com/LusoCryptoLabs/cells-contracts'}];

describe('cross-source project provenance',()=>{
 it('preserves multiple repository links from the source-backed repository section',()=>{expect(extractRepositoryMentions(body)).toEqual([{repository:'https://github.com/LusoCryptoLabs/cells-contracts',role:'contracts'},{repository:'https://github.com/LusoCryptoLabs/cells-resolver',role:'resolver'}])});
 it('merges a corroborated parenthetical product alias and refuses ambiguous matches',()=>{expect(resolveIssueIdentity('Cells (cellula.id)',body,existing)).toBe('cellula');expect(resolveIssueIdentity('Cells (cellula.id)',body,[...existing,{...existing[0],id:'duplicate'}])).toBeNull();expect(resolveIssueIdentity('Cells (cellula.id)','no corroborating links',existing)).toBeNull()});
 it('ignores repository references outside explicit repository sections and rejects unsafe hosts',()=>{expect(extractRepositoryMentions('See https://github.com/LusoCryptoLabs/cells-resolver for context.\n**Repository:** https://evil.example/cells-resolver')).toEqual([])});
});
