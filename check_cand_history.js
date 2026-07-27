import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, '..', 'sqlite.db');
const db = new DatabaseSync(dbPath);

console.log('=== CHECKING CANDIDATES AND AI PROVIDER HISTORY ===\n');

const cands = db.prepare(`SELECT id, name, original_filename, created_at FROM candidates`).all();
console.log('Candidates in DB:');
cands.forEach(c => console.log(`  ID #${c.id}: ${c.name} (${c.original_filename}) | Created: ${c.created_at}`));

const audits = db.prepare(`SELECT id, action_type, details, created_at FROM audit_logs WHERE action_type = 'CV Upload' ORDER BY id ASC`).all();
console.log('\nCV Upload Audit Log Entries:');
audits.forEach(a => console.log(`  [Audit #${a.id}] ${a.created_at} | Details: ${a.details}`));
