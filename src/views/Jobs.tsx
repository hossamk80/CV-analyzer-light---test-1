import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../i18n/I18nContext.js';
import { apiRequest } from '../utils/api.js';
import { 
  Plus, 
  Trash2, 
  Briefcase, 
  CheckSquare, 
  PlusCircle 
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
  const [checklist, setChecklist] = useState<ChecklistItem[]>([
    { id: 'req-1', requirement: 'Minimum required years of experience in the core field', importance: 'Mandatory' },
    { id: 'req-2', requirement: 'Required university degree or educational specialization', importance: 'Important' }
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
      setError('Please fill in or remove empty checklist requirement fields.');
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
      setError(err.message || 'Failed to create job definition');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-brand/10 border border-brand/20 flex items-center justify-center">
          <Briefcase className="w-5 h-5 text-brand" />
        </div>
        <h2 className="text-xl font-black text-text-main">{t('createJob')}</h2>
      </div>

      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-500 text-xs font-medium rounded-xl">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Forms - General Info */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-bg-card border border-border-main p-6 rounded-2xl space-y-5">
            <h3 className="text-sm font-bold text-text-muted uppercase tracking-wider mb-2">Job Specifications</h3>
            
            {/* Title & Dept */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-1.5 px-1">
                  {t('jobTitle')}
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Senior Frontend Developer"
                  className="w-full px-3 py-2 rounded-lg border border-border-main bg-bg-main/50 text-text-main focus:outline-none focus:border-brand text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-1.5 px-1">
                  {t('department')}
                </label>
                <input
                  type="text"
                  required
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  placeholder="e.g. Engineering"
                  className="w-full px-3 py-2 rounded-lg border border-border-main bg-bg-main/50 text-text-main focus:outline-none focus:border-brand text-sm"
                />
              </div>
            </div>

            {/* Location & Experience & Degree */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-1.5 px-1">
                  {t('location')}
                </label>
                <input
                  type="text"
                  required
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g. Riyadh, KSA"
                  className="w-full px-3 py-2 rounded-lg border border-border-main bg-bg-main/50 text-text-main focus:outline-none focus:border-brand text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-1.5 px-1">
                  {t('experienceYears')}
                </label>
                <input
                  type="number"
                  required
                  min={0}
                  value={experience}
                  onChange={(e) => setExperience(parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 rounded-lg border border-border-main bg-bg-main/50 text-text-main focus:outline-none focus:border-brand text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-1.5 px-1">
                  {t('degreeRequired')}
                </label>
                <input
                  type="text"
                  required
                  value={degree}
                  onChange={(e) => setDegree(e.target.value)}
                  placeholder="e.g. Bachelor's in CS"
                  className="w-full px-3 py-2 rounded-lg border border-border-main bg-bg-main/50 text-text-main focus:outline-none focus:border-brand text-sm"
                />
              </div>
            </div>

            {/* Target Skills */}
            <div>
              <label className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-1.5 px-1">
                Target Core Skills (Comma-separated)
              </label>
              <input
                type="text"
                value={skills}
                onChange={(e) => setSkills(e.target.value)}
                placeholder="React, TypeScript, Node.js, REST APIs"
                className="w-full px-3 py-2 rounded-lg border border-border-main bg-bg-main/50 text-text-main focus:outline-none focus:border-brand text-sm"
              />
            </div>
          </div>
          
          <div className="bg-bg-card border border-border-main p-6 rounded-2xl space-y-5">
            <h3 className="text-sm font-bold text-text-muted uppercase tracking-wider mb-2">التفاصيل الفنية والمتطلبات المعمقة</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-1.5 px-1">
                  التخصص الدقيق المطلوب
                </label>
                <input
                  type="text"
                  value={specialization}
                  onChange={(e) => setSpecialization(e.target.value)}
                  placeholder="مثال: هندسة شبكات وأنظمة"
                  className="w-full px-3 py-2 rounded-lg border border-border-main bg-bg-main/50 text-text-main focus:outline-none focus:border-brand text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-1.5 px-1">
                  المهارات الفنية المطلوبة (تفصل بفاصلة)
                </label>
                <input
                  type="text"
                  value={technicalSkills}
                  onChange={(e) => setTechnicalSkills(e.target.value)}
                  placeholder="Cisco, Azure, Windows Server"
                  className="w-full px-3 py-2 rounded-lg border border-border-main bg-bg-main/50 text-text-main focus:outline-none focus:border-brand text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-1.5 px-1">
                  الجنسية المطلوبة
                </label>
                <input
                  type="text"
                  value={nationality}
                  onChange={(e) => setNationality(e.target.value)}
                  placeholder="مثال: سعودي أو إقامة قابلة للنقل الكفالة"
                  className="w-full px-3 py-2 rounded-lg border border-border-main bg-bg-main/50 text-text-main focus:outline-none focus:border-brand text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-1.5 px-1">
                  اللغات المطلوبة
                </label>
                <input
                  type="text"
                  value={languages}
                  onChange={(e) => setLanguages(e.target.value)}
                  placeholder="مثال: العربية والإنجليزية"
                  className="w-full px-3 py-2 rounded-lg border border-border-main bg-bg-main/50 text-text-main focus:outline-none focus:border-brand text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-1.5 px-1">
                المهارات السلوكية والشخصية (تفصل بفاصلة)
              </label>
              <input
                type="text"
                value={softSkills}
                onChange={(e) => setSoftSkills(e.target.value)}
                placeholder="حل المشكلات, العمل الجماعي, التواصل"
                className="w-full px-3 py-2 rounded-lg border border-border-main bg-bg-main/50 text-text-main focus:outline-none focus:border-brand text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-1.5 px-1">
                الشهادات المهنية المطلوبة
              </label>
              <input
                type="text"
                value={requiredCerts}
                onChange={(e) => setRequiredCerts(e.target.value)}
                placeholder="CCNA, PMP, AZ-900"
                className="w-full px-3 py-2 rounded-lg border border-border-main bg-bg-main/50 text-text-main focus:outline-none focus:border-brand text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-1.5 px-1">
                الوصف العام للوظيفة
              </label>
              <textarea
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
                placeholder="أدخل وصفاً عاماً للوظيفة والبيئة الوظيفية"
                rows={3}
                className="w-full px-3 py-2 rounded-lg border border-border-main bg-bg-main/50 text-text-main focus:outline-none focus:border-brand text-sm resize-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-1.5 px-1">
                المسؤوليات الأساسية
              </label>
              <textarea
                value={coreResponsibilities}
                onChange={(e) => setCoreResponsibilities(e.target.value)}
                placeholder="أدخل الواجبات والمسؤوليات اليومية بالتفصيل"
                rows={3}
                className="w-full px-3 py-2 rounded-lg border border-border-main bg-bg-main/50 text-text-main focus:outline-none focus:border-brand text-sm resize-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-1.5 px-1">
                متطلبات إضافية
              </label>
              <textarea
                value={additionalRequirements}
                onChange={(e) => setAdditionalRequirements(e.target.value)}
                placeholder="شروط إضافية مثل رخصة القيادة أو برامج محددة"
                rows={3}
                className="w-full px-3 py-2 rounded-lg border border-border-main bg-bg-main/50 text-text-main focus:outline-none focus:border-brand text-sm resize-none"
              />
            </div>
          </div>
        </div>

        {/* Right Form - ATS Checklist Builder */}
        <div className="space-y-6">
          <div className="bg-bg-card border border-border-main p-6 rounded-2xl flex flex-col min-h-[400px] justify-between">
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-bold text-text-muted uppercase tracking-wider flex items-center gap-1.5">
                  <CheckSquare className="w-4 h-4" />
                  {t('checklistTitle')}
                </h3>
                <button
                  type="button"
                  onClick={handleAddChecklistItem}
                  className="flex items-center gap-1 text-xs text-brand hover:underline font-bold"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>Add Item</span>
                </button>
              </div>

              <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                {checklist.map((item, idx) => (
                  <div key={item.id} className="p-3 bg-bg-main/60 border border-border-main/50 rounded-xl space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-bold text-text-muted uppercase">Item #{idx + 1}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveChecklistItem(item.id)}
                        className="text-red-500 hover:text-red-600 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <textarea
                      required
                      value={item.requirement}
                      onChange={(e) => handleChecklistTextChange(item.id, e.target.value)}
                      placeholder={t('requirementDescription')}
                      className="w-full p-2 h-14 rounded-lg border border-border-main bg-bg-card text-text-main focus:outline-none focus:border-brand text-xs resize-none"
                    />

                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-bold text-text-muted uppercase">{t('importanceLevel')}</span>
                      <select
                        value={item.importance}
                        onChange={(e) => handleChecklistImportanceChange(item.id, e.target.value)}
                        className="px-2 py-1 bg-bg-card rounded-md border border-border-main text-text-main text-xs focus:outline-none focus:border-brand"
                      >
                        <option value="Mandatory">Mandatory</option>
                        <option value="Important">Important</option>
                        <option value="Additional">Additional</option>
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-border-main/50 flex gap-2">
              <button
                type="button"
                onClick={() => navigate('/')}
                className="flex-1 py-2.5 border border-border-main rounded-xl text-xs font-bold text-text-muted hover:text-text-main"
              >
                {t('cancel')}
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 py-2.5 bg-brand hover:bg-brand-hover text-white rounded-xl font-bold text-xs shadow-md shadow-brand/10 transition-all cursor-pointer"
              >
                {loading ? 'Saving...' : t('saveJob')}
              </button>
            </div>
          </div>
        </div>

      </form>
    </div>
  );
};

export default Jobs;
