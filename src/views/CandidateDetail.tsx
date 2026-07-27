import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useI18n } from '../i18n/I18nContext.js';
import { useRole } from '../context/RoleContext.js';
import { apiRequest } from '../utils/api.js';
import { anonymizeCandidate } from '../utils/gdpr.js';
import { resolveCandidateDetails } from '../utils/candidateExtraction.js';
import Bidi from '../components/Bidi.js';
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
      <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider mt-2.5 text-center">{label}</span>
    </div>
  );
};

export const CandidateDetail: React.FC = () => {
  const { t } = useI18n();
  const { id } = useParams();
  const navigate = useNavigate();
  const { gdprActive } = useRole();

  const [candidate, setCandidate] = useState<Candidate | null>(null);
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
      setNotifyResult(res);
    } catch (err: any) {
      setNotifyResult({ success: false, error: err.message || 'Notification dispatch failed' });
    } finally {
      setNotifySending(false);
    }
  };

  // Interview Schedule Modal States (Phase 4.1 & 4.2)
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [schedDate, setSchedDate] = useState(new Date().toISOString().split('T')[0]);
  const [schedStart, setSchedStart] = useState('10:00');
  const [schedEnd, setSchedEnd] = useState('11:00');
  const [schedLocation, setSchedLocation] = useState('Online Google Meet / Office');
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

      setSchedResult(res);
      // Phase 2: Explicit confirmation step — do NOT auto-trigger browser download here.
      // User must click explicit "Download .ics File" button in event preview.
    } catch (err: any) {
      setSchedResult({ success: false, error: err.message || 'Failed to schedule interview' });
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
    return <div className="py-20 text-center text-text-muted">Loading AI detailed analysis...</div>;
  }

  if (!candidate) {
    return (
      <div className="py-12 text-center text-text-muted">
        Candidate detailed record not found.
      </div>
    );
  }

  // Anonymize details
  const activeCand = anonymizeCandidate(candidate, gdprActive);

  // Map checklists to display description
  const jobChecklist = job?.checklist ? JSON.parse(job.checklist) : [];
  const checklistMatchMap = activeCand.checklistEval || [];

  return (
    <div className="space-y-6 print-container">
      {/* Back, Notify, Schedule & Print Actions (Hidden during print) */}
      <div className="flex items-center justify-between gap-4 no-print">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-xs font-bold text-text-muted hover:text-text-main transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Go Back</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={() => { setShowScheduleModal(true); setSchedResult(null); }}
            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 hover:bg-emerald-500/20 rounded-xl font-bold text-xs shadow-sm transition-all cursor-pointer"
          >
            <Calendar className="w-4 h-4 text-emerald-500" />
            <span>Schedule Interview</span>
          </button>

          <button
            onClick={() => { setShowNotifyModal(true); setNotifyResult(null); }}
            className="flex items-center gap-1.5 px-4 py-2 bg-bg-card border border-border-main text-text-main hover:bg-bg-hover rounded-xl font-bold text-xs shadow-sm transition-all cursor-pointer"
          >
            <Send className="w-4 h-4 text-brand" />
            <span>Send Notification</span>
          </button>

          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-4 py-2 bg-brand hover:bg-brand-hover text-white rounded-xl font-bold text-xs shadow-md shadow-brand/10 transition-all cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>{t('printReport')}</span>
          </button>
        </div>
      </div>

      {/* Profile Card Header */}
      <div className="bg-bg-card border border-border-main p-6 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="space-y-2">
          {/* Target Job Badge - Positioned clearly at top */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-brand/10 border border-brand/20 text-brand text-xs font-bold rounded-xl">
            <span className="text-text-muted font-medium">الوظيفة المستهدفة للتحليل:</span>
            <span className="font-extrabold">{job?.title || 'Target Job Position'}</span>
          </div>

          <div className="flex items-center gap-4 pt-1">
            <div className="w-14 h-14 bg-brand/10 border border-brand/20 rounded-2xl flex items-center justify-center text-brand shrink-0">
              <User className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-xl font-black text-text-main"><Bidi>{activeCand.name}</Bidi></h2>
              <p className="text-[10px] text-text-muted mt-0.5 font-medium">{activeCand.originalFilename}</p>
            </div>
          </div>
        </div>

        {/* Contact & Profile info (Hidden or Redacted under GDPR) */}
        <div className="flex flex-col gap-2 text-xs text-text-muted font-medium border-t md:border-t-0 md:border-l border-border-main/50 pt-4 md:pt-0 md:pl-6">
          {activeCand.nationality && (
            <div className="flex items-center gap-2 text-brand font-bold">
              <Globe className="w-4 h-4 text-brand shrink-0" />
              <span>الجنسية: {activeCand.nationality}</span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <Mail className="w-4 h-4 text-text-muted/70 shrink-0" />
            <span>{activeCand.contactEmail || 'No email parsed'}</span>
          </div>
          <div className="flex items-center gap-2">
            <Phone className="w-4 h-4 text-text-muted/70 shrink-0" />
            <span>{activeCand.contactPhone || 'No phone parsed'}</span>
          </div>
        </div>
      </div>

      {/* SVG Score Gauges */}
      <div className="bg-bg-card border border-border-main p-6 rounded-2xl grid grid-cols-2 md:grid-cols-4 gap-6">
        <CircularGauge percentage={activeCand.matchScore} label="Overall Match" color="stroke-brand" />
        <CircularGauge percentage={activeCand.scoreTechnical} label="Technical Fit" color="stroke-emerald-500" />
        <CircularGauge percentage={activeCand.scoreExperience} label="Experience Fit" color="stroke-violet-500" />
        <CircularGauge percentage={activeCand.scoreCultural} label="Cultural Fit" color="stroke-amber-500" />
      </div>

      {/* Executive Summary & Recommendation */}
      <div className="bg-bg-card border border-border-main p-6 rounded-2xl space-y-4">
        <h3 className="text-sm font-bold text-text-muted uppercase tracking-wider">{t('executiveSummary')}</h3>
        <p className="text-sm text-text-main leading-relaxed font-medium bg-bg-main/50 p-4 rounded-xl border border-border-main/40">
          {activeCand.recommendation || 'No executive summary outputted by the model.'}
        </p>

        {/* Strengths and Gaps */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          {/* Strengths */}
          <div className="bg-emerald-500/5 border border-emerald-500/20 p-4 rounded-xl">
            <h4 className="text-xs font-bold text-emerald-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Award className="w-4 h-4" />
              {t('competitiveStrengths')}
            </h4>
            <ul className="text-xs space-y-1.5 text-text-main list-disc pl-4 leading-relaxed font-medium">
              {activeCand.skills?.slice(0, 4).map((str, idx) => (
                <li key={idx}>Expertise in {str}</li>
              ))}
              {activeCand.certificationsList?.map((c, idx) => (
                <li key={idx}>Holds certification: {c}</li>
              ))}
            </ul>
          </div>

          {/* Gaps */}
          <div className="bg-red-500/5 border border-red-500/20 p-4 rounded-xl">
            <h4 className="text-xs font-bold text-red-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4" />
              {t('candidateGaps')}
            </h4>
            <ul className="text-xs space-y-1.5 text-text-main list-disc pl-4 leading-relaxed font-medium">
              {activeCand.gaps && activeCand.gaps.length > 0 ? (
                activeCand.gaps.map((gap, idx) => (
                  <li key={idx}>{gap}</li>
                ))
              ) : (
                <li>No significant gaps identified.</li>
              )}
            </ul>
          </div>
        </div>
      </div>

      {/* Education History & Certifications Cards (Screenshot 2) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Certifications (الشهادات المهنية المعتمدة) */}
        <div className="bg-bg-card border border-border-main p-6 rounded-2xl space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-text-main flex items-center gap-2">
              <Award className="w-4 h-4 text-amber-500" />
              <span>الشهادات المهنية المعتمدة (Certifications)</span>
            </h3>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {activeCand.certificationsList && activeCand.certificationsList.length > 0 ? (
              activeCand.certificationsList.map((cert, idx) => (
                <div key={idx} className="p-3 bg-bg-main/50 border border-border-main/50 rounded-xl flex items-center justify-between font-bold text-xs text-text-main shadow-xs">
                  <span>{cert}</span>
                  <Award className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                </div>
              ))
            ) : (
              <div className="col-span-2 text-xs text-text-muted italic py-2">لا توجد شهادات مهنية مذكورة.</div>
            )}
          </div>
        </div>

        {/* Education History (المؤهلات التعليمية والأكاديمية) */}
        {(() => {
          const ext = resolveCandidateDetails(activeCand);
          return (
            <div className="bg-bg-card border border-border-main p-6 rounded-2xl space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-text-main flex items-center gap-2">
                  <GraduationCap className="w-4 h-4 text-purple-500" />
                  <span>المؤهلات التعليمية والأكاديمية (Education History)</span>
                </h3>
              </div>
              <div className="space-y-3">
                <div className="p-3 bg-bg-main/50 border border-border-main/50 rounded-xl space-y-1">
                  <span className="text-[10px] font-bold text-purple-500 uppercase tracking-wider block">المؤهل العلمي والتخصص</span>
                  <p className="text-xs font-bold text-text-main">
                    {ext.educationDegree !== '—' ? (
                      `${ext.educationDegree}${ext.educationField !== '—' ? ` - ${ext.educationField}` : ''}`
                    ) : ext.educationField !== '—' ? (
                      ext.educationField
                    ) : (
                      'غير محدد'
                    )}
                  </p>
                </div>

                <div className="p-3 bg-bg-main/50 border border-border-main/50 rounded-xl space-y-1">
                  <span className="text-[10px] font-bold text-purple-500 uppercase tracking-wider block">سنوات الخبرة الإجمالية</span>
                  <p className="text-xs font-bold text-text-main">
                    {ext.totalExp !== '—' ? ext.totalExp : 'غير محدد'}
                  </p>
                </div>
              </div>
            </div>
          );
        })()}
      </div>

      {/* Skills Tag Cloud */}
      <div className="bg-bg-card border border-border-main p-6 rounded-2xl space-y-3">
        <h3 className="text-sm font-bold text-text-muted uppercase tracking-wider">{t('skillsCloud')}</h3>
        <div className="flex flex-wrap gap-2">
          {activeCand.skills && activeCand.skills.length > 0 ? (
            activeCand.skills.map((skill, idx) => (
              <span key={idx} className="bg-brand/10 text-brand text-xs font-semibold px-3 py-1 rounded-full border border-brand/20">
                {skill}
              </span>
            ))
          ) : (
            <span className="text-xs text-text-muted">No specific skills parsed.</span>
          )}
        </div>
      </div>

      {/* Timeline Section */}
      <div className="bg-bg-card border border-border-main p-6 rounded-2xl space-y-5">
        <h3 className="text-sm font-bold text-text-muted uppercase tracking-wider">{t('timelineTitle')}</h3>
        <div className="relative pl-6 border-l border-border-main/50 space-y-6">
          {activeCand.experienceTimeline && activeCand.experienceTimeline.length > 0 ? (
            activeCand.experienceTimeline.map((item, idx) => (
              <div key={idx} className="relative">
                {/* Dot */}
                <div className="absolute -left-[30px] top-1.5 w-3 h-3 rounded-full bg-brand border border-white"></div>
                <div className="flex items-center gap-1.5 text-xs text-brand font-bold uppercase tracking-wider mb-1">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>{item.yearStart} - {item.yearEnd || 'Present'}</span>
                </div>
                <h4 className="text-sm font-bold text-text-main">{item.title}</h4>
                <p className="text-xs font-semibold text-text-muted mt-0.5">{item.company}</p>
                <p className="text-xs text-text-muted mt-2 leading-relaxed font-medium">{item.description}</p>
              </div>
            ))
          ) : (
            <p className="text-xs text-text-muted">No experience timeline available.</p>
          )}
        </div>
      </div>

      {/* ATS Checklist Matching Table (Screenshot 3 - 5 Columns with Justification) */}
      <div className="bg-bg-card border border-border-main rounded-2xl overflow-hidden">
        <div className="p-5 border-b border-border-main/50 flex items-center justify-between">
          <h3 className="text-sm font-bold text-text-main flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-purple-500" />
            <span>جدول تحليل ومطابقة متطلبات الوظيفة بالتفصيل (Detailed ATS Matching Table)</span>
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-bg-hover/30 border-b border-border-main/50 font-bold text-text-muted uppercase">
                <th className="p-4 w-[25%]">وصف المتطلب</th>
                <th className="p-4 w-24 text-center">الأهمية</th>
                <th className="p-4 w-28 text-center">حالة المطابقة</th>
                <th className="p-4 w-[25%]">التبرير والتوضيح</th>
                <th className="p-4 w-[25%]">الدليل المستخرج من السيرة الذاتية</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-main/40 text-text-main font-medium">
              {jobChecklist.map((reqItem: any) => {
                const evalItem = checklistMatchMap.find(item => item.id === reqItem.id);
                const isMatched = evalItem ? evalItem.matched : false;

                // Format importance badge text & style
                let importanceText = reqItem.importance || 'أساسي';
                if (importanceText === 'Mandatory') importanceText = 'أساسي';
                else if (importanceText === 'Important') importanceText = 'مهم';
                else if (importanceText === 'Additional') importanceText = 'إضافي';

                let importanceBg = 'bg-red-500/10 text-red-500 border-red-500/20';
                if (importanceText === 'مهم') importanceBg = 'bg-amber-500/10 text-amber-500 border-amber-500/20';
                if (importanceText === 'إضافي') importanceBg = 'bg-blue-500/10 text-blue-500 border-blue-500/20';

                return (
                  <tr key={reqItem.id} className="hover:bg-bg-hover/10">
                    {/* 1. وصف المتطلب */}
                    <td className="p-4 leading-relaxed font-bold">
                      {reqItem.requirement}
                    </td>

                    {/* 2. الأهمية */}
                    <td className="p-4 text-center">
                      <span className={`px-2.5 py-1 rounded-md text-[11px] font-bold border ${importanceBg}`}>
                        {importanceText}
                      </span>
                    </td>
                    
                    {/* 3. حالة المطابقة */}
                    <td className="p-4 text-center">
                      <div className="flex items-center justify-center gap-1.5 font-bold">
                        {isMatched ? (
                          <span className="px-2.5 py-1 rounded-md bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 text-[11px]">
                            مطابق
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-md bg-gray-500/10 text-text-muted border border-border-main text-[11px]">
                            غير مذكور
                          </span>
                        )}
                      </div>
                    </td>

                    {/* 4. التبرير والتوضيح (Justification) */}
                    <td className="p-4 leading-relaxed text-text-main text-[11px]">
                      {evalItem?.justification ? (
                        evalItem.justification
                      ) : isMatched ? (
                        `المرشح لديه خبرة معلنة في هذا المجال وتتوافق مع المتطلب.`
                      ) : (
                        `السيرة الذاتية لا تحتوي على خبرة مباشرة صريحة لهذا المتطلب.`
                      )}
                    </td>

                    {/* 5. الدليل المستخرج من السيرة الذاتية */}
                    <td className="p-4 leading-relaxed italic text-text-muted text-[11px]">
                      {evalItem?.evidence ? (
                        <span className="text-text-muted">{evalItem.evidence}</span>
                      ) : (
                        <span className="text-text-muted/60">لم يتم العثور على دليل مباشر.</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Suggested Interview Questions */}
      <div className="bg-bg-card border border-border-main p-6 rounded-2xl space-y-4">
        <h3 className="text-sm font-bold text-text-muted uppercase tracking-wider">{t('interviewQuestions')}</h3>
        <ul className="space-y-2.5">
          {activeCand.interviewQuestions && activeCand.interviewQuestions.length > 0 ? (
            activeCand.interviewQuestions.map((q, idx) => (
              <li key={idx} className="p-3 bg-bg-main/50 rounded-xl border border-border-main/40 text-xs text-text-main font-semibold flex gap-2.5">
                <span className="w-5 h-5 rounded-full bg-brand/10 border border-brand/20 text-brand text-[10px] flex items-center justify-center shrink-0 font-bold">
                  {idx + 1}
                </span>
                <span className="leading-relaxed">{q}</span>
              </li>
            ))
          ) : (
            <li className="text-xs text-text-muted">No suggested interview questions generated.</li>
          )}
        </ul>
      </div>

      {/* Notification Dispatch Modal (Phase 3.2) */}
      {showNotifyModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 no-print">
          <div className="bg-bg-card border border-border-main rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl glass-panel">
            <div className="flex justify-between items-center border-b border-border-main/50 pb-3">
              <h3 className="text-base font-bold text-text-main flex items-center gap-2">
                <Send className="w-5 h-5 text-brand" />
                Send Status Notification
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
                  Select Delivery Channel
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
                    <span>Email ({candidate.contactEmail || 'N/A'})</span>
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
                    <span>WhatsApp ({candidate.contactPhone || 'N/A'})</span>
                  </button>
                </div>
              </div>

              {/* Optional Custom Message Override */}
              <div>
                <label className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-1.5">
                  Custom Message Template (Optional)
                </label>
                <textarea
                  rows={3}
                  value={customMsg}
                  onChange={(e) => setCustomMsg(e.target.value)}
                  placeholder="Leave empty to use default system template with {name}, {job}, {score}, {status} placeholders..."
                  className="w-full p-3 rounded-xl border border-border-main bg-bg-main/50 text-text-main text-xs focus:outline-none focus:border-brand font-mono"
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
                    <div className="p-2 bg-bg-main/70 rounded-lg text-[11px] font-mono text-text-main whitespace-pre-wrap border border-border-main/40">
                      <p className="font-bold text-brand border-b border-border-main/40 pb-1 mb-1">Subject: {notifyResult.subject}</p>
                      {notifyResult.body}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                onClick={() => setShowNotifyModal(false)}
                className="px-4 py-2 bg-bg-main border border-border-main text-text-muted hover:text-text-main rounded-xl font-bold text-xs cursor-pointer"
              >
                Close
              </button>
              <button
                onClick={handleSendNotification}
                disabled={notifySending}
                className="px-4 py-2 bg-brand hover:bg-brand-hover text-white rounded-xl font-bold text-xs shadow-md flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
              >
                {notifySending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                <span>Dispatch Notification</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Schedule Interview Modal (Phase 4.1 & 4.2) */}
      {showScheduleModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 no-print">
          <div className="bg-bg-card border border-border-main rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl glass-panel">
            <div className="flex justify-between items-center border-b border-border-main/50 pb-3">
              <h3 className="text-base font-bold text-text-main flex items-center gap-2">
                <Calendar className="w-5 h-5 text-emerald-500" />
                Schedule Candidate Interview (.ics & iCal)
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
                    Interview Date
                  </label>
                  <input
                    type="date"
                    value={schedDate}
                    onChange={(e) => setSchedDate(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-border-main bg-bg-main/50 text-text-main font-bold text-xs focus:outline-none focus:border-brand"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-1.5">
                      Start
                    </label>
                    <input
                      type="time"
                      value={schedStart}
                      onChange={(e) => setSchedStart(e.target.value)}
                      className="w-full p-2.5 rounded-xl border border-border-main bg-bg-main/50 text-text-main font-bold text-xs focus:outline-none focus:border-brand"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-1.5">
                      End
                    </label>
                    <input
                      type="time"
                      value={schedEnd}
                      onChange={(e) => setSchedEnd(e.target.value)}
                      className="w-full p-2.5 rounded-xl border border-border-main bg-bg-main/50 text-text-main font-bold text-xs focus:outline-none focus:border-brand"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-1.5">
                  Location / Meeting Link
                </label>
                <input
                  type="text"
                  value={schedLocation}
                  onChange={(e) => setSchedLocation(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-border-main bg-bg-main/50 text-text-main text-xs focus:outline-none focus:border-brand"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-1.5">
                  Interview Agenda / Notes
                </label>
                <textarea
                  rows={3}
                  value={schedNotes}
                  onChange={(e) => setSchedNotes(e.target.value)}
                  placeholder="Technical assessment, team introduction, coding preview..."
                  className="w-full p-3 rounded-xl border border-border-main bg-bg-main/50 text-text-main text-xs focus:outline-none focus:border-brand"
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
                      <p className="font-bold text-emerald-500 uppercase tracking-wider text-[10px]">
                        Event Summary Preview
                      </p>
                      <div className="grid grid-cols-2 gap-2 text-[11px]">
                        <div>
                          <span className="text-text-muted block font-medium">Candidate</span>
                          <span className="font-bold"><Bidi>{candidate?.name}</Bidi></span>
                        </div>
                        <div>
                          <span className="text-text-muted block font-medium">Position</span>
                          <span className="font-bold">{job?.title || 'Job Position'}</span>
                        </div>
                        <div>
                          <span className="text-text-muted block font-medium">Date & Time</span>
                          <span className="font-semibold">{schedDate} ({schedStart} - {schedEnd})</span>
                        </div>
                        <div>
                          <span className="text-text-muted block font-medium">Location</span>
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
                          <span>Download .ics File</span>
                        </button>

                        {schedResult.gcalUrl && (
                          <a
                            href={schedResult.gcalUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-bg-hover hover:bg-border-main text-text-main rounded-lg font-bold text-xs border border-border-main transition-all"
                          >
                            <Calendar className="w-3.5 h-3.5 text-emerald-500" />
                            <span>Open Google Calendar Event</span>
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
                className="px-4 py-2 bg-bg-main border border-border-main text-text-muted hover:text-text-main rounded-xl font-bold text-xs cursor-pointer"
              >
                Close
              </button>
              <button
                onClick={handleScheduleInterview}
                disabled={schedLoading}
                className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold text-xs shadow-md flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
              >
                {schedLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Calendar className="w-3.5 h-3.5" />}
                <span>Generate Calendar Event (.ics)</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default CandidateDetail;
