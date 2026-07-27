import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, '..', 'sqlite.db');
const db = new DatabaseSync(dbPath);

console.log('=== PHASE 2 INVESTIGATION OF CASCADING JOB DELETIONS ===\n');

console.log('[1] Fetching raw audit log entries for all job deletions (Audit IDs 25, 26, 27, 28):');
const rows = db.prepare(`
  SELECT id, actor_username, actor_role, action_type, target_entity, target_entity_id, created_at, details 
  FROM audit_logs 
  WHERE action_type = 'Job Change' AND details LIKE '%Deleted job position%'
  ORDER BY id ASC
`).all();

rows.forEach(r => {
  console.log(`[Audit ID ${r.id}] Timestamp: ${r.created_at} | Actor: ${r.actor_username} (${r.actor_role}) | Target ID: ${r.target_entity_id}`);
  console.log(`  Details: "${r.details}"\n`);
});

// Trigger a new deletion to test updated metadata logging (IP, User-Agent, Method, URL)
async function testEnhancedAuditLogging() {
  console.log('[2] Testing enhanced audit logging on new DELETE endpoint call...');
  
  // Login as admin
  const loginRes = await fetch('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' })
  });
  const cookie = (loginRes.headers.get('set-cookie') || '').split(';')[0];

  // Create temporary test job to delete
  const createRes = await fetch('http://localhost:3000/api/jobs', {
    method: 'POST',
    headers: { Cookie: cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: 'Audit Metadata Test Job',
      department: 'Security QA',
      location: 'Dubai',
      experience: 2,
      degree: 'BSc',
      skills: ['Audit'],
      checklist: [{ id: 'req-1', requirement: 'Audit check', importance: 'Mandatory' }]
    })
  });
  const createdJob = await createRes.json();

  // Delete the temporary test job
  const delRes = await fetch(`http://localhost:3000/api/jobs/${createdJob.id}`, {
    method: 'DELETE',
    headers: { Cookie: cookie, 'User-Agent': 'SecurityAuditProbe/2.0' }
  });
  const delData = await delRes.json();
  console.log(`  DELETE /api/jobs/${createdJob.id} status: ${delRes.status}, Response:`, delData);

  // Fetch the latest audit log entry to display newly recorded metadata fields
  const latestAudit = db.prepare(`
    SELECT id, actor_username, actor_role, action_type, target_entity, target_entity_id, ip_address, user_agent, request_method, request_url, created_at, details
    FROM audit_logs
    ORDER BY id DESC LIMIT 1
  `).get();

  console.log('\n--- NEW ENHANCED AUDIT LOG RECORD (WITH IP, USER-AGENT, METHOD, URL) ---');
  console.log(JSON.stringify(latestAudit, null, 2));
  console.log('------------------------------------------------------------------------\n');
}

testEnhancedAuditLogging().catch(err => console.error('Verification error:', err));
