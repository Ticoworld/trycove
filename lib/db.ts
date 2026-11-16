import {PGlite} from '@electric-sql/pglite';
import {drizzle as pgliteDrizzle} from 'drizzle-orm/pglite';
import {drizzle as pgDrizzle} from 'drizzle-orm/node-postgres';
import {Pool} from 'pg';
import * as schema from './schema';
const globalDb=globalThis as typeof globalThis & {tcDb?:ReturnType<typeof pgliteDrizzle<typeof schema>>};
export const db = globalDb.tcDb ?? (process.env.DATABASE_URL ? pgDrizzle(new Pool({connectionString:process.env.DATABASE_URL}),{schema}) : pgliteDrizzle(new PGlite('./.data/trycove'),{schema}));
if(process.env.NODE_ENV!=='production') globalDb.tcDb=db as ReturnType<typeof pgliteDrizzle<typeof schema>>;
