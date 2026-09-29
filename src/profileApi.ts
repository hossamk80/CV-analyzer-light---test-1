import type { Express } from 'express';
import type { DatabaseSync } from 'node:sqlite';
import { identitySnapshot, changeIdentity, IdentityError } from './utils/profileIdentity.js';

export function registerProfileApi(app:Express,sqlite:DatabaseSync,auth:any,writeAccess:any,translate:any,audit:any) {
  const fail=(req:any,res:any,e:any)=>res.status(e instanceof IdentityError?e.status:500).json({error:translate(req.headers['accept-language'])(e instanceof IdentityError?e.code:'identityFailed')});
  app.get('/api/candidates/:id/identity',auth,(req,res)=>{
    try {res.json(identitySnapshot(sqlite,Number(req.params.id)));}catch(e){fail(req,res,e);}
  });
  app.get('/api/identity-search',auth,(req,res)=>{
    const q=typeof req.query.q==='string'?req.query.q.trim():'';
    if(q.length<2 || q.length>100) return res.json([]);
    // Search returns candidates, never automatically establishes identity.
    const literal='%'+q.replace(/[\\%_]/g,'\\$&')+'%';
    const rows=sqlite.prepare(`SELECT c.id,c.name,c.contact_email AS email,c.original_filename AS filename,j.title AS jobTitle
      FROM candidates c JOIN jobs j ON c.job_id=j.id WHERE c.gdpr_anonymized=0
      AND (c.name LIKE ? ESCAPE '\\' OR c.contact_email LIKE ? ESCAPE '\\') ORDER BY c.id DESC LIMIT 20`).all(literal,literal);
    res.json(rows);
  });
  for(const action of ['link','unlink'] as const) app.post(`/api/candidates/:id/identity/${action}`,auth,writeAccess,(req:any,res)=>{
    const b=req.body;
    if(typeof b.reason!=='string'||!b.reason.trim()||b.reason.length>1000||typeof b.version!=='string'
      ||(action==='link'&&(!Number.isSafeInteger(b.sourceId)||b.sourceId<1||typeof b.sourceVersion!=='string'))
      ||(action==='unlink'&&(!Number.isSafeInteger(b.profileId)||b.profileId<1))) return fail(req,res,new IdentityError('identityInvalid'));
    try {
      const output=changeIdentity(sqlite,{...b,candidateId:Number(req.params.id),action});
      audit(req,action==='link'?'Identity Link':'Identity Unlink','candidates',Number(req.params.id),null,
        {affected:output.affected,sourceId:b.sourceId,profileId:b.profileId},b.reason.trim());
      res.json(output.result);
    } catch(e) {fail(req,res,e);}
  });
}
