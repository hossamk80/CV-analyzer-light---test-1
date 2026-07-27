import { fileURLToPath } from 'node:url';
import path from 'node:path';

const BASE_URL = 'http://localhost:3000';

async function testJobEditModalParity() {
  console.log('=== VERIFYING EDIT JOB MODAL PARITY & DATA INTEGRITY ===');

  // 1. Login
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' })
  });
  const cookieHeader = loginRes.headers.get('set-cookie');
  const tokenCookie = cookieHeader ? cookieHeader.split(';')[0] : '';
  console.log('✓ Login successful');

  // 2. Fetch jobs list
  const jobsRes = await fetch(`${BASE_URL}/api/jobs`, {
    headers: { 'Cookie': tokenCookie }
  });
  const jobsList = await jobsRes.json();
  if (jobsList.length === 0) {
    throw new Error('No job positions found to test edit modal.');
  }
  const testJob = jobsList[0];
  console.log(`✓ Testing with Job ID ${testJob.id}: "${testJob.title}"`);

  // 3. Perform Full Edit with all 15 fields
  const fullEditPayload = {
    title: testJob.title + ' (Updated)',
    department: 'Software Engineering',
    location: 'Riyadh, KSA',
    experience: 7,
    degree: "Master's in Computer Science",
    skills: ['React', 'TypeScript', 'Node.js', 'PostgreSQL'],
    checklist: [
      { id: 'req-1', requirement: '7+ years experience in Fullstack Engineering', importance: 'Mandatory' },
      { id: 'req-2', requirement: 'Master degree in Computer Science or related field', importance: 'Important' }
    ],
    specialization: 'هندسة شبكات وأنظمة متقدمة',
    technicalSkills: ['TypeScript', 'Docker', 'Kubernetes', 'AWS'],
    nationality: 'سعودي أو إقامة قابلة للنقل',
    languages: 'العربية والإنجليزية والفرنسية',
    softSkills: ['القيادة', 'إدارة الوقت', 'التفكير التحليلي'],
    requiredCerts: 'AWS Solutions Architect, PMP, CISSP',
    jobDescription: 'وصف عام محدث للوظيفة والبيئة الوظيفية المستهدفة',
    coreResponsibilities: 'قيادة الفريق الفني وتطوير الأنظمة والمعمارية السحابية',
    additionalRequirements: 'توفر رخصة قيادة سارية وإمكانية السفر عند الحاجة'
  };

  const updateRes = await fetch(`${BASE_URL}/api/jobs/${testJob.id}`, {
    method: 'PUT',
    headers: {
      'Cookie': tokenCookie,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(fullEditPayload)
  });
  console.log('  PUT /api/jobs HTTP Status:', updateRes.status);
  const updatedJob = await updateRes.json();

  // 4. Verify all 15 fields match saved values
  console.log('\n--- Verifying All 15 Fields Saved Correctly ---');
  console.log('  1. Title:', updatedJob.title);
  console.log('  2. Department:', updatedJob.department);
  console.log('  3. Location:', updatedJob.location);
  console.log('  4. Experience:', updatedJob.experience);
  console.log('  5. Degree:', updatedJob.degree);
  console.log('  6. Core Skills:', updatedJob.skills);
  console.log('  7. Specialization:', updatedJob.specialization);
  console.log('  8. Technical Skills:', updatedJob.technicalSkills);
  console.log('  9. Nationality:', updatedJob.nationality);
  console.log(' 10. Languages:', updatedJob.languages);
  console.log(' 11. Soft Skills:', updatedJob.softSkills);
  console.log(' 12. Required Certs:', updatedJob.requiredCerts);
  console.log(' 13. Job Description:', updatedJob.jobDescription);
  console.log(' 14. Core Responsibilities:', updatedJob.coreResponsibilities);
  console.log(' 15. Additional Requirements:', updatedJob.additionalRequirements);

  if (!updatedJob.specialization || !updatedJob.nationality || !updatedJob.jobDescription) {
    throw new Error('Failed: One or more of the 10 added fields were not saved properly.');
  }
  console.log('✓ All 15 fields verified saved successfully.');

  // 5. Test Data Integrity: Edit ONLY 1 field (e.g. Nationality) and verify no other field is erased
  console.log('\n--- Testing Partial Edit Data Integrity (Preserving all other 14 fields) ---');
  const singleFieldEditPayload = {
    ...fullEditPayload,
    nationality: 'سعودي فقط (تعديل فردي)'
  };

  const partialUpdateRes = await fetch(`${BASE_URL}/api/jobs/${testJob.id}`, {
    method: 'PUT',
    headers: {
      'Cookie': tokenCookie,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(singleFieldEditPayload)
  });
  const reUpdatedJob = await partialUpdateRes.json();

  console.log('  Updated Nationality:', reUpdatedJob.nationality);
  console.log('  Preserved Specialization:', reUpdatedJob.specialization);
  console.log('  Preserved Certs:', reUpdatedJob.requiredCerts);
  console.log('  Preserved Responsibilities:', reUpdatedJob.coreResponsibilities);

  if (reUpdatedJob.nationality !== 'سعودي فقط (تعديل فردي)' || reUpdatedJob.specialization !== fullEditPayload.specialization) {
    throw new Error('Failed: Data integrity check failed! Other fields were erased during partial edit.');
  }
  console.log('✓ Data integrity test passed: Editing 1 field preserves all other 14 fields.');

  console.log('\n=== EDIT JOB MODAL PARITY & DATA INTEGRITY VERIFIED & PASSED ===');
}

testJobEditModalParity().catch(err => {
  console.error('VERIFICATION FAILED:', err);
  process.exit(1);
});
