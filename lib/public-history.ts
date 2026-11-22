import {createHash} from 'node:crypto';
import {and,eq,inArray,sql} from 'drizzle-orm';
import {z} from 'zod';
import {db} from './db';
import {historicalFeedback,projects,projectRepositories,sourceRecords,opportunities,evidence} from './schema';

const id = z.string().min(1).max(200);
const date = z.iso.datetime({offset:true}).transform(value=>new Date(value));
const url = z.url().max(2048);
const project = z.strictObject({
  id,name:z.string().min(1).max(500),description:z.string().max(30000),website:url.nullable(),
  repository:url.nullable(),sourceUrl:url,revision:z.string().min(1),observedAt:date,
});
const source = z.strictObject({
  id,projectId:id,source:z.string().min(1),sourceUrl:url,revision:z.string().min(1),
  raw:z.string().max(200000),observedAt:date,
});
const repository = z.strictObject({
  id,projectId:id,repository:url,role:z.string().min(1),sourceUrl:url,
  revision:z.string().min(1),verification:z.string().min(1),observedAt:date,
});
const opportunity = z.strictObject({
  id, projectA:id, projectB:id.nullable(), kind:z.string(), problem:z.string(),
  reasoning:z.string(), requirements:z.string(), experiment:z.string(), status:z.string(),
});
const sourceEvidence = z.strictObject({
  id:z.number().int().positive(), opportunityId:id, needItemId:z.null(),
  claim:z.string(), sourceUrl:url, revision:z.string().nullable(), observedAt:date, verification:z.string(),
});
const manifest = z.strictObject({
  version:z.literal(1),projects:z.array(project).min(1).max(300),
  sources:z.array(source).max(1200),repositories:z.array(repository).max(1200),
  opportunities:z.array(opportunity).max(1200), evidence:z.array(sourceEvidence).max(1200),
});
const owlId = 'ckbuilder-owlpilot-67';
const report = z.object({
  schemaVersion:z.literal('trycove-approved-handoff-export/1.0'),
  exportedAt:z.iso.datetime(),
  report:z.object({
    type:z.literal('feedback'),project:z.object({name:z.literal('Owl Pilot')}),
    tasks:z.array(z.object({task:z.string(),outcome:z.string(),note:z.string().optional()})).min(1).max(12),
  }),
});
export const sha256 = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');


export async function importPublicHistory(bundle: Buffer, bundleDigest: string, database = db) {
  if (bundle.length > 16_000_000 || sha256(bundle) !== bundleDigest) throw new Error('Manifest digest or size did not match.');
  const parsed = manifest.parse(JSON.parse(bundle.toString('utf8')));
  const projectIds = new Set(parsed.projects.map(row => row.id));
  const opportunityIds = new Set(parsed.opportunities.map(row => row.id));
  if (projectIds.size !== parsed.projects.length || opportunityIds.size !== parsed.opportunities.length ||
    [parsed.sources,parsed.repositories].some(rows => new Set(rows.map(row=>row.id)).size !== rows.length || rows.some(row=>!projectIds.has(row.projectId))) ||
    new Set(parsed.evidence.map(row=>row.id)).size !== parsed.evidence.length ||
    parsed.opportunities.some(row=>!projectIds.has(row.projectA) || (row.projectB !== null && !projectIds.has(row.projectB))) ||
    parsed.evidence.some(row=>!opportunityIds.has(row.opportunityId))) throw new Error('Duplicate IDs or missing manifest dependencies.');
  return database.transaction(async tx => {
    await tx.insert(projects).values(parsed.projects).onConflictDoNothing();
    if (parsed.sources.length) await tx.insert(sourceRecords).values(parsed.sources).onConflictDoNothing();
    if (parsed.repositories.length) await tx.insert(projectRepositories).values(parsed.repositories).onConflictDoNothing();
    if (parsed.opportunities.length) await tx.insert(opportunities).values(parsed.opportunities).onConflictDoNothing();
    if (parsed.evidence.length) await tx.insert(evidence).values(parsed.evidence).onConflictDoNothing();
    const actualProjects = await tx.select().from(projects).where(inArray(projects.id,parsed.projects.map(row=>row.id)));
    const actualSources = parsed.sources.length ? await tx.select().from(sourceRecords).where(inArray(sourceRecords.id,parsed.sources.map(row=>row.id))) : [];
    const actualRepositories = parsed.repositories.length ? await tx.select().from(projectRepositories).where(inArray(projectRepositories.id,parsed.repositories.map(row=>row.id))) : [];
    const actualOpportunities = parsed.opportunities.length ? await tx.select().from(opportunities).where(inArray(opportunities.id,parsed.opportunities.map(row=>row.id))) : [];
    const actualEvidence = parsed.evidence.length ? await tx.select().from(evidence).where(inArray(evidence.id,parsed.evidence.map(row=>row.id))) : [];
    function matches<T extends {id:string | number}>(expected:T[], actual:T[]) {
      const rows = new Map(actual.map(row=>[row.id,row]));
      return expected.every(row=>{const found=rows.get(row.id);return found && Object.entries(row).every(([key,value])=>JSON.stringify(found[key as keyof T])===JSON.stringify(value));});
    }
    if (!matches(parsed.projects,actualProjects) || !matches(parsed.sources,actualSources) ||
      !matches(parsed.repositories,actualRepositories) || !matches(parsed.opportunities,actualOpportunities) ||
      !matches(parsed.evidence,actualEvidence)) throw new Error('Imported IDs or provenance conflict with existing data.');
    if (parsed.evidence.length) {
      await tx.execute(sql`SELECT setval(pg_get_serial_sequence('evidence','id'), GREATEST((SELECT last_value FROM evidence_id_seq), (SELECT max(id) FROM evidence)), true)`);
    }
    return {projects:actualProjects.length,sources:actualSources.length,repositories:actualRepositories.length,
      opportunities:actualOpportunities.length,evidence:actualEvidence.length};
  });
}

export async function importApprovedFeedback(approvedExport: Buffer, exportDigest: string, database = db) {
  if (approvedExport.length > 200_000 || sha256(approvedExport) !== exportDigest) throw new Error('Report digest or size did not match.');
  const exportJson = approvedExport.toString('utf8');
  report.parse(JSON.parse(exportJson));
  return database.transaction(async tx => {
    await tx.insert(historicalFeedback).values({sha256:exportDigest,projectId:owlId,exportJson}).onConflictDoNothing();
    const [saved] = await tx.select().from(historicalFeedback).where(and(eq(historicalFeedback.sha256,exportDigest),eq(historicalFeedback.projectId,owlId)));
    if (!saved || sha256(Buffer.from(saved.exportJson)) !== exportDigest) throw new Error('Historical report conflicts with existing data.');
    return {exportDigest};
  });
}
