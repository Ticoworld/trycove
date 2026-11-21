import {createHash} from 'node:crypto';
import {and,eq,inArray} from 'drizzle-orm';
import {z} from 'zod';
import {db} from './db';
import {historicalFeedback,projects,projectRepositories,sourceRecords} from './schema';

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
const manifest = z.strictObject({
  version:z.literal(1),projects:z.array(project).min(1).max(300),
  sources:z.array(source).max(1200),repositories:z.array(repository).max(1200),
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

export async function importPublicHistory(bundle: Buffer, bundleDigest: string,
  approvedExport: Buffer, exportDigest: string, database = db) {
  if (bundle.length > 16_000_000 || approvedExport.length > 200_000 ||
    sha256(bundle) !== bundleDigest || sha256(approvedExport) !== exportDigest) {
    throw new Error('An import digest or file size did not match.');
  }
  const parsed = manifest.parse(JSON.parse(bundle.toString('utf8')));
  const exportJson = approvedExport.toString('utf8');
  report.parse(JSON.parse(exportJson));
  const projectIds = new Set(parsed.projects.map(row=>row.id));
  if (!projectIds.has(owlId) || projectIds.size !== parsed.projects.length ||
    [parsed.sources,parsed.repositories].some(rows=>new Set(rows.map(row=>row.id)).size !== rows.length ||
      rows.some(row=>!projectIds.has(row.projectId)))) {
    throw new Error('The manifest has duplicate IDs or missing referenced Product Passports.');
  }
  return database.transaction(async tx => {
    await tx.insert(projects).values(parsed.projects).onConflictDoNothing();
    if (parsed.sources.length) await tx.insert(sourceRecords).values(parsed.sources).onConflictDoNothing();
    if (parsed.repositories.length) await tx.insert(projectRepositories).values(parsed.repositories).onConflictDoNothing();
    await tx.insert(historicalFeedback).values({sha256:exportDigest,projectId:owlId,exportJson}).onConflictDoNothing();
    const [saved] = await tx.select().from(historicalFeedback).where(and(
      eq(historicalFeedback.sha256,exportDigest),eq(historicalFeedback.projectId,owlId),
    ));
    const [actualProjects,actualSources,actualRepositories] = await Promise.all([
      tx.select().from(projects).where(inArray(projects.id,parsed.projects.map(row=>row.id))),
      parsed.sources.length ? tx.select().from(sourceRecords).where(inArray(sourceRecords.id,parsed.sources.map(row=>row.id))) : [],
      parsed.repositories.length ? tx.select().from(projectRepositories).where(inArray(projectRepositories.id,parsed.repositories.map(row=>row.id))) : [],
    ]);
    function matches<T extends {id:string}>(expected:T[], actual:T[]) {
      const rows = new Map(actual.map(row=>[row.id,row]));
      return expected.every(row=>{
        const found = rows.get(row.id);
        return found && Object.entries(row).every(([key,value])=>
          JSON.stringify(found[key as keyof T]) === JSON.stringify(value));
      });
    }
    if (!matches(parsed.projects,actualProjects) || !matches(parsed.sources,actualSources) ||
      !matches(parsed.repositories,actualRepositories) || !saved ||
      sha256(Buffer.from(saved.exportJson))!==exportDigest) {
      throw new Error('Imported IDs, provenance, or report bytes conflict with existing data.');
    }
    return {projects:actualProjects.length,sources:actualSources.length,repositories:actualRepositories.length,exportDigest};
  });
}
