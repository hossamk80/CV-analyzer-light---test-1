import React from 'react';
import { useI18n } from '../i18n/I18nContext.js';
import type { ScreeningRequirement } from '../utils/requirementRules.js';

export default function RequirementRuleFields({ item, onChange }: {
  item: ScreeningRequirement; onChange: (value: ScreeningRequirement) => void;
}) {
  const { t } = useI18n();
  const type = item.ruleType || 'manual';
  return <div className="grid gap-2 mt-3">
    <label>{t('ruleTypeLabel')}
      <select className="tk-field w-full" value={type} onChange={e => onChange({ ...item, ruleType: e.target.value as ScreeningRequirement['ruleType'], acceptedTerms: [], minimumYears: 0 })}>
        <option value="manual">{t('ruleManual')}</option>
        <option value="term">{t('ruleTerm')}</option>
        <option value="certificate">{t('ruleCertificate')}</option>
        <option value="years">{t('ruleYears')}</option>
        <option value="degree">{t('ruleDegree')}</option>
      </select>
    </label>
    {type === 'years' && <label>{t('ruleMinimumYears')}
      <input className="tk-field w-full" type="number" min="0" max="60" step="0.5" required value={item.minimumYears ?? 0} onChange={e => onChange({ ...item, minimumYears: Number(e.target.value) })} />
    </label>}
    {['term', 'certificate', 'degree'].includes(type) && <label>{t('ruleAcceptedTerms')}
      <textarea className="tk-field w-full" dir="auto" required rows={3} value={(item.acceptedTerms || []).join('\n')} onChange={e => onChange({ ...item, acceptedTerms: e.target.value.split('\n') })} />
    </label>}
    <p className="text-sm" style={{ color: 'var(--tk-muted)' }}>{t('ruleHelp')}</p>
  </div>;
}
