import {and, eq} from 'drizzle-orm';
import {qualifiedCatalogCondition} from '../lib/qualified-map';
import {checkProjectPermission} from '../lib/authorization';
import {db} from '../lib/db';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtemp, readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {PGlite} from '@electric-sql/pglite';
import {drizzle} from 'drizzle-orm/pglite';
import manifest from '../evidence/data-01c/qualified-catalog.json';
import {importCatalog, prepareCatalog, snapshotPath} from '../lib/catalog-recovery';
import {selectQualifiedCatalog} from '../lib/catalog-qualification';
import {getProblemMapOverview, getProjectProblemDomains} from '../lib/problem-map-data';
import * as schema from '../lib/schema';

async function main() {
  const raw = await readFile(snapshotPath);
  const original = prepareCatalog(raw);
  const rows = selectQualifiedCatalog(raw);
  assert.equal(manifest.decisions.length, 64);
  assert.equal(original.rows.length, 150);
  assert(manifest.decisions.every(row => row.availability === 'unknown'));
  assert.equal(JSON.stringify(selectQualifiedCatalog(raw)), JSON.stringify(rows));
  assert.deepEqual(rows, original.rows.filter(row => rows.some(selected => selected.project.id === row.project.id)));
  assert(!rows.some(row => ['arweave', 'mbabelcloud', 'map-fixture'].includes(row.project.id)));
  const invalid = structuredClone(manifest);
  invalid.decisions[1].id = invalid.decisions[0].id;
  assert.throws(() => selectQualifiedCatalog(raw, invalid), /identity or provenance/);
  const root = await mkdtemp(join(tmpdir(), 'trycove-data01c-'));
  const path = join(root, 'catalog');
  console.log('Preview directory:', root);
  execFileSync(process.execPath, ['--import', 'tsx', 'scripts/migrate.ts'], {
    env: {...process.env, DATABASE_URL: '', TRYCOVE_MIGRATION_DATABASE_URL: '', NODE_ENV: 'development',
      VERCEL: '', TRYCOVE_PGLITE_PATH: path}, stdio: 'inherit',
  });
  const client = await PGlite.create(path);
  const database = drizzle(client, {schema});
  const globals = globalThis as typeof globalThis & {tcDb?: typeof database};
  globals.tcDb = database;
  process.env.TRYCOVE_QUALIFIED_PREVIEW = '1';
  try {
    const read = async () => Promise.all([
      database.select().from(schema.projects).orderBy(schema.projects.id),
      database.select().from(schema.sourceRecords).orderBy(schema.sourceRecords.id),
      database.select().from(schema.projectRepositories).orderBy(schema.projectRepositories.id),
      database.select().from(schema.signals).orderBy(schema.signals.id),
    ] as const);
    const fixture = {...rows[0].project, id: 'editor-fixture', name: 'Editor fixture'};
    const linked = {...fixture, id: 'trial-linked', name: 'Trial linked project'};
    const reviewOnly = original.rows.find(row => row.project.id === 'arweave');
    assert(reviewOnly);
    await importCatalog(database, [reviewOnly]);
    await database.insert(schema.projects).values([fixture, linked]);
    const userId = '00000000-0000-4000-8000-000000000001';
    await database.insert(schema.appUsers).values({id:userId});
    await database.insert(schema.projectMemberships).values({userId, projectId:linked.id, role:'owner'});
    await database.transaction(async tx => {
      await tx.insert(schema.trialPacks).values({id:'catalog-test-trial', state:'draft', latestVersion:1});
      await tx.insert(schema.trialPackVersions).values({packId:'catalog-test-trial', version:1, definition:JSON.stringify({productId:linked.id})});
    });
    const trialBefore = await database.select().from(schema.trialPackVersions);
    await importCatalog(database, rows);
    const first = await read();
    await importCatalog(database, rows);
    assert.deepEqual(await read(), first);
    assert.deepEqual(await database.select().from(schema.trialPackVersions), trialBefore);
    await checkProjectPermission(db, userId, linked.id, 'edit');
    await assert.rejects(checkProjectPermission(db, userId, fixture.id, 'edit'), /permission/);
    assert.equal((await database.select().from(schema.projects).where(and(eq(schema.projects.id, linked.id), qualifiedCatalogCondition()))).length, 0);
    const conflict = {...rows[0], project:{...rows[0].project, description:'Conflicting description'}};
    await assert.rejects(importCatalog(database, [conflict]), /provenance conflict/);
    assert.deepEqual(await read(), first);
    const overview = await getProblemMapOverview();
    assert.equal(overview.projects.length, rows.length);
    for (const decision of manifest.decisions) {
      assert.equal(overview.projects.some(row => row.id === decision.id), decision.outcome === 'QUALIFIED');
      assert.deepEqual([...(overview.memberships.get(decision.id)?.keys() ?? [])].sort(), [...decision.approvedDomains].sort());
    }
    assert.equal((await getProjectProblemDomains('grid3')).size, 0);
    assert(first[3].some(row => row.projectId === 'grid3' && row.claim === 'CKBdapps category: DeFi'));
    assert.deepEqual(prepareCatalog(raw), original);
    console.log(JSON.stringify({projects: rows.length, classified: overview.memberships.size, unmapped: overview.unclassifiedCount,
      sources: first[1].length, repositories: first[2].length, signals: first[3].length, regions: Object.fromEntries(overview.counts)}));
  } finally {
    delete globals.tcDb;
    await client.close();
  }
}
main().catch(error => {console.error(error); process.exitCode = 1;});
