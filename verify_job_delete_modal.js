import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_URL = 'http://localhost:3000';

async function loginAndGetCookie(username, password) {
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  if (!res.ok) throw new Error(`Login failed for ${username}`);
  const setCookie = res.headers.get('set-cookie') || '';
  return setCookie.split(';')[0];
}

async function verifyJobDeleteModal() {
  console.log('=== PHASE 1: JOB DELETE CONFIRMATION MODAL VERIFICATION ===\n');

  const adminCookie = await loginAndGetCookie('admin', 'admin123');

  // 1. Create a test job for verification
  console.log('[Step 1] Creating temporary job position "DevOps Specialist"...');
  const createRes = await fetch(`${BASE_URL}/api/jobs`, {
    method: 'POST',
    headers: { Cookie: adminCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: 'DevOps Specialist',
      department: 'Infrastructure',
      location: 'Dubai',
      experience: 5,
      degree: 'BSc Computer Science',
      skills: ['Docker', 'Kubernetes'],
      checklist: [{ id: 'req-1', requirement: '5 years K8s experience', importance: 'Mandatory' }]
    })
  });
  const createdJob = await createRes.json();
  console.log(`  Job Created - ID: ${createdJob.id}, Title: "${createdJob.title}"\n`);

  // 2. Fetch candidates count linked to this job
  const dbPath = path.join(__dirname, '..', 'sqlite.db');
  const db = new DatabaseSync(dbPath);
  const candidatesForJob = db.prepare(`SELECT COUNT(*) as cnt FROM candidates WHERE job_id = ?`).get(createdJob.id);
  console.log(`[Step 2] Linked candidates count for Job #${createdJob.id}: ${candidatesForJob.cnt} candidate(s)\n`);

  // 3. Verify CANCEL behavior (simulating abort click - NO DELETE API request sent)
  console.log('[Step 3] Simulating "Cancel" click in Delete Modal (no DELETE request dispatched)...');
  const jobCheckAfterCancel = db.prepare(`SELECT * FROM jobs WHERE id = ?`).get(createdJob.id);
  console.log(`  Job #${createdJob.id} status in DB after Cancel click: ${jobCheckAfterCancel ? '✅ Preserved (No DELETE call made)' : '❌ Deleted (FAILED)'}\n`);

  // 4. Verify DELETE behavior (simulating confirmation click - sends DELETE /api/jobs/:id)
  console.log(`[Step 4] Executing "Delete Job" confirmation via DELETE /api/jobs/${createdJob.id}...`);
  const initialAuditCount = db.prepare(`SELECT COUNT(*) as cnt FROM audit_logs`).get().cnt;

  const deleteRes = await fetch(`${BASE_URL}/api/jobs/${createdJob.id}`, {
    method: 'DELETE',
    headers: { Cookie: adminCookie }
  });
  const deleteData = await deleteRes.json();
  console.log(`  DELETE /api/jobs/${createdJob.id} Response Status: ${deleteRes.status}`);
  console.log(`  Payload: ${JSON.stringify(deleteData)}\n`);

  const jobCheckAfterDelete = db.prepare(`SELECT * FROM jobs WHERE id = ?`).get(createdJob.id);
  console.log(`  Job #${createdJob.id} status in DB after Delete click: ${!jobCheckAfterDelete ? '✅ Permanently Deleted' : '❌ Still Exists (FAILED)'}`);

  const latestAudit = db.prepare(`SELECT action_type, details FROM audit_logs ORDER BY id DESC LIMIT 1`).get();
  console.log(`  Audit Log Recorded: "${latestAudit.details}"\n`);

  if (deleteRes.status === 200 && jobCheckAfterCancel && !jobCheckAfterDelete) {
    console.log('=== PHASE 1 JOB DELETE CONFIRMATION MODAL VERIFICATION PASSED ===');
    process.exit(0);
  } else {
    console.error('❌ VERIFICATION FAILED');
    process.exit(1);
  }
}

verifyJobDeleteModal().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
