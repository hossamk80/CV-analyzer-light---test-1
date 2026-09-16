import React,{useState} from 'react';
import {useI18n} from '../i18n/I18nContext.js';
import {apiRequest} from '../utils/api.js';
import type {JobImportDraft} from '../utils/jobImport.js';
import {applyImportSuggestions} from '../utils/importSuggestions.js';

export default function JobImport({onApply}:{onApply:(draft:JobImportDraft)=>void}){
  const {t}=useI18n();const [text,setText]=useState('');const [file,setFile]=useState<File|null>(null);
  const [draft,setDraft]=useState<JobImportDraft|null>(null);const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [applied,setApplied]=useState(false);
  const [selected,setSelected]=useState<string[]>([]);
  const labels:Record<string,any>={title:'jobTitle',degree:'degreeRequired',specialization:'specializationRequired',experience:'experienceYears',requiredCerts:'certificationsRequired',technicalSkills:'technicalSkillsRequired',department:'department',location:'location',nationality:'nationalityRequired',languages:'languagesRequired',coreResponsibilities:'coreResponsibilitiesField',additionalRequirements:'additionalRequirementsField'};
  const preview=async()=>{
    setBusy(true);setError('');setDraft(null);setApplied(false);setSelected([]);
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
      <h3>{t('suggestTitle')}</h3><p>{t('suggestHelp')}</p>
      {draft.suggestions.map(s=><div key={s.rule.id} className="border rounded p-3 space-y-2">
        <p dir="auto">{s.rule.requirement}</p>
        <p>{t(({degree:'ruleDegree',certificate:'ruleCertificate',years:'ruleYears',term:'ruleTerm'} as const)[s.category])} · {s.rule.ruleType==='manual'?t('ruleManual'):t('suggestLocal')} · {t(s.rule.importance==='Mandatory'?'importance_Mandatory':'importance_Important')}</p>
        <p>{t(s.reason)}</p>{s.minimumYears!==undefined&&<p>{t('ruleMinimumYears')}: {s.minimumYears}</p>}
        <label><input type="checkbox" checked={selected.includes(s.rule.id)} onChange={e=>{setSelected(prev=>e.target.checked?[...prev,s.rule.id]:prev.filter(id=>id!==s.rule.id));setApplied(false);}}/> {t('suggestConfirm')}</label>
      </div>)}
      <p>{t('jobImportReplace')}</p><button type="button" className="tk-btn-primary" onClick={()=>{onApply({...draft,checklist:applyImportSuggestions(draft.checklist,draft.suggestions,selected)});setApplied(true);}}>{t('jobImportApply')}</button>
    </div>}
    {applied&&<p role="status">{t('jobImportApplied')}</p>}
  </section>;
}
