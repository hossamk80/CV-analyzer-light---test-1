import React, { useEffect, useState } from 'react';
import { apiRequest } from '../utils/api.js';
import { useI18n } from '../i18n/I18nContext.js';
import { useRole } from '../context/RoleContext.js';
import { hasPermission } from '../utils/rbac.js';

export default function EvidenceReview({ candidateId }: { candidateId:number }) {
  const {t}=useI18n(); const {role,capabilities}=useRole();
  const [data,setData]=useState<any>(null); const [error,setError]=useState('');const [busy,setBusy]=useState(false);
  const [requirementId,setRequirement]=useState('');const [status,setStatus]=useState('unknown');
  const [evidence,setEvidence]=useState('');const [note,setNote]=useState('');const [page,setPage]=useState('');const [identity,setIdentity]=useState('');
  const [assignmentType,setAssignmentType]=useState('primary');
  const canWrite=role && hasPermission(role,'change_status',capabilities);
  const load=async()=>{setData(await apiRequest('GET',`/api/candidates/${candidateId}/evidence-reviews`));};
  useEffect(()=>{setData(null);setRequirement('');setError('');void load().catch(e=>setError(e.message));},[candidateId]);
  const action=async(path:string,method:string,body?:any)=>{setBusy(true);setError('');try {await apiRequest(method as any,`/api/candidates/${candidateId}/${path}`,body);await load();}catch(e:any){setError(e.message);}finally{setBusy(false);}};
  return <section className="tk-panel p-4 space-y-3 print:hidden" aria-busy={busy}>
    <h2>{t('reviewTitle')}</h2><p className="text-sm">{t('reviewHelp')}</p>
    {error && <p role="alert">{error}</p>}
    {!data && !error && <p>{t('loading')}</p>}
    {data && <>
      <ul>{data.requirements.map((r:any)=>{const v=data.reviews.find((x:any)=>x.requirement_id===r.id);return <li key={r.id}><span dir="auto">{r.requirement}</span>: {v ? t(`requirement_${v.status}` as any):t('reviewPending')}{v && <> — {v.reviewer} <time dateTime={v.reviewed_at}>{new Date(v.reviewed_at).toLocaleString()}</time></>}</li>;})}</ul>
      {canWrite && <form className="grid gap-3" onSubmit={e=>{e.preventDefault();void action('evidence-reviews','POST',{revision:data.revision,requirementId,status,evidence,note,page:page?Number(page):null});}}>
        <label>{t('colRequirement')}<select required className="tk-field w-full" value={requirementId} onChange={e=>{setRequirement(e.target.value);setEvidence('');setNote('');setPage('');setStatus('unknown');}}><option value="">{t('reviewSelect')}</option>{data.requirements.map((r:any)=><option key={r.id} value={r.id}>{r.requirement}</option>)}</select></label>
        <label>{t('colMatchStatus')}<select className="tk-field w-full" value={status} onChange={e=>setStatus(e.target.value)}>{['met','partial','not_met','unknown'].map(s=><option key={s} value={s}>{t(`requirement_${s}` as any)}</option>)}</select></label>
        <label>{t('colEvidence')}<textarea className="tk-field w-full" dir="auto" required={status==='met'} maxLength={8000} rows={3} value={evidence} onChange={e=>setEvidence(e.target.value)} /></label>
        <label>{t('reviewNote')}<textarea className="tk-field w-full" dir="auto" required maxLength={2000} value={note} onChange={e=>setNote(e.target.value)} /></label>
        <label>{t('reviewPage')}<input className="tk-field w-full" type="number" min="1" max="10000" value={page} onChange={e=>setPage(e.target.value)} /></label>
        <button disabled={busy} className="tk-btn-primary">{t('save')}</button>
      </form>}
      {canWrite && <div className="grid gap-2 border-t pt-3"><p>{t('approvalHelp')}</p><label>{t('identityLabel')}<input className="tk-field w-full" dir="auto" value={identity} maxLength={200} onChange={e=>setIdentity(e.target.value)} /></label>
        <label>{t('assignmentType')}<select className="tk-field w-full" value={assignmentType} onChange={e=>setAssignmentType(e.target.value)}><option value="primary">{t('assignmentPrimary')}</option><option value="backup">{t('assignmentBackup')}</option></select></label>
        <button className="tk-btn-primary" disabled={busy||!identity.trim()} onClick={()=>action('staffing-approval','POST',{revision:data.revision,identityKey:identity,assignmentType})}>{t('approvalSave')}</button>
        {data.approval && <><p>{t('coverageApproved')}: {data.approval.reviewer} — {data.approval.assignment_type==='backup'?t('assignmentBackup'):t('assignmentPrimary')}</p><button className="tk-btn-neutral" disabled={busy} onClick={()=>action('staffing-approval','DELETE')}>{t('approvalRelease')}</button></>}
      </div>}
      <details><summary>{t('reviewHistory')}</summary>{data.history.map((r:any)=><article className="border-b py-2" key={r.id}><p>{r.reviewer} — {new Date(r.reviewed_at).toLocaleString()} — {t(`requirement_${r.status}` as any)} {r.stale && t('reviewOld')}</p><p dir="auto">{r.evidence}</p><p dir="auto">{r.note}</p>{r.page && <p>{t('reviewPage')}: {r.page}</p>}</article>)}</details>
    </>}
  </section>;
}
