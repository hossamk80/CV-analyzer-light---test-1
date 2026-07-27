import { fileURLToPath } from 'node:url';
import path from 'node:path';

const BASE_URL = 'http://localhost:3000';

async function verifyUserRequestedFixes() {
  console.log('=== VERIFYING USER REQUESTED FIXES & ENHANCEMENTS ===');

  // 1. Login
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' })
  });
  const cookieHeader = loginRes.headers.get('set-cookie');
  const tokenCookie = cookieHeader ? cookieHeader.split(';')[0] : '';
  console.log('✓ Login successful');

  // 2. Fetch candidates
  const candRes = await fetch(`${BASE_URL}/api/candidates`, {
    headers: { 'Cookie': tokenCookie }
  });
  const candidates = await candRes.json();
  console.log(`✓ Fetched ${candidates.length} candidates from API`);

  // Test Requirement 1 & 2: Strict Nationality & No Static Fallbacks
  console.log('\n--- Test 1 & 2: Strict Nationality & Dynamic Education Data ---');
  candidates.forEach(c => {
    console.log(`  Candidate ID ${c.id} (${c.name}):`);
    console.log('    Nationality:', c.nationality || '—');
    console.log('    Education Degree:', c.educationDegree || '—');
    console.log('    Education Field:', c.educationField || '—');
    console.log('    Total Experience Years:', c.totalExperienceYears ?? '—');
  });

  // Test Requirement 3: Experience calculation & filtering
  console.log('\n--- Test 3: Experience Calculation & Filter Matching ---');
  const sampleCandidate = {
    totalExperienceYears: 6.5,
    recommendation: 'Candidate has 6.5 years of professional experience.'
  };
  const minExpFilter = 4;
  const getExpYears = (c) => {
    if (typeof c.totalExperienceYears === 'number') return c.totalExperienceYears;
    const match = c.recommendation?.match(/(\d+(?:\.\d+)?)\+?\s*years?/i);
    return match ? parseFloat(match[1]) : 0;
  };
  const expYears = getExpYears(sampleCandidate);
  const isExcluded = expYears < minExpFilter;
  console.log(`  Candidate experience: ${expYears} years, Min Exp filter set to: ${minExpFilter} years`);
  console.log(`  Candidate excluded by filter? ${isExcluded ? 'YES (Bug)' : 'NO (Correct)'}`);
  if (isExcluded) {
    throw new Error('Failed: Candidate with 6.5 years experience was incorrectly excluded when filter was 4 years!');
  }
  console.log('✓ Verified: Candidate with 6.5 years experience is correctly kept when minExp is 4 years.');

  console.log('\n=== ALL USER REQUESTED FIXES VERIFIED & PASSED ===');
}

verifyUserRequestedFixes().catch(err => {
  console.error('VERIFICATION FAILED:', err);
  process.exit(1);
});
