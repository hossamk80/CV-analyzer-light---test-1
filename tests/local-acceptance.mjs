import assert from 'node:assert/strict';
import {mkdtempSync,cpSync,symlinkSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawn} from 'node:child_process';
import JSZip from 'jszip';

// Synthetic applicants only. The complete app, database and uploads are isolated.
const cwd=mkdtempSync(join(tmpdir(),'cv-acceptance-'));
cpSync(resolve('dist'),join(cwd,'dist'),{recursive:true});
symlinkSync(resolve('node_modules'),join(cwd,'node_modules'),'dir');
const port=Number(process.env.TEST_PORT||31874);
const child=spawn(process.execPath,[join(cwd,'dist/server.mjs')],{cwd,env:{...process.env,PORT:String(port),NODE_ENV:'production',AUTH_SECRET:'isolated-acceptance-secret'}});
const xml=s=>s.replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
async function docx(lines){
 const zip=new JSZip();
 zip.file('[Content_Types].xml','<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
 zip.file('_rels/.rels','<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
 zip.file('word/document.xml','<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>'+lines.map(s=>'<w:p><w:r><w:t>'+xml(s)+'</w:t></w:r></w:p>').join('')+'</w:body></w:document>');
 return zip.generateAsync({type:'nodebuffer'});
}
try{
 await new Promise((ok,fail)=>{const timer=setTimeout(()=>fail(Error('Startup timeout')),20000);child.stdout.on('data',d=>{if(d.toString().includes('Server listening')){clearTimeout(timer);ok();}});child.once('exit',c=>{clearTimeout(timer);fail(Error('Server exited '+c));});child.stderr.on('data',d=>process.stderr.write(d));});
 const base=`http://127.0.0.1:${port}`;
 const login=await fetch(base+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'admin',password:'admin123'})});assert.equal(login.status,200);
 const cookie=login.headers.get('set-cookie').split(';')[0];
 const call=(path,method='GET',body)=>fetch(base+path,{method,headers:{Cookie:cookie,'Content-Type':'application/json','Accept-Language':'en'},body:body?JSON.stringify(body):undefined});
 const json=async(path,method='GET',body)=>{const r=await call(path,method,body);assert.ok(r.ok,`${path}: ${r.status} ${await r.clone().text()}`);return r.json();};
 await json('/api/screening-settings','PUT',{analysisMode:'local'});
 const before=await json('/api/token-usage');
 const text=`Network Monitoring and Operation Systems Engineer
Job Requirements
1. Education
Bachelor's degree in Computer Science.
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
 const draft=await json('/api/job-import','POST',{text});assert.equal(draft.fields.experience,5);
 const rules=draft.suggestions.map(s=>s.rule);
 const scoped=rules.find(r=>r.requirement.includes('five (5)'));assert.equal(scoped.ruleType,'manual');
 const cert=rules.find(r=>r.requirement==='MCSE');assert.equal(cert.ruleType,'certificate');assert.equal(cert.importance,'Mandatory');
 const job=await json('/api/jobs','POST',{...draft.fields,department:'Synthetic IT',location:'Synthetic Riyadh',workflowType:'tender',projectName:'ACCEPTANCE ONLY',requiredCount:1,checklist:rules,skills:[],technicalSkills:draft.fields.technicalSkills.split(', ')});
 async function upload(lines,name,lang){
  const form=new FormData();form.append('jobId',String(job.id));form.append('lang',lang);form.append('cvs',new Blob([await docx(lines)],{type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'}),name);
  const response=await fetch(base+'/api/upload',{method:'POST',headers:{Cookie:cookie},body:form});assert.equal(response.status,200);
  const result=(await response.json()).results[0];assert.equal(result.success,true,JSON.stringify(result));return json('/api/candidates/'+result.candidateId);
 }
 const strong=await upload(['Synthetic Network Applicant','synthetic-strong@example.invalid','Bachelor degree in Computer Science.','8 years of experience in computer networking.','Certifications: MCSE, MCSA, Security+.','Skills: SCCM, SCOM, F5 Load Balancer, Active Directory, Windows Server 2019 VMware, Exchange 2019, Hyper-V, Veeam Backup Solutions, Dell EMC, SRM.'],'synthetic-strong.docx','en');
 const weak=await upload(['مرشح تجريبي ناقص','synthetic-weak@example.invalid','خبرة سنتين في الدعم الفني.','دبلوم دعم فني.','مهارات: تركيب أجهزة الحاسب وخدمة المستفيدين.'],'synthetic-incomplete.docx','ar');
 assert.equal(strong.checklistEval.find(e=>e.id===cert.id).status,'met');
 assert.notEqual(weak.checklistEval.find(e=>e.id===cert.id).status,'met');
 assert.notEqual(strong.checklistEval.find(e=>e.id===scoped.id).status,'met');
 const path='/api/candidates/'+strong.id;
 let review=await json(path+'/evidence-reviews');
 assert.equal((await call(path+'/staffing-approval','POST',{revision:review.revision,identityKey:'synthetic-person'})).status,400);
 // A reviewer only confirms credentials explicitly present in the synthetic source.
 for(const requirement of rules.filter(r=>r.ruleType==='certificate'))await json(path+'/evidence-reviews','POST',{revision:review.revision,requirementId:requirement.id,status:'met',evidence:'Certifications: MCSE, MCSA, Security+.',note:'Synthetic test evidence checked',page:1});
 assert.equal((await call(path+'/staffing-approval','POST',{revision:review.revision,identityKey:'synthetic-person'})).status,400,'Ambiguous mandatory credentials must still prevent approval');
 let coverage=await json('/api/project-coverage');assert.equal(coverage.rows.find(r=>r.jobId===job.id).shortage,1);
 for(const lang of ['ar','en']){const report=await call(path+'/evidence-report?lang='+lang);assert.equal(report.status,200);const html=await report.text();assert.ok(html.includes(lang==='ar'?'dir="rtl"':'dir="ltr"'));assert.ok(html.includes('Synthetic test evidence checked'));}
 const changed=rules.map(r=>r.id===cert.id?{...r,requirement:'MCSE revised requirement'}:r);
 await json('/api/jobs/'+job.id,'PUT',{checklist:changed});
 assert.match(await (await call(path+'/evidence-report?lang=en')).text(),/snapshot changed/);
 assert.equal((await call(path+'/evidence-reviews','POST',{revision:review.revision,requirementId:cert.id,status:'met',evidence:'old',note:'old'})).status,409);
 await json(path+'/reanalyze','POST',{lang:'en'});
 assert.ok(!(await (await call(path+'/evidence-report?lang=en')).text()).includes('snapshot changed'));
 assert.equal((await json('/api/token-usage')).used,before.used);
 console.log('PASS: imported network job → confirmed rules → real DOCX uploads (English/Arabic) → local assessment → evidence review → missing mandatory credentials block staffing → bilingual report → stale revision → re-analysis. No token usage.');
 console.log('NOT TESTED: real candidate accuracy, image OCR, browser layout/font controls and PDF pagination. See ACCEPTANCE_AR.md.');
}finally{
 if(child.exitCode===null){child.kill();await new Promise(r=>child.once('close',r));}
 rmSync(cwd,{recursive:true,force:true});
}
