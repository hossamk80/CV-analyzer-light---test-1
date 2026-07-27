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

async function verifyAuditLogRetention() {
  console.log('=== AUDIT LOG RETENTION & AUTO-PURGE FEATURE VERIFICATION ===\n');

  const adminCookie = await loginAndGetCookie('admin', 'admin123');
  const recruiterCookie = await loginAndGetCookie('recruiter', 'recruiter123');

  // 1. Save Settings via PUT /api/settings
  console.log('[Step 1] Saving valid retention setting via PUT /api/settings ({ auditLogRetentionDays: 120 })...');
  const validSaveRes = await fetch(`${BASE_URL}/api/settings`, {
    method: 'PUT',
    headers: { Cookie: adminCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ auditLogRetentionDays: 120 })
  });
  const validSaveData = await validSaveRes.json();
  console.log(`  Save Settings Status: ${validSaveRes.status}, Updated auditLogRetentionDays: ${validSaveData.auditLogRetentionDays}\n`);

  // 2. Test Minimum Floor Rejection (attempt setting < 90 days)
  console.log('[Step 2.1] Attempting to set retention below 90-day minimum floor (PUT /api/settings { auditLogRetentionDays: 30 })...');
  const invalidSaveRes = await fetch(`${BASE_URL}/api/settings`, {
    method: 'PUT',
    headers: { Cookie: adminCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ auditLogRetentionDays: 30 })
  });
  const invalidSaveData = await invalidSaveRes.json();
  console.log(`  Invalid Save Status: ${invalidSaveRes.status} (Expected 400), Error: "${invalidSaveData.error}"`);

  console.log('\n[Step 2.2] Attempting manual purge with retention below 90-day floor (POST /api/audit-logs/purge { retentionDays: 15 })...');
  const invalidPurgeRes = await fetch(`${BASE_URL}/api/audit-logs/purge`, {
    method: 'POST',
    headers: { Cookie: adminCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ retentionDays: 15 })
  });
  const invalidPurgeData = await invalidPurgeRes.json();
  console.log(`  Invalid Purge Status: ${invalidPurgeRes.status} (Expected 400), Error: "${invalidPurgeData.error}"\n`);

  // 3. Test RBAC Enforcement (403 Forbidden for recruiter)
  console.log('[Step 3] Testing RBAC Enforcement (Recruiter calling POST /api/audit-logs/purge)...');
  const recruiterPurgeRes = await fetch(`${BASE_URL}/api/audit-logs/purge`, {
    method: 'POST',
    headers: { Cookie: recruiterCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ retentionDays: 90 })
  });
  const recruiterPurgeData = await recruiterPurgeRes.json();
  console.log(`  Recruiter Purge Status: ${recruiterPurgeRes.status} (Expected 403), Error: "${recruiterPurgeData.error}"\n`);

  // 4. Seed old audit log entry (older than 90 days) and test Purge execution
  console.log('[Step 4.1] Seeding synthetic old audit log entry (created_at = 2020-01-01T00:00:00.000Z)...');
  const dbPath = path.join(__dirname, '..', 'sqlite.db');
  const db = new DatabaseSync(dbPath);

  const oldTimestamp = '2020-01-01T00:00:00.000Z';
  db.prepare(`
    INSERT INTO audit_logs (actor_username, actor_role, action_type, target_entity, details, created_at)
    VALUES ('old_admin', 'admin', 'Legacy Action', 'system', 'Synthetic old entry to purge', ?)
  `).run(oldTimestamp);

  const countBeforeRes = await fetch(`${BASE_URL}/api/audit-logs`, { headers: { Cookie: adminCookie } });
  const logsBefore = await countBeforeRes.json();
  const oldEntryExistsBefore = logsBefore.some(l => l.details === 'Synthetic old entry to purge');
  console.log(`  Total audit entries before purge: ${logsBefore.length}`);
  console.log(`  Synthetic old entry present before purge: ${oldEntryExistsBefore ? '✅ YES' : '❌ NO'}\n`);

  console.log('[Step 4.2] Executing "Run Purge Now" via POST /api/audit-logs/purge ({ retentionDays: 90 })...');
  const purgeRes = await fetch(`${BASE_URL}/api/audit-logs/purge`, {
    method: 'POST',
    headers: { Cookie: adminCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ retentionDays: 90 })
  });
  const purgeData = await purgeRes.json();
  console.log(`  Purge Execution Response: ${JSON.stringify(purgeData, null, 2)}\n`);

  console.log('[Step 4.3] Fetching audit logs after purge...');
  const countAfterRes = await fetch(`${BASE_URL}/api/audit-logs`, { headers: { Cookie: adminCookie } });
  const logsAfter = await countAfterRes.json();
  const oldEntryExistsAfter = logsAfter.some(l => l.details === 'Synthetic old entry to purge');
  const purgeSelfLog = logsAfter.find(l => l.actionType === 'Audit Log Purge');

  console.log(`  Total audit entries after purge: ${logsAfter.length}`);
  console.log(`  Synthetic old entry present after purge: ${oldEntryExistsAfter ? '❌ YES (FAILED)' : '✅ NO (Successfully Purged)'}`);
  console.log(`  Self-Logged "Audit Log Purge" Record Present: ${purgeSelfLog ? '✅ YES (' + purgeSelfLog.details + ')' : '❌ NO'}\n`);

  if (
    validSaveRes.status === 200 &&
    invalidSaveRes.status === 400 &&
    invalidPurgeRes.status === 400 &&
    recruiterPurgeRes.status === 403 &&
    !oldEntryExistsAfter &&
    purgeSelfLog
  ) {
    console.log('=== ALL AUDIT LOG RETENTION & PURGE VERIFICATIONS PASSED SUCCESSFULLY ===');
    process.exit(0);
  } else {
    console.error('❌ AUDIT LOG RETENTION VERIFICATION FAILED');
    process.exit(1);
  }
}

verifyAuditLogRetention().catch(err => {
  console.error('Fatal verification error:', err);
  process.exit(1);
});
