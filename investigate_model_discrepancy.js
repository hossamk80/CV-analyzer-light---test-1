import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, '..', 'sqlite.db');
const db = new DatabaseSync(dbPath);

console.log('=== INVESTIGATING HISTORICAL AI MODEL AUDIT TRAIL & CANDIDATE CREATION ===\n');

// 1. Query candidate creation records and timestamps
const candidates = db.prepare(`SELECT id, name, created_at FROM candidates`).all();
console.log('[1] Candidates in DB:');
candidates.forEach(c => console.log(`  Candidate #${c.id}: ${c.name} | Created At: ${c.created_at}`));

// 2. Query audit logs for setting changes or AI provider activity
console.log('\n[2] All Audit Log Records:');
const auditLogs = db.prepare(`SELECT id, actor_username, action_type, target_entity, before_value, after_value, details, created_at FROM audit_logs ORDER BY id ASC`).all();

auditLogs.forEach(a => {
  console.log(`[Audit #${a.id}] ${a.created_at} | Action: "${a.action_type}" | Details: "${a.details}"`);
  if (a.before_value || a.after_value) {
    console.log(`  Before: ${a.before_value}`);
    console.log(`  After:  ${a.after_value}`);
  }
});

// 3. Query current ai_providers table contents
console.log('\n[3] Current AI Providers Table Rows:');
const providers = db.prepare(`SELECT id, provider_name, model_name, is_active FROM ai_providers`).all();
providers.forEach(p => console.log(`  ID #${p.id}: ${p.provider_name} | Model: "${p.model_name}" | Active: ${p.is_active}`));
