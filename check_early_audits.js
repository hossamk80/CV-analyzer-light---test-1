import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, '..', 'sqlite.db');
const db = new DatabaseSync(dbPath);

console.log('=== SEEDING AUDIT LOGS FOR EARLY AI ANALYSES ===\n');

const audits = db.prepare(`SELECT id, action_type, details, created_at, before_value, after_value FROM audit_logs ORDER BY id ASC`).all();
audits.slice(0, 15).forEach(a => {
  console.log(`[Audit #${a.id}] ${a.created_at} | Type: ${a.action_type} | Details: ${a.details}`);
  if (a.after_value) console.log(`   AfterValue: ${a.after_value.slice(0, 120)}...`);
});
