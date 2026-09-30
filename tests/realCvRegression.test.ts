import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeLocally, extractEducation, extractName, evaluateChecklist, extractLocalFacts } from '../src/utils/localAnalysis.ts';

// Synthetic fragments reproduce real-document failures without publishing personal data.
test('address and contact header before a name are not selected as the name', () => {
  assert.equal(extractName('Example District, Country – City.\nSMS: 0000\nhttps://example.invalid/\nprofile/path\nexample@example.invalid\nContact Information\nSynthetic Applicant Name'), 'Synthetic Applicant Name');
  assert.equal(extractName('حي تجريبي، مدينة تجريبية\nالمعلومات الشخصية\nأحمد محمد عبدالله'), 'أحمد محمد عبدالله');
});
test('Microsoft product abbreviations and master data are not academic degrees', () => {
  assert.equal(extractEducation("Bachelor's degree in Computation\nUpgraded M.S Exchange 365.\nManaged master data.").degreeKey, 'bachelor');
  assert.equal(extractEducation('Managed MS Exchange and master data').degreeKey, null);
  for (const degree of ['Master of Science', "Master's degree in Computer Science", 'M.Sc. Computer Science', 'M.S. in Computer Science', 'ماجستير علوم الحاسب']) {
    assert.equal(extractEducation(degree).degreeKey, 'master', degree);
  }
});
test('general database experience earns no scoped networking experience points', () => {
  const cv = 'Database administrator with 14 years of experience.\nSkills: SQL Server, Backup.';
  const job = { experience: 5, checklist: [{id:'network', requirement:'Minimum of five (5) years of experience in computer networking.', ruleType:'manual' as const}] };
  const result = analyzeLocally(cv, job, key => key);
  assert.equal(result.score_experience, 0);
  assert.notEqual(result.checklist_eval[0].status, 'met');
  assert.equal(analyzeLocally(cv, {experience:5}, key => key).score_experience, 100);
});
test('product experience cannot pass a certificate rule; missing proof stays unknown', () => {
  const rules = ['MCSE', 'MCSA', 'Security+', 'SQL Server', 'Backup'].map(term => ({id:term, requirement:term, ruleType:'certificate' as const, acceptedTerms:[term]}));
  const evaluations = evaluateChecklist('MCSE Cloud and Server Certificate 2016.\nMCSA Associate Certificate 2016.\nSkills: SQL Server, Backup.', rules);
  assert.deepEqual(evaluations.map(e => e.status), ['met','met','unknown','unknown','unknown']);
  const text = 'CERTIFICATION\nMCSE\nMCSA\nSKILLS\nSQL Server, Backup';
  const job = {requiredCerts:'MCSE, MCSA, SQL Server, Backup'};
  assert.deepEqual(analyzeLocally(text, job, key => key).certifications_list, ['MCSE','MCSA']);
  assert.deepEqual(extractLocalFacts(text, job).matched_certifications, ['MCSE','MCSA']);
  assert.equal(evaluateChecklist('الشهادات المهنية\nMCSE\nالمهارات\nBackup', rules)[0].status, 'met');
  assert.equal(evaluateChecklist('Certifications\nPursuing MCSE', rules)[0].status, 'unknown');
});
