import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { en } from '../src/i18n/en.ts';
import { ar } from '../src/i18n/ar.ts';

const walk=(dir:string):string[]=>readdirSync(dir).flatMap(n=>{const p=join(dir,n);return statSync(p).isDirectory()?walk(p):[p]});
test('Arabic and English dictionaries have the exact same complete key set',()=>{
 assert.deepEqual(Object.keys(ar).sort(),Object.keys(en).sort());
 const files=walk('src').filter(p=>p.endsWith('.tsx'));
 const literalKeys=new Set(files.flatMap(p=>[...readFileSync(p,'utf8').matchAll(/\bt\(\s*['"]([^'"]+)/g)].map(m=>m[1])));
 assert.deepEqual([...literalKeys].filter(k=>!(k in en)),[]);
});
test('Arabic translations do not silently equal English UI prose',()=>{
 const leaks=Object.keys(en).filter(k=>ar[k as keyof typeof ar]===en[k as keyof typeof en] && /[A-Za-z]{3}/.test(en[k as keyof typeof en]));
 assert.deepEqual(leaks,[]);
});
test('candidate report uses logical RTL/LTR spacing and borders',()=>{
 const report=readFileSync('src/views/CandidateDetail.tsx','utf8');
 for(const token of ['border-l','pl-','-left-[']) assert.equal(report.includes(token),false,token);
});
