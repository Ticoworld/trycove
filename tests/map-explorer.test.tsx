import {describe,expect,it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {MapExplorer,type Product} from '../app/map/world-explorer';
import {PROBLEM_DOMAINS} from '../lib/problem-map';
const domains=PROBLEM_DOMAINS.map(({slug,title,summary})=>({slug,title,summary}));
const fixture:Product={id:'test-one',name:'Synthetic payment tool',description:'Test only',sourceUrl:'https://example.com',revision:'test',memberships:[{slug:'payments-checkout',evidence:[{kind:'directory-category',label:'Payment'}]},{slug:'developer-tools',evidence:[{kind:'directory-category',label:'Dev Tools'}]}]};
describe('map explorer initial rendering',()=>{
 it('keeps all nine areas available when the dataset is empty',()=>{const html=renderToStaticMarkup(<MapExplorer domains={domains} products={[]}/>);expect(html).toContain('Unmapped');expect(html.match(/aria-pressed="false"/g)).toHaveLength(9);expect(html).toContain('Browse areas')});
 it('counts one identity in both supported areas without assigning unmapped identities',()=>{const unclassified={...fixture,id:'unmapped',memberships:[]};const html=renderToStaticMarkup(<MapExplorer domains={domains} products={[fixture,unclassified]}/>);expect(html).toContain('Payments &amp; Fiber, 1 projects');expect(html).toContain('Developer &amp; Contract Tools, 1 projects');expect(html).toContain('Trading &amp; Markets, 0 projects');expect(html).toContain('Unmapped <span>1</span>')});
 it('shows occupancy only for areas with supported memberships',()=>{const html=renderToStaticMarkup(<MapExplorer domains={domains} products={[fixture]}/>);expect(html.match(/class="place-count"/g)).toHaveLength(2);expect(html).toContain('aria-label="Trading &amp; Markets, 0 projects"')});
});
