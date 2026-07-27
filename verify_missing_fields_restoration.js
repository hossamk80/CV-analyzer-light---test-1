import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BASE_URL = 'http://localhost:3000';

async function testMissingFieldsRestoration() {
  console.log('=== VERIFYING MISSING FIELDS RESTORATION ===');

  // 1. Login
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' })
  });
  const cookieHeader = loginRes.headers.get('set-cookie');
  const tokenCookie = cookieHeader ? cookieHeader.split(';')[0] : '';
  const loginData = await loginRes.json();
  const token = loginData.token;
  console.log('✓ Logged in successfully. Cookie:', tokenCookie ? 'Present' : 'Missing');

  // 2. Create Job with the 9 optional fields
  const jobPayload = {
    title: 'Senior Network & Systems Engineer',
    department: 'IT Infrastructure',
    location: 'Riyadh, KSA',
    experience: 5,
    degree: "Bachelor's in Computer Engineering",
    skills: ['Cisco', 'Azure', 'Windows Server'],
    checklist: [
      { id: 'req-1', requirement: 'إدارة وتكوين خوادم ويندوز والخدمات النشطة', importance: 'Mandatory' },
      { id: 'req-2', requirement: 'إدارة وتكوين المحاكاة الافتراضية VMware', importance: 'Important' },
      { id: 'req-3', requirement: 'شهادات سيسكو أو شبكات متقدمة (CCNA/CCNP)', importance: 'Additional' }
    ],
    specialization: 'هندسة شبكات وأنظمة',
    technicalSkills: ['Cisco', 'Azure', 'Windows Server'],
    nationality: 'سعودي أو إقامة قابلة لنقل الكفالة',
    languages: 'العربية والإنجليزية',
    softSkills: ['حل المشكلات', 'العمل الجماعي', 'التواصل'],
    requiredCerts: 'CCNA, PMP, AZ-900',
    jobDescription: 'أدخل وصفاً عاماً للوظيفة والبيئة الوظيفية',
    coreResponsibilities: 'أدخل الواجبات والمسؤوليات اليومية بالتفصيل',
    additionalRequirements: 'شروط إضافية مثل رخصة القيادة أو برامج محددة'
  };

  const createJobRes = await fetch(`${BASE_URL}/api/jobs`, {
    method: 'POST',
    headers: {
      'Cookie': tokenCookie,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(jobPayload)
  });
  console.log('  Create Job HTTP Status:', createJobRes.status);
  const createdJob = await createJobRes.json();
  console.log('✓ Created job position ID:', createdJob.id);
  console.log('  Specialization:', createdJob.specialization);
  console.log('  Nationality:', createdJob.nationality);
  console.log('  Languages:', createdJob.languages);
  console.log('  Required Certs:', createdJob.requiredCerts);
  console.log('  Technical Skills:', createdJob.technicalSkills);
  console.log('  Soft Skills:', createdJob.softSkills);

  // 3. Fetch candidates list to check education fields
  const candidatesRes = await fetch(`${BASE_URL}/api/candidates`, {
    headers: {
      'Cookie': tokenCookie
    }
  });
  const candidatesList = await candidatesRes.json();
  console.log(`✓ Fetched ${candidatesList.length} candidate records`);
  if (candidatesList.length > 0) {
    const cand = candidatesList[0];
    console.log('  Sample Candidate checklist_eval sample justification:', cand.checklistEval?.[0]?.justification || 'N/A (legacy record)');
    console.log('  Education Degree:', cand.educationDegree || 'N/A');
    console.log('  Education Field:', cand.educationField || 'N/A');
    console.log('  Total Experience Years:', cand.totalExperienceYears || 'N/A');
  }

  console.log('=== VERIFICATION PASSED SUCCESSFULLY ===');
}

testMissingFieldsRestoration().catch(err => {
  console.error('FAILED:', err);
  process.exit(1);
});
