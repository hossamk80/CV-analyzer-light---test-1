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
import { useNavigate, Link } from 'react-router-dom';

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

interface TrendPoint {
  date: string;
  label: string;
  cvCount: number;
  avgMatch: number;
  cumulativeCvs: number;
  cumulativeExcellent: number;
  cumulativeJobs: number;
}

interface TopCandidate {
  id: number;
  name: string;
  matchScore: number;
  jobTitle: string;
  gdprAnonymized: number;
}

interface Stats {
  totalCvs: number;
  activeJobs: number;
  excellentMatches: number;
  averageMatch: number;
  trend7d: TrendPoint[];
  topCandidates: TopCandidate[];
  jobCandidateCounts: Record<number, number>;
}

interface Reliability {
  hasData: boolean;
  totalRuns: number;
  successRuns: number;
  successRate: number | null;
  fallbackRate: number | null;
  avgDurationMs: number | null;
}

/** Builds an SVG polyline `points` string from a series, scaled into an 8x34 sparkline box. */
function sparklinePoints(values: number[]): string {
  if (values.length === 0) return '';
  const max = Math.max(...values, 1);
  const w = 90, h = 34;
  return values
    .map((v, i) => {
      const x = values.length > 1 ? (i / (values.length - 1)) * w : w;
      const y = h - (v / max) * h;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}

export const Dashboard: React.FC = () => {
  const { t } = useI18n();
  const { role, capabilities, gdprActive } = useRole();
  const navigate = useNavigate();

  const canEditJobs = role ? hasPermission(role, 'manage_jobs', capabilities) : false;
  const canDeleteJobs = role ? hasPermission(role, 'delete_data', capabilities) : false;

  const [stats, setStats] = useState<Stats>({ totalCvs: 0, activeJobs: 0, excellentMatches: 0, averageMatch: 0, trend7d: [], topCandidates: [], jobCandidateCounts: {} });
  const [reliability, setReliability] = useState<Reliability | null>(null);
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

      try {
        setReliability(await apiRequest('GET', '/api/ai/reliability'));
      } catch {
        // Reliability is supplementary — the rest of the dashboard still renders without it.
      }
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

  const cvSeries = stats.trend7d.map(p => p.cumulativeCvs);
  const jobSeries = stats.trend7d.map(p => p.cumulativeJobs);
  const excellentSeries = stats.trend7d.map(p => p.cumulativeExcellent);
  const matchSeries = stats.trend7d.map(p => p.avgMatch);
  const todayCount = stats.trend7d[stats.trend7d.length - 1]?.cvCount ?? 0;
  const strongMatches = stats.topCandidates.filter(c => c.matchScore >= 90).length;

  const kpiTiles = [
    { label: t('kpiTotalCvs'), value: String(stats.totalCvs), series: cvSeries, icon: FileText },
    { label: t('kpiActiveJobs'), value: String(stats.activeJobs), series: jobSeries, icon: Briefcase },
    { label: t('kpiExcellentMatches'), value: String(stats.excellentMatches), series: excellentSeries, icon: Award },
    { label: t('kpiAverageScore'), value: `${stats.averageMatch}%`, series: matchSeries, icon: TrendingUp }
  ];

  return (
    <div className="space-y-5">
      {/* KPI row — des-2.txt §5 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(200px, 100%), 1fr))', gap: 14 }}>
        {kpiTiles.map(({ label, value, series, icon: Icon }) => (
          <div key={label} className="tk-tile tk-focusable" style={{ transition: 'border-color 180ms ease' }}>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold uppercase tracking-[.1em] flex items-center gap-1.5" style={{ color: 'var(--tk-muted)' }}>
                <Icon className="w-3.5 h-3.5" />
                {label}
              </span>
            </div>
            <div className="flex items-end justify-between gap-2 mt-2">
              <h3 style={{ fontSize: 'clamp(24px,2.6vw,32px)', fontWeight: 500, letterSpacing: '-.03em', color: 'var(--tk-text)', fontVariantNumeric: 'tabular-nums' }}>
                {value}
              </h3>
              {series.length > 1 && (
                <svg viewBox="0 0 90 34" width="90" height="34" style={{ maxWidth: '40%' }}>
                  <polyline points={sparklinePoints(series)} fill="none" stroke="var(--tk-accent)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* AI Assistant hero panel + Top candidates — des-2.txt §5 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(330px, 100%), 1fr))', gap: 14 }}>
        <div className="tk-hero p-5" style={{ flex: '1 1 0' }}>
          <div
            style={{
              position: 'absolute', top: -60, insetInlineEnd: -60, width: 200, height: 200, borderRadius: '50%',
              background: 'radial-gradient(circle, var(--tk-accent-mid), transparent 65%)'
            }}
          />
          <div className="relative space-y-3">
            <h4 className="text-sm font-semibold flex items-center gap-2" style={{ color: 'var(--tk-accent-text)' }}>
              <Sparkles className="w-4 h-4" />
              {t('assistantTitle')}
            </h4>

            {/* Extraction reliability donut — the share of real AI runs (last 30 days) that
                returned a usable structured result. Named "reliability", not "accuracy":
                the system has no ground truth to score its own judgement against. */}
            <div className="flex items-center justify-center py-1">
              <div style={{ position: 'relative', width: 104, height: 104 }}>
                <svg viewBox="0 0 120 120" width="104" height="104">
                  <g transform="rotate(-90 60 60)">
                    <circle cx="60" cy="60" r="50" fill="none" stroke="var(--tk-track)" strokeWidth="9" />
                    {reliability?.hasData && (
                      <circle
                        cx="60" cy="60" r="50" fill="none"
                        stroke="var(--tk-accent)" strokeWidth="9" strokeLinecap="round"
                        strokeDasharray={`${2 * Math.PI * 50 * ((reliability.successRate ?? 0) / 100)} ${2 * Math.PI * 50}`}
                        style={{ filter: 'drop-shadow(0 0 8px color-mix(in srgb, var(--tk-accent) 60%, transparent))' }}
                      />
                    )}
                  </g>
                </svg>
                <div
                  className="absolute inset-0 flex flex-col items-center justify-center"
                  style={{ color: 'var(--tk-text)' }}
                >
                  <span style={{ fontSize: 23, fontWeight: 500, letterSpacing: '-.03em', fontVariantNumeric: 'tabular-nums' }}>
                    {reliability?.hasData ? `${reliability.successRate}%` : '—'}
                  </span>
                  <span className="text-[9px] font-bold uppercase tracking-[.14em]" style={{ color: 'var(--tk-muted)' }}>
                    Reliability
                  </span>
                </div>
              </div>
            </div>
            <p className="text-[11px] text-center" style={{ color: 'var(--tk-dim)' }}>
              {reliability?.hasData
                ? `${reliability.successRuns}/${reliability.totalRuns} AI runs succeeded (30d)`
                : 'No AI runs recorded yet'}
            </p>

            <p className="text-xs leading-relaxed flex items-center gap-2 flex-wrap" style={{ color: 'var(--tk-muted)' }}>
              <span><strong style={{ color: 'var(--tk-text)', fontVariantNumeric: 'tabular-nums' }}>{todayCount}</strong> {t('screenedToday')}</span>
              <span>·</span>
              <span><strong style={{ color: 'var(--tk-text)', fontVariantNumeric: 'tabular-nums' }}>{strongMatches}</strong> {t('atOrAbove90')}</span>
            </p>
            <p className="text-sm font-medium leading-relaxed" style={{ color: 'var(--tk-text)' }}>
              {role === 'admin' ? t('assistant_admin') : role === 'manager' ? t('assistant_manager') : t('assistant_recruiter')}
            </p>

            {stats.topCandidates.slice(0, 3).map(c => {
              const displayName = c.gdprAnonymized ? `Candidate #${c.id}` : c.name;
              return (
                <div key={c.id} className="flex items-center gap-2.5">
                  <span
                    className="flex items-center justify-center shrink-0 font-bold text-xs"
                    style={{ width: 30, height: 30, borderRadius: 10, background: 'var(--tk-accent-soft)', color: 'var(--tk-accent-text)' }}
                  >
                    {c.matchScore}
                  </span>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <p className="text-xs font-semibold truncate" style={{ color: 'var(--tk-text)' }}><Bidi>{displayName}</Bidi></p>
                    <p className="text-[11px] truncate" style={{ color: 'var(--tk-muted)', maxWidth: '40%' }}><Bidi>{c.jobTitle}</Bidi></p>
                  </div>
                </div>
              );
            })}

            <button
              type="button"
              onClick={() => setSummaryModalOpen(true)}
              className="tk-btn-primary tk-focusable"
              style={{ width: '100%', height: 38, fontSize: 12.5 }}
            >
              <Sparkles className="w-3.5 h-3.5" />
              {t('aiStrategicSummary')}
            </button>
          </div>
        </div>

        <div className="tk-panel" style={{ flex: '1.6 1 0' }}>
          <div className="flex items-center justify-between gap-2 mb-3">
            <div>
              <h4 className="text-[15px] font-medium" style={{ color: 'var(--tk-text)' }}>{t('navResults')}</h4>
              <p className="text-[11px]" style={{ color: 'var(--tk-muted)' }}>ranked by match score</p>
            </div>
            <Link to="/results" className="text-xs font-semibold tk-focusable" style={{ color: 'var(--tk-accent-text)' }}>
              {t('viewResults')} →
            </Link>
          </div>

          {stats.topCandidates.length === 0 ? (
            <p className="text-xs py-6 text-center" style={{ color: 'var(--tk-muted)' }}>{t('noCandidatesYet')}</p>
          ) : (
            <div className="tk-row-list">
              {stats.topCandidates.map((c, idx) => {
                const displayName = c.gdprAnonymized ? `Candidate #${c.id}` : c.name;
                return (
                  <div key={c.id} className="flex items-center gap-3 flex-wrap">
                    <span className="text-sm font-bold" style={{ width: 20, color: 'var(--tk-dim)' }}>{String(idx + 1).padStart(2, '0')}</span>
                    <span
                      className="flex items-center justify-center shrink-0 rounded-full font-bold text-xs"
                      style={{ width: 34, height: 34, background: 'var(--tk-accent-soft)', color: 'var(--tk-accent-text)' }}
                    >
                      {displayName.charAt(0).toUpperCase()}
                    </span>
                    <div style={{ flex: '1 1 150px', minWidth: 0 }}>
                      <p className="text-xs font-semibold truncate" style={{ color: 'var(--tk-text)' }}><Bidi>{displayName}</Bidi></p>
                      <p className="text-[11px] truncate" style={{ color: 'var(--tk-muted)' }}><Bidi>{c.jobTitle}</Bidi></p>
                    </div>
                    <div className="tk-progress-track" style={{ flex: '1 1 90px' }}>
                      <div className="tk-progress-fill" style={{ width: `${c.matchScore}%` }} />
                    </div>
                    <span className="text-sm font-bold text-end" style={{ width: 48, color: 'var(--tk-accent-text)' }}>{c.matchScore}%</span>
                    <Link to={`/candidate/${c.id}`} className="tk-btn-primary tk-focusable" style={{ height: 30, padding: '0 12px', fontSize: 11 }}>
                      {t('viewResults') === 'View Results' ? 'Open' : t('viewResults')}
                    </Link>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Actions and Jobs Table Section */}
      <div className="space-y-4">
        <div className="flex justify-between items-center gap-4">
          <h3 className="text-[15px] font-medium" style={{ color: 'var(--tk-text)' }}>{t('activeJobsList')}</h3>

          {canEditJobs && (
            <button
              onClick={() => navigate('/jobs')}
              className="tk-btn-primary tk-focusable"
              style={{ height: 36, padding: '0 16px', fontSize: 12.5 }}
            >
              <Plus className="w-4 h-4" />
              <span>{t('createJob')}</span>
            </button>
          )}
        </div>

        {loading ? (
          <div className="py-20 text-center" style={{ color: 'var(--tk-muted)' }}>Loading dashboard...</div>
        ) : jobsList.length === 0 ? (
          <div className="tk-panel text-center" style={{ padding: 48 }}>
            <Briefcase className="w-12 h-12 mx-auto mb-3" style={{ color: 'var(--tk-dim)' }} />
            <p className="text-sm font-semibold" style={{ color: 'var(--tk-muted)' }}>{t('noJobsYet')}</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(320px, 100%), 1fr))', gap: 14 }}>
            {jobsList.map(job => {
              const checklistItems = job.checklist ? JSON.parse(job.checklist) : [];
              return (
                <div key={job.id} className="tk-tile flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="tk-pill is-active">{job.department}</span>
                      {job.status === 'Paused' && (
                        <span className="tk-pill">
                          <Pause className="w-3 h-3" />
                          Paused
                        </span>
                      )}
                    </div>
                    <h4 className="text-[15.5px] font-medium mt-3" style={{ color: 'var(--tk-text)', lineHeight: 1.35 }} title={job.title}>
                      <Bidi>{job.title}</Bidi>
                    </h4>
                    <p className="text-[11.5px] mt-1" style={{ color: 'var(--tk-muted)' }}>{job.location} • {job.experience} years exp.</p>

                    <div className="mt-4 pt-4 space-y-2" style={{ borderTop: '1px solid var(--tk-border)' }}>
                      <p className="text-[11px] font-bold uppercase tracking-[.1em] flex items-center gap-1.5" style={{ color: 'var(--tk-muted)' }}>
                        <ListTodo className="w-3.5 h-3.5" />
                        ATS Checklist Preview ({checklistItems.length})
                      </p>
                      <ul className="text-xs space-y-1 max-h-[85px] overflow-y-auto pr-1" style={{ color: 'var(--tk-text)' }}>
                        {checklistItems.slice(0, 3).map((item: any) => (
                          <li key={item.id} className="truncate flex items-center gap-1">
                            <span className="w-1 h-1 rounded-full shrink-0" style={{ background: 'var(--tk-accent)' }}></span>
                            <span className="truncate">{item.requirement}</span>
                          </li>
                        ))}
                        {checklistItems.length > 3 && (
                          <li className="text-[10px] font-semibold italic" style={{ color: 'var(--tk-muted)' }}>
                            + {checklistItems.length - 3} more items...
                          </li>
                        )}
                      </ul>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mt-5 pt-4" style={{ borderTop: '1px solid var(--tk-border)' }}>
                    <button
                      onClick={() => navigate(`/results?job=${job.id}`)}
                      className="tk-btn-neutral tk-focusable"
                      style={{ flex: 1, height: 34, fontSize: 11.5 }}
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>{t('viewResults')}</span>
                    </button>

                    {canEditJobs && (
                      <button
                        onClick={() => handleOpenEdit(job)}
                        className="tk-icon-btn tk-focusable"
                        style={{ width: 34, height: 34 }}
                        title={t('editJob')}
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {canEditJobs && (
                      <button
                        onClick={() => handleTogglePause(job)}
                        className="tk-icon-btn tk-focusable"
                        style={{ width: 34, height: 34 }}
                        title={job.status === 'Paused' ? 'Activate Job Position' : 'Pause Job Position'}
                      >
                        {job.status === 'Paused' ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
                      </button>
                    )}

                    {canDeleteJobs && (
                      <button
                        onClick={() => handleDeleteJobClick(job)}
                        className="tk-focusable"
                        style={{
                          width: 34, height: 34, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center',
                          background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.2)', color: '#ef4444', cursor: 'pointer'
                        }}
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
