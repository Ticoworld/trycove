import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtemp, readFile, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {PGlite} from '@electric-sql/pglite';
import {drizzle} from 'drizzle-orm/pglite';
import {importCatalog, pilotIds, prepareCatalog, snapshotPath, snapshotRevision} from '../lib/catalog-recovery';
import {getProblemMapOverview} from '../lib/problem-map-data';
import * as schema from '../lib/schema';

async function main() {
  const raw = await readFile(snapshotPath);
  assert.throws(() => prepareCatalog(Buffer.concat([raw, Buffer.from(' ')])), /digest mismatch/);
  const {rows, manifest} = prepareCatalog(raw);
  assert.deepEqual(prepareCatalog(raw), {rows, manifest});
  assert.equal(manifest.length, 150);
  assert(manifest.every(row => !row.publicPromotionApproved && !row.fixture));
  assert.equal(manifest.find(row => row.id === 'arweave')?.outcome, 'review-required');

  const pilot = rows.filter(row => pilotIds.includes(row.project.id));
  const root = await mkdtemp(join(tmpdir(), 'trycove-data01b-'));
  const databasePath = join(root, 'catalog');
  console.log('Staging directory:', root);
  execFileSync(process.execPath, ['--import', 'tsx', 'scripts/migrate.ts'], {
    env: {...process.env, DATABASE_URL: '', TRYCOVE_MIGRATION_DATABASE_URL: '', NODE_ENV: 'development',
      VERCEL: '', TRYCOVE_PGLITE_PATH: databasePath}, stdio: 'inherit',
  });
  const client = await PGlite.create(databasePath);
  const database = drizzle(client, {schema});
  const globals = globalThis as typeof globalThis & {tcDb?: typeof database};
  globals.tcDb = database;
  try {
    const journal = await client.query<{version: string}>('SELECT version FROM trycove_migrations ORDER BY version');
    assert.deepEqual(journal.rows.map(row => row.version), Array.from({length:20}, (_, index) => String(index + 1).padStart(4, '0')));
    async function inventory() {
      const overview = await getProblemMapOverview();
      const tables = await Promise.all([
        database.select().from(schema.projects).orderBy(schema.projects.id),
        database.select().from(schema.sourceRecords).orderBy(schema.sourceRecords.id),
        database.select().from(schema.projectRepositories).orderBy(schema.projectRepositories.id),
        database.select().from(schema.signals).orderBy(schema.signals.id),
      ] as const);
      for (const row of tables[1]) {
        assert.equal(row.revision, snapshotRevision);
        assert.equal(JSON.parse(row.raw).record.slug, row.projectId);
      }
      const placements = Object.fromEntries([...overview.memberships].map(([id, groups]) => {
        for (const evidence of groups.values()) {
          assert(evidence.every(item => item.kind === 'directory-category' && item.revision === snapshotRevision &&
            tables[3].some(signal => signal.projectId === id && signal.claim === `CKBdapps category: ${item.label}` &&
              signal.sourceUrl === item.sourceUrl && signal.verification === item.verification)));
        }
        return [id, [...groups.keys()].sort()];
      }));
      return {tables, placements, counts: {
        projects: tables[0].length, sources: tables[1].length, repositories: tables[2].length, categorySignals: tables[3].length,
        classified: overview.memberships.size, unmapped: overview.unclassifiedCount,
        memberships: Object.values(placements).reduce((sum, groups) => sum + groups.length, 0),
        regions: Object.fromEntries(overview.counts),
      }};
    }

    await importCatalog(database, pilot);
    const initial = await inventory();
    assert.deepEqual(initial.placements, {
      'ckb-on-ramp': ['payments-checkout'], grid3: ['trading-markets'],
      cellula: ['accounts-identity', 'developer-tools'], ckbexplorer: ['chain-data-indexing'],
    });
    assert.equal(initial.counts.projects, 5);
    assert.equal(initial.counts.unmapped, 1);
    await importCatalog(database, pilot);
    assert.deepEqual(await inventory(), initial);

    const conflict = pilot[0];
    const extra = rows.find(row => !pilotIds.includes(row.project.id));
    assert(extra);
    await assert.rejects(importCatalog(database, [extra, {...conflict,
      signals: conflict.signals.map(signal => ({...signal, revision: 'conflicting revision'})),
    }]), /Catalog ID or provenance conflict/);
    assert.deepEqual(await inventory(), initial);
    console.log('Pilot passed:', JSON.stringify(initial.counts));

    await importCatalog(database, rows);
    const full = await inventory();
    assert.equal(full.counts.projects, rows.length);
    assert.equal(full.counts.projects, full.counts.sources);
    assert.equal(full.counts.projects, full.counts.classified + full.counts.unmapped);
    await importCatalog(database, rows);
    assert.deepEqual(await inventory(), full);
    const receipt = {revision: snapshotRevision, pilot: initial.counts, full: full.counts,
      idempotency: 'passed', rollback: 'passed',
      outcomes: Object.fromEntries(['source-backed-candidate', 'review-required', 'blocked'].map(outcome =>
        [outcome, manifest.filter(row => row.outcome === outcome).length])),
      entries: manifest.map(row => ({...row, staged: rows.some(item => item.project.id === row.id),
        mapDomains: full.placements[row.id] ?? []})),
    };
    await writeFile(join(root, 'publication-manifest.json'), JSON.stringify(receipt, null, 2) + '\n');
    console.log('Full run passed:', JSON.stringify({counts: full.counts, outcomes: receipt.outcomes}));
  } finally {
    delete globals.tcDb;
    await client.close();
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
