import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateChecklist, analyzeLocally } from '../src/utils/localAnalysis.ts';
import { validRequirements, type ScreeningRequirement } from '../src/utils/requirementRules.ts';
const rule: ScreeningRequirement = { id: 'cert', requirement: 'Pega certificate', importance: 'Mandatory', ruleType: 'certificate', acceptedTerms: ['CSSA', 'CLSA'] };
test('explicitly approved certificate alternatives pass with original evidence', () => {
  const [r] = evaluateChecklist('Certifications: CLSA 2024', [rule]);
  assert.equal(r.status, 'met'); assert.equal(r.evidence, 'Certifications: CLSA 2024');
  assert.equal(evaluateChecklist('Certifications: PMP', [rule])[0].status, 'unknown');
  assert.equal(evaluateChecklist('Pursuing CLSA certification', [rule])[0].status, 'unknown');
  assert.equal(evaluateChecklist('Expired CLSA certification', [rule])[0].status, 'unknown');
});
test('Arabic alternatives and Arabic numbers are evaluated without a model', () => {
  assert.equal(evaluateChecklist('شهادة إدارة المشاريع', [{ ...rule, acceptedTerms: ['إدارة المشاريع'] }])[0].status, 'met');
  const years: ScreeningRequirement = { id: 'years', requirement: 'Total years', ruleType: 'years', minimumYears: 5 };
  assert.equal(evaluateChecklist('٧ سنوات خبرة', [years])[0].status, 'met');
  assert.equal(evaluateChecklist('2 years of experience', [years])[0].status, 'not_met');
  assert.equal(evaluateChecklist('Experienced engineer', [years])[0].status, 'unknown');
});
test('free text never becomes a definitive automatic pass', () => {
  assert.equal(evaluateChecklist('PMP', [{ id: 'free', requirement: 'PMP' }])[0].status, 'partial');
});
test('rule payload validation rejects malformed, duplicate and incomplete rules', () => {
  assert.equal(validRequirements([rule]), true);
  assert.equal(validRequirements([rule, rule]), false);
  assert.equal(validRequirements([{ ...rule, acceptedTerms: [] }]), false);
  assert.equal(validRequirements([{ ...rule, ruleType: 'years', minimumYears: -1 }]), false);
  assert.equal(validRequirements('invalid'), false);
});
test('local report keeps an independent requirement snapshot', () => {
  const result = analyzeLocally('Certifications: CLSA', { checklist: [rule] }, key => key);
  const ev = result.checklist_eval[0] as any;
  assert.equal(ev.engineVersion, 'local-rules-v2');
  assert.equal(ev.requirementSnapshot.requirement, rule.requirement);
  assert.notEqual(ev.requirementSnapshot, rule);
  assert.equal(result.match_score, 100);
  assert.equal(analyzeLocally('7 years of experience', {}, key => key).match_score, 0);
});
