import { test } from 'node:test';
import assert from 'node:assert/strict';
import { summarizeProjects, csvDocument, type CoverageRow } from '../src/utils/projectCoverage.ts';
const row:CoverageRow={jobId:1,projectName:'Project A',title:'Engineer',required:2,approved:1,backups:4,reviewed:5,shortage:1,primaryNames:[],backupNames:[]};
test('readiness is weighted by required seats and backups do not fill vacancies',()=>{
 const [p]=summarizeProjects([row,{...row,jobId:2,projectName:' project   a ',required:8,approved:0}]);
 assert.equal(p.required,10);assert.equal(p.readiness,10);assert.equal(p.shortage,9);assert.equal(p.backups,8);
 assert.equal(summarizeProjects([{...row,projectName:''},{...row,jobId:2,projectName:''}]).length,2);
});
test('CSV preserves Arabic, quotes and line breaks, and neutralizes formula prefixes',()=>{
 const csv=csvDocument([['المرشح','A,"B"','line\nnext','=1+2','  @SUM(A1)','+123']]);
 assert.ok(csv.startsWith('\uFEFF'));assert.ok(csv.includes('"A,""B"""'));assert.ok(csv.includes("\"'=1+2\""));assert.ok(csv.includes("\"'  @SUM(A1)\""));
});
