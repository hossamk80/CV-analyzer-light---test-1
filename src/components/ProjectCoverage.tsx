import React, { useEffect, useState } from 'react';
import { apiRequest } from '../utils/api.js';
import { useI18n } from '../i18n/I18nContext.js';

type Row = { jobId:number; projectName:string; title:string; required:number; reviewed:number; approved:number; shortage:number };
export default function ProjectCoverage() {
  const { t } = useI18n();
  const [data,setData] = useState<{rows:Row[];updatedAt:string}|null>(null);
  const [error,setError] = useState('');
  const [busy,setBusy] = useState(false);
  const refresh = async () => { setBusy(true);setError('');try { setData(await apiRequest('GET','/api/project-coverage')); } catch(e:any) {setError(e.message);} finally {setBusy(false);} };
  useEffect(() => { void refresh(); },[]);
  return <section className="tk-panel p-4 space-y-3" aria-busy={busy}>
    <div className="flex justify-between gap-3 flex-wrap"><h2>{t('coverageTitle')}</h2><button className="tk-btn-neutral" disabled={busy} onClick={refresh}>{t('refresh')}</button></div>
    <p className="text-sm">{t('coverageHelp')}</p>
    {error && <p role="alert">{error}</p>}
    {!data && !error && <p role="status">{t('loading')}</p>}
    {data && <><div className="overflow-x-auto"><table className="tk-table">
      <thead><tr>{['projectName','jobTitle','requiredCount','coverageReviewed','coverageApproved','coverageShortage'].map(k=><th key={k}>{t(k as any)}</th>)}</tr></thead>
      <tbody>{data.rows.map(r=><tr key={r.jobId}><td dir="auto">{r.projectName || t('notSpecified')}</td><td dir="auto">{r.title}</td><td>{r.required}</td><td>{r.reviewed}</td><td>{r.approved}</td><td>{r.shortage}</td></tr>)}</tbody>
    </table></div>{!data.rows.length && <p>{t('coverageEmpty')}</p>}<p className="text-sm">{t('coverageUpdated')}: <time dateTime={data.updatedAt}>{new Date(data.updatedAt).toLocaleString()}</time></p></>}
  </section>;
}
