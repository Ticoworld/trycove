import 'server-only';
import {sql} from 'drizzle-orm';
import {db} from './db';

export async function publicConnectionCopies() {
 const table=await db.execute<{name:string|null}>(sql`select to_regclass('public.connection_operations')::text as name`);
 if(!table.rows[0]?.name)return [];
 const result=await db.execute<{opportunity_id:string;public_title:string;public_summary:string;public_source_url:string;public_kind:string}>(sql`select opportunity_id,public_title,public_summary,public_source_url,public_kind from connection_operations where publication='published' and reviewed_by is not null and reviewed_at is not null and public_title is not null and public_summary is not null and public_source_url is not null and public_kind is not null`);
 return result.rows;
}
