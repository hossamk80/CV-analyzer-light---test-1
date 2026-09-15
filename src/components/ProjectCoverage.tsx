import React, { useEffect, useState } from 'react';
import { apiRequest } from '../utils/api.js';
import { useI18n } from '../i18n/I18nContext.js';
import { csvDocument, type CoverageRow, summarizeProjects } from '../utils/projectCoverage.js';
import { useRole } from '../context/RoleContext.js';

export default function ProjectCoverage() {
  const { t } = useI18n();
  const { gdprActive }=useRole();
  const [data,setData] = useState<{rows:CoverageRow[];projects:ReturnType<typeof summarizeProjects>;updatedAt:string}|null>(null);
  const [error,setError] = useState('');
  const [busy,setBusy] = useState(false);
  const refresh = async () => { setBusy(true);setError('');try { setData(await apiRequest('GET','/api/project-coverage')); } catch(e:any) {setError(e.message);} finally {setBusy(false);} };
  useEffect(() => { void refresh(); },[]);
  const download=()=>{
    if(!data)return;
    const columns=['projectName','jobTitle','requiredCount','coverageReviewed','assignmentPrimary','assignmentBackup','coverageShortage'];
    if(!gdprActive)columns.push('primaryCandidates','backupCandidates');
    const contents=csvDocument([columns.map(k=>t(k as any)),...data.rows.map(r=>{
      const row:unknown[]=[r.projectName,r.title,r.required,r.reviewed,r.approved,r.backups,r.shortage];
      if(!gdprActive)row.push(r.primaryNames.join(' | '),r.backupNames.join(' | '));return row;
    })]);
    const url=URL.createObjectURL(new Blob([contents],{type:'text/csv;charset=utf-8'}));
    const anchor=document.createElement('a');anchor.href=url;anchor.download='project-coverage-'+data.updatedAt.slice(0,10)+'.csv';anchor.click();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
  return <section className="tk-panel p-4 space-y-3" aria-busy={busy}>
    <div className="flex justify-between gap-3 flex-wrap"><h2>{t('coverageTitle')}</h2><div className="flex flex-wrap gap-2"><button className="tk-btn-neutral" disabled={busy} onClick={refresh}>{t('refresh')}</button><button className="tk-btn-neutral" disabled={busy||!data||!!error} onClick={download}>{t('coverageExport')}</button></div></div>
    <p className="text-sm">{t('coverageHelp')}</p>
    <p className="text-sm">{t('readinessHelp')}</p>
    {error && <p role="alert">{error}</p>}
    {!data && !error && <p role="status">{t('loading')}</p>}
    {data && <><div className="grid gap-3 md:grid-cols-2">{data.projects.map(p=><article className="border rounded p-3 space-y-2" key={p.key}>
      <h3 dir="auto">{p.name||t('notSpecified')}</h3><p>{t('projectReadiness')}: {p.readiness}%</p>
      <progress className="w-full" max={100} value={p.readiness} aria-label={t('projectReadiness')}/>
      <p>{t('assignmentPrimary')}: {p.approved}/{p.required} · {t('assignmentBackup')}: {p.backups} · {t('coverageShortage')}: {p.shortage}</p>
    </article>)}</div><div className="overflow-x-auto"><table className="tk-table">
      <thead><tr>{['projectName','jobTitle','requiredCount','coverageReviewed','assignmentPrimary','assignmentBackup','coverageShortage'].map(k=><th key={k}>{t(k as any)}</th>)}</tr></thead>
      <tbody>{data.rows.map(r=><tr key={r.jobId}><td dir="auto">{r.projectName || t('notSpecified')}</td><td dir="auto">{r.title}</td><td>{r.required}</td><td>{r.reviewed}</td><td>{r.approved}{!gdprActive&&<div className="text-xs" dir="auto">{r.primaryNames.join('، ')}</div>}</td><td>{r.backups}{!gdprActive&&<div className="text-xs" dir="auto">{r.backupNames.join('، ')}</div>}</td><td>{r.shortage}</td></tr>)}</tbody>
    </table></div>{!data.rows.length && <p>{t('coverageEmpty')}</p>}<p className="text-sm">{t('coverageUpdated')}: <time dateTime={data.updatedAt}>{new Date(data.updatedAt).toLocaleString()}</time></p></>}
  </section>;
}
