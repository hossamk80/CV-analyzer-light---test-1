import { mandatorySummary, requirementStatus } from '../utils/screening.js';
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useI18n } from '../i18n/I18nContext.js';
import { useRole } from '../context/RoleContext.js';
import { apiRequest } from '../utils/api.js';
import { anonymizeCandidate } from '../utils/gdpr.js';
import { resolveCandidateDetails } from '../utils/candidateExtraction.js';
import Bidi from '../components/Bidi.js';
import EvidenceReview from '../components/EvidenceReview.js';
import { 
  ArrowLeft, 
  Printer, 
  Mail, 
  Phone, 
  Award, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  Calendar, 
  FileText,
  User,
  Send,
  MessageSquare,
  Check,
  Loader2,
  Download,
  GraduationCap,
  Globe
} from 'lucide-react';

interface TimelineItem {
  yearStart: string;
  yearEnd: string;
  company: string;
  title: string;
  description: string;
}

interface ChecklistEvalItem {
  requirementSnapshot?: { id: string; requirement: string; importance?: string };
  id: string;
  matched: boolean;
  evidence: string;
  justification?: string;
}

interface Candidate {
  id: number;
  jobId: number;
  name: string;
  matchScore: number;
  scoreTechnical: number;
  scoreExperience: number;
  scoreCultural: number;
  skills: string[];
  gaps: string[];
  checklistEval: ChecklistEvalItem[];
  experienceTimeline: TimelineItem[];
  certificationsList: string[];
  interviewQuestions: string[];
  recommendation: string;
  contactEmail: string;
  contactPhone: string;
  nationality?: string;
  educationDegree?: string;
  educationField?: string;
  totalExperienceYears?: number;
  originalFilename: string;
  status: string;
  gdprAnonymized: number;
}

interface Job {
  id: number;
  title: string;
  checklist: string; // JSON string
}

// Reusable Circular SVG Progress Gauge
const CircularGauge: React.FC<{ percentage: number; label: string; color: string }> = ({ percentage, label, color }) => {
  const radius = 36;
  const strokeDash = 2 * Math.PI * radius;
  const offset = strokeDash - (percentage / 100) * strokeDash;

  return (
    <div className="flex flex-col items-center justify-center">
      <div className="relative w-20 h-20 gauge-circle">
        <svg className="w-full h-full transform -rotate-90">
          <circle cx="40" cy="40" r={radius} fill="none" className="stroke-border-main" strokeWidth="5" />
          <circle 
            cx="40" 
            cy="40" 
            r={radius} 
            fill="none" 
            className={color} 
            strokeWidth="5"
            strokeDasharray={strokeDash}
            strokeDashoffset={offset}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 1s ease-out' }}
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-sm font-extrabold text-text-main">
          {percentage}%
        </span>
      </div>
      <span className="text-[0.625rem] font-bold text-text-muted uppercase tracking-wider mt-2.5 text-center">{label}</span>
    </div>
  );
};

export const CandidateDetail: React.FC = () => {
  const { t } = useI18n();
  const { id } = useParams();
  const navigate = useNavigate();
  const { gdprActive } = useRole();

  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [applications, setApplications] = useState<{id:number; jobId:number; matchScore:number; status:string}[]>([]);
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [id]);

  const fetchData = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const c = await apiRequest('GET', `/api/candidates/${id}`);
      setCandidate(c);
      setApplications(await apiRequest('GET', `/api/candidates/${id}/applications`));
      
      const j = await apiRequest('GET', `/api/jobs/${c.jobId}`);
      setJob(j);
    } catch (e) {
      console.error('Failed to load candidate detail report:', e);
    } finally {
      setLoading(false);
    }
  };

  // Notification Modal States (Phase 3.2)
  const [showNotifyModal, setShowNotifyModal] = useState(false);
  const [notifyChannel, setNotifyChannel] = useState<'email' | 'whatsapp'>('email');
  const [customMsg, setCustomMsg] = useState('');
  const [notifySending, setNotifySending] = useState(false);
  const [notifyResult, setNotifyResult] = useState<any | null>(null);

  const handleSendNotification = async () => {
    if (!candidate) return;
    setNotifySending(true);
    setNotifyResult(null);
    try {
      const res = await apiRequest('POST', `/api/candidates/${candidate.id}/notify`, {
        channel: notifyChannel,
        customMessage: customMsg || undefined
      });
      setNotifyResult({ ...res, message: t('notificationSent') });
    } catch (err: any) {
      setNotifyResult({ success: false, error: err.message || t('notifyFailed') });
    } finally {
      setNotifySending(false);
    }
  };

  // Interview Schedule Modal States (Phase 4.1 & 4.2)
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [schedDate, setSchedDate] = useState(new Date().toISOString().split('T')[0]);
  const [schedStart, setSchedStart] = useState('10:00');
  const [schedEnd, setSchedEnd] = useState('11:00');
  const [schedLocation, setSchedLocation] = useState('');
  const [schedNotes, setSchedNotes] = useState('');
  const [schedLoading, setSchedLoading] = useState(false);
  const [schedResult, setSchedResult] = useState<any | null>(null);

  const handleScheduleInterview = async () => {
    if (!candidate) return;
    setSchedLoading(true);
    setSchedResult(null);
    try {
      const res = await apiRequest('POST', `/api/candidates/${candidate.id}/schedule-interview`, {
        date: schedDate,
        startTime: schedStart,
        endTime: schedEnd,
        location: schedLocation,
        notes: schedNotes
      });

      setSchedResult({ ...res, message: t('interviewScheduled') });
      // Phase 2: Explicit confirmation step — do NOT auto-trigger browser download here.
      // User must click explicit "Download .ics File" button in event preview.
    } catch (err: any) {
      setSchedResult({ success: false, error: err.message || t('scheduleFailed') });
    } finally {
      setSchedLoading(false);
    }
  };

  const handleDownloadIcsFile = (icsContent: string, filename: string) => {
    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename || 'interview.ics');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return <div className="py-16 text-center text-[0.78125rem]" style={{ color: 'var(--tk-muted)' }}>{t('loadingCandidateReport')}</div>;
  }

  if (!candidate) {
    return (
      <div className="py-12 text-center text-[0.78125rem]" style={{ color: 'var(--tk-muted)' }}>
        {t('candidateNotFound')}
      </div>
    );
  }

  // Anonymize details
  const activeCand = anonymizeCandidate(candidate, gdprActive);

  // Map checklists to display description
  const checklistMatchMap = activeCand.checklistEval || [];
  const snapshots = checklistMatchMap.map(item => item.requirementSnapshot).filter(Boolean);
  const jobChecklist = snapshots.length === checklistMatchMap.length && snapshots.length > 0
    ? snapshots : job?.checklist ? JSON.parse(job.checklist) : [];

  return (
    <div className="space-y-6 print-container">
      {/* Back, Notify, Schedule & Print Actions (Hidden during print) */}
      <div className="flex items-center justify-between gap-4 no-print">
        <button
          onClick={() => navigate(-1)}
          className="tk-focusable flex items-center gap-1.5 text-xs font-semibold" style={{ color: 'var(--tk-accent-text)', background: 'transparent', border: 'none', cursor: 'pointer' }}
        >
          <ArrowLeft className="w-4 h-4 rtl:scale-x-[-1]" />
          <span>{t('goBack')}</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={() => { setShowScheduleModal(true); setSchedResult(null); }}
            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 hover:bg-emerald-500/20 rounded-xl font-bold text-xs shadow-sm transition-all cursor-pointer"
          >
            <Calendar className="w-4 h-4 text-emerald-500" />
            <span>{t('scheduleInterview')}</span>
          </button>

          <button
            onClick={() => { setShowNotifyModal(true); setNotifyResult(null); }}
            className="tk-btn-neutral tk-focusable" style={{ height: 36, padding: '0 16px', fontSize: '0.75rem' }}
          >
            <Send className="w-4 h-4" />
            <span>{t('sendNotification')}</span>
          </button>

          <button
            onClick={handlePrint}
            className="tk-btn-primary tk-focusable" style={{ height: 36, padding: '0 16px', fontSize: '0.75rem' }}
          >
            <Printer className="w-4 h-4" />
            <span>{t('printReport')}</span>
          </button>
        </div>
      </div>

      {/* Profile Card Header */}
      <div className="tk-hero flex flex-col md:flex-row justify-between items-start md:items-center gap-6" style={{ padding: 'clamp(0.9375rem,1.6vw,1.375rem)' }}>
        <div className="space-y-2">
          {/* Target Job Badge - Positioned clearly at top */}
          <div className="tk-pill is-active">
            <span style={{ opacity: .8 }}>{t('targetJobLabel')}</span>
            <span className="font-extrabold"><Bidi>{job?.title || t('targetJobFallback')}</Bidi></span>
          </div>

          <div className="flex items-center gap-4 pt-1">
            <div className="w-14 h-14 bg-brand/10 border border-brand/20 rounded-2xl flex items-center justify-center text-brand shrink-0">
              <User className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-xl font-black text-text-main"><Bidi>{activeCand.name}</Bidi></h2>
              <p className="text-[0.625rem] text-text-muted mt-0.5 font-medium">{activeCand.originalFilename}</p>
            </div>
          </div>
        </div>

        {/* Contact & Profile info (Hidden or Redacted under GDPR) */}
        <div className="flex flex-col gap-2 text-xs text-text-muted font-medium border-t md:border-t-0 md:border-s border-border-main/50 pt-4 md:pt-0 md:ps-6">
          {activeCand.nationality && (
            <div className="flex items-center gap-2 text-brand font-bold">
              <Globe className="w-4 h-4 text-brand shrink-0" />
              <span>{t('nationalityLabel', { value: activeCand.nationality })}</span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <Mail className="w-4 h-4 text-text-muted/70 shrink-0" />
            <span dir="ltr">{activeCand.contactEmail || t('noEmailParsed')}</span>
          </div>
          <div className="flex items-center gap-2">
            <Phone className="w-4 h-4 text-text-muted/70 shrink-0" />
            <span dir="ltr">{activeCand.contactPhone || t('noPhoneParsed')}</span>
          </div>
        </div>
      </div>

      <div className="tk-panel p-4" role="status">{t(`mandatory_${mandatorySummary(jobChecklist, checklistMatchMap).status}`)} — {mandatorySummary(jobChecklist, checklistMatchMap).met}/{mandatorySummary(jobChecklist, checklistMatchMap).total}</div>
      {/* SVG Score Gauges */}
      {!gdprActive && !activeCand.gdprAnonymized && <EvidenceReview candidateId={activeCand.id} />}
      <div className="tk-panel grid grid-cols-2 md:grid-cols-4 gap-6">
        <CircularGauge percentage={activeCand.matchScore} label={t('overallMatch')} color="stroke-brand" />
        <CircularGauge percentage={activeCand.scoreTechnical} label={t('technicalFit')} color="stroke-emerald-500" />
        <CircularGauge percentage={activeCand.scoreExperience} label={t('experienceFit')} color="stroke-violet-500" />
        <CircularGauge percentage={activeCand.scoreCultural} label={t('culturalFit')} color="stroke-amber-500" />
      </div>

      {applications.length > 1 && <section className="tk-panel p-4">
        <h2>{t('profileApplications')}</h2><p className="text-xs">{t('profileNote')}</p>
        <div className="flex flex-wrap gap-3 mt-3">{applications.map(a => <button key={a.id} className="tk-pill" onClick={() => navigate(`/candidate/${a.id}`)}>#{a.jobId} · {a.matchScore}% · {t(`status_${a.status}` as any)}</button>)}</div>
      </section>}
      {/* Executive Summary & Recommendation */}
      <div className="tk-panel space-y-4">
        <h3 className="text-sm font-bold text-text-muted uppercase tracking-wider">{t('executiveSummary')}</h3>
        <p className="text-[0.8125rem] leading-[1.75]" style={{ padding: 16, borderRadius: 11, background: 'var(--tk-inset)', border: '1px solid var(--tk-border)', color: 'var(--tk-text)', textWrap: 'pretty' }}>
          {activeCand.recommendation || t('noExecutiveSummary')}
        </p>

        {/* Strengths and Gaps */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          {/* Strengths */}
          <div className="bg-emerald-500/5 border border-emerald-500/20 p-4 rounded-xl">
            <h4 className="text-xs font-bold text-emerald-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Award className="w-4 h-4" />
              {t('competitiveStrengths')}
            </h4>
            <ul className="text-xs space-y-1.5 text-text-main list-disc ps-4 leading-relaxed font-medium">
              {activeCand.skills?.slice(0, 4).map((str, idx) => (
                <li key={idx}>{t('strengthExpertise', { skill: str })}</li>
              ))}
              {activeCand.certificationsList?.map((c, idx) => (
                <li key={idx}>{t('strengthCertification', { name: c })}</li>
              ))}
            </ul>
          </div>

          {/* Gaps */}
          <div className="bg-red-500/5 border border-red-500/20 p-4 rounded-xl">
            <h4 className="text-xs font-bold text-red-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4" />
              {t('candidateGaps')}
            </h4>
            <ul className="text-xs space-y-1.5 text-text-main list-disc ps-4 leading-relaxed font-medium">
              {activeCand.gaps && activeCand.gaps.length > 0 ? (
                activeCand.gaps.map((gap, idx) => (
                  <li key={idx}>{gap}</li>
                ))
              ) : (
                <li>{t('noSignificantGaps')}</li>
              )}
            </ul>
          </div>
        </div>
      </div>

      {/* Education History & Certifications Cards (Screenshot 2) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Certifications (الشهادات المهنية المعتمدة) */}
        <div className="tk-panel space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-text-main flex items-center gap-2">
              <Award className="w-4 h-4 text-amber-500" />
              <span>{t('certificationsCard')}</span>
            </h3>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {activeCand.certificationsList && activeCand.certificationsList.length > 0 ? (
              activeCand.certificationsList.map((cert, idx) => (
                <div key={idx} className="flex items-center justify-between text-xs" style={{ padding: 12, borderRadius: 11, background: 'var(--tk-inset)', border: '1px solid var(--tk-border)', color: 'var(--tk-text)' }}>
                  <span>{cert}</span>
                  <Award className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                </div>
              ))
            ) : (
              <div className="col-span-2 text-xs text-text-muted italic py-2">{t('noCertifications')}</div>
            )}
          </div>
        </div>

        {/* Education History (المؤهلات التعليمية والأكاديمية) */}
        {(() => {
          const ext = resolveCandidateDetails(activeCand, t as any);
          return (
            <div className="tk-panel space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-text-main flex items-center gap-2">
                  <GraduationCap className="w-4 h-4 text-purple-500" />
                  <span>{t('educationCard')}</span>
                </h3>
              </div>
              <div className="space-y-3">
                <div className="space-y-1" style={{ padding: 12, borderRadius: 11, background: 'var(--tk-inset)', border: '1px solid var(--tk-border)' }}>
                  <span className="text-[0.625rem] font-bold text-purple-500 uppercase tracking-wider block">{t('degreeAndField')}</span>
                  <p className="text-xs font-bold text-text-main">
                    {ext.educationDegree !== '—' ? (
                      `${ext.educationDegree}${ext.educationField !== '—' ? ` - ${ext.educationField}` : ''}`
                    ) : ext.educationField !== '—' ? (
                      ext.educationField
                    ) : (
                      t('notSpecified')
                    )}
                  </p>
                </div>

                <div className="space-y-1" style={{ padding: 12, borderRadius: 11, background: 'var(--tk-inset)', border: '1px solid var(--tk-border)' }}>
                  <span className="text-[0.625rem] font-bold text-purple-500 uppercase tracking-wider block">{t('totalExperience')}</span>
                  <p className="text-xs font-bold text-text-main">
                    {ext.totalExp !== '—' ? ext.totalExp : t('notSpecified')}
                  </p>
                </div>
              </div>
            </div>
          );
        })()}
      </div>

      {/* Skills Tag Cloud */}
      <div className="tk-panel space-y-3">
        <h3 className="text-sm font-bold text-text-muted uppercase tracking-wider">{t('skillsCloud')}</h3>
        <div className="flex flex-wrap gap-2">
          {activeCand.skills && activeCand.skills.length > 0 ? (
            activeCand.skills.map((skill, idx) => (
              <span key={idx} className="text-[0.71875rem]" style={{ padding: '6px 12px', borderRadius: 99, background: 'var(--tk-accent-soft)', color: 'var(--tk-accent-text)' }}>
                {skill}
              </span>
            ))
          ) : (
            <span className="text-xs text-text-muted">{t('noSkillsParsed')}</span>
          )}
        </div>
      </div>

      {/* Timeline Section */}
      <div className="tk-panel space-y-5">
        <h3 className="text-sm font-bold text-text-muted uppercase tracking-wider">{t('timelineTitle')}</h3>
        <div className="relative ps-6 border-s border-border-main/50 space-y-6">
          {activeCand.experienceTimeline && activeCand.experienceTimeline.length > 0 ? (
            activeCand.experienceTimeline.map((item, idx) => (
              <div key={idx} className="relative">
                {/* Dot */}
                <div className="absolute -start-[30px] top-1.5 w-3 h-3 rounded-full bg-brand border border-white"></div>
                <div className="flex items-center gap-1.5 text-xs text-brand font-bold uppercase tracking-wider mb-1">
                  <Calendar className="w-3.5 h-3.5" />
                  <span dir="ltr">{item.yearStart} - {item.yearEnd || t('present')}</span>
                </div>
                <h4 className="text-sm font-bold text-text-main">{item.title}</h4>
                <p className="text-xs font-semibold text-text-muted mt-0.5">{item.company}</p>
                <p className="text-xs text-text-muted mt-2 leading-relaxed font-medium">{item.description}</p>
              </div>
            ))
          ) : (
            <p className="text-xs text-text-muted">{t('noTimeline')}</p>
          )}
        </div>
      </div>

      {/* ATS Checklist Matching Table (Screenshot 3 - 5 Columns with Justification) */}
      <div className="tk-panel" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="flex items-center justify-between" style={{ padding: '13px 14px', borderBottom: '1px solid var(--tk-border)' }}>
          <h3 className="text-[0.8125rem] font-semibold flex items-center gap-2" style={{ color: 'var(--tk-text)' }}>
            <CheckCircle2 className="w-4 h-4 text-purple-500" />
            <span>{t('detailedAtsTable')}</span>
          </h3>
        </div>
        <div className="tk-table-scroll">
          <table className="tk-table">
            <thead>
              <tr>
                <th style={{ width: '25%' }}>{t('colRequirement')}</th>
                <th style={{ width: 90, textAlign: 'center' }}>{t('colImportance')}</th>
                <th style={{ width: 105, textAlign: 'center' }}>{t('colMatchStatus')}</th>
                <th style={{ width: '25%' }}>{t('colJustification')}</th>
                <th style={{ width: '25%' }}>{t('colEvidence')}</th>
              </tr>
            </thead>
            <tbody>
              {jobChecklist.map((reqItem: any) => {
                const evalItem = checklistMatchMap.find(item => item.id === reqItem.id);
                const isMatched = requirementStatus(evalItem) === 'met';

                // Importance is stored in English on the job record; render the localized label.
                const importanceKey = ['Mandatory', 'Important', 'Additional'].includes(reqItem.importance)
                  ? reqItem.importance
                  : 'Mandatory';
                const importanceText = t(`importance_${importanceKey}` as any);
                const importanceBg =
                  importanceKey === 'Important'
                    ? 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                    : importanceKey === 'Additional'
                      ? 'bg-blue-500/10 text-blue-500 border-blue-500/20'
                      : 'bg-red-500/10 text-red-500 border-red-500/20';

                return (
                  <tr key={reqItem.id}>
                    <td className="leading-relaxed font-semibold" style={{ color: 'var(--tk-text)' }}>
                      {reqItem.requirement}
                    </td>

                    <td style={{ textAlign: 'center' }}>
                      <span className={`px-2 py-1 rounded-md text-[0.65625rem] font-bold border ${importanceBg}`}>
                        {importanceText}
                      </span>
                    </td>

                    <td style={{ textAlign: 'center' }}>
                      {isMatched ? (
                        <span className="px-2 py-1 rounded-md bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 text-[0.65625rem] font-bold">
                          {t('matched')}
                        </span>
                      ) : (
                        <span className="tk-pill">{t(`requirement_${requirementStatus(evalItem)}`)}</span>
                      )}
                    </td>

                    <td className="leading-relaxed text-[0.6875rem]" style={{ color: 'var(--tk-text)' }}>
                      {evalItem?.justification
                        || (isMatched ? t('defaultJustificationMatched') : t('defaultJustificationUnmatched'))}
                    </td>

                    <td className="leading-relaxed italic text-[0.6875rem]" style={{ color: 'var(--tk-muted)' }}>
                      {evalItem?.evidence || t('noDirectEvidence')}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Suggested Interview Questions */}
      <div className="tk-panel space-y-4">
        <h3 className="text-sm font-bold text-text-muted uppercase tracking-wider">{t('interviewQuestions')}</h3>
        <ul className="space-y-2.5">
          {activeCand.interviewQuestions && activeCand.interviewQuestions.length > 0 ? (
            activeCand.interviewQuestions.map((q, idx) => (
              <li key={idx} className="text-xs flex gap-2.5" style={{ padding: 12, borderRadius: 11, background: 'var(--tk-inset)', border: '1px solid var(--tk-border)', color: 'var(--tk-text)' }}>
                <span className="w-5 h-5 rounded-full bg-brand/10 border border-brand/20 text-brand text-[0.625rem] flex items-center justify-center shrink-0 font-bold">
                  {idx + 1}
                </span>
                <span className="leading-relaxed">{q}</span>
              </li>
            ))
          ) : (
            <li className="text-xs text-text-muted">{t('noInterviewQuestions')}</li>
          )}
        </ul>
      </div>

      {/* Notification Dispatch Modal (Phase 3.2) */}
      {showNotifyModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 no-print">
          <div className="tk-panel max-w-lg w-full space-y-4" style={{ boxShadow: '0 22px 50px rgba(0,0,0,.35)' }}>
            <div className="flex justify-between items-center border-b border-border-main/50 pb-3">
              <h3 className="text-base font-bold text-text-main flex items-center gap-2">
                <Send className="w-4 h-4" />
                {t('sendStatusNotification')}
              </h3>
              <button 
                onClick={() => setShowNotifyModal(false)}
                className="text-text-muted hover:text-text-main text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* Channel Selector */}
              <div>
                <label className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-2">
                  {t('selectDeliveryChannel')}
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setNotifyChannel('email')}
                    className={`p-3 rounded-xl border flex items-center gap-2 font-bold cursor-pointer transition-all ${
                      notifyChannel === 'email'
                        ? 'border-brand bg-brand/10 text-brand shadow-sm'
                        : 'border-border-main text-text-muted hover:text-text-main'
                    }`}
                  >
                    <Mail className="w-4 h-4" />
                    <span>{t('channelEmail')}</span>
                  </button>

                  <button
                    onClick={() => setNotifyChannel('whatsapp')}
                    className={`p-3 rounded-xl border flex items-center gap-2 font-bold cursor-pointer transition-all ${
                      notifyChannel === 'whatsapp'
                        ? 'border-green-500 bg-green-500/10 text-green-500 shadow-sm'
                        : 'border-border-main text-text-muted hover:text-text-main'
                    }`}
                  >
                    <MessageSquare className="w-4 h-4" />
                    <span>{t('channelWhatsapp')}</span>
                  </button>
                </div>
              </div>

              {/* Optional Custom Message Override */}
              <div>
                <label className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-1.5">
                  {t('customMessageTemplate')}
                </label>
                <textarea
                  rows={3}
                  value={customMsg}
                  onChange={(e) => setCustomMsg(e.target.value)}
                  placeholder={t('customMessagePlaceholder')}
                  className="tk-field tk-focusable" style={{ height: 'auto', minHeight: 34, paddingBlock: 9 }}
                />
              </div>

              {/* Result Preview */}
              {notifyResult && (
                <div className={`p-3.5 rounded-xl border space-y-1.5 ${notifyResult.success ? 'bg-green-500/10 border-green-500/20 text-green-500' : 'bg-red-500/10 border-red-500/20 text-red-500'}`}>
                  <div className="flex items-center gap-2 font-bold">
                    {notifyResult.success ? <Check className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                    <span>{notifyResult.message || notifyResult.error}</span>
                  </div>
                  {notifyResult.body && (
                    <div className="text-[0.6875rem] whitespace-pre-wrap" style={{ padding: 10, borderRadius: 11, background: 'var(--tk-inset)', border: '1px solid var(--tk-border)', color: 'var(--tk-soft)', fontFamily: 'ui-monospace, SFMono-Regular, monospace' }}>
                      <p className="font-bold text-brand border-b border-border-main/40 pb-1 mb-1">{t('notifySubject', { subject: notifyResult.subject })}</p>
                      {notifyResult.body}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                onClick={() => setShowNotifyModal(false)}
                className="tk-btn-neutral tk-focusable"
              >
                {t('close')}
              </button>
              <button
                onClick={handleSendNotification}
                disabled={notifySending}
                className="tk-btn-primary tk-focusable"
              >
                {notifySending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                <span>{t('dispatchNotification')}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Schedule Interview Modal (Phase 4.1 & 4.2) */}
      {showScheduleModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 no-print">
          <div className="tk-panel max-w-lg w-full space-y-4" style={{ boxShadow: '0 22px 50px rgba(0,0,0,.35)' }}>
            <div className="flex justify-between items-center border-b border-border-main/50 pb-3">
              <h3 className="text-base font-bold text-text-main flex items-center gap-2">
                <Calendar className="w-4 h-4 text-emerald-500" />
                {t('scheduleInterviewTitle')}
              </h3>
              <button 
                onClick={() => setShowScheduleModal(false)}
                className="text-text-muted hover:text-text-main text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-1.5">
                    {t('interviewDate')}
                  </label>
                  <input
                    type="date"
                    value={schedDate}
                    onChange={(e) => setSchedDate(e.target.value)}
                    className="tk-field tk-focusable"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-1.5">
                      {t('interviewStart')}
                    </label>
                    <input
                      type="time"
                      value={schedStart}
                      onChange={(e) => setSchedStart(e.target.value)}
                      className="tk-field tk-focusable"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-1.5">
                      {t('interviewEnd')}
                    </label>
                    <input
                      type="time"
                      value={schedEnd}
                      onChange={(e) => setSchedEnd(e.target.value)}
                      className="tk-field tk-focusable"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-1.5">
                  {t('interviewLocation')}
                </label>
                <input
                  type="text"
                  value={schedLocation}
                  onChange={(e) => setSchedLocation(e.target.value)}
                  placeholder={t('interviewLocationDefault')}
                  className="tk-field tk-focusable"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-1.5">
                  {t('interviewNotes')}
                </label>
                <textarea
                  rows={3}
                  value={schedNotes}
                  onChange={(e) => setSchedNotes(e.target.value)}
                  placeholder={t('interviewNotesPlaceholder')}
                  className="tk-field tk-focusable" style={{ height: 'auto', minHeight: 34, paddingBlock: 9 }}
                />
              </div>

              {/* Schedule Result & Event Preview Card (Phase 2) */}
              {schedResult && (
                <div className={`p-4 rounded-xl border space-y-3 ${schedResult.success ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' : 'bg-red-500/10 border-red-500/20 text-red-500'}`}>
                  <div className="flex items-center gap-2 font-bold text-xs">
                    {schedResult.success ? <Check className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
                    <span>{schedResult.message || schedResult.error}</span>
                  </div>

                  {schedResult.success && schedResult.icsContent && (
                    <div className="p-3 bg-bg-card/70 border border-emerald-500/30 rounded-lg text-xs space-y-2 text-text-main">
                      <p className="font-bold text-emerald-500 uppercase tracking-wider text-[0.625rem]">
                        {t('eventSummaryPreview')}
                      </p>
                      <div className="grid grid-cols-2 gap-2 text-[0.6875rem]">
                        <div>
                          <span className="text-text-muted block font-medium">{t('eventCandidate')}</span>
                          <span className="font-bold"><Bidi>{candidate?.name}</Bidi></span>
                        </div>
                        <div>
                          <span className="text-text-muted block font-medium">{t('eventPosition')}</span>
                          <span className="font-bold"><Bidi>{job?.title || t('targetJobFallback')}</Bidi></span>
                        </div>
                        <div>
                          <span className="text-text-muted block font-medium">{t('eventDateTime')}</span>
                          <span className="font-semibold" dir="ltr">{schedDate} ({schedStart} - {schedEnd})</span>
                        </div>
                        <div>
                          <span className="text-text-muted block font-medium">{t('eventLocation')}</span>
                          <span className="font-semibold truncate block">{schedLocation}</span>
                        </div>
                      </div>

                      {/* Explicit Action Buttons */}
                      <div className="pt-2 flex flex-wrap items-center gap-2 border-t border-border-main/40">
                        <button
                          type="button"
                          id="download-ics-btn"
                          onClick={() => handleDownloadIcsFile(schedResult.icsContent, schedResult.filename || 'interview.ics')}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg font-bold text-xs shadow-sm transition-all cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>{t('downloadIcs')}</span>
                        </button>

                        {schedResult.gcalUrl && (
                          <a
                            href={schedResult.gcalUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="tk-btn-neutral tk-focusable" style={{ height: 32, padding: '0 12px', fontSize: '0.71875rem' }}
                          >
                            <Calendar className="w-3.5 h-3.5 text-emerald-500" />
                            <span>{t('openGoogleCalendar')}</span>
                          </a>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                onClick={() => setShowScheduleModal(false)}
                className="tk-btn-neutral tk-focusable"
              >
                {t('close')}
              </button>
              <button
                onClick={handleScheduleInterview}
                disabled={schedLoading}
                className="tk-focusable flex items-center gap-1.5 disabled:opacity-50"
                style={{ height: 32, borderRadius: 9, paddingInline: 13, fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', background: 'rgba(16,185,129,.12)', color: '#10b981', border: '1px solid rgba(16,185,129,.25)' }}
              >
                {schedLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Calendar className="w-3.5 h-3.5" />}
                <span>{t('generateIcs')}</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default CandidateDetail;
