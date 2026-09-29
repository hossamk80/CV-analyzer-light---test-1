import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { dirname } from 'node:path';
import { extractLocalOcr } from '../src/utils/localOcr.ts';
const text='Synthetic Candidate with seven years of experience and a PMP certificate.';
test('local OCR renders PDF pages in order with fixed arguments and removes temporary files',async()=>{
 const calls:{command:string;args:string[]}[]=[];
 const output=await extractLocalOcr(Buffer.from('fake PDF'),'application/pdf',async(command,args)=>{
   calls.push({command,args});
   if(args[0]==='--list-langs') return 'ara\neng\n';
   if(command==='pdfinfo') return 'Pages: 2\n';
   if(command==='pdftoppm') return '';
   return text;
 });
 assert.equal(output,text+'\n\n'+text);
 assert.deepEqual(calls.filter(c=>c.command==='pdftoppm').map(c=>c.args[1]),['1','2']);
 const input=calls.find(c=>c.command==='pdfinfo')!.args[0];
 assert.equal(existsSync(dirname(input)),false);
 assert.ok(calls.filter(c=>c.command==='tesseract'&&c.args[0]!=='--list-langs').every(c=>c.args.includes('ara+eng')));
});
test('missing Arabic support is explicit rather than silently reading English only',async()=>{
 await assert.rejects(extractLocalOcr(Buffer.from('image'),'image/png',async()=> 'eng\nosd'),{code:'ocr_unavailable'});
});
test('excessive page counts stop before rendering and empty OCR is rejected',async()=>{
 await assert.rejects(extractLocalOcr(Buffer.from('pdf'),'application/pdf',async(command,args)=>args[0]==='--list-langs'?'ara\neng':command==='pdfinfo'?'Pages: 11':Promise.reject(new Error('must not render'))),{code:'ocr_limit'});
 await assert.rejects(extractLocalOcr(Buffer.from('image'),'image/png',async(_command,args)=>args[0]==='--list-langs'?'ara\neng':''),{code:'ocr_no_text'});
});
