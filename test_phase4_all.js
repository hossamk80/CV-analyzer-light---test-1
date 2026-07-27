const BASE_URL = 'http://localhost:3005';

async function loginAndGetToken(username, password) {
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  if (!res.ok) throw new Error(`Login failed for ${username}`);
  const setCookie = res.headers.get('set-cookie');
  return setCookie ? setCookie.split(';')[0] : '';
}

async function runAllPhase4Tests() {
  console.log('=== PHASE 4 COMPREHENSIVE SUB-FEATURES VERIFICATION TEST ===\n');
  let passed = 0;
  let failed = 0;

  try {
    const adminCookie = await loginAndGetToken('admin', 'admin123');
    const managerCookie = await loginAndGetToken('manager', 'manager123');

    // --- 4.3 Interview Scheduling Integration ---
    console.log('[Test 4.3] Verifying Interview Scheduling & iCal Generation...');
    const scheduleRes = await fetch(`${BASE_URL}/api/candidates/1/schedule-interview`, {
      method: 'POST',
      headers: { Cookie: managerCookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Technical Interview',
        date: '2026-08-15',
        startTime: '14:00',
        endTime: '15:00',
        location: 'Google Meet / HQ Room 4B',
        notes: 'Review system architecture and coding samples'
      })
    });

    const scheduleData = await scheduleRes.json();
    console.log(`  - Schedule response status: ${scheduleRes.status}`);
    console.log(`  - Google Calendar URL: ${scheduleData.gcalUrl ? scheduleData.gcalUrl.slice(0, 70) + '...' : ''}`);
    console.log(`  - iCal (.ics) snippet:\n${scheduleData.icsContent ? scheduleData.icsContent.split('\r\n').slice(0, 6).join('\n') : ''}`);

    if (scheduleRes.status === 200 && scheduleData.gcalUrl && scheduleData.icsContent?.includes('BEGIN:VCALENDAR')) {
      console.log('  ✅ TEST 4.3 PASSED (Google Calendar & .ics generated successfully)\n');
      passed++;
    } else {
      console.log('  ❌ TEST 4.3 FAILED\n');
      failed++;
    }

    // --- 4.5 GDPR Data Retention Automation by Days ---
    console.log('[Test 4.5] Verifying GDPR Retention Purge Job...');
    const purgeRes = await fetch(`${BASE_URL}/api/gdpr/purge`, {
      method: 'POST',
      headers: { Cookie: adminCookie }
    });

    const purgeData = await purgeRes.json();
    console.log(`  - Purge response status: ${purgeRes.status}`);
    console.log(`  - Purged candidates count: ${purgeData.purgedCount}`);
    console.log(`  - Retention days threshold: ${purgeData.retentionDays} days`);

    if (purgeRes.status === 200 && purgeData.success) {
      console.log('  ✅ TEST 4.5 PASSED (GDPR retention purge executed & logged)\n');
      passed++;
    } else {
      console.log('  ❌ TEST 4.5 FAILED\n');
      failed++;
    }

    console.log(`=== PHASE 4 SUMMARY: ${passed} PASSED, ${failed} FAILED ===`);
    process.exit(failed > 0 ? 1 : 0);
  } catch (err) {
    console.error('Fatal test error:', err);
    process.exit(1);
  }
}

runAllPhase4Tests();
