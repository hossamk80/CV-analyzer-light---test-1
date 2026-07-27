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

async function verifyPhase2Audit() {
  console.log('=== PHASE 2 AUDIT LOGGING COVERAGE VERIFICATION ===\n');

  // 1. Trigger Failed Login Attempt (2.1)
  console.log('[Step 1] Triggering failed login attempt for "user_test_audit"...');
  const failedLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'user_test_audit', password: 'wrongpassword123' })
  });
  console.log(`  Failed login status: ${failedLoginRes.status}`);

  // 2. Trigger 403 Access Denied (2.2) (Recruiter trying to access Admin-only /api/settings)
  console.log('\n[Step 2] Triggering 403 Access Denied (Recruiter hitting GET /api/settings)...');
  const recruiterCookie = await loginAndGetCookie('recruiter', 'recruiter123');
  const deniedRes = await fetch(`${BASE_URL}/api/settings`, {
    headers: { Cookie: recruiterCookie }
  });
  console.log(`  Access Denied status: ${deniedRes.status}`);

  // 3. Trigger Rejected Upload (2.3) (Disguised text file sent as .pdf)
  console.log('\n[Step 3] Triggering rejected upload (Disguised file: text content with .pdf extension)...');
  const fakePdfContent = 'This is a plain text file, not a real PDF document with %PDF magic bytes!';
  const formData = new FormData();
  const blob = new Blob([fakePdfContent], { type: 'application/pdf' });
  formData.append('cvs', blob, 'disguised_file.pdf');
  formData.append('jobId', '1');

  const uploadRes = await fetch(`${BASE_URL}/api/upload`, {
    method: 'POST',
    headers: { Cookie: recruiterCookie },
    body: formData
  });
  const uploadData = await uploadRes.json();
  console.log(`  Rejected Upload status: ${uploadRes.status}, Body: ${JSON.stringify(uploadData)}`);

  // 4. Trigger Job Creation (2.4)
  console.log('\n[Step 4] Triggering job creation (POST /api/jobs)...');
  const jobRes = await fetch(`${BASE_URL}/api/jobs`, {
    method: 'POST',
    headers: { Cookie: recruiterCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: 'Senior Audit Test Engineer',
      department: 'Quality Engineering',
      location: 'Riyadh / Hybrid',
      experience: 5,
      degree: "Bachelor's Degree",
      skills: ['TypeScript', 'Jest', 'Audit Logging'],
      checklist: [{ id: 'chk-1', requirement: '5+ years experience in automated testing', importance: 'Must-Have' }]
    })
  });
  const jobData = await jobRes.json();
  console.log(`  Job Creation status: ${jobRes.status}, Job Title: "${jobData.title}" (ID: ${jobData.id})`);

  // 5. Fetch GET /api/audit-logs as Admin and verify entries
  console.log('\n[Step 5] Fetching GET /api/audit-logs as Admin...');
  const adminCookie = await loginAndGetCookie('admin', 'admin123');
  const auditRes = await fetch(`${BASE_URL}/api/audit-logs`, {
    headers: { Cookie: adminCookie }
  });

  const logs = await auditRes.json();
  console.log(`  Fetched ${logs.length} total audit log entries.\n`);

  console.log('--- RECENT AUDIT LOG ENTRIES (LATEST 10) ---');
  logs.slice(0, 10).forEach((entry, idx) => {
    console.log(`[Entry #${entry.id}] ${entry.createdAt} | Actor: ${entry.actorUsername} (${entry.actorRole}) | Action: "${entry.actionType}" | Target: ${entry.targetEntity || 'N/A'} | Details: ${entry.details}`);
  });

  // Verify all 4 required event types exist
  const foundFailedLogin = logs.find(l => l.actionType === 'Failed Login' && l.actorUsername === 'user_test_audit');
  const foundAccessDenied = logs.find(l => l.actionType === 'Access Denied' && l.actorUsername === 'recruiter');
  const foundCvUpload = logs.find(l => l.actionType === 'CV Upload' && l.details?.includes('disguised_file.pdf'));
  const foundJobChange = logs.find(l => l.actionType === 'Job Change' && l.details?.includes('Senior Audit Test Engineer'));

  console.log('\n--- VERIFICATION CHECKLIST ---');
  console.log(`1. Failed Login Recorded:   ${foundFailedLogin ? '✅ YES' : '❌ NO'}`);
  console.log(`2. Access Denied Recorded:  ${foundAccessDenied ? '✅ YES' : '❌ NO'}`);
  console.log(`3. Rejected Upload Recorded: ${foundCvUpload ? '✅ YES' : '❌ NO'}`);
  console.log(`4. Job Change Recorded:     ${foundJobChange ? '✅ YES' : '❌ NO'}`);

  if (foundFailedLogin && foundAccessDenied && foundCvUpload && foundJobChange) {
    console.log('\n=== ALL PHASE 2 AUDIT LOGGING TESTS PASSED SUCCESSFULLY ===');
    process.exit(0);
  } else {
    console.error('\n❌ PHASE 2 AUDIT LOGGING VERIFICATION FAILED');
    process.exit(1);
  }
}

verifyPhase2Audit().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
