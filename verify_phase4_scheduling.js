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

async function verifyPhase4Scheduling() {
  console.log('=== PHASE 4 INTERVIEW SCHEDULING VERIFICATION ===\n');

  const adminCookie = await loginAndGetCookie('admin', 'admin123');
  const managerCookie = await loginAndGetCookie('manager', 'manager123');

  // 1. Fetch Candidate #1
  const candRes = await fetch(`${BASE_URL}/api/candidates/1`, { headers: { Cookie: adminCookie } });
  if (!candRes.ok) {
    console.error('Candidate #1 not found. Ensure DB has at least one candidate.');
    process.exit(1);
  }
  const cand = await candRes.json();
  console.log(`[Step 1] Target Candidate ID 1: Name = "${cand.name}", Job ID = ${cand.jobId}, Status = "${cand.status}"\n`);

  // 2. Trigger Real Interview Scheduling (POST /api/candidates/1/schedule-interview)
  console.log('[Step 2] Triggering POST /api/candidates/1/schedule-interview...');
  const schedRes = await fetch(`${BASE_URL}/api/candidates/1/schedule-interview`, {
    method: 'POST',
    headers: { Cookie: managerCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: 'Senior Architecture Interview',
      date: '2026-09-15',
      startTime: '14:00',
      endTime: '15:00',
      location: 'Google Meet / HQ Room 3A',
      notes: 'Deep-dive into distributed systems design and API security'
    })
  });

  const schedData = await schedRes.json();
  console.log(`  Schedule Response Status: ${schedRes.status}`);
  console.log(`  Google Calendar Link: ${schedData.gcalUrl}`);
  console.log(`  Generated File Name: ${schedData.filename}\n`);
  console.log('--- GENERATED .ICS ICALENDAR CONTENT PARSED OUTPUT ---');
  console.log(schedData.icsContent);
  console.log('------------------------------------------------------\n');

  // Verify iCalendar structure
  const hasIcsHeader = schedData.icsContent?.includes('BEGIN:VCALENDAR') && schedData.icsContent?.includes('END:VCALENDAR');
  const hasEventHeader = schedData.icsContent?.includes('BEGIN:VEVENT') && schedData.icsContent?.includes('END:VEVENT');
  const hasTitle = schedData.icsContent?.includes('SUMMARY:Senior Architecture Interview');

  console.log(`  iCalendar Valid Header (BEGIN/END:VCALENDAR): ${hasIcsHeader ? '✅ YES' : '❌ NO'}`);
  console.log(`  iCalendar Valid Event (BEGIN/END:VEVENT):    ${hasEventHeader ? '✅ YES' : '❌ NO'}`);
  console.log(`  iCalendar Event Title (SUMMARY):              ${hasTitle ? '✅ YES' : '❌ NO'}\n`);

  // 3. Verify Status Change does NOT trigger fake interview scheduling log
  console.log('[Step 3] Updating candidate status to "Interviewing" via PUT /api/candidates/1...');
  const statusRes = await fetch(`${BASE_URL}/api/candidates/1`, {
    method: 'PUT',
    headers: { Cookie: managerCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'Interviewing' })
  });
  console.log(`  Status Update Response Status: ${statusRes.status}\n`);

  // 4. Fetch Audit Logs and verify
  console.log('[Step 4] Checking GET /api/audit-logs for entries...');
  const auditRes = await fetch(`${BASE_URL}/api/audit-logs`, { headers: { Cookie: adminCookie } });
  const auditLogs = await auditRes.json();

  // Find audit logs created during this run
  const schedAuditLog = auditLogs.find(l => l.details?.includes("Scheduled interview calendar event for candidate '"));
  const statusAuditLog = auditLogs.find(l => l.actionType === 'status_change' && l.details?.includes("changed from '"));

  console.log('--- AUDIT TRAIL VERIFICATION ---');
  console.log(`1. Real Scheduling Action Logged: ${schedAuditLog ? '✅ YES (' + schedAuditLog.details + ')' : '❌ NO'}`);
  console.log(`2. Status Change Action Logged:    ${statusAuditLog ? '✅ YES (' + statusAuditLog.details + ')' : '❌ NO'}`);

  // Confirm NO misleading scheduling log was created by the status change
  const misleadingLogs = auditLogs.filter(l => l.actionType === 'status_change' && l.details?.includes('Scheduled interview calendar event'));
  console.log(`3. Misleading Scheduling Logs on Status Change: ${misleadingLogs.length === 0 ? '✅ NONE (Clean Audit Trail)' : '❌ FOUND MISLEADING LOG'}`);

  if (hasIcsHeader && hasEventHeader && hasTitle && schedAuditLog && statusAuditLog && misleadingLogs.length === 0) {
    console.log('\n=== ALL PHASE 4 INTERVIEW SCHEDULING TESTS PASSED SUCCESSFULLY ===');
    process.exit(0);
  } else {
    console.error('\n❌ PHASE 4 VERIFICATION FAILED');
    process.exit(1);
  }
}

verifyPhase4Scheduling().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
