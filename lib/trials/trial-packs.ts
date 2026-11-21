import {and, eq, sql} from 'drizzle-orm';
import {db} from '../db';
import {evidence, opportunities, projects, trialPacks, trialPackVersions} from '../schema';
import {DefinitionSchema, DraftSchema} from './room-definitions';

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Reader = typeof db | Transaction;

export async function readTrialPack(id: string, reader: Reader = db, lock = false) {
  const query = reader.select().from(trialPacks).where(eq(trialPacks.id, id));
  const [pack] = await (lock ? query.for('update') : query);
  if (!pack || pack.publishedVersion === null) return null;
  const definition = await readPackVersion(id, pack.publishedVersion, reader);
  return {pack, definition};
}

export async function readPackVersion(id: string, version: number, reader: Reader = db) {
  const [row] = await reader.select().from(trialPackVersions).where(and(
    eq(trialPackVersions.packId, id), eq(trialPackVersions.version, version),
  ));
  if (!row) throw new Error('Trial Pack version is unavailable.');
  return DefinitionSchema.parse(JSON.parse(row.definition));
}

export async function listPublishedTrials() {
  const rows = await db.select({definition: trialPackVersions.definition}).from(trialPacks)
    .innerJoin(trialPackVersions, and(eq(trialPacks.id, trialPackVersions.packId),
      eq(trialPacks.publishedVersion, trialPackVersions.version)))
    .where(eq(trialPacks.state, 'published')).orderBy(trialPacks.id);
  return rows.map(row => DefinitionSchema.parse(JSON.parse(row.definition)));
}

export async function saveTrialDraft(input: unknown, database = db, authorize?: (tx: Transaction, productId: string) => Promise<void>) {
  const draft = DraftSchema.parse(input);
  return database.transaction(async tx => {
    await authorize?.(tx, draft.productId);
    const [product] = await tx.select().from(projects).where(eq(projects.id, draft.productId));
    if (!product) throw new Error('Choose an existing project ID.');
    const {request, productId, ...fields} = draft;
    let provenance;
    let problemMap;
    if (request.kind === 'externally-sourced') {
      const [source] = await tx.select({evidence, opportunity: opportunities}).from(evidence)
        .innerJoin(opportunities, eq(evidence.opportunityId, opportunities.id))
        .where(and(eq(evidence.id, request.evidenceId), eq(opportunities.projectA, productId),
          eq(opportunities.kind, 'user-testing')));
      if (!source) throw new Error('Choose evidence from a testing request for this product.');
      provenance = {kind: request.kind, text: source.evidence.claim, sourceUrl: source.evidence.sourceUrl,
        revision: source.evidence.revision, verification: source.evidence.verification};
      problemMap = {slug: 'unclassified', opportunityId: source.opportunity.id, sourceUrl: source.evidence.sourceUrl};
    } else {
      provenance = request;
    }
    const [pack] = await tx.insert(trialPacks).values({id: draft.id, state: 'draft', latestVersion: 1})
      .onConflictDoUpdate({target: trialPacks.id, set: {latestVersion: sql`${trialPacks.latestVersion} + 1`}})
      .returning();
    if (pack.state === 'closed') throw new Error('This Trial Pack is closed.');
    if (pack.latestVersion > 1) {
      const previous = await readPackVersion(pack.id, pack.latestVersion - 1, tx);
      if (previous.product.id !== productId) throw new Error('A room retains its original product.');
    }
    const definition = DefinitionSchema.parse({...fields, product: {id: product.id, name: product.name},
      version: String(pack.latestVersion), request: provenance, problemMap});
    await tx.insert(trialPackVersions).values({packId: pack.id, version: pack.latestVersion,
      definition: JSON.stringify(definition)});
    return pack;
  });
}

export async function setTrialPackState(id: string, version: number, state: 'published' | 'paused' | 'closed', database = db,
  authorize?: (tx: Transaction, productId: string) => Promise<void>) {
  return database.transaction(async tx => {
    if (authorize) {
      const [room] = await tx.select().from(trialPacks).where(eq(trialPacks.id,id));
      if (!room) throw new Error('Trial Pack is unavailable.');
      const definition = await readPackVersion(id,room.latestVersion,tx);
      await authorize(tx,definition.product.id);
    }
  const [pack] = await tx.update(trialPacks).set(state === 'published' ? {state, publishedVersion: version} : {state})
    .where(and(eq(trialPacks.id, id), eq(trialPacks.latestVersion, version),
      state === 'paused' ? eq(trialPacks.state, 'published') : sql`${trialPacks.state} <> 'closed'`)).returning();
  if (!pack) throw new Error('The room changed or this transition is unavailable. Reload and review it.');
  });
}
