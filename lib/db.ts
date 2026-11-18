import {PGlite} from '@electric-sql/pglite';
import {drizzle as pgliteDrizzle} from 'drizzle-orm/pglite';
import {drizzle as pgDrizzle} from 'drizzle-orm/node-postgres';
import {Pool} from 'pg';
import * as schema from './schema';
type Database=ReturnType<typeof pgliteDrizzle<typeof schema>>;
const globalDb=globalThis as typeof globalThis & {tcDb?:Database};
function getDb():Database {if(!globalDb.tcDb)globalDb.tcDb=(process.env.DATABASE_URL?pgDrizzle(new Pool({connectionString:process.env.DATABASE_URL}),{schema}):pgliteDrizzle(new PGlite(process.env.TRYCOVE_PGLITE_PATH??'./.data/trycove'),{schema})) as Database;return globalDb.tcDb}
// Defer PGlite initialization until a request or command actually queries it.
export const db=new Proxy({} as Database,{get(_target,key){const instance=getDb();const value=Reflect.get(instance,key,instance);return typeof value==='function'?value.bind(instance):value}});
