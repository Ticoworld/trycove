import 'server-only';
import {and, inArray, sql} from 'drizzle-orm';
import {db} from './db';
import {projects, opportunities} from './schema';
import {qualifiedCatalogCondition} from './qualified-map';
import {authenticatedUser, checkProjectPermission} from './authorization';
import {hasOrganizerSession} from './organizer-auth';

type Opportunity = typeof opportunities.$inferSelect;

export async function publicOpportunityIds(rows: Opportunity[]) {
  const ids = [...new Set(rows.flatMap(row => [row.projectA, ...(row.projectB ? [row.projectB] : [])]))];
  if (!ids.length) return new Set<string>();
  const visible = new Set((await db.select({id: projects.id}).from(projects)
    .where(and(inArray(projects.id, ids), qualifiedCatalogCondition()))).map(row => row.id));
  const table = await db.execute<{name:string|null}>(sql`select to_regclass('public.connection_operations')::text as name`);
  const managed = new Set<string>();
  if (table.rows[0]?.name) {
    const records = await db.execute<{opportunity_id:string}>(sql`select opportunity_id from connection_operations where publication <> 'legacy'`);
    for (const record of records.rows) managed.add(record.opportunity_id);
  }
  return new Set(rows.filter(row => !managed.has(row.id) && row.status !== 'needs-review' && visible.has(row.projectA) &&
    (!row.projectB || visible.has(row.projectB))).map(row => row.id));
}

export async function canManageOpportunity(row: Opportunity) {
  if (await hasOrganizerSession()) return true;
  const user = await authenticatedUser();
  if (!user) return false;
  // Every private project in the candidate requires editor permission.
  const ids = [row.projectA, ...(row.projectB ? [row.projectB] : [])];
  const visible = new Set((await db.select({id: projects.id}).from(projects)
    .where(and(inArray(projects.id, ids), qualifiedCatalogCondition()))).map(project => project.id));
  let editor = false;
  for (const id of [row.projectA, ...(row.projectB ? [row.projectB] : [])]) {
    const allowed = await checkProjectPermission(db, user.id, id, 'edit').then(() => true, () => false);
    editor ||= allowed;
    if (!visible.has(id) && !allowed) return false;
  }
  return editor;
}

export async function canViewOpportunity(row: Opportunity) {
  return (await publicOpportunityIds([row])).has(row.id) || await canManageOpportunity(row);
}
