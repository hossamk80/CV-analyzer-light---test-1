import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseJobRequirements,tableToText} from '../src/utils/jobImport.js';
import {validRequirements} from '../src/utils/requirementRules.js';
test('job import extracts the network engineer example without inventing missing fields',()=>{
  const text=`Network Monitoring and Operation Systems Engineer
Job Requirements
1. Education
Bachelor’s degree in Computer Science.
2. Certifications
Candidates must hold the following certifications:
MCSE
SQL Server
MCSA
VMware
Security+
Backup
3. Experience
Minimum of five (5) years of experience in computer networking.
4. Technical Skills
Proficiency in managing, operating, and working with:
SCCM
SCOM
F5 Load Balancer
Active Directory
Windows Server 2019 VMware
Exchange 2019
Hyper-V
Veeam Backup Solutions
Dell EMC
SRM`;
  const draft=parseJobRequirements(text);
  assert.equal(draft.fields.experience,5);assert.equal(draft.fields.specialization,'Computer Science');
  assert.equal(draft.fields.requiredCerts,'MCSE; SQL Server; MCSA; VMware; Security+; Backup');
  assert.match(String(draft.fields.technicalSkills),/Windows Server 2019 VMware/);
  assert.equal(draft.fields.department,undefined);assert.equal(draft.fields.location,undefined);
  assert.equal(draft.sourceText,text);assert.ok(validRequirements(draft.checklist));
  assert.equal(draft.checklist.length,18);assert.ok(draft.checklist.every(r=>r.ruleType==='manual'));
});
test('Arabic labels, numeric values, and pasted header tables preserve source content',()=>{
  const ar=parseJobRequirements('المسمى الوظيفي: مهندس شبكات\nالمؤهل: بكالوريوس في علوم الحاسب\nسنوات الخبرة: ٥ سنوات\nالشهادات: MCSE\nالموقع: الرياض');
  assert.equal(ar.fields.experience,5);assert.equal(ar.fields.specialization,'علوم الحاسب');
  const table=parseJobRequirements('Position\tDegree\tExp. years\nEngineer\tBachelor\t5');
  assert.equal(table.fields.experience,5);assert.equal(table.fields.title,'Engineer');
  assert.equal(parseJobRequirements('Experience\n5 years').fields.experience,5);
  assert.throws(()=>parseJobRequirements('Position\tDegree\nA\tB\nC\tD'));
});
test('CSV quotes and embedded newlines survive and multiple jobs are rejected',()=>{
  const text=tableToText('Position,Certifications,Experience\nEngineer,"MCSE\nSecurity+",5',',');
  const draft=parseJobRequirements(text);assert.equal(draft.fields.requiredCerts,'MCSE; Security+');
  assert.equal(draft.fields.experience,5);
  assert.throws(()=>tableToText('Position,Degree\nA,B\nC,D',','));
  assert.throws(()=>tableToText('"unfinished',','));
  assert.throws(()=>parseJobRequirements(' '));
  assert.throws(()=>parseJobRequirements('x'.repeat(100001)));
});
