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

async function verifyPhase3JobLifecycle() {
  console.log('=== PHASE 3 JOB LIFECYCLE MANAGEMENT VERIFICATION ===\n');

  const recruiterCookie = await loginAndGetCookie('recruiter', 'recruiter123');
  const adminCookie = await loginAndGetCookie('admin', 'admin123');

  // 1. Create a test job as recruiter for testing
  console.log('[Step 1] Creating temporary job position for testing as recruiter...');
  const createRes = await fetch(`${BASE_URL}/api/jobs`, {
    method: 'POST',
    headers: { Cookie: recruiterCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: 'Lifecycle QA Lead',
      department: 'Quality Assurance',
      location: 'Dubai / Remote',
      experience: 4,
      degree: "Bachelor's Degree",
      skills: ['Automation', 'Node.js'],
      checklist: [{ id: 'req-1', requirement: '4+ years in QA', importance: 'Mandatory' }]
    })
  });

  const createdJob = await createRes.json();
  const jobId = createdJob.id;
  console.log(`  Created Job ID: ${jobId}, Title: "${createdJob.title}", Initial Status: "${createdJob.status}"\n`);

  // 2. Test Recruiter RBAC on Pause, Activate, and Delete
  console.log('[Step 2.1] Testing Pause as Recruiter (PUT /api/jobs/:id/pause)...');
  const pauseRecruiterRes = await fetch(`${BASE_URL}/api/jobs/${jobId}/pause`, {
    method: 'PUT',
    headers: { Cookie: recruiterCookie }
  });
  const pauseData = await pauseRecruiterRes.json();
  console.log(`  Recruiter Pause status: ${pauseRecruiterRes.status}, Updated Job Status: "${pauseData.status}"`);

  console.log('\n[Step 2.2] Testing Activate as Recruiter (PUT /api/jobs/:id/activate)...');
  const activateRecruiterRes = await fetch(`${BASE_URL}/api/jobs/${jobId}/activate`, {
    method: 'PUT',
    headers: { Cookie: recruiterCookie }
  });
  const activateData = await activateRecruiterRes.json();
  console.log(`  Recruiter Activate status: ${activateRecruiterRes.status}, Updated Job Status: "${activateData.status}"`);

  console.log('\n[Step 2.3] Testing Delete as Recruiter (DELETE /api/jobs/:id) [Should be 403 Forbidden]...');
  const deleteRecruiterRes = await fetch(`${BASE_URL}/api/jobs/${jobId}`, {
    method: 'DELETE',
    headers: { Cookie: recruiterCookie }
  });
  const deleteRecruiterData = await deleteRecruiterRes.json();
  console.log(`  Recruiter Delete status: ${deleteRecruiterRes.status} (Expected 403), Error: "${deleteRecruiterData.error}"`);

  // 3. Test CV Upload Server-Side Block on Paused Job
  console.log('\n[Step 3.1] Pausing job as Admin, then attempting CV upload against paused job...');
  await fetch(`${BASE_URL}/api/jobs/${jobId}/pause`, {
    method: 'PUT',
    headers: { Cookie: adminCookie }
  });

  const formData = new FormData();
  const pdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2D, 0x31, 0x2E, 0x34]); // %PDF-1.4 header
  const blob = new Blob([pdfBytes], { type: 'application/pdf' });
  formData.append('cvs', blob, 'sample_candidate_cv.pdf');
  formData.append('jobId', String(jobId));

  const uploadPausedRes = await fetch(`${BASE_URL}/api/upload`, {
    method: 'POST',
    headers: { Cookie: recruiterCookie },
    body: formData
  });

  const uploadPausedData = await uploadPausedRes.json();
  console.log(`  Upload to Paused Job status: ${uploadPausedRes.status} (Expected 400), Error: "${uploadPausedData.error}"`);

  console.log('\n[Step 3.2] Activating job as Admin, then re-attempting upload...');
  await fetch(`${BASE_URL}/api/jobs/${jobId}/activate`, {
    method: 'PUT',
    headers: { Cookie: adminCookie }
  });

  const uploadActiveRes = await fetch(`${BASE_URL}/api/upload`, {
    method: 'POST',
    headers: { Cookie: recruiterCookie },
    body: formData
  });
  console.log(`  Upload to Active Job status: ${uploadActiveRes.status} (Expected 200)`);

  // 4. Test Admin Delete capability
  console.log('\n[Step 4] Testing Delete as Admin (DELETE /api/jobs/:id)...');
  const deleteAdminRes = await fetch(`${BASE_URL}/api/jobs/${jobId}`, {
    method: 'DELETE',
    headers: { Cookie: adminCookie }
  });
  const deleteAdminData = await deleteAdminRes.json();
  console.log(`  Admin Delete status: ${deleteAdminRes.status} (Expected 200), Response: ${JSON.stringify(deleteAdminData)}`);

  // Verify job is gone from GET /api/jobs
  const allJobsRes = await fetch(`${BASE_URL}/api/jobs`, { headers: { Cookie: adminCookie } });
  const allJobs = await allJobsRes.json();
  const jobStillExists = allJobs.some(j => j.id === jobId);
  console.log(`  Job ID ${jobId} present in GET /api/jobs: ${jobStillExists ? 'YES (FAILED)' : 'NO (Successfully Deleted)'}`);

  // 5. Audit Log Verification
  console.log('\n[Step 5] Checking GET /api/audit-logs for Phase 2 "Job Change" entries...');
  const auditRes = await fetch(`${BASE_URL}/api/audit-logs`, { headers: { Cookie: adminCookie } });
  const auditLogs = await auditRes.json();

  const pauseLog = auditLogs.find(l => l.actionType === 'Job Change' && l.details?.includes('Paused job position'));
  const activateLog = auditLogs.find(l => l.actionType === 'Job Change' && l.details?.includes('Activated job position'));
  const deleteLog = auditLogs.find(l => l.actionType === 'Job Change' && l.details?.includes('Deleted job position'));

  console.log(`  Pause Audit Log:    ${pauseLog ? '✅ YES (' + pauseLog.details + ')' : '❌ NO'}`);
  console.log(`  Activate Audit Log: ${activateLog ? '✅ YES (' + activateLog.details + ')' : '❌ NO'}`);
  console.log(`  Delete Audit Log:   ${deleteLog ? '✅ YES (' + deleteLog.details + ')' : '❌ NO'}`);

  if (
    pauseRecruiterRes.status === 200 &&
    activateRecruiterRes.status === 200 &&
    deleteRecruiterRes.status === 403 &&
    uploadPausedRes.status === 400 &&
    deleteAdminRes.status === 200 &&
    !jobStillExists &&
    pauseLog && activateLog && deleteLog
  ) {
    console.log('\n=== ALL PHASE 3 JOB LIFECYCLE TESTS PASSED SUCCESSFULLY ===');
    process.exit(0);
  } else {
    console.error('\n❌ PHASE 3 VERIFICATION FAILED');
    process.exit(1);
  }
}

verifyPhase3JobLifecycle().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
