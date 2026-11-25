import {describe,it,expect} from 'vitest';
import {eq} from 'drizzle-orm';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {drizzle} from 'drizzle-orm/pglite';
import {qualifiedCatalogCondition} from '../lib/qualified-map';
import {importCatalog,prepareCatalog,snapshotPath} from '../lib/catalog-recovery';
import {selectQualifiedCatalog} from '../lib/catalog-qualification';
import * as schema from '../lib/schema';

describe('release catalog visibility',()=>{
 it('keeps reviewed exclusions and drafts hidden while preserving published legacy products',async()=>{
  const instance=new PGlite();const beforePreview=process.env.TRYCOVE_QUALIFIED_PREVIEW;const beforeLegacy=process.env.TRYCOVE_INCLUDE_PUBLISHED_LEGACY;
  try{
   const names=['initial','connections','footprints','intelligence','trial_evidence','project_repositories','signal_intents','candidate_lifecycle','need_items','need_taxonomy','need_lineage_and_decisions','opportunity_qualification','opportunity_prior_work_reconciliations','external_source_snapshots','guided_trial_rooms','devrel_handoffs','trial_packs'];
   for(let i=0;i<names.length;i++)await instance.exec(await readFile(`migrations/${String(i+1).padStart(4,'0')}_${names[i]}.sql`,'utf8'));
   const db=drizzle(instance,{schema});const raw=await readFile(snapshotPath);const qualified=selectQualifiedCatalog(raw);const review=prepareCatalog(raw).rows.find(row=>row.project.id==='arweave');expect(review).toBeDefined();await importCatalog(db,[qualified[0],review!]);
   const base={name:'Fixture',description:'',sourceUrl:'https://example.test',revision:'fixture',observedAt:new Date('2026-01-01')};await db.insert(schema.projects).values([{...base,id:'legacy-published'},{...base,id:'legacy-draft'},{...base,id:'organizer-ref-private'}]);
   for(const [id,product,state] of [['public-room','legacy-published','published'],['draft-room','legacy-draft','draft'],['review-room','arweave','published'],['reference-room','organizer-ref-private','published']] as const){await db.transaction(async tx=>{await tx.insert(schema.trialPacks).values({id,state:'draft',latestVersion:1,publishedVersion:null});await tx.insert(schema.trialPackVersions).values({packId:id,version:1,definition:JSON.stringify({product:{id:product}})});if(state==='published')await tx.update(schema.trialPacks).set({state:'published',publishedVersion:1}).where(eq(schema.trialPacks.id,id));});}
   process.env.TRYCOVE_QUALIFIED_PREVIEW='1';delete process.env.TRYCOVE_INCLUDE_PUBLISHED_LEGACY;
   expect((await db.select({id:schema.projects.id}).from(schema.projects).where(qualifiedCatalogCondition())).map(r=>r.id)).toEqual([qualified[0].project.id]);
   process.env.TRYCOVE_INCLUDE_PUBLISHED_LEGACY='1';
   expect((await db.select({id:schema.projects.id}).from(schema.projects).where(qualifiedCatalogCondition())).map(r=>r.id).sort()).toEqual([qualified[0].project.id,'legacy-published'].sort());
   delete process.env.TRYCOVE_QUALIFIED_PREVIEW;
   expect((await db.select({id:schema.projects.id}).from(schema.projects).where(qualifiedCatalogCondition())).some(row=>row.id==='organizer-ref-private')).toBe(false);
  }finally{if(beforePreview===undefined)delete process.env.TRYCOVE_QUALIFIED_PREVIEW;else process.env.TRYCOVE_QUALIFIED_PREVIEW=beforePreview;if(beforeLegacy===undefined)delete process.env.TRYCOVE_INCLUDE_PUBLISHED_LEGACY;else process.env.TRYCOVE_INCLUDE_PUBLISHED_LEGACY=beforeLegacy;await instance.close()}
 },60000);
});
