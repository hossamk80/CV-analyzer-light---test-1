import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../i18n/I18nContext.js';
import { apiRequest } from '../utils/api.js';
import {
  Trash2,
  Briefcase,
  CheckSquare,
  PlusCircle,
  ArrowLeft
} from 'lucide-react';

interface ChecklistItem {
  id: string;
  requirement: string;
  importance: 'Mandatory' | 'Important' | 'Additional';
}

export const Jobs: React.FC = () => {
  const { t } = useI18n();
  const navigate = useNavigate();

  const [title, setTitle] = useState('');
  const [department, setDepartment] = useState('');
  const [location, setLocation] = useState('');
  const [experience, setExperience] = useState(0);
  const [degree, setDegree] = useState('');
  const [skills, setSkills] = useState('');
  const [specialization, setSpecialization] = useState('');
  const [technicalSkills, setTechnicalSkills] = useState('');
  const [nationality, setNationality] = useState('');
  const [languages, setLanguages] = useState('');
  const [softSkills, setSoftSkills] = useState('');
  const [requiredCerts, setRequiredCerts] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [coreResponsibilities, setCoreResponsibilities] = useState('');
  const [additionalRequirements, setAdditionalRequirements] = useState('');
  // Seeded in the active interface language so a fresh form never mixes locales.
  const [checklist, setChecklist] = useState<ChecklistItem[]>(() => [
    { id: 'req-1', requirement: t('seedChecklist1'), importance: 'Mandatory' },
    { id: 'req-2', requirement: t('seedChecklist2'), importance: 'Important' }
  ]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAddChecklistItem = () => {
    setChecklist([
      ...checklist,
      { id: 'req-' + Date.now(), requirement: '', importance: 'Important' }
    ]);
  };

  const handleRemoveChecklistItem = (id: string) => {
    setChecklist(checklist.filter(item => item.id !== id));
  };

  const handleChecklistTextChange = (id: string, text: string) => {
    setChecklist(checklist.map(item => item.id === id ? { ...item, requirement: text } : item));
  };

  const handleChecklistImportanceChange = (id: string, importance: any) => {
    setChecklist(checklist.map(item => item.id === id ? { ...item, importance } : item));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Validate checklist items are not empty
    const invalidItems = checklist.some(item => !item.requirement.trim());
    if (invalidItems) {
      setError(t('emptyChecklistError'));
      setLoading(false);
      return;
    }

    try {
      const skillsArray = skills ? skills.split(',').map(s => s.trim()).filter(Boolean) : [];
      await apiRequest('POST', '/api/jobs', {
        title,
        department,
        location,
        experience,
        degree,
        skills: skillsArray,
        checklist,
        specialization,
        technicalSkills: technicalSkills ? technicalSkills.split(',').map(s => s.trim()).filter(Boolean) : [],
        nationality,
        languages,
        softSkills: softSkills ? softSkills.split(',').map(s => s.trim()).filter(Boolean) : [],
        requiredCerts,
        jobDescription,
        coreResponsibilities,
        additionalRequirements
      });
      navigate('/');
    } catch (err: any) {
      setError(err.message || t('createJobFailed'));
    } finally {
      setLoading(false);
    }
  };

  const microLabel = 'block text-[10.5px] font-bold uppercase tracking-[.1em] mb-1.5';
  const microLabelStyle = { color: 'var(--tk-muted)' } as React.CSSProperties;

  // Panel 1 — six basic specification fields (des-2.txt §14.1).
  const basicFields: { label: string; value: string; set: (v: string) => void; placeholder: string; type?: string; required?: boolean }[] = [
    { label: t('jobTitle'), value: title, set: setTitle, placeholder: t('phJobTitle'), required: true },
    { label: t('department'), value: department, set: setDepartment, placeholder: t('phDepartment'), required: true },
    { label: t('location'), value: location, set: setLocation, placeholder: t('phLocation'), required: true },
    { label: t('experienceYears'), value: String(experience), set: (v) => setExperience(parseInt(v) || 0), placeholder: '7', type: 'number', required: true },
    { label: t('degreeRequired'), value: degree, set: setDegree, placeholder: t('phDegree'), required: true },
    { label: t('specializationRequired'), value: specialization, set: setSpecialization, placeholder: t('phSpecialization') }
  ];

  // Panel 2 — stacked requirement fields; the last three are taller text areas (des-2.txt §14.2).
  const requirementFields: { label: string; value: string; set: (v: string) => void; placeholder: string; area?: boolean }[] = [
    { label: t('targetCoreSkills'), value: skills, set: setSkills, placeholder: t('phCoreSkills') },
    { label: t('technicalSkillsRequired'), value: technicalSkills, set: setTechnicalSkills, placeholder: t('phTechnicalSkills') },
    { label: t('certificationsRequired'), value: requiredCerts, set: setRequiredCerts, placeholder: t('phCertifications') },
    { label: t('nationalityRequired'), value: nationality, set: setNationality, placeholder: t('phNationality') },
    { label: t('languagesRequired'), value: languages, set: setLanguages, placeholder: t('phLanguages') },
    { label: t('softSkillsRequired'), value: softSkills, set: setSoftSkills, placeholder: t('phSoftSkills') },
    { label: t('jobDescriptionField'), value: jobDescription, set: setJobDescription, placeholder: t('phJobDescription'), area: true },
    { label: t('coreResponsibilitiesField'), value: coreResponsibilities, set: setCoreResponsibilities, placeholder: t('phCoreResponsibilities'), area: true },
    { label: t('additionalRequirementsField'), value: additionalRequirements, set: setAdditionalRequirements, placeholder: t('phAdditionalRequirements'), area: true }
  ];

  return (
    <form onSubmit={handleSubmit} style={{ maxWidth: 860, display: 'grid', gap: 10 }}>
      <button
        type="button"
        onClick={() => navigate('/')}
        className="tk-focusable flex items-center gap-1.5 text-xs font-semibold w-fit"
        style={{ color: 'var(--tk-accent-text)', background: 'transparent', border: 'none', cursor: 'pointer' }}
      >
        <ArrowLeft className="w-4 h-4 rtl:scale-x-[-1]" />
        {t('navDashboard')}
      </button>

      {error && (
        <div
          className="text-xs font-medium"
          style={{ padding: 12, borderRadius: 11, background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.2)', color: '#ef4444' }}
        >
          {error}
        </div>
      )}

      {/* 1. Basic job specifications */}
      <div className="tk-panel">
        <h3 className="text-[10.5px] font-bold uppercase tracking-[.14em] mb-3 flex items-center gap-1.5" style={{ color: 'var(--tk-accent-text)' }}>
          <Briefcase className="w-3.5 h-3.5" />
          {t('basicJobSpecs')}
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(210px, 100%), 1fr))', gap: 10 }}>
          {basicFields.map(({ label, value, set, placeholder, type, required }) => (
            <div key={label}>
              <label className={microLabel} style={microLabelStyle}>{label}</label>
              <input
                type={type || 'text'}
                required={required}
                min={type === 'number' ? 0 : undefined}
                value={value}
                onChange={(e) => set(e.target.value)}
                placeholder={placeholder}
                className="tk-field tk-focusable"
                style={{ fontVariantNumeric: type === 'number' ? 'tabular-nums' : undefined }}
              />
            </div>
          ))}
        </div>
      </div>

      {/* 2. Requirements & specifications */}
      <div className="tk-panel">
        <h3 className="text-[10.5px] font-bold uppercase tracking-[.14em] mb-3" style={{ color: 'var(--tk-accent-text)' }}>
          {t('requirementsAndSpecs')}
        </h3>
        <div style={{ display: 'grid', gap: 10 }}>
          {requirementFields.map(({ label, value, set, placeholder, area }) => (
            <div key={label}>
              <label className={microLabel} style={microLabelStyle}>{label}</label>
              {area ? (
                <textarea
                  value={value}
                  onChange={(e) => set(e.target.value)}
                  placeholder={placeholder}
                  rows={3}
                  className="tk-field tk-focusable"
                  style={{ height: 'auto', minHeight: 34, paddingBlock: 9, lineHeight: 1.7, resize: 'vertical' }}
                />
              ) : (
                <input
                  type="text"
                  value={value}
                  onChange={(e) => set(e.target.value)}
                  placeholder={placeholder}
                  className="tk-field tk-focusable"
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 3. ATS evaluation criteria */}
      <div className="tk-panel">
        <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
          <h3 className="text-[10.5px] font-bold uppercase tracking-[.14em] flex items-center gap-1.5" style={{ color: 'var(--tk-accent-text)' }}>
            <CheckSquare className="w-3.5 h-3.5" />
            {t('checklistTitle')}
          </h3>
          <button
            type="button"
            onClick={handleAddChecklistItem}
            className="tk-btn-primary tk-focusable"
            style={{ height: 28, padding: '0 10px', fontSize: 11 }}
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>{t('addChecklistItem')}</span>
          </button>
        </div>

        <div style={{ display: 'grid', gap: 10 }}>
          {checklist.map((item, idx) => (
            <div
              key={item.id}
              style={{ padding: 11, borderRadius: 11, background: 'var(--tk-inset)', border: '1px solid var(--tk-border)' }}
            >
              <div className="flex items-start gap-2">
                <textarea
                  required
                  value={item.requirement}
                  onChange={(e) => handleChecklistTextChange(item.id, e.target.value)}
                  placeholder={t('requirementDescription')}
                  rows={2}
                  className="tk-field tk-focusable"
                  style={{ flex: 1, height: 'auto', minHeight: 34, paddingBlock: 8, fontSize: 12, background: 'var(--tk-input)', resize: 'vertical' }}
                />
                <button
                  type="button"
                  onClick={() => handleRemoveChecklistItem(item.id)}
                  className="tk-icon-btn tk-focusable"
                  title={t('removeItemN', { n: String(idx + 1) })}
                  aria-label={t('removeItemN', { n: String(idx + 1) })}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="flex items-center gap-2 mt-2.5">
                <span className="text-[10px] font-bold uppercase tracking-[.1em]" style={{ color: 'var(--tk-muted)' }}>
                  {t('importanceLevel')}
                </span>
                <select
                  value={item.importance}
                  onChange={(e) => handleChecklistImportanceChange(item.id, e.target.value)}
                  className="tk-focusable"
                  style={{
                    height: 28, borderRadius: 99, paddingInline: 11, fontSize: 11, fontWeight: 600,
                    background: 'var(--tk-accent-soft)', color: 'var(--tk-accent-text)', border: 'none', cursor: 'pointer'
                  }}
                >
                  <option value="Mandatory">{t('importance_Mandatory')}</option>
                  <option value="Important">{t('importance_Important')}</option>
                  <option value="Additional">{t('importance_Additional')}</option>
                </select>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 4. Footer actions */}
      <div className="flex items-center justify-end gap-2.5 flex-wrap">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="tk-btn-neutral tk-focusable"
        >
          {t('cancel')}
        </button>
        <button
          type="submit"
          disabled={loading}
          className="tk-btn-primary tk-focusable"
          style={{ opacity: loading ? 0.5 : 1 }}
        >
          {loading ? t('saving') : t('saveJob')}
        </button>
      </div>
    </form>
  );
};

export default Jobs;
