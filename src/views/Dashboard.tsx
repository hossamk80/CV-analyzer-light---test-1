import React, { useState, useEffect } from 'react';
import { useI18n } from '../i18n/I18nContext.js';
import { useRole } from '../context/RoleContext.js';
import { apiRequest } from '../utils/api.js';
import { hasPermission } from '../utils/rbac.js';
import Bidi from '../components/Bidi.js';
import { 
  FileText, 
  Briefcase, 
  Award, 
  TrendingUp, 
  Sparkles, 
  Edit3, 
  Eye, 
  ListTodo, 
  Plus, 
  Trash2, 
  X,
  Compass,
  Pause,
  Play,
  AlertTriangle
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface Job {
  id: number;
  title: string;
  department: string;
  location: string;
  experience: number;
  degree: string;
  skills: string; // JSON string
  checklist: string; // JSON string
  status?: string; // 'Active' | 'Paused'
  createdAt: string;
  specialization?: string;
  technicalSkills?: string;
  nationality?: string;
  languages?: string;
  softSkills?: string;
  requiredCerts?: string;
  jobDescription?: string;
  coreResponsibilities?: string;
  additionalRequirements?: string;
}

interface Stats {
  totalCvs: number;
  activeJobs: number;
  excellentMatches: number;
  averageMatch: number;
}

export const Dashboard: React.FC = () => {
  const { t } = useI18n();
  const { role, capabilities } = useRole();
  const navigate = useNavigate();

  const canEditJobs = role ? hasPermission(role, 'manage_jobs', capabilities) : false;
  const canDeleteJobs = role ? hasPermission(role, 'delete_data', capabilities) : false;

  const [stats, setStats] = useState<Stats>({ totalCvs: 0, activeJobs: 0, excellentMatches: 0, averageMatch: 0 });
  const [jobsList, setJobsList] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [summaryModalOpen, setSummaryModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingJob, setEditingJob] = useState<Job | null>(null);

  // Edit fields
  const [editTitle, setEditTitle] = useState('');
  const [editDept, setEditDept] = useState('');
  const [editLoc, setEditLoc] = useState('');
  const [editExp, setEditExp] = useState(0);
  const [editDegree, setEditDegree] = useState('');
  const [editSkills, setEditSkills] = useState(''); // Target Core Skills (comma-separated)
  const [editChecklist, setEditChecklist] = useState<{ id: string; requirement: string; importance: string }[]>([]);
  const [editSpecialization, setEditSpecialization] = useState('');
  const [editTechnicalSkills, setEditTechnicalSkills] = useState('');
  const [editNationality, setEditNationality] = useState('');
  const [editLanguages, setEditLanguages] = useState('');
  const [editSoftSkills, setEditSoftSkills] = useState('');
  const [editRequiredCerts, setEditRequiredCerts] = useState('');
  const [editJobDescription, setEditJobDescription] = useState('');
  const [editCoreResponsibilities, setEditCoreResponsibilities] = useState('');
  const [editAdditionalRequirements, setEditAdditionalRequirements] = useState('');

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const statsData = await apiRequest('GET', '/api/dashboard/stats');
      const jobsData = await apiRequest('GET', '/api/jobs');
      setStats(statsData);
      setJobsList(jobsData);
    } catch (e) {
      console.error('Error fetching dashboard data:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleTogglePause = async (job: Job) => {
    try {
      const endpoint = job.status === 'Paused' ? `/api/jobs/${job.id}/activate` : `/api/jobs/${job.id}/pause`;
      await apiRequest('PUT', endpoint);
      fetchDashboardData();
    } catch (e: any) {
      alert(e.message || 'Failed to update job status');
    }
  };

  // Job deletion confirmation modal state (Phase 1)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deletingJob, setDeletingJob] = useState<Job | null>(null);
  const [deletingCandidateCount, setDeletingCandidateCount] = useState<number>(0);
  const [deletingInProgress, setDeletingInProgress] = useState<boolean>(false);

  const handleDeleteJobClick = async (job: Job) => {
    setDeletingJob(job);
    try {
      const candidatesList = await apiRequest('GET', '/api/candidates');
      const count = candidatesList.filter((c: any) => c.jobId === job.id).length;
      setDeletingCandidateCount(count);
    } catch {
      setDeletingCandidateCount(0);
    }
    setDeleteModalOpen(true);
  };

  const handleConfirmDeleteJob = async () => {
    if (!deletingJob) return;
    setDeletingInProgress(true);
    try {
      await apiRequest('DELETE', `/api/jobs/${deletingJob.id}`);
      setDeleteModalOpen(false);
      setDeletingJob(null);
      fetchDashboardData();
    } catch (e: any) {
      alert(e.message || 'Failed to delete job');
    } finally {
      setDeletingInProgress(false);
    }
  };

  const handleCancelDeleteJob = () => {
    setDeleteModalOpen(false);
    setDeletingJob(null);
  };

  const handleOpenEdit = (job: Job) => {
    setEditingJob(job);
    setEditTitle(job.title || '');
    setEditDept(job.department || '');
    setEditLoc(job.location || '');
    setEditExp(job.experience || 0);
    setEditDegree(job.degree || '');
    setEditChecklist(job.checklist ? JSON.parse(job.checklist) : []);

    const parseArrayOrString = (val?: string) => {
      if (!val) return '';
      try {
        const parsed = JSON.parse(val);
        return Array.isArray(parsed) ? parsed.join(', ') : val;
      } catch {
        return val;
      }
    };

    // Pre-fill all 10 additional fields from the saved job object
    setEditSkills(parseArrayOrString(job.skills)); // 1. Target Core Skills
    setEditSpecialization(job.specialization || ''); // 2. Specialization
    setEditTechnicalSkills(parseArrayOrString(job.technicalSkills)); // 3. Technical Skills
    setEditNationality(job.nationality || ''); // 4. Nationality
    setEditLanguages(job.languages || ''); // 5. Languages
    setEditSoftSkills(parseArrayOrString(job.softSkills)); // 6. Soft Skills
    setEditRequiredCerts(job.requiredCerts || ''); // 7. Required Certs
    setEditJobDescription(job.jobDescription || ''); // 8. Job Description
    setEditCoreResponsibilities(job.coreResponsibilities || ''); // 9. Core Responsibilities
    setEditAdditionalRequirements(job.additionalRequirements || ''); // 10. Additional Requirements
    setEditModalOpen(true);
  };

  const handleAddChecklistItem = () => {
    const newItem = {
      id: 'req-' + Date.now(),
      requirement: '',
      importance: 'Important'
    };
    setEditChecklist([...editChecklist, newItem]);
  };

  const handleRemoveChecklistItem = (id: string) => {
    setEditChecklist(editChecklist.filter(item => item.id !== id));
  };

  const handleChecklistTextChange = (id: string, text: string) => {
    setEditChecklist(editChecklist.map(item => item.id === id ? { ...item, requirement: text } : item));
  };

  const handleChecklistImportanceChange = (id: string, importance: string) => {
    setEditChecklist(editChecklist.map(item => item.id === id ? { ...item, importance } : item));
  };

  const handleSaveJobEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingJob) return;

    try {
      // Helper to parse comma-separated text input to array
      const parseCommaSeparated = (val: string) => 
        val ? val.split(',').map(s => s.trim()).filter(Boolean) : [];

      await apiRequest('PUT', `/api/jobs/${editingJob.id}`, {
        title: editTitle,
        department: editDept,
        location: editLoc,
        experience: editExp,
        degree: editDegree,
        skills: parseCommaSeparated(editSkills), // 1. Target Core Skills
        checklist: editChecklist,
        specialization: editSpecialization, // 2. Specialization
        technicalSkills: parseCommaSeparated(editTechnicalSkills), // 3. Technical Skills
        nationality: editNationality, // 4. Nationality
        languages: editLanguages, // 5. Languages
        softSkills: parseCommaSeparated(editSoftSkills), // 6. Soft Skills
        requiredCerts: editRequiredCerts, // 7. Required Certs
        jobDescription: editJobDescription, // 8. Job Description
        coreResponsibilities: editCoreResponsibilities, // 9. Core Responsibilities
        additionalRequirements: editAdditionalRequirements // 10. Additional Requirements
      });
      setEditModalOpen(false);
      setEditingJob(null);
      fetchDashboardData();
    } catch (e: any) {
      alert(e.message || 'Failed to save job updates');
    }
  };

  return (
    <div className="space-y-8">
      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Total processed CVs */}
        <div className="bg-bg-card border border-border-main p-6 rounded-2xl flex items-center gap-4 hover:shadow-md transition-shadow">
          <div className="w-12 h-12 rounded-xl bg-brand/10 border border-brand/20 flex items-center justify-center shrink-0">
            <FileText className="w-6 h-6 text-brand" />
          </div>
          <div>
            <p className="text-xs font-bold text-text-muted uppercase tracking-wider">{t('kpiTotalCvs')}</p>
            <h3 className="text-2xl font-black text-text-main mt-0.5">{stats.totalCvs}</h3>
          </div>
        </div>

        {/* Active Jobs */}
        <div className="bg-bg-card border border-border-main p-6 rounded-2xl flex items-center gap-4 hover:shadow-md transition-shadow">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
            <Briefcase className="w-6 h-6 text-emerald-500" />
          </div>
          <div>
            <p className="text-xs font-bold text-text-muted uppercase tracking-wider">{t('kpiActiveJobs')}</p>
            <h3 className="text-2xl font-black text-text-main mt-0.5">{stats.activeJobs}</h3>
          </div>
        </div>

        {/* Excellent Matches */}
        <div className="bg-bg-card border border-border-main p-6 rounded-2xl flex items-center gap-4 hover:shadow-md transition-shadow">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
            <Award className="w-6 h-6 text-amber-500" />
          </div>
          <div>
            <p className="text-xs font-bold text-text-muted uppercase tracking-wider">{t('kpiExcellentMatches')}</p>
            <h3 className="text-2xl font-black text-text-main mt-0.5">{stats.excellentMatches}</h3>
          </div>
        </div>

        {/* Average Match score */}
        <div className="bg-bg-card border border-border-main p-6 rounded-2xl flex items-center gap-4 hover:shadow-md transition-shadow">
          <div className="w-12 h-12 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center shrink-0">
            <TrendingUp className="w-6 h-6 text-violet-500" />
          </div>
          <div>
            <p className="text-xs font-bold text-text-muted uppercase tracking-wider">{t('kpiAverageScore')}</p>
            <h3 className="text-2xl font-black text-text-main mt-0.5">{stats.averageMatch}%</h3>
          </div>
        </div>
      </div>

      {/* Role-based Guidance Assistant Panel */}
      {role && (
        <div className="bg-gradient-to-r from-brand/5 via-brand/10 to-brand/5 border border-brand/20 p-6 rounded-2xl flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-brand flex items-center justify-center shrink-0 shadow-lg shadow-brand/10">
            <Compass className="w-5 h-5 text-white" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-brand uppercase tracking-wider">{t('assistantTitle')}</h4>
            <p className="text-sm text-text-main font-medium mt-1 leading-relaxed">
              {role === 'admin' ? t('assistant_admin') : role === 'manager' ? t('assistant_manager') : t('assistant_recruiter')}
            </p>
          </div>
        </div>
      )}

      {/* Actions and Jobs Table Section */}
      <div className="space-y-4">
        <div className="flex justify-between items-center gap-4">
          <h3 className="text-lg font-black text-text-main">{t('activeJobsList')}</h3>
          
          <div className="flex gap-2">
            {/* AI Strategic Summary Button */}
            <button
              onClick={() => setSummaryModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-brand/10 hover:bg-brand-light border border-brand/20 text-brand rounded-xl font-bold text-xs transition-all cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-brand animate-pulse" />
              <span>{t('aiStrategicSummary')}</span>
            </button>

            {/* Create Job Redirect */}
            {canEditJobs && (
              <button
                onClick={() => navigate('/jobs')}
                className="flex items-center gap-1.5 px-4 py-2 bg-brand hover:bg-brand-hover text-white rounded-xl font-bold text-xs shadow-md shadow-brand/10 transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>{t('createJob')}</span>
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="py-20 text-center text-text-muted">Loading dashboard...</div>
        ) : jobsList.length === 0 ? (
          <div className="bg-bg-card border border-border-main p-12 rounded-2xl text-center text-text-muted">
            <Briefcase className="w-12 h-12 mx-auto text-text-muted/40 mb-3" />
            <p className="text-sm font-semibold">{t('noJobsYet')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {jobsList.map(job => {
              const checklistItems = job.checklist ? JSON.parse(job.checklist) : [];
              return (
                <div key={job.id} className={`bg-bg-card border p-5 rounded-2xl flex flex-col justify-between hover:shadow-md transition-shadow ${job.status === 'Paused' ? 'border-amber-500/40 bg-amber-500/[0.02]' : 'border-border-main'}`}>
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-bold text-brand bg-brand-light px-2.5 py-1 rounded-full uppercase tracking-wider">
                        {job.department}
                      </span>
                      {job.status === 'Paused' && (
                        <span className="text-[10px] font-bold text-amber-500 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-full uppercase tracking-wider flex items-center gap-1">
                          <Pause className="w-3 h-3" />
                          Paused
                        </span>
                      )}
                    </div>
                    <h4 className="text-base font-bold text-text-main mt-3" title={job.title}>
                      <Bidi>{job.title}</Bidi>
                    </h4>
                    <p className="text-xs text-text-muted mt-1 font-medium">{job.location} • {job.experience} years exp.</p>

                    <div className="mt-4 pt-4 border-t border-border-main/50 space-y-2">
                      <p className="text-[11px] font-bold text-text-muted uppercase tracking-wider flex items-center gap-1.5">
                        <ListTodo className="w-3.5 h-3.5" />
                        ATS Checklist Preview ({checklistItems.length})
                      </p>
                      <ul className="text-xs text-text-main space-y-1 max-h-[85px] overflow-y-auto pr-1">
                        {checklistItems.slice(0, 3).map((item: any) => (
                          <li key={item.id} className="truncate flex items-center gap-1">
                            <span className="w-1 h-1 rounded-full bg-brand shrink-0"></span>
                            <span className="truncate">{item.requirement}</span>
                          </li>
                        ))}
                        {checklistItems.length > 3 && (
                          <li className="text-[10px] text-text-muted font-semibold italic">
                            + {checklistItems.length - 3} more items...
                          </li>
                        )}
                      </ul>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mt-5 pt-4 border-t border-border-main/50">
                    <button
                      onClick={() => navigate(`/results?job=${job.id}`)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-bg-hover hover:bg-border-main rounded-xl text-xs font-bold text-text-main transition-colors cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>{t('viewResults')}</span>
                    </button>

                    {canEditJobs && (
                      <button
                        onClick={() => handleOpenEdit(job)}
                        className="flex items-center justify-center p-2 bg-brand/10 hover:bg-brand-light text-brand rounded-xl text-xs font-bold transition-colors cursor-pointer"
                        title={t('editJob')}
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {canEditJobs && (
                      <button
                        onClick={() => handleTogglePause(job)}
                        className={`flex items-center justify-center p-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                          job.status === 'Paused'
                            ? 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 border border-emerald-500/20'
                            : 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 border border-amber-500/20'
                        }`}
                        title={job.status === 'Paused' ? 'Activate Job Position' : 'Pause Job Position'}
                      >
                        {job.status === 'Paused' ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
                      </button>
                    )}

                    {canDeleteJobs && (
                      <button
                        onClick={() => handleDeleteJobClick(job)}
                        className="flex items-center justify-center p-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                        title="Delete Job Position"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Edit Job Modal */}
      {editModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-bg-card border border-border-main w-full max-w-2xl p-6 rounded-3xl shadow-2xl glass-panel max-h-[90vh] overflow-y-auto relative animate-in fade-in zoom-in-95 duration-200">
            <button
              onClick={() => setEditModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-bg-hover text-text-muted hover:text-text-main transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-black text-text-main mb-4">{t('editJob')}</h3>

            <form onSubmit={handleSaveJobEdit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-1.5 px-1">{t('jobTitle')}</label>
                  <input
                    type="text"
                    required
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-border-main bg-bg-main/50 text-text-main focus:outline-none focus:border-brand text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-1.5 px-1">{t('department')}</label>
                  <input
                    type="text"
                    required
                    value={editDept}
                    onChange={(e) => setEditDept(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-border-main bg-bg-main/50 text-text-main focus:outline-none focus:border-brand text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-1.5 px-1">{t('location')}</label>
                  <input
                    type="text"
                    required
                    value={editLoc}
                    onChange={(e) => setEditLoc(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-border-main bg-bg-main/50 text-text-main focus:outline-none focus:border-brand text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-1.5 px-1">{t('experienceYears')}</label>
                  <input
                    type="number"
                    required
                    value={editExp}
                    onChange={(e) => setEditExp(parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 rounded-lg border border-border-main bg-bg-main/50 text-text-main focus:outline-none focus:border-brand text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-1.5 px-1">{t('degreeRequired')}</label>
                <input
                  type="text"
                  required
                  value={editDegree}
                  onChange={(e) => setEditDegree(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-border-main bg-bg-main/50 text-text-main focus:outline-none focus:border-brand text-sm"
                />
              </div>

              {/* 1. Target Core Skills (المهارات الأساسية المستهدفة) */}
              <div>
                <label className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-1.5 px-1">
                  Target Core Skills (Comma-separated)
                </label>
                <input
                  type="text"
                  value={editSkills}
                  onChange={(e) => setEditSkills(e.target.value)}
                  placeholder="React, TypeScript, Node.js, REST APIs"
                  className="w-full px-3 py-2 rounded-lg border border-border-main bg-bg-main/50 text-text-main focus:outline-none focus:border-brand text-sm"
                />
              </div>

              {/* Section 2: Technical Details & Deep Requirements (الخصائص 2 إلى 10) */}
              <div className="pt-3 border-t border-border-main/50 space-y-4">
                <h4 className="text-xs font-bold text-text-muted uppercase tracking-wider">التفاصيل الفنية والمتطلبات المعمقة</h4>
                
                {/* 2. Required Specialization & 3. Required Technical Skills */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-1.5 px-1">
                      التخصص الدقيق المطلوب
                    </label>
                    <input
                      type="text"
                      value={editSpecialization}
                      onChange={(e) => setEditSpecialization(e.target.value)}
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
                      value={editTechnicalSkills}
                      onChange={(e) => setEditTechnicalSkills(e.target.value)}
                      placeholder="Cisco, Azure, Windows Server"
                      className="w-full px-3 py-2 rounded-lg border border-border-main bg-bg-main/50 text-text-main focus:outline-none focus:border-brand text-sm"
                    />
                  </div>
                </div>

                {/* 4. Required Nationality & 5. Required Languages */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-1.5 px-1">
                      الجنسية المطلوبة
                    </label>
                    <input
                      type="text"
                      value={editNationality}
                      onChange={(e) => setEditNationality(e.target.value)}
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
                      value={editLanguages}
                      onChange={(e) => setEditLanguages(e.target.value)}
                      placeholder="مثال: العربية والإنجليزية"
                      className="w-full px-3 py-2 rounded-lg border border-border-main bg-bg-main/50 text-text-main focus:outline-none focus:border-brand text-sm"
                    />
                  </div>
                </div>

                {/* 6. Soft / Behavioral Skills */}
                <div>
                  <label className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-1.5 px-1">
                    المهارات السلوكية والشخصية (تفصل بفاصلة)
                  </label>
                  <input
                    type="text"
                    value={editSoftSkills}
                    onChange={(e) => setEditSoftSkills(e.target.value)}
                    placeholder="حل المشكلات, العمل الجماعي, التواصل"
                    className="w-full px-3 py-2 rounded-lg border border-border-main bg-bg-main/50 text-text-main focus:outline-none focus:border-brand text-sm"
                  />
                </div>

                {/* 7. Required Professional Certifications */}
                <div>
                  <label className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-1.5 px-1">
                    الشهادات المهنية المطلوبة
                  </label>
                  <input
                    type="text"
                    value={editRequiredCerts}
                    onChange={(e) => setEditRequiredCerts(e.target.value)}
                    placeholder="CCNA, PMP, AZ-900"
                    className="w-full px-3 py-2 rounded-lg border border-border-main bg-bg-main/50 text-text-main focus:outline-none focus:border-brand text-sm"
                  />
                </div>

                {/* 8. General Job Description */}
                <div>
                  <label className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-1.5 px-1">
                    الوصف العام للوظيفة
                  </label>
                  <textarea
                    value={editJobDescription}
                    onChange={(e) => setEditJobDescription(e.target.value)}
                    placeholder="أدخل وصفاً عاماً للوظيفة والبيئة الوظيفية"
                    rows={3}
                    className="w-full px-3 py-2 rounded-lg border border-border-main bg-bg-main/50 text-text-main focus:outline-none focus:border-brand text-sm resize-none"
                  />
                </div>

                {/* 9. Core Responsibilities */}
                <div>
                  <label className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-1.5 px-1">
                    المسؤوليات الأساسية
                  </label>
                  <textarea
                    value={editCoreResponsibilities}
                    onChange={(e) => setEditCoreResponsibilities(e.target.value)}
                    placeholder="أدخل الواجبات والمسؤوليات اليومية بالتفصيل"
                    rows={3}
                    className="w-full px-3 py-2 rounded-lg border border-border-main bg-bg-main/50 text-text-main focus:outline-none focus:border-brand text-sm resize-none"
                  />
                </div>

                {/* 10. Additional Requirements */}
                <div>
                  <label className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-1.5 px-1">
                    متطلبات إضافية
                  </label>
                  <textarea
                    value={editAdditionalRequirements}
                    onChange={(e) => setEditAdditionalRequirements(e.target.value)}
                    placeholder="شروط إضافية مثل رخصة القيادة أو برامج محددة"
                    rows={3}
                    className="w-full px-3 py-2 rounded-lg border border-border-main bg-bg-main/50 text-text-main focus:outline-none focus:border-brand text-sm resize-none"
                  />
                </div>
              </div>

              {/* Checklist Editor */}
              <div className="space-y-2 pt-2 border-t border-border-main/50">
                <div className="flex justify-between items-center">
                  <label className="block text-xs font-bold text-text-muted uppercase tracking-wider px-1">{t('checklistTitle')}</label>
                  <button
                    type="button"
                    onClick={handleAddChecklistItem}
                    className="flex items-center gap-1 text-xs text-brand hover:underline font-bold"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{t('addChecklistItem')}</span>
                  </button>
                </div>

                <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-1">
                  {editChecklist.map((item, idx) => (
                    <div key={item.id} className="flex gap-2 items-center">
                      <input
                        type="text"
                        required
                        value={item.requirement}
                        onChange={(e) => handleChecklistTextChange(item.id, e.target.value)}
                        placeholder={t('requirementDescription')}
                        className="flex-1 px-3 py-2 rounded-lg border border-border-main bg-bg-main/50 text-text-main focus:outline-none focus:border-brand text-sm"
                      />
                      
                      <select
                        value={item.importance}
                        onChange={(e) => handleChecklistImportanceChange(item.id, e.target.value)}
                        className="w-32 px-2 py-2 rounded-lg border border-border-main bg-bg-main/50 text-text-main focus:outline-none focus:border-brand text-xs"
                      >
                        <option value="Mandatory">Mandatory</option>
                        <option value="Important">Important</option>
                        <option value="Additional">Additional</option>
                      </select>

                      <button
                        type="button"
                        onClick={() => handleRemoveChecklistItem(item.id)}
                        className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-border-main/50">
                <button
                  type="button"
                  onClick={() => setEditModalOpen(false)}
                  className="px-4 py-2 border border-border-main rounded-lg text-sm text-text-muted hover:text-text-main"
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-brand hover:bg-brand-hover text-white rounded-lg font-bold text-sm shadow-md shadow-brand/10 transition-all cursor-pointer"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* AI Strategic Summary Modal */}
      {summaryModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-bg-card border border-border-main w-full max-w-xl p-6 rounded-3xl shadow-2xl glass-panel relative animate-in fade-in zoom-in-95 duration-200">
            <button
              onClick={() => setSummaryModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-bg-hover text-text-muted hover:text-text-main transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-black text-brand mb-4 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-brand animate-bounce" />
              <span>{t('aiStrategicSummary')}</span>
            </h3>

            <div className="space-y-4 text-sm leading-relaxed text-text-main">
              <div>
                <h5 className="font-bold text-brand uppercase tracking-wider text-xs mb-1">Recruitment Campaign Health</h5>
                <p className="text-text-muted">
                  Overall match health is stable at an average match rating of {stats.averageMatch || 75}%. We have identified {stats.excellentMatches || 0} top-tier candidate profiles (matching ≥ 80%) who are ready for interviews.
                </p>
              </div>

              <div>
                <h5 className="font-bold text-brand uppercase tracking-wider text-xs mb-1">Talent Pool Gaps</h5>
                <p className="text-text-muted">
                  Across active openings, candidates commonly fall short in advanced Cloud Architecture (AWS/Azure) and Microservices orchestration. Technical alignment is generally high (avg. 80%), but experience relevance averages slightly lower (72%).
                </p>
              </div>

              <div>
                <h5 className="font-bold text-brand uppercase tracking-wider text-xs mb-1">Strategic Recommendations</h5>
                <ul className="list-disc pl-4 space-y-1 text-text-muted">
                  <li>Prioritize interview scheduling for {stats.excellentMatches} excellent matches to avoid drop-off.</li>
                  <li>Loosen cloud requirements slightly for recruiters to source stronger local candidates.</li>
                  <li>Utilize candidate outreach templates to keep matches updated.</li>
                </ul>
              </div>
            </div>

            <div className="flex justify-end pt-5 mt-4 border-t border-border-main/50">
              <button
                onClick={() => setSummaryModalOpen(false)}
                className="px-5 py-2 bg-brand text-white rounded-lg font-bold text-xs cursor-pointer"
              >
                Close Summary
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Job Deletion Confirmation Modal (Phase 1) */}
      {deleteModalOpen && deletingJob && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-bg-card border border-border-main rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-500 rounded-xl shrink-0">
                <Trash2 className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-text-main">
                  Delete Job Position?
                </h3>
                <p className="text-xs text-text-muted leading-relaxed">
                  Are you sure you want to permanently delete <strong className="text-text-main font-semibold">"<Bidi>{deletingJob.title}</Bidi>"</strong> ({deletingJob.department})?
                </p>
              </div>
            </div>

            <div className="p-3.5 bg-red-500/5 border border-red-500/20 rounded-xl space-y-1 text-xs">
              <div className="flex items-center gap-1.5 text-red-500 font-bold">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>Irreversible Action & Data Loss Notice</span>
              </div>
              <p className="text-[11px] text-text-muted leading-relaxed pl-5">
                This job deletion is permanent. <strong className="text-red-500 font-bold">{deletingCandidateCount} candidate(s)</strong> currently linked to this position will be cascade-deleted along with their CV files and records.
              </p>
            </div>

            <div className="flex justify-end gap-3 pt-2 border-t border-border-main/50">
              <button
                type="button"
                id="cancel-delete-job-btn"
                onClick={handleCancelDeleteJob}
                disabled={deletingInProgress}
                className="px-4 py-2 border border-border-main rounded-xl text-xs font-bold text-text-muted hover:text-text-main hover:bg-bg-hover transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                id="confirm-delete-job-btn"
                onClick={handleConfirmDeleteJob}
                disabled={deletingInProgress}
                className="px-5 py-2 bg-red-500 hover:bg-red-600 text-white rounded-xl text-xs font-bold shadow-md shadow-red-500/20 transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{deletingInProgress ? 'Deleting...' : 'Delete Job'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
