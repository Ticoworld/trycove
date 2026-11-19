import {describe, expect, it} from 'vitest';
import {readFile, rm, mkdtemp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {PGlite} from '@electric-sql/pglite';
import {drizzle} from 'drizzle-orm/pglite';
import * as schema from '../lib/schema';
import {db} from '../lib/db';
import {createGuidedTrialStore} from '../lib/trials/guided-room-store';

const migrationFiles = Array.from({length: 15}, (_, index) => `migrations/${String(index + 1).padStart(4, '0')}_${[
  'initial', 'connections', 'footprints', 'intelligence', 'trial_evidence', 'project_repositories', 'signal_intents', 'candidate_lifecycle', 'need_items', 'need_taxonomy', 'need_lineage_and_decisions', 'opportunity_qualification', 'opportunity_prior_work_reconciliations', 'external_source_snapshots', 'guided_trial_rooms',
][index]}.sql`);

async function migrate(instance: PGlite) {
  for (const file of migrationFiles) await instance.exec(await readFile(file, 'utf8'));
}

async function addOwlPilotFixture(instance: PGlite) {
  await instance.exec("INSERT INTO projects(id,name,description,source_url,revision,observed_at) VALUES ('ckbuilder-owlpilot-67','Owl Pilot','','https://github.com/Birdmannn/owl','source-revision',now())");
  await instance.exec("INSERT INTO opportunities(id,project_a,kind,problem,reasoning,requirements,experiment,status) VALUES ('need-bdf6f13b14eed451c7158856d0fd6f7b','ckbuilder-owlpilot-67','user-testing','UX request','source-backed request','no participant','human test','contact-worthy')");
}

describe('private Guided Trial Room persistence', () => {
  it('isolates access and recovers append-only task history and receipts after database reopen', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'trycove-guided-trial-'));
    const databasePath = join(directory, 'db');
    let first = new PGlite(databasePath);
    try {
      await migrate(first);
      await first.exec(await readFile('migrations/0015_guided_trial_rooms.sql', 'utf8'));
      await addOwlPilotFixture(first);
      const store = createGuidedTrialStore(drizzle(first, {schema}) as unknown as typeof db);
      const started = await store.createSession('owl-pilot-ux', true);
      expect(started.accessToken).toHaveLength(43);

      const privateRow = await first.query<{access_token_sha256: string}>("SELECT access_token_sha256 FROM guided_trial_sessions WHERE id=$1", [started.sessionId]);
      expect(privateRow.rows[0].access_token_sha256).not.toBe(started.accessToken);
      expect(await store.loadSession(started.sessionId, 'wrong-token')).toBeNull();
      expect(await store.recordStep({sessionId: started.sessionId, accessToken: 'wrong-token', taskId: 'account-addresses', status: 'completed', note: ''})).toMatchObject({ok: false, reason: 'unavailable'});

      expect(await store.recordStep({sessionId: started.sessionId, accessToken: started.accessToken, taskId: 'account-addresses', status: 'completed', note: ''})).toMatchObject({ok: true, version: 2});
      const emptyNote = await store.loadSession(started.sessionId, started.accessToken);
      expect(emptyNote?.events.at(-1)).toMatchObject({status: 'completed', note: ''});
      expect(await store.recordStep({sessionId: started.sessionId, accessToken: started.accessToken, taskId: 'account-addresses', status: 'stuck', note: 'I could not distinguish the two account roles.'})).toMatchObject({ok: true, version: 3});
      expect(await store.recordStep({sessionId: started.sessionId, accessToken: started.accessToken, taskId: 'not-a-real-task', status: 'completed', note: ''})).toMatchObject({ok: false, reason: 'invalid-task'});
      await expect(first.exec("UPDATE guided_trial_receipts SET receipt='altered' WHERE session_id='" + started.sessionId + "' AND version=1")).rejects.toThrow('append-only');

      await first.close();
      first = new PGlite(databasePath);
      const reopened = createGuidedTrialStore(drizzle(first, {schema}) as unknown as typeof db);
      const loaded = await reopened.loadSession(started.sessionId, started.accessToken);
      expect(loaded?.events.map((event) => [event.status, event.note])).toEqual([
        ['completed', ''],
        ['stuck', 'I could not distinguish the two account roles.'],
      ]);
      expect(loaded?.receipts.map((receipt) => receipt.version)).toEqual([1, 2, 3]);
      expect(loaded?.receiptIntact).toBe(true);
      expect(loaded?.definition.tasks.find((task) => task.id === 'account-addresses')?.instructions).toContain('owner');
      expect(loaded?.latestReceipt?.receiptSha256).toMatch(/^[a-f0-9]{64}$/);
      const receipt = JSON.parse(loaded!.latestReceipt!.receipt) as {sessionType: string; results: Array<{taskId: string; status: string; history: unknown[]}>};
      expect(receipt.sessionType).toBe('guided-trial-session');
      expect(receipt.results.find((result) => result.taskId === 'account-addresses')).toMatchObject({status: 'stuck', history: [{}, {}]});

      expect(await reopened.finishSession({sessionId: started.sessionId, accessToken: started.accessToken})).toMatchObject({ok: true, alreadyFinished: false, version: 4});
      expect(await reopened.finishSession({sessionId: started.sessionId, accessToken: started.accessToken})).toMatchObject({ok: true, alreadyFinished: true});
      expect(await reopened.recordStep({sessionId: started.sessionId, accessToken: started.accessToken, taskId: 'allowance-meaning', status: 'skipped', note: ''})).toMatchObject({ok: false, reason: 'finished'});

      const tables = await first.query<{sessions: string; events: string; humanReceipts: string; labReceipts: string}>(`SELECT
        (SELECT count(*) FROM guided_trial_sessions)::text AS sessions,
        (SELECT count(*) FROM guided_trial_step_events)::text AS events,
        (SELECT count(*) FROM guided_trial_receipts)::text AS "humanReceipts",
        (SELECT count(*) FROM trial_evidence_records)::text AS "labReceipts"`);
      expect(tables.rows[0]).toEqual({sessions: '1', events: '2', humanReceipts: '4', labReceipts: '0'});
    } finally {
      await first.close().catch(() => undefined);
      await rm(directory, {recursive: true, force: true});
    }
  }, 60000);
});
