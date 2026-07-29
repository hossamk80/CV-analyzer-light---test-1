import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../i18n/I18nContext.js';
import { useRole } from '../context/RoleContext.js';
import { apiRequest } from '../utils/api.js';
import { hasPermission } from '../utils/rbac.js';
import LaserUploadZone from '../components/LaserUploadZone.js';
import { UploadCloud, CheckCircle2, ArrowLeft, ArrowRight } from 'lucide-react';

interface Job {
  id: number;
  title: string;
  department: string;
  location: string;
  status?: string;
}

interface UploadFileState {
  id: string;
  file: File;
  name: string;
  size: number;
  progress: number;
  status: 'queued' | 'processing' | 'success' | 'error' | 'skipped';
  error?: string;
  errorCode?: string;
  errorDetail?: string;
  // populated when status === 'skipped'
  skipReason?: 'duplicate_same_job';
  existingCandidateName?: string;
}

type AnalysisMode = 'ai' | 'hybrid' | 'local';

export const Upload: React.FC = () => {
  const { t, dir, language } = useI18n();
  const navigate = useNavigate();
  const { role, capabilities, gdprActive, toggleGdpr } = useRole();
  const canToggleGdpr = !!role && hasPermission(role, 'toggle_gdpr', capabilities);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string>('');
  const [files, setFiles] = useState<UploadFileState[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(true);

  // Screening knobs, persisted server-side via /api/screening-settings.
  const [matchThreshold, setMatchThreshold] = useState(80);
  const [notifyOnHighMatch, setNotifyOnHighMatch] = useState(false);
  const [analysisMode, setAnalysisMode] = useState<AnalysisMode>('hybrid');
  const canChangeScreening = !!role && hasPermission(role, 'upload_cvs', capabilities);

  // Files the user removed mid-flight. An upload already in the air cannot be
  // recalled, so the worker checks this set and simply discards the outcome.
  const removedIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    fetchJobs();
    fetchScreeningSettings();
  }, []);

  const fetchJobs = async () => {
    try {
      const data = await apiRequest('GET', '/api/jobs');
      setJobs(data);
      if (data.length > 0) {
        // Default to the first job that can actually accept uploads — a paused job would
        // have every upload rejected server-side.
        const firstActive = data.find((j: Job) => j.status !== 'Paused');
        setSelectedJobId(String((firstActive || data[0]).id));
      }
    } catch (e) {
      console.error('Error fetching jobs:', e);
    } finally {
      setLoadingJobs(false);
    }
  };

  const fetchScreeningSettings = async () => {
    try {
      const s = await apiRequest('GET', '/api/screening-settings');
      setMatchThreshold(s.matchThreshold);
      setNotifyOnHighMatch(s.notifyOnHighMatch);
      if (s.analysisMode) setAnalysisMode(s.analysisMode);
    } catch (e) {
      console.error('Error fetching screening settings:', e);
    }
  };

  const persistScreeningSettings = async (payload: { matchThreshold?: number; notifyOnHighMatch?: boolean; analysisMode?: AnalysisMode }) => {
    try {
      await apiRequest('PUT', '/api/screening-settings', payload);
    } catch (e: any) {
      console.error('Failed saving screening settings:', e);
    }
  };

  const handleFilesSelected = (newFiles: File[]) => {
    const freshFiles = newFiles.map(file => ({
      id: 'file-' + Date.now() + '-' + Math.round(Math.random() * 1e5),
      file,
      name: file.name,
      size: file.size,
      progress: 0,
      status: 'queued' as const
    }));

    setFiles(prev => [...prev, ...freshFiles]);
    
    // Trigger batch uploading process
    setTimeout(() => uploadBatch(freshFiles), 50);
  };

  const uploadBatch = async (filesToUpload: UploadFileState[]) => {
    if (!selectedJobId) return;

    // Concurrency limit of 3
    const concurrency = 3;
    const queue = [...filesToUpload];

    const uploadWorker = async () => {
      while (queue.length > 0) {
        const item = queue.shift();
        if (!item) continue;
        // Removed while it was still waiting its turn — never send it.
        if (removedIdsRef.current.has(item.id)) continue;

        // Only touch a row that is still in the list.
        const patch = (updater: (f: UploadFileState) => UploadFileState) => {
          if (removedIdsRef.current.has(item.id)) return;
          setFiles(prev => prev.map(f => (f.id === item.id ? updater(f) : f)));
        };

        patch(f => ({ ...f, status: 'processing', progress: 10 }));

        // Start progress simulation timer
        let progressVal = 10;
        const progressTimer = setInterval(() => {
          if (progressVal < 90) {
            progressVal += Math.round(Math.random() * 8) + 2;
            setFiles(prev => prev.map(f =>
              f.id === item.id && f.status === 'processing'
                ? { ...f, progress: Math.min(progressVal, 90) }
                : f
            ));
          }
        }, 400);

        try {
          const formData = new FormData();
          formData.append('cvs', item.file);
          formData.append('jobId', selectedJobId);
          // Lets the server store locally generated report text in the language
          // the uploader is actually using.
          formData.append('lang', language);

          // We use native fetch here to support multipart FormData uploads
          const response = await fetch('/api/upload', {
            method: 'POST',
            body: formData,
            credentials: 'same-origin'
          });

          clearInterval(progressTimer);

          const data = await response.json().catch(() => ({}));

          // A request-level rejection (paused job, no provider, 413, …) carries
          // its own code; surface it exactly like a per-file failure.
          if (!response.ok) {
            patch(f => ({
              ...f,
              status: 'error',
              progress: 100,
              errorCode: data.errorCode || undefined,
              errorDetail: data.error || `HTTP ${response.status}`,
              error: data.error || `HTTP ${response.status}`
            }));
            continue;
          }

          const fileResult = data.results?.[0];

          if (fileResult?.skipped && fileResult?.skipReason === 'duplicate_same_job') {
            // Duplicate for same job — show amber warning
            patch(f => ({
              ...f,
              status: 'skipped',
              progress: 100,
              skipReason: 'duplicate_same_job',
              existingCandidateName: fileResult.existingCandidateName
            }));
          } else if (fileResult?.success) {
            patch(f => ({ ...f, status: 'success', progress: 100 }));
          } else {
            patch(f => ({
              ...f,
              status: 'error',
              progress: 100,
              errorCode: fileResult?.errorCode || undefined,
              errorDetail: fileResult?.errorDetail || fileResult?.error || undefined,
              error: fileResult?.error || t('uploadFailed')
            }));
          }

        } catch (err: any) {
          clearInterval(progressTimer);
          // Never reached the server at all — a browser/network failure.
          patch(f => ({
            ...f,
            status: 'error',
            progress: 100,
            errorCode: 'network',
            errorDetail: err?.message || undefined,
            error: err?.message || t('uploadFailed')
          }));
        }
      }
    };

    // Spawn workers
    const workers = Array.from({ length: Math.min(concurrency, filesToUpload.length) }, uploadWorker);
    await Promise.all(workers);
  };

  const handleClearList = () => {
    files.forEach(f => removedIdsRef.current.add(f.id));
    setFiles([]);
  };

  /** Drops one CV from the queue without disturbing the rest of the batch. */
  const handleRemoveFile = (id: string) => {
    removedIdsRef.current.add(id);
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  /** Re-runs a single failed file. */
  const handleRetryFile = (id: string) => {
    const target = files.find(f => f.id === id);
    if (!target) return;
    removedIdsRef.current.delete(id);
    setFiles(prev => prev.map(f =>
      f.id === id
        ? { ...f, status: 'queued', progress: 0, error: undefined, errorCode: undefined, errorDetail: undefined }
        : f
    ));
    setTimeout(() => uploadBatch([target]), 50);
  };

  const selectedJob = jobs.find(j => String(j.id) === selectedJobId);
  const jobIsPaused = selectedJob?.status === 'Paused';

  // Once every queued file has settled and at least one was actually analyzed,
  // the user needs an obvious way out of this screen — previously the flow just
  // ended here with no route to the ranked results.
  const analyzedCount = files.filter(f => f.status === 'success').length;
  const settled = files.length > 0 && files.every(f => f.status === 'success' || f.status === 'error' || f.status === 'skipped');
  const showResultsCta = settled && analyzedCount > 0;
  const ForwardArrow = dir === 'rtl' ? ArrowLeft : ArrowRight;

  if (loadingJobs) {
    return <div className="text-center py-16 text-[12.5px]" style={{ color: 'var(--tk-muted)' }}>{t('loadingJobsList')}</div>;
  }

  if (jobs.length === 0) {
    return (
      <div className="tk-panel text-center" style={{ padding: 32 }}>
        <UploadCloud className="w-9 h-9 mx-auto mb-3" style={{ color: 'var(--tk-dim)' }} />
        <p className="text-[13px] font-medium" style={{ color: 'var(--tk-text)' }}>
          {t('needJobFirst')}
        </p>
        <button
          type="button"
          onClick={() => navigate('/jobs')}
          className="tk-btn-primary tk-focusable mt-4 mx-auto"
        >
          {t('createJob')}
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gap: 10 }}>
      {/* Completion banner — the exit route to the leaderboard. */}
      {showResultsCta && (
        <div
          className="flex flex-wrap items-center justify-between gap-3"
          style={{
            padding: '11px 14px', borderRadius: 12,
            background: 'var(--tk-accent-soft)', border: '1px solid var(--tk-accent-line)'
          }}
        >
          <div className="flex items-center gap-2.5" style={{ minWidth: 0 }}>
            <CheckCircle2 className="w-4 h-4 shrink-0" style={{ color: 'var(--tk-accent-text)' }} />
            <div style={{ minWidth: 0 }}>
              <p className="text-[12.5px] font-medium" style={{ color: 'var(--tk-text)' }}>
                {t('uploadCompleteTitle', { count: String(analyzedCount) })}
              </p>
              <p className="text-[11px]" style={{ color: 'var(--tk-muted)' }}>{t('uploadCompleteHint')}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => navigate(`/results?job=${selectedJobId}`)}
            className="tk-btn-primary tk-focusable shrink-0"
            style={{ background: 'var(--tk-accent)', color: 'var(--tk-on-accent)', borderColor: 'transparent' }}
          >
            <span>{t('continueToResults')}</span>
            <ForwardArrow className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(300px, 100%), 1fr))', gap: 10, alignItems: 'start' }}>
      {/* Left column — drop zone + processing queue */}
      <LaserUploadZone
        files={files}
        onFilesSelected={handleFilesSelected}
        onClear={handleClearList}
        onRemove={handleRemoveFile}
        onRetry={handleRetryFile}
        disabled={jobIsPaused}
      />

      {/* Right column — screening setup */}
      <div className="tk-panel" style={{ display: 'grid', gap: 13 }}>
        <h3 className="text-[14px] font-medium" style={{ color: 'var(--tk-text)' }}>{t('screeningSetup')}</h3>

        <div>
          <label className="block text-[10.5px] font-bold uppercase tracking-[.1em] mb-1.5" style={{ color: 'var(--tk-muted)' }}>
            {t('selectJob')}
          </label>
          <select
            value={selectedJobId}
            onChange={(e) => setSelectedJobId(e.target.value)}
            className="tk-field tk-focusable"
            style={{ cursor: 'pointer' }}
          >
            {jobs.map(j => (
              <option key={j.id} value={j.id} disabled={j.status === 'Paused'}>
                {j.title} ({j.department}){j.status === 'Paused' ? ` — ${t('jobPausedSuffix')}` : ''}
              </option>
            ))}
          </select>
          {jobIsPaused && (
            <p className="text-[11px] mt-1.5" style={{ color: '#f5b301' }}>
              {t('jobPausedNotice')}
            </p>
          )}
        </div>

        {/* Analysis mode — the single biggest lever on token spend, so it lives
            right next to the upload zone rather than buried in Settings. */}
        <div>
          <label className="block text-[10.5px] font-bold uppercase tracking-[.1em] mb-1.5" style={{ color: 'var(--tk-muted)' }}>
            {t('analysisMode')}
          </label>
          <div className="flex gap-1.5 flex-wrap">
            {(['local', 'hybrid', 'ai'] as AnalysisMode[]).map(mode => (
              <button
                key={mode}
                type="button"
                disabled={!canChangeScreening}
                onClick={() => {
                  if (!canChangeScreening) return;
                  setAnalysisMode(mode);
                  persistScreeningSettings({ analysisMode: mode });
                }}
                className="tk-focusable"
                style={{
                  height: 28, borderRadius: 8, paddingInline: 10, fontSize: 11, fontWeight: 600,
                  cursor: canChangeScreening ? 'pointer' : 'not-allowed',
                  opacity: canChangeScreening ? 1 : 0.5,
                  ...(analysisMode === mode
                    ? { background: 'var(--tk-accent)', color: 'var(--tk-on-accent)', border: '1px solid transparent' }
                    : { background: 'transparent', color: 'var(--tk-soft)', border: '1px solid var(--tk-border-strong)' })
                }}
              >
                {t(`analysisMode_${mode}` as any)}
              </button>
            ))}
          </div>
          <p className="text-[11px] mt-1.5 leading-relaxed" style={{ color: 'var(--tk-muted)' }}>
            {t(`analysisMode_${analysisMode}_desc` as any)}
          </p>
          {analysisMode === 'local' && (
            <p className="text-[11px] mt-1" style={{ color: '#f5b301' }}>
              {t('analysisModeLocalNote')}
            </p>
          )}
        </div>

        {/* Match threshold — governs which CVs count as a strong match and, when the
            notification switch is on, which ones raise a notification (des-2.txt §7.2). */}
        <div>
          <div className="flex items-center justify-between gap-2 mb-2">
            <label
              htmlFor="match-threshold"
              className="text-[10.5px] font-bold uppercase tracking-[.1em]"
              style={{ color: 'var(--tk-muted)' }}
            >
              {t('matchThreshold')}
            </label>
            <span className="text-[12px]" style={{ color: 'var(--tk-accent-text)', fontVariantNumeric: 'tabular-nums' }}>
              {matchThreshold}%
            </span>
          </div>
          <input
            id="match-threshold"
            type="range"
            min={0}
            max={100}
            value={matchThreshold}
            disabled={!canChangeScreening}
            onChange={(e) => setMatchThreshold(parseInt(e.target.value))}
            onPointerUp={() => persistScreeningSettings({ matchThreshold })}
            onKeyUp={() => persistScreeningSettings({ matchThreshold })}
            className="w-full tk-focusable"
            style={{ cursor: canChangeScreening ? 'pointer' : 'not-allowed', opacity: canChangeScreening ? 1 : 0.5 }}
          />
          <p className="text-[11px] mt-1.5" style={{ color: 'var(--tk-muted)' }}>
            {t('matchThresholdHint')}
          </p>
        </div>

        {/* Auto-screen: reflects how the pipeline actually works today (upload triggers analysis
            immediately), so it is shown as a locked-on state rather than a toggle that lies. */}
        <div className="flex items-start justify-between gap-3">
          <div style={{ minWidth: 0 }}>
            <p className="text-[12px] font-medium" style={{ color: 'var(--tk-text)' }}>{t('autoScreenTitle')}</p>
            <p className="text-[11px]" style={{ color: 'var(--tk-muted)' }}>{t('autoScreenHint')}</p>
          </div>
          <span className="tk-switch is-on" role="img" aria-label={t('alwaysOn')} title={t('alwaysOnHint')}>
            <span className="tk-switch-knob" />
          </span>
        </div>

        {/* Bound to the header anonymization toggle. */}
        <div className="flex items-start justify-between gap-3">
          <div style={{ minWidth: 0 }}>
            <p className="text-[12px] font-medium" style={{ color: 'var(--tk-text)' }}>{t('anonymizeTitle')}</p>
            <p className="text-[11px]" style={{ color: 'var(--tk-muted)' }}>{t('anonymizeHint')}</p>
          </div>
          <button
            type="button"
            onClick={canToggleGdpr ? toggleGdpr : undefined}
            disabled={!canToggleGdpr}
            role="switch"
            aria-checked={gdprActive}
            aria-label={t('anonymizeTitle')}
            className={`tk-switch tk-focusable ${gdprActive ? 'is-on' : ''}`}
            style={{ opacity: canToggleGdpr ? 1 : 0.5, cursor: canToggleGdpr ? 'pointer' : 'not-allowed' }}
          >
            <span className="tk-switch-knob" />
          </button>
        </div>

        {/* Raises a real in-app notification (header bell) when a CV lands at/above the threshold. */}
        <div className="flex items-start justify-between gap-3">
          <div style={{ minWidth: 0 }}>
            <p className="text-[12px] font-medium" style={{ color: 'var(--tk-text)' }}>{t('notifyStrongTitle')}</p>
            <p className="text-[11px]" style={{ color: 'var(--tk-muted)' }}>
              {t('notifyStrongHint', { threshold: String(matchThreshold) })}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              if (!canChangeScreening) return;
              const next = !notifyOnHighMatch;
              setNotifyOnHighMatch(next);
              persistScreeningSettings({ notifyOnHighMatch: next });
            }}
            disabled={!canChangeScreening}
            role="switch"
            aria-checked={notifyOnHighMatch}
            aria-label={t('notifyStrongTitle')}
            className={`tk-switch tk-focusable ${notifyOnHighMatch ? 'is-on' : ''}`}
            style={{ opacity: canChangeScreening ? 1 : 0.5, cursor: canChangeScreening ? 'pointer' : 'not-allowed' }}
          >
            <span className="tk-switch-knob" />
          </button>
        </div>

        <div style={{ borderTop: '1px solid var(--tk-border)', paddingTop: 12 }}>
          <p className="text-[11px] leading-relaxed" style={{ color: 'var(--tk-dim)' }}>
            {t('uploadFooterNote')}
          </p>
        </div>
      </div>
      </div>
    </div>
  );
};

export default Upload;
