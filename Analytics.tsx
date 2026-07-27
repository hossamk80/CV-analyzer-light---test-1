import React, { useState, useEffect, useMemo } from 'react';
import { apiRequest } from '../utils/api.js';
import { useI18n } from '../i18n/I18nContext.js';
import AccessDenied from '../components/AccessDenied.js';
import { 
  BarChart3, 
  TrendingUp, 
  Clock, 
  Users, 
  Award, 
  Briefcase, 
  Filter, 
  CheckCircle2, 
  XCircle, 
  RefreshCw,
  PieChart,
  Calendar
} from 'lucide-react';

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
  status: 'Pending' | 'Shortlisted' | 'Interviewing' | 'Rejected';
  createdAt: string;
}

interface Job {
  id: number;
  title: string;
  department: string;
}

export const Analytics: React.FC = () => {
  const { language } = useI18n();
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const cList = await apiRequest('GET', '/api/candidates');
      const jList = await apiRequest('GET', '/api/jobs');
      setCandidates(cList);
      setJobs(jList);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch analytics data');
    } finally {
      setLoading(false);
    }
  };

  // Filter candidates by target job
  const filteredCandidates = useMemo(() => {
    if (selectedJobId === 'all') return candidates;
    return candidates.filter(c => c.jobId === parseInt(selectedJobId));
  }, [candidates, selectedJobId]);

  // Compute Funnel Metrics
  const funnelMetrics = useMemo(() => {
    const total = filteredCandidates.length;
    const pending = filteredCandidates.filter(c => c.status === 'Pending').length;
    const shortlisted = filteredCandidates.filter(c => c.status === 'Shortlisted').length;
    const interviewing = filteredCandidates.filter(c => c.status === 'Interviewing').length;
    const rejected = filteredCandidates.filter(c => c.status === 'Rejected').length;

    const shortlistedPct = total > 0 ? Math.round((shortlisted / total) * 100) : 0;
    const interviewingPct = total > 0 ? Math.round((interviewing / total) * 100) : 0;
    const rejectedPct = total > 0 ? Math.round((rejected / total) * 100) : 0;

    return { total, pending, shortlisted, interviewing, rejected, shortlistedPct, interviewingPct, rejectedPct };
  }, [filteredCandidates]);

  // Compute Match Score Analytics
  const scoreAnalytics = useMemo(() => {
    if (filteredCandidates.length === 0) return { avgMatch: 0, avgTech: 0, avgExp: 0, avgCult: 0, fullMatchCount: 0, partialMatchCount: 0, lowMatchCount: 0 };
    
    let sumMatch = 0, sumTech = 0, sumExp = 0, sumCult = 0;
    let fullMatchCount = 0, partialMatchCount = 0, lowMatchCount = 0;

    filteredCandidates.forEach(c => {
      sumMatch += c.matchScore || 0;
      sumTech += c.scoreTechnical || 0;
      sumExp += c.scoreExperience || 0;
      sumCult += c.scoreCultural || 0;

      if (c.matchScore >= 80) fullMatchCount++;
      else if (c.matchScore >= 50) partialMatchCount++;
      else lowMatchCount++;
    });

    const count = filteredCandidates.length;
    return {
      avgMatch: Math.round(sumMatch / count),
      avgTech: Math.round(sumTech / count),
      avgExp: Math.round(sumExp / count),
      avgCult: Math.round(sumCult / count),
      fullMatchCount,
      partialMatchCount,
      lowMatchCount
    };
  }, [filteredCandidates]);

  // Compute Time-to-Hire (average days in system for interviewed/shortlisted candidates)
  const timeToHireDays = useMemo(() => {
    const advancedCandidates = filteredCandidates.filter(c => c.status === 'Interviewing' || c.status === 'Shortlisted');
    if (advancedCandidates.length === 0) return 3.5; // default benchmark

    const now = new Date().getTime();
    let totalDays = 0;

    advancedCandidates.forEach(c => {
      const created = new Date(c.createdAt || Date.now()).getTime();
      const diffDays = Math.max(1, Math.round((now - created) / (1000 * 60 * 60 * 24)));
      totalDays += diffDays;
    });

    return (totalDays / advancedCandidates.length).toFixed(1);
  }, [filteredCandidates]);

  // Compute Top Skills & Gaps
  const topSkillsAndGaps = useMemo(() => {
    const skillCountMap: Record<string, number> = {};
    const gapCountMap: Record<string, number> = {};

    filteredCandidates.forEach(c => {
      if (Array.isArray(c.skills)) {
        c.skills.forEach(s => {
          const key = s.trim();
          if (key) skillCountMap[key] = (skillCountMap[key] || 0) + 1;
        });
      }
      if (Array.isArray(c.gaps)) {
        c.gaps.forEach(g => {
          const key = g.trim();
          if (key) gapCountMap[key] = (gapCountMap[key] || 0) + 1;
        });
      }
    });

    const topSkills = Object.entries(skillCountMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);

    const topGaps = Object.entries(gapCountMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);

    return { topSkills, topGaps };
  }, [filteredCandidates]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px] text-text-muted text-sm gap-2">
        <RefreshCw className="w-5 h-5 animate-spin text-brand" />
        <span>Computing analytics and funnel metrics...</span>
      </div>
    );
  }

  if (error) {
    return <AccessDenied message={error} onRetry={fetchData} />;
  }

  return (
    <div className="space-y-6">
      {/* Header & Job Selector */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-bg-card border border-border-main p-6 rounded-2xl">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-brand/10 border border-brand/20 flex items-center justify-center text-brand">
            <BarChart3 className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-text-main">
              {language === 'ar' ? 'تقارير وتحليلات التوظيف' : 'Recruitment Reporting & Funnel Analytics'}
            </h2>
            <p className="text-xs text-text-muted">
              {language === 'ar' ? 'مؤشرات الأداء، مسار التوظيف، توزيع النقاط، وأوقات الاستجابة' : 'Funnel conversion rates, match score distribution, and estimated time-to-hire.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Job Position:</label>
          <select
            value={selectedJobId}
            onChange={(e) => setSelectedJobId(e.target.value)}
            className="px-3 py-2 rounded-xl border border-border-main bg-bg-main/50 text-text-main text-xs font-semibold focus:outline-none focus:border-brand min-w-[200px]"
          >
            <option value="all">All Jobs Combined ({jobs.length})</option>
            {jobs.map(j => (
              <option key={j.id} value={j.id}>{j.title}</option>
            ))}
          </select>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-bg-card border border-border-main p-5 rounded-2xl space-y-2">
          <div className="flex justify-between items-center text-text-muted">
            <span className="text-xs font-bold uppercase tracking-wider">Total Candidates</span>
            <Users className="w-4 h-4 text-brand" />
          </div>
          <p className="text-2xl font-black text-text-main">{funnelMetrics.total}</p>
          <p className="text-[11px] text-text-muted font-medium">Evaluated across selected scope</p>
        </div>

        <div className="bg-bg-card border border-border-main p-5 rounded-2xl space-y-2">
          <div className="flex justify-between items-center text-text-muted">
            <span className="text-xs font-bold uppercase tracking-wider">Avg Match Score</span>
            <Award className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-black text-emerald-500">{scoreAnalytics.avgMatch}%</p>
          <p className="text-[11px] text-text-muted font-medium">Tech: {scoreAnalytics.avgTech}% | Exp: {scoreAnalytics.avgExp}%</p>
        </div>

        <div className="bg-bg-card border border-border-main p-5 rounded-2xl space-y-2">
          <div className="flex justify-between items-center text-text-muted">
            <span className="text-xs font-bold uppercase tracking-wider">Shortlisted Rate</span>
            <TrendingUp className="w-4 h-4 text-blue-500" />
          </div>
          <p className="text-2xl font-black text-blue-500">{funnelMetrics.shortlistedPct}%</p>
          <p className="text-[11px] text-text-muted font-medium">{funnelMetrics.shortlisted} candidates shortlisted</p>
        </div>

        <div className="bg-bg-card border border-border-main p-5 rounded-2xl space-y-2">
          <div className="flex justify-between items-center text-text-muted">
            <span className="text-xs font-bold uppercase tracking-wider">Est. Time-to-Hire</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-2xl font-black text-amber-500">{timeToHireDays} days</p>
          <p className="text-[11px] text-text-muted font-medium">From application to interview stage</p>
        </div>
      </div>

      {/* Funnel Metrics Breakdown & Match Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Recruitment Funnel Stages */}
        <div className="bg-bg-card border border-border-main p-6 rounded-2xl space-y-5">
          <h3 className="text-sm font-bold text-text-main uppercase tracking-wider flex items-center gap-2 border-b border-border-main/50 pb-3">
            <PieChart className="w-4 h-4 text-brand" />
            Recruitment Stage Funnel
          </h3>

          <div className="space-y-4">
            {/* Stage 1: Total Applied */}
            <div>
              <div className="flex justify-between text-xs font-bold mb-1">
                <span className="text-text-main">1. Applied / Pending</span>
                <span className="text-text-muted">{funnelMetrics.pending} ({funnelMetrics.total > 0 ? Math.round((funnelMetrics.pending / funnelMetrics.total) * 100) : 0}%)</span>
              </div>
              <div className="w-full bg-bg-main rounded-full h-2.5 overflow-hidden">
                <div className="bg-text-muted h-full rounded-full transition-all duration-500" style={{ width: `${funnelMetrics.total > 0 ? (funnelMetrics.pending / funnelMetrics.total) * 100 : 0}%` }}></div>
              </div>
            </div>

            {/* Stage 2: Shortlisted */}
            <div>
              <div className="flex justify-between text-xs font-bold mb-1">
                <span className="text-blue-500">2. Shortlisted</span>
                <span className="text-blue-500">{funnelMetrics.shortlisted} ({funnelMetrics.shortlistedPct}%)</span>
              </div>
              <div className="w-full bg-bg-main rounded-full h-2.5 overflow-hidden">
                <div className="bg-blue-500 h-full rounded-full transition-all duration-500" style={{ width: `${funnelMetrics.shortlistedPct}%` }}></div>
              </div>
            </div>

            {/* Stage 3: Interviewing */}
            <div>
              <div className="flex justify-between text-xs font-bold mb-1">
                <span className="text-purple-500">3. Interviewing Stage</span>
                <span className="text-purple-500">{funnelMetrics.interviewing} ({funnelMetrics.interviewingPct}%)</span>
              </div>
              <div className="w-full bg-bg-main rounded-full h-2.5 overflow-hidden">
                <div className="bg-purple-500 h-full rounded-full transition-all duration-500" style={{ width: `${funnelMetrics.interviewingPct}%` }}></div>
              </div>
            </div>

            {/* Stage 4: Rejected */}
            <div>
              <div className="flex justify-between text-xs font-bold mb-1">
                <span className="text-red-500">4. Rejected</span>
                <span className="text-red-500">{funnelMetrics.rejected} ({funnelMetrics.rejectedPct}%)</span>
              </div>
              <div className="w-full bg-bg-main rounded-full h-2.5 overflow-hidden">
                <div className="bg-red-500 h-full rounded-full transition-all duration-500" style={{ width: `${funnelMetrics.rejectedPct}%` }}></div>
              </div>
            </div>
          </div>
        </div>

        {/* Score Quality Distribution */}
        <div className="bg-bg-card border border-border-main p-6 rounded-2xl space-y-5">
          <h3 className="text-sm font-bold text-text-main uppercase tracking-wider flex items-center gap-2 border-b border-border-main/50 pb-3">
            <Award className="w-4 h-4 text-emerald-500" />
            Candidate Quality Score Tier Breakdown
          </h3>

          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-xl space-y-1">
              <span className="text-[10px] font-bold uppercase text-green-500">Full Match (≥80%)</span>
              <p className="text-2xl font-black text-green-500">{scoreAnalytics.fullMatchCount}</p>
              <p className="text-[10px] text-text-muted">Top tier fits</p>
            </div>

            <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl space-y-1">
              <span className="text-[10px] font-bold uppercase text-amber-500">Partial (50-79%)</span>
              <p className="text-2xl font-black text-amber-500">{scoreAnalytics.partialMatchCount}</p>
              <p className="text-[10px] text-text-muted">Moderate fits</p>
            </div>

            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl space-y-1">
              <span className="text-[10px] font-bold uppercase text-red-500">Low (&lt;50%)</span>
              <p className="text-2xl font-black text-red-500">{scoreAnalytics.lowMatchCount}</p>
              <p className="text-[10px] text-text-muted">Unmatched</p>
            </div>
          </div>

          {/* Sub-Score Breakdown Averages */}
          <div className="space-y-3 pt-2">
            <div className="flex justify-between items-center text-xs font-semibold">
              <span className="text-text-muted">Technical Match Average:</span>
              <span className="font-bold text-text-main">{scoreAnalytics.avgTech}%</span>
            </div>
            <div className="flex justify-between items-center text-xs font-semibold">
              <span className="text-text-muted">Experience Match Average:</span>
              <span className="font-bold text-text-main">{scoreAnalytics.avgExp}%</span>
            </div>
            <div className="flex justify-between items-center text-xs font-semibold">
              <span className="text-text-muted">Cultural/Soft-Skills Average:</span>
              <span className="font-bold text-text-main">{scoreAnalytics.avgCult}%</span>
            </div>
          </div>
        </div>

      </div>

      {/* Top Skills & Common Gaps Analysis */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        <div className="bg-bg-card border border-border-main p-6 rounded-2xl space-y-4">
          <h3 className="text-sm font-bold text-text-main uppercase tracking-wider flex items-center gap-2 border-b border-border-main/50 pb-3">
            <CheckCircle2 className="w-4 h-4 text-green-500" />
            Most Common Matched Skills
          </h3>
          {topSkillsAndGaps.topSkills.length === 0 ? (
            <p className="text-xs text-text-muted py-4 text-center">No skill data evaluated yet.</p>
          ) : (
            <div className="space-y-2">
              {topSkillsAndGaps.topSkills.map(([skill, cnt]) => (
                <div key={skill} className="flex justify-between items-center p-2.5 bg-bg-main/50 rounded-xl border border-border-main/40 text-xs">
                  <span className="font-bold text-text-main">{skill}</span>
                  <span className="text-[10px] font-bold text-brand bg-brand/10 px-2 py-0.5 rounded-full">{cnt} candidates</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-bg-card border border-border-main p-6 rounded-2xl space-y-4">
          <h3 className="text-sm font-bold text-text-main uppercase tracking-wider flex items-center gap-2 border-b border-border-main/50 pb-3">
            <XCircle className="w-4 h-4 text-red-500" />
            Most Common Skill & Experience Gaps
          </h3>
          {topSkillsAndGaps.topGaps.length === 0 ? (
            <p className="text-xs text-text-muted py-4 text-center">No gap data evaluated yet.</p>
          ) : (
            <div className="space-y-2">
              {topSkillsAndGaps.topGaps.map(([gap, cnt]) => (
                <div key={gap} className="flex justify-between items-center p-2.5 bg-bg-main/50 rounded-xl border border-border-main/40 text-xs">
                  <span className="font-bold text-text-main">{gap}</span>
                  <span className="text-[10px] font-bold text-red-500 bg-red-500/10 px-2 py-0.5 rounded-full">{cnt} candidates</span>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default Analytics;
