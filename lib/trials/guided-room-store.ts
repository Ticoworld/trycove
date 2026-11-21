import {createHash, randomBytes, timingSafeEqual} from 'node:crypto';
import {asc, desc, eq} from 'drizzle-orm';
import {z} from 'zod';
import {db} from '../db';
import {guidedTrialReceipts, guidedTrialSessions, guidedTrialStepEvents} from '../schema';
import type {GuidedTrialDefinition, GuidedTrialStatus} from './room-definitions';
import {DefinitionSchema} from './room-definitions';
import {readTrialPack} from './trial-packs';
import {GUIDED_TRIAL_ACCESS_MAX_AGE_SECONDS} from './room-auth';

export const GuidedTrialStatusSchema = z.enum(['completed', 'failed', 'stuck', 'skipped']);
export type GuidedTrialEvent = typeof guidedTrialStepEvents.$inferSelect;
export type GuidedTrialSession = typeof guidedTrialSessions.$inferSelect;
export type GuidedTrialReceiptRow = typeof guidedTrialReceipts.$inferSelect;

export type SessionReceipt = {
  schemaVersion: 'trycove-guided-trial-receipt/1.0';
  receiptVersion: number;
  sessionId: string;
  sessionType: 'guided-trial-session';
  product: GuidedTrialDefinition['product'];
  problemMap: GuidedTrialDefinition['problemMap'];
  application: GuidedTrialDefinition['application'];
  taskSet: {id: string; version: string; sha256: string};
  startedAt: string;
  selfReportedAt: string;
  updatedAt: string;
  completedAt: string | null;
  results: Array<{
    taskId: string;
    title: string;
    status: GuidedTrialStatus | 'not_recorded';
    latestNote: string | null;
    history: Array<{status: GuidedTrialStatus; note: string; observedAt: string}>;
  }>;
  limitations: string[];
  createdAt: string;
};

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');
const iso = (value: Date) => value.toISOString();
const RECEIPT_LIMITATIONS = [
  'Task outcomes and notes are self-reported. Tester identity and human participation are not independently verified.',
  'Application version information is supplied by the trial definition and is not independently verified.',
  'This is a Trycove user-observation receipt, not a CKB transaction receipt, security audit, compatibility verdict or adoption claim.',
  'Session notes are access-controlled in the app but are not encrypted per session in the database; the server/database operator can read them.',
  'Trycove does not request or store passkeys, seed phrases, private keys, wallet addresses or signatures.',
];

function makeReceipt(input: {
  version: number;
  session: GuidedTrialSession;
  definition: GuidedTrialDefinition;
  definitionSha256: string;
  events: GuidedTrialEvent[];
  createdAt: Date;
}): SessionReceipt {
  const results = input.definition.tasks.map((task) => {
    const history = input.events.filter((event) => event.taskId === task.id).map((event) => ({
      status: event.status as GuidedTrialStatus,
      note: event.note,
      observedAt: iso(event.observedAt),
    }));
    const latest = history.at(-1);
    return {
      taskId: task.id,
      title: task.title,
      status: latest?.status ?? 'not_recorded' as const,
      latestNote: latest?.note || null,
      history,
    };
  });
  return {
    schemaVersion: 'trycove-guided-trial-receipt/1.0',
    receiptVersion: input.version,
    sessionId: input.session.id,
    sessionType: 'guided-trial-session',
    product: input.definition.product,
    problemMap: input.definition.problemMap,
    application: input.definition.application,
    taskSet: {id: input.definition.id, version: input.definition.version, sha256: input.definitionSha256},
    startedAt: iso(input.session.startedAt),
    selfReportedAt: iso(input.session.selfReportedAt),
    updatedAt: iso(input.session.updatedAt),
    completedAt: input.session.completedAt ? iso(input.session.completedAt) : null,
    results,
    limitations: RECEIPT_LIMITATIONS,
    createdAt: iso(input.createdAt),
  };
}

function tokenMatches(token: string, digest: string, startedAt: Date) {
  if (Date.now() > startedAt.getTime() + GUIDED_TRIAL_ACCESS_MAX_AGE_SECONDS * 1000) return false;
  const actual = Buffer.from(sha256(token), 'hex');
  const expected = Buffer.from(digest, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function parseDefinition(snapshot: string) {
  let parsed: unknown;
  try { parsed = JSON.parse(snapshot); } catch { return null; }
  const result = DefinitionSchema.safeParse(parsed);
  return result.success ? result.data as GuidedTrialDefinition : null;
}

type GuidedTrialDatabase = typeof db;

export function createGuidedTrialStore(database: GuidedTrialDatabase = db) {
  async function addReceipt(tx: Parameters<Parameters<GuidedTrialDatabase['transaction']>[0]>[0], session: GuidedTrialSession, definition: GuidedTrialDefinition, events: GuidedTrialEvent[], createdAt: Date) {
    const [latest] = await tx.select({version: guidedTrialReceipts.version}).from(guidedTrialReceipts)
      .where(eq(guidedTrialReceipts.sessionId, session.id)).orderBy(desc(guidedTrialReceipts.version)).limit(1);
    const version = (latest?.version ?? 0) + 1;
    const receipt = makeReceipt({version, session, definition, definitionSha256: session.definitionSha256, events, createdAt});
    const serialized = JSON.stringify(receipt);
    await tx.insert(guidedTrialReceipts).values({
      id: `${session.id}:receipt:${version}`,
      sessionId: session.id,
      version,
      receiptSha256: sha256(serialized),
      receipt: serialized,
      createdAt,
    });
    return {receipt, receiptSha256: sha256(serialized)};
  }

  async function authorize(tx: Parameters<Parameters<GuidedTrialDatabase['transaction']>[0]>[0], sessionId: string, token: string) {
    const [session] = await tx.select().from(guidedTrialSessions).where(eq(guidedTrialSessions.id, sessionId)).for('update');
    return session && tokenMatches(token, session.accessTokenSha256, session.startedAt) ? session : null;
  }

  return {
    async createSession(packId: string, selfReported: boolean) {
      return database.transaction(async tx => {
        const room = await readTrialPack(packId, tx, true);
        const definition = room?.pack.state === 'published' ? room.definition : null;
        if (!definition || selfReported !== true) throw new Error('A valid guided trial and self-report acknowledgement are required.');
        const sessionId = randomBytes(18).toString('base64url');
        const accessToken = randomBytes(32).toString('base64url');
        const now = new Date();
        const definitionSnapshot = JSON.stringify(definition);
        const definitionSha256 = sha256(definitionSnapshot);
        const row: GuidedTrialSession = {
          id: sessionId,
          packId: definition.id,
          productId: definition.product.id,
          problemMapSlug: definition.problemMap?.slug ?? 'unclassified',
          problemMapOpportunityId: definition.problemMap?.opportunityId ?? null,
          definitionVersion: definition.version,
          definitionSha256,
          definitionSnapshot,
          accessTokenSha256: sha256(accessToken),
          selfReportedAt: now,
          startedAt: now,
          updatedAt: now,
          completedAt: null,
        };
        await tx.insert(guidedTrialSessions).values(row);
        await addReceipt(tx, row, definition, [], now);
        return {sessionId, accessToken, startedAt: now};
      });
    },

    async recordStep(input: {sessionId: string; packId?: string; accessToken: string; taskId: string; status: GuidedTrialStatus; note: string}) {
      const now = new Date();
      return database.transaction(async (tx) => {
        const session = await authorize(tx, input.sessionId, input.accessToken);
        if (!session || (input.packId !== undefined && session.packId !== input.packId)) return {ok: false as const, reason: 'unavailable' as const};
        if (session.completedAt) return {ok: false as const, reason: 'finished' as const};
        const definition = sha256(session.definitionSnapshot) === session.definitionSha256 ? parseDefinition(session.definitionSnapshot) : null;
        if (!definition || !definition.tasks.some((task) => task.id === input.taskId)) return {ok: false as const, reason: 'invalid-task' as const};
        const note = input.note.trim();
        if (note.length > 1200) return {ok: false as const, reason: 'invalid-note' as const};
        await tx.insert(guidedTrialStepEvents).values({sessionId: session.id, taskId: input.taskId, status: input.status, note, observedAt: now});
        const updatedSession = {...session, updatedAt: now};
        await tx.update(guidedTrialSessions).set({updatedAt: now}).where(eq(guidedTrialSessions.id, session.id));
        const events = await tx.select().from(guidedTrialStepEvents).where(eq(guidedTrialStepEvents.sessionId, session.id)).orderBy(asc(guidedTrialStepEvents.id));
        const receipt = await addReceipt(tx, updatedSession, definition, events, now);
        return {ok: true as const, version: receipt.receipt.receiptVersion};
      });
    },

    async finishSession(input: {sessionId: string; packId?: string; accessToken: string}) {
      const now = new Date();
      return database.transaction(async (tx) => {
        const session = await authorize(tx, input.sessionId, input.accessToken);
        if (!session || (input.packId !== undefined && session.packId !== input.packId)) return {ok: false as const, reason: 'unavailable' as const};
        if (session.completedAt) return {ok: true as const, alreadyFinished: true as const};
        const definition = sha256(session.definitionSnapshot) === session.definitionSha256 ? parseDefinition(session.definitionSnapshot) : null;
        if (!definition) return {ok: false as const, reason: 'invalid-definition' as const};
        const updatedSession = {...session, updatedAt: now, completedAt: now};
        await tx.update(guidedTrialSessions).set({updatedAt: now, completedAt: now}).where(eq(guidedTrialSessions.id, session.id));
        const events = await tx.select().from(guidedTrialStepEvents).where(eq(guidedTrialStepEvents.sessionId, session.id)).orderBy(asc(guidedTrialStepEvents.id));
        const receipt = await addReceipt(tx, updatedSession, definition, events, now);
        return {ok: true as const, alreadyFinished: false as const, version: receipt.receipt.receiptVersion};
      });
    },

    async loadSession(sessionId: string, accessToken: string) {
      const [session] = await database.select().from(guidedTrialSessions).where(eq(guidedTrialSessions.id, sessionId));
      if (!session || !tokenMatches(accessToken, session.accessTokenSha256, session.startedAt)) return null;
      const definition = sha256(session.definitionSnapshot) === session.definitionSha256 ? parseDefinition(session.definitionSnapshot) : null;
      if (!definition) return null;
      const [events, receipts] = await Promise.all([
        database.select().from(guidedTrialStepEvents).where(eq(guidedTrialStepEvents.sessionId, session.id)).orderBy(asc(guidedTrialStepEvents.id)),
        database.select().from(guidedTrialReceipts).where(eq(guidedTrialReceipts.sessionId, session.id)).orderBy(asc(guidedTrialReceipts.version)),
      ]);
      const latestReceipt = receipts.at(-1) ?? null;
      const receiptIntact = latestReceipt !== null && sha256(latestReceipt.receipt) === latestReceipt.receiptSha256;
      return {session, definition, events, receipts, latestReceipt, receiptIntact};
    },
  };
}

export const guidedTrialStore = createGuidedTrialStore();
