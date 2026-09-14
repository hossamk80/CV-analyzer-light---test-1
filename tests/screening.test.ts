import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateChecklist, matchTerms, extractEducation, extractTotalYears } from '../src/utils/localAnalysis.ts';
import { mandatorySummary } from '../src/utils/screening.ts';

test('numeric requirement cannot pass on keyword overlap', () => {
 const [r] = evaluateChecklist('Network Engineer with 2 years of network experience.', [{id:'r', requirement:'Minimum 5 years of network experience', importance:'Mandatory'}]);
 assert.equal(r.matched, false); assert.equal(r.status, 'not_met');
});
test('denied or planned certificates and partial-word hits are not credentials', () => {
 assert.deepEqual(matchTerms('I do not hold PMP certification.', ['PMP']), []);
 assert.deepEqual(matchTerms('Pursuing PMP certification.', ['PMP']), []);
 assert.deepEqual(matchTerms('لا احمل شهادة PMP', ['PMP']), []);
 assert.deepEqual(matchTerms('JavaScript engineer', ['Java']), []);
 assert.deepEqual(matchTerms('Certifications: PMP', ['PMP']), ['PMP']);
});
test('education date ranges are excluded from employment years', () => {
 assert.equal(extractTotalYears('Education\n2010 - 2014 Bachelor degree\nEmployment\n2020 - 2022 Engineer'), 2);
 assert.equal(extractTotalYears('Education\n2010 - 2014 Bachelor degree'), null);
 assert.equal(extractTotalYears('Employment\n2018 - 2022 Engineer\n2020 - 2024 Consultant'), 6);
});
test('employment keywords cannot replace academic specialization', () => {
 assert.equal(extractEducation('Bachelor of Arts in History.\nIT support specialist.').fieldKey, null);
 assert.equal(extractEducation('Bachelor of Computer Science').fieldKey, 'computer_science');
});
test('mandatory decision requires evidence and handles missing evaluations', () => {
 const requirements=[{id:'pmp',importance:'Mandatory'}];
 assert.equal(mandatorySummary(requirements, []).status,'review');
 assert.equal(mandatorySummary(requirements, [{id:'pmp',matched:true}]).status,'review');
 assert.equal(mandatorySummary(requirements, [{id:'pmp',matched:true,evidence:'PMP'}]).status,'met');
 assert.equal(mandatorySummary(requirements, [{id:'pmp',status:'not_met'}]).status,'not_met');
 assert.equal(mandatorySummary([], []).status,'unconfigured');
});
