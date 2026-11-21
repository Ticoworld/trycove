import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {drizzle} from 'drizzle-orm/pglite';
import {expect, it, vi} from 'vitest';
import {requireProjectPermission, requireOrganizer} from '../lib/authorization';
import {manageMaintainer} from '../app/account/claims';

const mocks = vi.hoisted(() => ({getUser: vi.fn(), db: {current: null as unknown}}));
vi.mock('../lib/db', () => ({get db() {return mocks.db.current;}}));
vi.mock('../lib/neon-auth', () => ({
  authConfigured: () => true,
  serverAuth: () => ({getSession: mocks.getUser}),
}));

it('isolates project roles across authenticated accounts and rejects anonymous access', async () => {
  const db = new PGlite();
  try {
    await db.exec(await readFile('migrations/0001_initial.sql','utf8'));
    await db.exec("CREATE FUNCTION reject_follow_up_history_mutation() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'append-only'; END; $$");
    await db.exec(await readFile('migrations/0018_identity.sql','utf8'));
    mocks.db.current = drizzle(db);
    const owner = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const other = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    await db.exec("INSERT INTO projects(id,name,description,source_url,revision,observed_at) VALUES ('first','First','','https://example.com','fixture',now()),('second','Second','','https://example.org','fixture',now())");
    await db.query('INSERT INTO app_users(id) VALUES ($1), ($2)', [owner, other]);
    await db.query("INSERT INTO project_memberships VALUES ('first',$1,'owner'),('second',$2,'owner'),('second',$1,'maintainer')", [owner, other]);
    const change = new FormData();
    change.set('projectId', 'first');
    change.set('userId', other);
    change.set('operation', 'add');
    mocks.getUser.mockResolvedValue({data: {user: {id: other, user_metadata: {organizer: true}}}, error: null});
    await expect(manageMaintainer(change)).rejects.toThrow('Project permission');
    await expect(requireOrganizer()).rejects.toThrow('Organizer access');
    mocks.getUser.mockResolvedValue({data: {user: {id: owner}}, error: null});
    await expect(requireProjectPermission('first','publish')).resolves.toMatchObject({id: owner});
    await expect(requireProjectPermission('second','edit')).resolves.toMatchObject({id: owner});
    await expect(requireProjectPermission('second','publish')).rejects.toThrow('Project permission');
    mocks.getUser.mockResolvedValue({data: {user: null}, error: new Error('unauthenticated')});
    await expect(manageMaintainer(change)).rejects.toThrow('Sign in');
  } finally {
    await db.close();
  }
}, 60000);
