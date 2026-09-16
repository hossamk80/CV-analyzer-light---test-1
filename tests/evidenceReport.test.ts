import {test} from 'node:test';
import assert from 'node:assert/strict';
import {evidenceReportRows,renderEvidenceReport} from '../src/utils/evidenceReport.js';
import {en} from '../src/i18n/en.js';
import {ar} from '../src/i18n/ar.js';
test('reports never attach old automated evidence to changed or unversioned conditions',()=>{
 const requirement={id:'a',requirement:'5 years',ruleType:'years',minimumYears:5};
 const saved={id:'a',status:'met',evidence:'old',requirementSnapshot:requirement};
 assert.equal(evidenceReportRows([requirement],[saved],[])[0].evaluation,saved);
 assert.equal(evidenceReportRows([{...requirement,minimumYears:10}],[saved],[])[0].evaluation,null);
 assert.equal(evidenceReportRows([requirement],[{...saved,requirementSnapshot:undefined}],[])[0].unverified,true);
});
test('report safely renders bilingual headings, evidence, reviewer and manual page reference',()=>{
 const r={id:'a',requirement:'<script>alert(1)</script>',importance:'Mandatory'};
 const ctx={candidate:{name:'<img src=x onerror=alert(1)>',checklist_eval:'[]'},job:{title:'Engineer'},requirements:[r],revision:'rev',reviews:[{requirement_id:'a',status:'met',evidence:'دليل & proof',note:'checked',page:2,reviewer:'Reviewer',reviewed_at:'2026-09-16'}]};
 for(const [lang,dict] of [['ar',ar],['en',en]] as const){
 const html=renderEvidenceReport(ctx,null,lang,key=>(dict as any)[key]||key);
 assert.ok(html.includes(`dir="${lang==='ar'?'rtl':'ltr'}"`));assert.ok(html.includes('دليل &amp; proof'));
 assert.ok(!html.includes('<script>'));assert.ok(!html.includes('<img'));assert.ok(html.includes('Reviewer'));assert.ok(html.includes('<bdi>2</bdi>'));
 }
});
