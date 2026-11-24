// @vitest-environment jsdom
import React,{act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {afterEach,beforeEach,describe,expect,it} from 'vitest';
import {RelationshipVisual} from '../app/opportunities/relationship-visual';
import type {RelationshipProfile} from '../app/opportunities/relationship-profiles';
const consumer:RelationshipProfile={id:'a',name:'Example requester',visible:true};
const provider:RelationshipProfile={id:'b',name:'Example provider',visible:true,logo:'https://example.com/logo.webp'};
let container:HTMLDivElement;let root:Root;
beforeEach(()=>{Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});container=document.createElement('div');document.body.append(container);root=createRoot(container)});
afterEach(()=>{act(()=>root.unmount());container.remove()});
describe('relationship visual',()=>{
 it('shows an open endpoint without claiming a provider is absent everywhere',()=>{act(()=>root.render(<RelationshipVisual consumer={consumer}/>));expect(container.textContent).toContain('Open to a match');expect(container.querySelector('.relationship')?.getAttribute('aria-label')).toContain('provider not yet identified');expect(container.querySelector('.connection-mark svg')).toBeTruthy()});
 it('distinguishes proposed relationships from recorded trials without implying a pass',()=>{act(()=>root.render(<RelationshipVisual consumer={consumer} provider={provider}/>));expect(container.querySelector('.relationship')?.getAttribute('aria-label')).toContain('proposed connection');act(()=>root.render(<RelationshipVisual consumer={consumer} provider={provider} tested/>));expect(container.querySelector('.relationship')?.getAttribute('aria-label')).toContain('trial record available');expect(container.textContent).not.toMatch(/passed|compatible|adopted/i)});
 it('uses an illustration when a source logo fails',()=>{Object.defineProperty(HTMLImageElement.prototype,'complete',{configurable:true,get:()=>false});act(()=>root.render(<RelationshipVisual consumer={provider}/>));const img=container.querySelector('img');expect(img).toBeTruthy();act(()=>img!.dispatchEvent(new Event('error')));expect(container.querySelector('img')).toBeNull();expect(container.querySelector('.connection-mark svg')).toBeTruthy();delete (HTMLImageElement.prototype as unknown as {complete?:boolean}).complete});
});
