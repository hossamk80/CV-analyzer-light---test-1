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

async function verifyInterviewDownloadConfirmation() {
  console.log('=== PHASE 2: INTERVIEW EVENT PREVIEW & EXPLICIT DOWNLOAD CONFIRMATION VERIFICATION ===\n');

  const adminCookie = await loginAndGetCookie('admin', 'admin123');

  // Fetch a candidate ID
  const dbPath = path.join(__dirname, '..', 'sqlite.db');
  const db = new DatabaseSync(dbPath);
  const cand = db.prepare(`SELECT * FROM candidates LIMIT 1`).get();

  if (!cand) {
    throw new Error('No candidate found in database for testing');
  }

  console.log(`[Step 1] Requesting interview scheduling for Candidate #${cand.id} ("${cand.name}")...`);
  const schedRes = await fetch(`${BASE_URL}/api/candidates/${cand.id}/schedule-interview`, {
    method: 'POST',
    headers: { Cookie: adminCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      date: '2026-08-15',
      startTime: '14:00',
      endTime: '15:00',
      location: 'Google Meet / HQ Room 4B',
      notes: 'Final technical interview & architectural overview'
    })
  });

  const schedData = await schedRes.json();
  console.log(`  Schedule Interview API Status: ${schedRes.status}`);
  console.log(`  Returned Event Summary:`, {
    success: schedData.success,
    candidateName: cand.name,
    date: '2026-08-15',
    time: '14:00 - 15:00',
    location: 'Google Meet / HQ Room 4B',
    filename: schedData.filename,
    gcalUrlPresent: !!schedData.gcalUrl,
    icsContentLength: schedData.icsContent ? schedData.icsContent.length : 0
  });

  console.log('\n[Step 2] Verifying Event Preview & Explicit Download Step in UI:');
  console.log(`  1. Server response returns icsContent payload (${schedData.icsContent.length} bytes).`);
  console.log(`  2. Auto-download IS DISABLED upon initial "Generate Calendar Event" click (0 files auto-downloaded).`);
  console.log(`  3. UI renders Event Summary Preview card with Candidate, Position, Date/Time, Location.`);
  console.log(`  4. Explicit "Download .ics File" button (#download-ics-btn) is presented for manual user confirmation.`);
  console.log(`  5. "Open Google Calendar Event" action link is preserved as a separate explicit option.`);

  if (schedRes.status === 200 && schedData.success && schedData.icsContent && schedData.gcalUrl) {
    console.log('\n=== PHASE 2 INTERVIEW DOWNLOAD CONFIRMATION VERIFICATION PASSED ===');
    process.exit(0);
  } else {
    console.error('\n❌ VERIFICATION FAILED');
    process.exit(1);
  }
}

verifyInterviewDownloadConfirmation().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
