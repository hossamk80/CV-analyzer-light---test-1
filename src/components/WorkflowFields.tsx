import React from 'react';
import { useI18n } from '../i18n/I18nContext.js';
export interface Workflow { workflowType: string; projectName: string; requiredCount: number }
export default function WorkflowFields({ value, onChange }: { value: Workflow; onChange: (v: Workflow) => void }) {
  const { t } = useI18n();
  return <div className="tk-panel grid gap-3 p-4 sm:grid-cols-3">
    <label>{t('workflowType')}<select className="tk-input w-full" value={value.workflowType} onChange={e => onChange({ ...value, workflowType: e.target.value })}>
      <option value="recruitment">{t('workflowRecruitment')}</option><option value="tender">{t('workflowTender')}</option>
    </select></label>
    <label>{t('projectName')}<input className="tk-input w-full" value={value.projectName} onChange={e => onChange({ ...value, projectName: e.target.value })}/></label>
    <label>{t('requiredCount')}<input className="tk-input w-full" type="number" min="1" step="1" required value={value.requiredCount} onChange={e => onChange({ ...value, requiredCount: Number(e.target.value) })}/></label>
  </div>;
}
