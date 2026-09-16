import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseJobRequirements} from '../src/utils/jobImport.js';
import {suggestImportRule,applyImportSuggestions} from '../src/utils/importSuggestions.js';
import {validRequirements} from '../src/utils/requirementRules.js';
test('explicit certificate obligation is proposed but never enabled without selection',()=>{
 const draft=parseJobRequirements('Engineer\nCertifications\nCandidates must hold the following certifications:\nMCSE\nVMware\nBackup\nSQL Server');
 assert.ok(draft.checklist.every(r=>r.ruleType==='manual'&&r.importance==='Important'));
 assert.ok(draft.suggestions.every(s=>s.rule.importance==='Mandatory'));
 assert.equal(draft.suggestions[0].rule.ruleType,'certificate');
 assert.ok(draft.suggestions.slice(1).every(s=>s.rule.ruleType==='manual'));
 assert.deepEqual(applyImportSuggestions(draft.checklist,draft.suggestions,[]),draft.checklist);
 const result=applyImportSuggestions(draft.checklist,draft.suggestions,[draft.checklist[0].id]);
 assert.equal(result[0].ruleType,'certificate');assert.equal(result[1].importance,'Important');
 assert.ok(validRequirements(result));assert.equal(draft.checklist[0].ruleType,'manual');
});
test('scoped duration never uses total experience, including Arabic and compound conditions',()=>{
 for(const text of ['Minimum of five (5) years of experience in computer networking.','5 years in Saudi government','10 years total and 5 years in networking','خبرة ٥ سنوات في الشبكات']){
   const s=suggestImportRule(text,'years','x');assert.equal(s.rule.ruleType,'manual');assert.equal(s.reason,'suggestScoped');
 }
 const total=suggestImportRule('At least 5 years of experience','years','x');
 assert.equal(total.rule.ruleType,'years');assert.equal(total.rule.minimumYears,5);
 assert.equal(suggestImportRule('خبرة ٥ سنوات','years','x').rule.minimumYears,5);
});
test('degree conjunctions, alternatives and ambiguous credentials remain manual',()=>{
 assert.equal(suggestImportRule('Bachelor degree in Computer Science','degree','x').rule.ruleType,'manual');
 for(const text of ['VMware','Backup','SQL Server','MCSE or equivalent','PMP; CISA'])assert.equal(suggestImportRule(text,'certificate','x').rule.ruleType,'manual');
 assert.deepEqual(suggestImportRule('Security+','certificate','x').rule.acceptedTerms,['Security+']);
 assert.equal(suggestImportRule('SCCM','term','x').rule.ruleType,'term');
 assert.equal(suggestImportRule('SCCM and SCOM','term','x').rule.ruleType,'manual');
});
