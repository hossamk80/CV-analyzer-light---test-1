import React,{useState} from 'react';
import {useI18n} from '../i18n/I18nContext.js';
import {apiRequest} from '../utils/api.js';
import type {JobImportDraft} from '../utils/jobImport.js';

export default function JobImport({onApply}:{onApply:(draft:JobImportDraft)=>void}){
  const {t}=useI18n();const [text,setText]=useState('');const [file,setFile]=useState<File|null>(null);
  const [draft,setDraft]=useState<JobImportDraft|null>(null);const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [applied,setApplied]=useState(false);
  const labels:Record<string,any>={title:'jobTitle',degree:'degreeRequired',specialization:'specializationRequired',experience:'experienceYears',requiredCerts:'certificationsRequired',technicalSkills:'technicalSkillsRequired',department:'department',location:'location',nationality:'nationalityRequired',languages:'languagesRequired',coreResponsibilities:'coreResponsibilitiesField',additionalRequirements:'additionalRequirementsField'};
  const preview=async()=>{
    setBusy(true);setError('');setDraft(null);setApplied(false);
    try{const body=new FormData();if(file)body.append('file',file);else body.append('text',text);setDraft(await apiRequest('POST','/api/job-import',body,true));}
    catch(e:any){setError(e.message);}finally{setBusy(false);}
  };
  return <section className="tk-panel space-y-3" aria-busy={busy}>
    <h2>{t('jobImportTitle')}</h2><p>{t('jobImportHelp')}</p>
    <label className="block">{t('jobImportText')}<textarea dir="auto" rows={6} maxLength={100000} className="tk-field w-full" disabled={busy||!!file} value={text} onChange={e=>{setText(e.target.value);setDraft(null);setApplied(false);}}/></label>
    <label className="block">{t('jobImportFile')}<input type="file" disabled={busy} accept=".pdf,.docx,.png,.jpg,.jpeg,.txt,.csv,.tsv" onChange={e=>{setFile(e.target.files?.[0]||null);setDraft(null);setApplied(false);}}/></label>
    <button type="button" className="tk-btn-neutral" disabled={busy||(!file&&!text.trim())} onClick={preview}>{busy?t('loading'):t('jobImportPreview')}</button>
    {error&&<p role="alert">{error}</p>}
    {draft&&<div className="space-y-3">
      <p>{t('jobImportReview')}</p>
      <dl>{Object.entries(draft.fields).filter(([key])=>key!=='jobDescription').map(([key,value])=><div key={key} className="border-b py-2"><dt className="font-bold">{t(labels[key])}</dt><dd dir="auto">{String(value)}</dd></div>)}</dl>
      {!!draft.unclassified.length&&<div><h3>{t('jobImportUnclassified')}</h3><p dir="auto" className="whitespace-pre-wrap">{draft.unclassified.join('\n')}</p></div>}
      <details><summary>{t('jobImportSource')}</summary><pre dir="auto" className="whitespace-pre-wrap break-words">{draft.sourceText}</pre></details>
      <p>{t('jobImportReplace')}</p><button type="button" className="tk-btn-primary" onClick={()=>{onApply(draft);setApplied(true);}}>{t('jobImportApply')}</button>
    </div>}
    {applied&&<p role="status">{t('jobImportApplied')}</p>}
  </section>;
}
