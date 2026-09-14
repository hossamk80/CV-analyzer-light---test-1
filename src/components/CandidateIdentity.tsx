import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest } from '../utils/api.js';
import { useI18n } from '../i18n/I18nContext.js';
import { useRole } from '../context/RoleContext.js';
import { hasPermission } from '../utils/rbac.js';
import type { IdentitySnapshot } from '../utils/profileIdentity.js';

export default function CandidateIdentity({candidateId,onChanged}:{candidateId:number;onChanged:()=>void}) {
  const {t}=useI18n();const {role,capabilities}=useRole();
  const canEdit=!!role && hasPermission(role,'change_status',capabilities);
  const [current,setCurrent]=useState<IdentitySnapshot|null>(null);
  const [source,setSource]=useState<IdentitySnapshot|null>(null);
  const [sourceId,setSourceId]=useState<number|null>(null);
  const [detach,setDetach]=useState<number|null>(null);
  const [query,setQuery]=useState('');const [hits,setHits]=useState<any[]>([]);const [searched,setSearched]=useState(false);
  const [reason,setReason]=useState('');const [confirmed,setConfirmed]=useState(false);
  const [busy,setBusy]=useState(false);const [error,setError]=useState('');
  useEffect(()=>{
    let active=true;setCurrent(null);setSource(null);setDetach(null);setError('');setHits([]);setSearched(false);
    apiRequest('GET',`/api/candidates/${candidateId}/identity`).then(data=>{if(active)setCurrent(data);}).catch(e=>{if(active)setError(e.message);});
    return ()=>{active=false;};
  },[candidateId]);
  const attempt=async(task:()=>Promise<void>)=>{setBusy(true);setError('');try{await task();}catch(e:any){setError(e.message);}finally{setBusy(false);}};
  const table=(snapshot:IdentitySnapshot)=> <div className="overflow-x-auto"><table className="tk-table">
    <thead><tr>{['identityName','identityContact','identityDocument','jobTitle','identityScore'].map(k=><th key={k}>{t(k as any)}</th>)}{canEdit&&snapshot===current&&<th>{t('identityActions')}</th>}</tr></thead>
    <tbody>{snapshot.members.map(m=><tr key={m.id}><td dir="auto"><Link to={`/candidate/${m.id}`}>{m.name}</Link></td><td><div dir="auto">{m.email||'—'}</div><div dir="ltr">{m.phone||'—'}</div></td>
      <td dir="auto"><a href={`/api/candidates/${m.id}/download`}>{m.filename||t('identityDocument')}</a><div className="text-xs">{m.createdAt?new Date(m.createdAt).toLocaleDateString():''}</div></td><td dir="auto">{m.jobTitle}</td><td>{m.score}%</td>
      {canEdit&&snapshot===current&&<td>{new Set(snapshot.members.map(x=>x.profileId)).size>1&&<button type="button" className="tk-btn-neutral" disabled={busy} onClick={()=>{setDetach(m.profileId);setSource(null);setSourceId(null);setReason('');setConfirmed(false);}}>{t('identityUnlink')}</button>}</td>}</tr>)}</tbody>
  </table></div>;
  const save=async()=>{
    if(!current || !confirmed)return;
    await apiRequest('POST',`/api/candidates/${candidateId}/identity/${detach?'unlink':'link'}`,{
      version:current.version,sourceId,sourceVersion:source?.version,profileId:detach,reason
    });
    setSource(null);setDetach(null);setConfirmed(false);setReason('');onChanged();
  };
  return <section className="tk-panel p-4 space-y-3" aria-busy={busy}>
    <h2>{t('identityTitle')}</h2><p className="text-sm">{t('identityHelp')}</p>
    {error&&<p role="alert">{error}</p>}{!current&&!error&&<p role="status">{t('loading')}</p>}
    {current&&table(current)}
    {canEdit&&current&&<div className="print:hidden space-y-3">
      <form className="flex flex-wrap gap-2" onSubmit={e=>{e.preventDefault();void attempt(async()=>{setHits(await apiRequest('GET',`/api/identity-search?q=${encodeURIComponent(query.trim())}`));setSearched(true);});}}>
        <label className="flex-1">{t('identitySearch')}<input className="tk-field w-full" dir="auto" minLength={2} maxLength={100} required value={query} onChange={e=>setQuery(e.target.value)} /></label>
        <button className="tk-btn-neutral" disabled={busy}>{t('identityFind')}</button>
      </form>
      {searched&&hits.length===0&&<p>{t('identityNoResults')}</p>}
      <ul className="space-y-2">{hits.filter(h=>!current.members.some(m=>m.id===h.id)).map(h=><li key={h.id}><button className="tk-btn-neutral" disabled={busy} onClick={()=>attempt(async()=>{
        const data=await apiRequest('GET',`/api/candidates/${h.id}/identity`);setSource(data);setSourceId(h.id);setDetach(null);setReason('');setConfirmed(false);
      })}><span dir="auto">{h.name} · {h.email||h.filename||h.jobTitle}</span> — {t('identityPreview')}</button></li>)}</ul>
      {source&&<div className="border rounded p-3 space-y-2"><h3>{t('identitySource')}</h3>{table(source)}</div>}
      {(source||detach)&&<form className="grid gap-3" onSubmit={e=>{e.preventDefault();void attempt(save);}}>
        {detach&&<p>{t('identityDetachHelp')} <span dir="auto">{current.members.filter(m=>m.profileId===detach).map(m=>m.filename||m.name).join('، ')}</span></p>}
        <p>{t('identityImpact')}</p>
        <label>{t('identityReason')}<textarea className="tk-field w-full" dir="auto" required maxLength={1000} value={reason} onChange={e=>setReason(e.target.value)}/></label>
        <label className="flex gap-2 items-start"><input type="checkbox" required checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>{t('identityConfirm')}</label>
        <div className="flex flex-wrap gap-2"><button className="tk-btn-primary" disabled={busy||!confirmed||!reason.trim()}>{detach?t('identityUnlink'):t('identityLink')}</button><button type="button" className="tk-btn-neutral" disabled={busy} onClick={()=>{setSource(null);setDetach(null);}}>{t('cancel')}</button></div>
      </form>}
    </div>}
  </section>;
}
