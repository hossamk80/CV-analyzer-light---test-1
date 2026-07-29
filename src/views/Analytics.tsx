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
  const { t } = useI18n();
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
      setError(err.message || t('accessDeniedBody'));
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
      const dept = job?.department?.trim() || t('unassignedDept');
      counts[dept] = (counts[dept] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 6);
    // `t` is a dependency because the "unassigned" bucket label is localized.
  }, [filteredCandidates, jobs, t]);

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
        <span>{t('computingAnalytics')}</span>
      </div>
    );
  }

  if (error) {
    return <AccessDenied message={error} onRetry={fetchData} />;
  }

  const statTiles = [
    {
      label: t('statTotalCandidates'),
      value: String(funnelMetrics.total),
      delta: t('statTotalCandidatesHint'),
      icon: Users
    },
    {
      label: t('statAvgMatch'),
      value: `${scoreAnalytics.avgMatch}%`,
      delta: t('statAvgMatchHint', { tech: String(scoreAnalytics.avgTech), exp: String(scoreAnalytics.avgExp) }),
      icon: Award
    },
    {
      label: t('statShortlistRate'),
      value: `${funnelMetrics.shortlistedPct}%`,
      delta: t('statShortlistHint', { count: String(funnelMetrics.shortlisted) }),
      icon: TrendingUp
    },
    {
      label: t('statTimeToShortlist'),
      value: timeToHireDays ? t('daysUnit', { count: timeToHireDays }) : '—',
      delta: timeToHireDays ? t('statTimeToShortlistHint') : t('statTimeToShortlistNone'),
      icon: Clock
    }
  ];

  // Funnel rows, widest first, each measured against the top of the funnel (des-2.txt §9).
  const funnelRows = [
    { label: t('funnelReceived'), count: funnelMetrics.total },
    { label: t('funnelPending'), count: funnelMetrics.pending },
    { label: t('funnelShortlisted'), count: funnelMetrics.shortlisted },
    { label: t('funnelInterviewing'), count: funnelMetrics.interviewing },
    { label: t('funnelRejected'), count: funnelMetrics.rejected }
  ];
  const funnelTop = funnelMetrics.total || 1;
  const deptMax = byDepartment.length > 0 ? Math.max(...byDepartment.map(([, v]) => v)) : 1;

  const tierCards = [
    { label: t('tierFull'), count: scoreAnalytics.fullMatchCount, hint: t('tierFullHint') },
    { label: t('tierPartial'), count: scoreAnalytics.partialMatchCount, hint: t('tierPartialHint') },
    { label: t('tierLow'), count: scoreAnalytics.lowMatchCount, hint: t('tierLowHint') }
  ];

  return (
    <div style={{ display: 'grid', gap: 10, minWidth: 0 }}>
      {/* Job filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <label className="text-[10.5px] font-bold uppercase tracking-[.1em]" style={{ color: 'var(--tk-muted)' }}>
          {t('analyticsJobFilter')}
        </label>
        <select
          value={selectedJobId}
          onChange={(e) => setSelectedJobId(e.target.value)}
          className="tk-field tk-focusable"
          style={{ width: 'auto', minWidth: 180, maxWidth: '100%', cursor: 'pointer' }}
        >
          <option value="all">{t('allJobsCombined', { count: String(jobs.length) })}</option>
          {jobs.map(j => (
            <option key={j.id} value={j.id}>{j.title}</option>
          ))}
        </select>
      </div>

      {/* Stat tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(185px, 100%), 1fr))', gap: 10 }}>
        {statTiles.map(({ label, value, delta, icon: Icon }) => (
          <div key={label} className="tk-tile">
            <span className="text-[10.5px] font-bold uppercase tracking-[.1em] flex items-center gap-1.5" style={{ color: 'var(--tk-muted)' }}>
              <Icon className="w-3.5 h-3.5" />
              {label}
            </span>
            <div className="flex items-baseline gap-2 flex-wrap mt-1.5">
              <span className="tk-stat-value">{value}</span>
              <span className="text-[11px]" style={{ color: 'var(--tk-accent-text)' }}>{delta}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Hiring funnel + CVs by department */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(300px, 100%), 1fr))', gap: 10 }}>
        <div className="tk-panel">
          <h3 className="text-[14px] font-medium flex items-center gap-2" style={{ color: 'var(--tk-text)' }}>
            <PieChart className="w-4 h-4" style={{ color: 'var(--tk-accent-text)' }} />
            {t('hiringFunnel')}
          </h3>
          <p className="text-[11px] mb-3" style={{ color: 'var(--tk-muted)' }}>{t('hiringFunnelSub')}</p>

          <div style={{ display: 'grid', gap: 9 }}>
            {funnelRows.map(({ label, count }, i) => {
              const pct = Math.round((count / funnelTop) * 100);
              return (
                <div key={label}>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="text-[12px]" style={{ color: 'var(--tk-text)' }}>{label}</span>
                    <span className="text-[12px]" style={{ color: 'var(--tk-muted)', fontVariantNumeric: 'tabular-nums' }}>
                      {count}
                      <span className="inline-block text-end" style={{ width: 44, color: 'var(--tk-dim)' }}>{pct}%</span>
                    </span>
                  </div>
                  <div style={{ height: 20, borderRadius: 7, background: 'var(--tk-track)', overflow: 'hidden' }}>
                    <div
                      style={{
                        height: '100%',
                        width: count > 0 ? `max(6%, ${pct}%)` : '0%',
                        borderRadius: 7,
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
          <h3 className="text-[14px] font-medium flex items-center gap-2" style={{ color: 'var(--tk-text)' }}>
            <BarChart3 className="w-4 h-4" style={{ color: 'var(--tk-accent-text)' }} />
            {t('cvsByDepartment')}
          </h3>
          <p className="text-[11px] mb-3" style={{ color: 'var(--tk-muted)' }}>{t('cvsByDepartmentSub')}</p>

          {byDepartment.length === 0 ? (
            <p className="text-[12px] py-8 text-center" style={{ color: 'var(--tk-muted)' }}>{t('noCandidatesYet')}</p>
          ) : (
            <div className="flex items-end" style={{ height: 175, gap: 'clamp(6px,1.2vw,14px)' }}>
              {byDepartment.map(([dept, count]) => (
                <div key={dept} className="flex flex-col items-center justify-end" style={{ flex: 1, minWidth: 0, height: '100%' }}>
                  <span className="text-[11.5px] mb-1.5" style={{ color: 'var(--tk-accent-text)', fontVariantNumeric: 'tabular-nums' }}>{count}</span>
                  <div
                    style={{
                      width: '100%',
                      height: Math.max(4, Math.round((count / deptMax) * 122)),
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
        <h3 className="text-[14px] font-medium flex items-center gap-2" style={{ color: 'var(--tk-text)' }}>
          <Award className="w-4 h-4" style={{ color: 'var(--tk-accent-text)' }} />
          {t('matchQualityDistribution')}
        </h3>
        <p className="text-[11px] mb-3" style={{ color: 'var(--tk-muted)' }}>{t('matchQualitySub')}</p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(170px, 100%), 1fr))', gap: 10 }}>
          {tierCards.map(({ label, count, hint }) => (
            <div key={label} style={{ padding: 12, borderRadius: 11, background: 'var(--tk-inset)', border: '1px solid var(--tk-border)' }}>
              <span className="text-[10px] font-bold uppercase tracking-[.1em]" style={{ color: 'var(--tk-muted)' }}>{label}</span>
              <p style={{ fontSize: 21, fontWeight: 500, letterSpacing: '-.03em', color: 'var(--tk-accent-text)', fontVariantNumeric: 'tabular-nums' }}>{count}</p>
              <p className="text-[11px]" style={{ color: 'var(--tk-dim)' }}>{hint}</p>
            </div>
          ))}
        </div>

        <div className="mt-3 pt-3" style={{ borderTop: '1px solid var(--tk-border)', display: 'grid', gap: 7 }}>
          {[
            { label: t('avgTechnical'), value: scoreAnalytics.avgTech },
            { label: t('avgExperience'), value: scoreAnalytics.avgExp },
            { label: t('avgCultural'), value: scoreAnalytics.avgCult }
          ].map(({ label, value }) => (
            <div key={label} className="flex items-center justify-between gap-3 text-[12px]">
              <span style={{ color: 'var(--tk-muted)' }}>{label}</span>
              <span style={{ color: 'var(--tk-text)', fontVariantNumeric: 'tabular-nums' }}>{value}%</span>
            </div>
          ))}
        </div>
      </div>

      {/* Top matched skills & common gaps */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(270px, 100%), 1fr))', gap: 10 }}>
        <div className="tk-panel">
          <h3 className="text-[14px] font-medium flex items-center gap-2 mb-2.5" style={{ color: 'var(--tk-text)' }}>
            <CheckCircle2 className="w-4 h-4" style={{ color: 'var(--tk-accent-text)' }} />
            {t('topMatchedSkills')}
          </h3>
          {topSkillsAndGaps.topSkills.length === 0 ? (
            <p className="text-[12px] py-4 text-center" style={{ color: 'var(--tk-muted)' }}>{t('noSkillData')}</p>
          ) : (
            <div className="tk-row-list">
              {topSkillsAndGaps.topSkills.map(([skill, cnt]) => (
                <div key={skill} className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-[12px]" style={{ color: 'var(--tk-text)' }}>{skill}</span>
                  <span className="tk-pill is-active">{cnt}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="tk-panel">
          <h3 className="text-[14px] font-medium flex items-center gap-2 mb-2.5" style={{ color: 'var(--tk-text)' }}>
            <XCircle className="w-4 h-4" style={{ color: 'var(--tk-muted)' }} />
            {t('commonGaps')}
          </h3>
          {topSkillsAndGaps.topGaps.length === 0 ? (
            <p className="text-[12px] py-4 text-center" style={{ color: 'var(--tk-muted)' }}>{t('noGapData')}</p>
          ) : (
            <div className="tk-row-list">
              {topSkillsAndGaps.topGaps.map(([gap, cnt]) => (
                <div key={gap} className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-[12px]" style={{ color: 'var(--tk-soft)' }}>{gap}</span>
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
