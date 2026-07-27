import { DatabaseSync } from 'node:sqlite';
import { drizzle } from 'drizzle-orm/node-sqlite';
import * as schema from './schema.js';

// Setup connection to the local SQLite database
const sqlite = new DatabaseSync('sqlite.db');

// Setup Drizzle ORM client using native node:sqlite client (casting config to any to resolve TS typings mismatch)
export const db = drizzle({ client: sqlite, schema } as any);
export { sqlite };
export * as schema from './schema.js';
