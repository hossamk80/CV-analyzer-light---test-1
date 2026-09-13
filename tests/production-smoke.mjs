import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {spawn} from 'node:child_process';
const cwd=mkdtempSync(join(tmpdir(),'cv-smoke-'));
const port=Number(process.env.TEST_PORT || 31873);
const child=spawn(process.execPath,[resolve('dist/server.mjs')],{cwd,env:{...process.env,PORT:String(port),NODE_ENV:'production',AUTH_SECRET:'isolated-smoke-test-secret'}});
try {
 await new Promise((ok,fail)=>{const timer=setTimeout(()=>fail(new Error('Startup timeout')),15000);child.stdout.on('data',d=>{if(d.toString().includes('Server listening')){clearTimeout(timer);ok();}});child.on('exit',c=>{clearTimeout(timer);fail(new Error('Server exited '+c));});child.stderr.on('data',d=>process.stderr.write(d));});
 const base=`http://127.0.0.1:${port}`;
 const login=await fetch(base+'/api/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({username:'admin',password:'admin123'})});
 assert.equal(login.status,200);const cookie=login.headers.get('set-cookie')?.split(';')[0];assert.ok(cookie);
 const call=async(path,method='GET',body)=>fetch(base+path,{method,headers:{Cookie:cookie,'content-type':'application/json'},body:body?JSON.stringify(body):undefined});
 assert.equal((await fetch(base)).status,200);
 assert.equal((await fetch(base+'/api/candidates/1/applications')).status,401);
 const body={title:'Network engineer',department:'IT',location:'Riyadh',experience:5,degree:'Bachelor',checklist:[],workflowType:'tender',projectName:'Synthetic project',requiredCount:3};
 const created=await call('/api/jobs','POST',body);assert.equal(created.status,201);const job=await created.json();assert.equal(job.workflowType,'tender');assert.equal(job.requiredCount,3);
 assert.equal((await call('/api/jobs','POST',{...body,requiredCount:-1})).status,400);
 assert.equal((await call('/api/jobs/'+job.id,'PUT',{workflowType:'invalid'})).status,400);
 const updated=await (await call('/api/jobs/'+job.id,'PUT',{workflowType:'recruitment'})).json();assert.equal(updated.projectName,'Synthetic project');assert.equal(updated.workflowType,'recruitment');
 const db=new DatabaseSync(join(cwd,'sqlite.db'));
 const add=db.prepare('INSERT INTO candidates(job_id,name,match_score,file_hash) VALUES(?,?,?,?)');
 const a=Number(add.run(job.id,'Synthetic A',85,'same-document').lastInsertRowid);const b=Number(add.run(job.id,'Synthetic A',90,'same-document').lastInsertRowid);const c=Number(add.run(job.id,'Synthetic A',95,'different-document').lastInsertRowid);
 const apps=await (await call('/api/candidates/'+a+'/applications')).json();assert.deepEqual(apps.map(x=>x.id),[a,b]);assert.ok(!apps.some(x=>x.id===c));
 await call('/api/screening-settings','PUT',{matchThreshold:90});const stats=await (await call('/api/dashboard/stats')).json();assert.equal(stats.excellentMatches,2);
 const provider=await call('/api/ai-providers','POST',{providerName:'Google Gemini',modelName:'gemini-custom-test',apiKey:'synthetic-key-only',isCustomModel:true});
 assert.equal(provider.status,201);const providerId=(await provider.json()).id;
 assert.equal((await call('/api/ai-providers/'+providerId,'PUT',{modelName:'gemini-custom-updated',isCustomModel:true})).status,200);
 assert.equal(db.prepare('SELECT api_key FROM ai_providers WHERE id=?').get(providerId).api_key,'synthetic-key-only');
 assert.equal((await call('/api/ai-providers/'+providerId,'PUT',{modelName:'Gemini 3 Flash',isCustomModel:true})).status,400);
 db.close();
 console.log('PASS: production frontend, auth, workflow CRUD/validation, conservative profile linking, configurable dashboard threshold.');
} finally {
 child.kill();await new Promise(r=>child.once('close',r));rmSync(cwd,{recursive:true,force:true});
}
