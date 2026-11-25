import {beforeEach,describe,expect,it,vi} from 'vitest';
const state=vi.hoisted(()=>({visible:[] as string[],managed:[] as string[],organizer:false,user:null as null|{id:string},editable:[] as string[]}));
vi.mock('server-only',()=>({}));
vi.mock('../lib/db',()=>({db:{select:()=>({from:()=>({where:async()=>state.visible.map(id=>({id}))})}),execute:async(query:unknown)=>{
 const text=JSON.stringify(query);
 return {rows:text.includes('to_regclass')?[{name:'connection_operations'}]:state.managed.map(opportunity_id=>({opportunity_id}))};
}}}));
vi.mock('../lib/organizer-auth',()=>({hasOrganizerSession:async()=>state.organizer}));
vi.mock('../lib/authorization',()=>({authenticatedUser:async()=>state.user,checkProjectPermission:async(_db:unknown,_user:string,id:string)=>{if(!state.editable.includes(id))throw new Error('denied')}}));
import {canViewOpportunity,publicOpportunityIds} from '../lib/opportunity-visibility';
import type {opportunities} from '../lib/schema';
const row={id:'candidate',projectA:'a',projectB:'b',status:'needs-review',kind:'proposed',problem:'private',reasoning:'',requirements:'',experiment:''} satisfies typeof opportunities.$inferSelect;
describe('opportunity visibility',()=>{
 beforeEach(()=>{state.visible=['a','b'];state.managed=[];state.organizer=false;state.user=null;state.editable=[]});
 it('does not expose a review candidate by direct access or list',async()=>{expect((await publicOpportunityIds([row])).size).toBe(0);expect(await canViewOpportunity(row)).toBe(false)});
 it('allows organizers and authorized editors while protecting another private project',async()=>{
  state.user={id:'u'};state.visible=['a'];state.editable=['a'];expect(await canViewOpportunity(row)).toBe(false);
  state.editable.push('b');expect(await canViewOpportunity(row)).toBe(true);
  state.user=null;state.organizer=true;expect(await canViewOpportunity(row)).toBe(true);
 });
 it('keeps managed opportunities off the legacy public route',async()=>{
  const legacy={...row,status:'open'};expect((await publicOpportunityIds([legacy])).has(row.id)).toBe(true);
  state.managed=[row.id];expect((await publicOpportunityIds([legacy])).has(row.id)).toBe(false);
 });
});
