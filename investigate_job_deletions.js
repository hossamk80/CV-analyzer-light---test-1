import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, '..', 'sqlite.db');
const db = new DatabaseSync(dbPath);

console.log('=== INVESTIGATING AUDIT LOGS FOR JOB DELETIONS ===\n');

const rows = db.prepare(`
  SELECT id, actor_username, actor_role, action_type, target_entity, target_entity_id, created_at, details 
  FROM audit_logs 
  WHERE action_type = 'Job Change' AND details LIKE '%Deleted job position%'
  ORDER BY id ASC
`).all();

console.log(`Found ${rows.length} job deletion audit log entries:\n`);
rows.forEach(r => {
  console.log(`[Audit ID ${r.id}] Timestamp: ${r.created_at} | Actor: ${r.actor_username} (${r.actor_role}) | Target ID: ${r.target_entity_id}`);
  console.log(`  Details: "${r.details}"\n`);
});
