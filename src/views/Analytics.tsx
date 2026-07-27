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
  CheckCircle2,
  XCircle,
  RefreshCw,
  PieChart
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

  // Compute Time-to-Hire (average days in system for interviewed/shortlisted candidates).
  // Returns null — rendered as "—" — when nothing has advanced yet, rather than inventing a benchmark.
  const timeToHireDays = useMemo<string | null>(() => {
    const advancedCandidates = filteredCandidates.filter(c => c.status === 'Interviewing' || c.status === 'Shortlisted');
    if (advancedCandidates.length === 0) return null;

    const now = new Date().getTime();
    let totalDays = 0;

    advancedCandidates.forEach(c => {
      const created = new Date(c.createdAt || Date.now()).getTime();
      const diffDays = Math.max(1, Math.round((now - created) / (1000 * 60 * 60 * 24)));
      totalDays += diffDays;
    });

    return (totalDays / advancedCandidates.length).toFixed(1);
  }, [filteredCandidates]);

  // CVs by department — real volume from each candidate's target job (des-2.txt §9).
  const byDepartment = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredCandidates.forEach(c => {
      const job = jobs.find(j => j.id === c.jobId);
      const dept = job?.department?.trim() || 'Unassigned';
      counts[dept] = (counts[dept] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [filteredCandidates, jobs]);

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
      <div className="flex items-center justify-center min-h-[300px] text-sm gap-2" style={{ color: 'var(--tk-muted)' }}>
        <RefreshCw className="w-5 h-5 animate-spin" style={{ color: 'var(--tk-accent)' }} />
        <span>Computing analytics and funnel metrics…</span>
      </div>
    );
  }

  if (error) {
    return <AccessDenied message={error} onRetry={fetchData} />;
  }

  const statTiles = [
    { label: 'Total candidates', value: String(funnelMetrics.total), delta: 'Evaluated in selected scope', icon: Users },
    { label: 'Avg match score', value: `${scoreAnalytics.avgMatch}%`, delta: `Tech ${scoreAnalytics.avgTech}% · Exp ${scoreAnalytics.avgExp}%`, icon: Award },
    { label: 'Shortlisted rate', value: `${funnelMetrics.shortlistedPct}%`, delta: `${funnelMetrics.shortlisted} shortlisted`, icon: TrendingUp },
    { label: 'Est. time to shortlist', value: timeToHireDays ? `${timeToHireDays} days` : '—', delta: timeToHireDays ? 'From upload to advancement' : 'No candidates advanced yet', icon: Clock }
  ];

  // Funnel rows, widest first, each measured against the top of the funnel (des-2.txt §9).
  const funnelRows = [
    { label: 'CVs received', count: funnelMetrics.total },
    { label: 'Pending review', count: funnelMetrics.pending },
    { label: 'Shortlisted', count: funnelMetrics.shortlisted },
    { label: 'Interviewing', count: funnelMetrics.interviewing },
    { label: 'Rejected', count: funnelMetrics.rejected }
  ];
  const funnelTop = funnelMetrics.total || 1;
  const deptMax = byDepartment.length > 0 ? Math.max(...byDepartment.map(([, v]) => v)) : 1;

  const tierCards = [
    { label: 'Full match (≥80%)', count: scoreAnalytics.fullMatchCount, hint: 'Top tier fits' },
    { label: 'Partial (50–79%)', count: scoreAnalytics.partialMatchCount, hint: 'Moderate fits' },
    { label: 'Low (<50%)', count: scoreAnalytics.lowMatchCount, hint: 'Unmatched' }
  ];

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      {/* Job filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <label className="text-[11px] font-bold uppercase tracking-[.1em]" style={{ color: 'var(--tk-muted)' }}>
          {language === 'ar' ? 'الوظيفة' : 'Job'}
        </label>
        <select
          value={selectedJobId}
          onChange={(e) => setSelectedJobId(e.target.value)}
          className="tk-field tk-focusable"
          style={{ width: 'auto', minWidth: 200, height: 36, cursor: 'pointer' }}
        >
          <option value="all">All jobs combined ({jobs.length})</option>
          {jobs.map(j => (
            <option key={j.id} value={j.id}>{j.title}</option>
          ))}
        </select>
      </div>

      {/* Stat tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
        {statTiles.map(({ label, value, delta, icon: Icon }) => (
          <div key={label} className="tk-tile">
            <span className="text-[11px] font-bold uppercase tracking-[.1em] flex items-center gap-1.5" style={{ color: 'var(--tk-muted)' }}>
              <Icon className="w-3.5 h-3.5" />
              {label}
            </span>
            <div className="flex items-baseline gap-2 flex-wrap mt-2">
              <span style={{ fontSize: 'clamp(24px,2.6vw,32px)', fontWeight: 500, letterSpacing: '-.03em', color: 'var(--tk-text)', fontVariantNumeric: 'tabular-nums' }}>
                {value}
              </span>
              <span className="text-[11.5px]" style={{ color: 'var(--tk-accent-text)' }}>{delta}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Hiring funnel + CVs by department */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(330px, 1fr))', gap: 14 }}>
        <div className="tk-panel">
          <h3 className="text-[15px] font-medium flex items-center gap-2" style={{ color: 'var(--tk-text)' }}>
            <PieChart className="w-4 h-4" style={{ color: 'var(--tk-accent-text)' }} />
            Hiring funnel
          </h3>
          <p className="text-[11px] mb-4" style={{ color: 'var(--tk-muted)' }}>Conversion across the current candidate set</p>

          <div style={{ display: 'grid', gap: 12 }}>
            {funnelRows.map(({ label, count }, i) => {
              const pct = Math.round((count / funnelTop) * 100);
              return (
                <div key={label}>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="text-[12.5px]" style={{ color: 'var(--tk-text)' }}>{label}</span>
                    <span className="text-[12.5px]" style={{ color: 'var(--tk-muted)', fontVariantNumeric: 'tabular-nums' }}>
                      {count}
                      <span className="inline-block text-end" style={{ width: 44, color: 'var(--tk-dim)' }}>{pct}%</span>
                    </span>
                  </div>
                  <div style={{ height: 26, borderRadius: 9, background: 'var(--tk-track)', overflow: 'hidden' }}>
                    <div
                      style={{
                        height: '100%',
                        width: count > 0 ? `max(6%, ${pct}%)` : '0%',
                        borderRadius: 9,
                        background: `linear-gradient(90deg, color-mix(in srgb, var(--tk-accent) ${Math.max(70 - 8 * i, 20)}%, transparent), var(--tk-accent))`,
                        boxShadow: count > 0 ? '0 0 18px color-mix(in srgb, var(--tk-accent) 22%, transparent)' : 'none'
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="tk-panel">
          <h3 className="text-[15px] font-medium flex items-center gap-2" style={{ color: 'var(--tk-text)' }}>
            <BarChart3 className="w-4 h-4" style={{ color: 'var(--tk-accent-text)' }} />
            CVs by department
          </h3>
          <p className="text-[11px] mb-4" style={{ color: 'var(--tk-muted)' }}>Volume screened per hiring department</p>

          {byDepartment.length === 0 ? (
            <p className="text-xs py-8 text-center" style={{ color: 'var(--tk-muted)' }}>No candidates screened yet.</p>
          ) : (
            <div className="flex items-end" style={{ height: 210, gap: 'clamp(8px,1.4vw,18px)' }}>
              {byDepartment.map(([dept, count]) => (
                <div key={dept} className="flex flex-col items-center justify-end" style={{ flex: 1, minWidth: 0, height: '100%' }}>
                  <span className="text-[11.5px] mb-1.5" style={{ color: 'var(--tk-accent-text)', fontVariantNumeric: 'tabular-nums' }}>{count}</span>
                  <div
                    style={{
                      width: '100%',
                      height: Math.max(4, Math.round((count / deptMax) * 148)),
                      borderRadius: '8px 8px 0 0',
                      background: 'linear-gradient(180deg, var(--tk-accent), color-mix(in srgb, var(--tk-accent) 18%, transparent))',
                      boxShadow: '0 0 18px color-mix(in srgb, var(--tk-accent) 22%, transparent)'
                    }}
                  />
                  <span
                    className="text-[10px] font-bold uppercase tracking-[.1em] mt-2 truncate w-full text-center"
                    style={{ color: 'var(--tk-muted)' }}
                    title={dept}
                  >
                    {dept}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Score tier breakdown */}
      <div className="tk-panel">
        <h3 className="text-[15px] font-medium flex items-center gap-2" style={{ color: 'var(--tk-text)' }}>
          <Award className="w-4 h-4" style={{ color: 'var(--tk-accent-text)' }} />
          Match quality distribution
        </h3>
        <p className="text-[11px] mb-4" style={{ color: 'var(--tk-muted)' }}>Candidates grouped by overall match score</p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
          {tierCards.map(({ label, count, hint }) => (
            <div key={label} style={{ padding: 14, borderRadius: 13, background: 'var(--tk-inset)', border: '1px solid var(--tk-border)' }}>
              <span className="text-[10px] font-bold uppercase tracking-[.1em]" style={{ color: 'var(--tk-muted)' }}>{label}</span>
              <p style={{ fontSize: 24, fontWeight: 500, letterSpacing: '-.03em', color: 'var(--tk-accent-text)', fontVariantNumeric: 'tabular-nums' }}>{count}</p>
              <p className="text-[11px]" style={{ color: 'var(--tk-dim)' }}>{hint}</p>
            </div>
          ))}
        </div>

        <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--tk-border)', display: 'grid', gap: 8 }}>
          {[
            { label: 'Technical match average', value: scoreAnalytics.avgTech },
            { label: 'Experience match average', value: scoreAnalytics.avgExp },
            { label: 'Cultural / soft-skills average', value: scoreAnalytics.avgCult }
          ].map(({ label, value }) => (
            <div key={label} className="flex items-center justify-between gap-3 text-[12.5px]">
              <span style={{ color: 'var(--tk-muted)' }}>{label}</span>
              <span style={{ color: 'var(--tk-text)', fontVariantNumeric: 'tabular-nums' }}>{value}%</span>
            </div>
          ))}
        </div>
      </div>

      {/* Top matched skills & common gaps */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 14 }}>
        <div className="tk-panel">
          <h3 className="text-[15px] font-medium flex items-center gap-2 mb-3" style={{ color: 'var(--tk-text)' }}>
            <CheckCircle2 className="w-4 h-4" style={{ color: 'var(--tk-accent-text)' }} />
            Top matched skills
          </h3>
          {topSkillsAndGaps.topSkills.length === 0 ? (
            <p className="text-xs py-4 text-center" style={{ color: 'var(--tk-muted)' }}>No skill data evaluated yet.</p>
          ) : (
            <div className="tk-row-list">
              {topSkillsAndGaps.topSkills.map(([skill, cnt]) => (
                <div key={skill} className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-[12.5px]" style={{ color: 'var(--tk-text)' }}>{skill}</span>
                  <span className="tk-pill is-active">{cnt}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="tk-panel">
          <h3 className="text-[15px] font-medium flex items-center gap-2 mb-3" style={{ color: 'var(--tk-text)' }}>
            <XCircle className="w-4 h-4" style={{ color: 'var(--tk-muted)' }} />
            Most common gaps
          </h3>
          {topSkillsAndGaps.topGaps.length === 0 ? (
            <p className="text-xs py-4 text-center" style={{ color: 'var(--tk-muted)' }}>No gap data evaluated yet.</p>
          ) : (
            <div className="tk-row-list">
              {topSkillsAndGaps.topGaps.map(([gap, cnt]) => (
                <div key={gap} className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-[12.5px]" style={{ color: 'var(--tk-soft)' }}>{gap}</span>
                  <span className="tk-pill">{cnt}</span>
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
