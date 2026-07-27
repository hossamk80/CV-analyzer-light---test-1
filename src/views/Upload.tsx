import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../i18n/I18nContext.js';
import { useRole } from '../context/RoleContext.js';
import { apiRequest } from '../utils/api.js';
import { hasPermission } from '../utils/rbac.js';
import LaserUploadZone from '../components/LaserUploadZone.js';
import { UploadCloud } from 'lucide-react';

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
  // populated when status === 'skipped'
  skipReason?: 'duplicate_same_job';
  existingCandidateName?: string;
}

export const Upload: React.FC = () => {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { role, capabilities, gdprActive, toggleGdpr } = useRole();
  const canToggleGdpr = !!role && hasPermission(role, 'toggle_gdpr', capabilities);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string>('');
  const [files, setFiles] = useState<UploadFileState[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(true);

  useEffect(() => {
    fetchJobs();
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

        // Update status to processing
        setFiles(prev => prev.map(f => f.id === item.id ? { ...f, status: 'processing', progress: 10 } : f));

        // Start progress simulation timer
        let progressVal = 10;
        const progressTimer = setInterval(() => {
          if (progressVal < 90) {
            progressVal += Math.round(Math.random() * 8) + 2;
            setFiles(prev => prev.map(f => f.id === item.id && f.status === 'processing' ? { ...f, progress: Math.min(progressVal, 90) } : f));
          }
        }, 400);

        try {
          const formData = new FormData();
          formData.append('cvs', item.file);
          formData.append('jobId', selectedJobId);

          // We use native fetch here to support multipart FormData uploads
          const response = await fetch('/api/upload', {
            method: 'POST',
            body: formData,
            credentials: 'same-origin'
          });

          clearInterval(progressTimer);

          const data = await response.json();

          if (!response.ok) {
            throw new Error(data.error || 'Server error uploading file');
          }

          const fileResult = data.results[0];

          if (fileResult?.skipped && fileResult?.skipReason === 'duplicate_same_job') {
            // Duplicate for same job — show amber warning
            setFiles(prev => prev.map(f => f.id === item.id ? {
              ...f,
              status: 'skipped',
              progress: 100,
              skipReason: 'duplicate_same_job',
              existingCandidateName: fileResult.existingCandidateName
            } : f));
          } else if (fileResult?.success) {
            setFiles(prev => prev.map(f => f.id === item.id ? { ...f, status: 'success', progress: 100 } : f));
          } else {
            throw new Error(fileResult ? fileResult.error : 'AI processing failed');
          }

        } catch (err: any) {
          clearInterval(progressTimer);
          setFiles(prev => prev.map(f => f.id === item.id ? { ...f, status: 'error', error: err.message || 'AI Parsing Failed' } : f));
        }
      }
    };

    // Spawn workers
    const workers = Array.from({ length: Math.min(concurrency, filesToUpload.length) }, uploadWorker);
    await Promise.all(workers);
  };

  const handleClearList = () => {
    setFiles([]);
  };

  const selectedJob = jobs.find(j => String(j.id) === selectedJobId);
  const jobIsPaused = selectedJob?.status === 'Paused';

  if (loadingJobs) {
    return <div className="text-center py-16" style={{ color: 'var(--tk-muted)' }}>Loading target jobs list…</div>;
  }

  if (jobs.length === 0) {
    return (
      <div className="tk-panel text-center" style={{ padding: 40 }}>
        <UploadCloud className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--tk-dim)' }} />
        <p className="text-sm font-medium" style={{ color: 'var(--tk-text)' }}>
          You must define a job position before uploading candidate CVs.
        </p>
        <button
          type="button"
          onClick={() => navigate('/jobs')}
          className="tk-btn-primary tk-focusable mt-4 mx-auto"
          style={{ height: 36, padding: '0 16px', fontSize: 12.5 }}
        >
          {t('createJob')}
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(320px, 100%), 1fr))', gap: 14, alignItems: 'start' }}>
      {/* Left column — drop zone + processing queue */}
      <LaserUploadZone
        files={files}
        onFilesSelected={handleFilesSelected}
        onClear={handleClearList}
        disabled={jobIsPaused}
      />

      {/* Right column — screening setup */}
      <div className="tk-panel" style={{ display: 'grid', gap: 16 }}>
        <h3 className="text-[15px] font-medium" style={{ color: 'var(--tk-text)' }}>Screening setup</h3>

        <div>
          <label className="block text-[11px] font-bold uppercase tracking-[.1em] mb-1.5" style={{ color: 'var(--tk-muted)' }}>
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
                {j.title} ({j.department}){j.status === 'Paused' ? ' — PAUSED' : ''}
              </option>
            ))}
          </select>
          {jobIsPaused && (
            <p className="text-[11px] mt-1.5" style={{ color: '#f5b301' }}>
              This position is paused — uploads are rejected until it is reactivated.
            </p>
          )}
        </div>

        {/* Auto-screen: reflects how the pipeline actually works today (upload triggers analysis
            immediately), so it is shown as a locked-on state rather than a toggle that lies. */}
        <div className="flex items-start justify-between gap-3">
          <div style={{ minWidth: 0 }}>
            <p className="text-[12.5px] font-medium" style={{ color: 'var(--tk-text)' }}>Auto-screen on upload</p>
            <p className="text-[11px]" style={{ color: 'var(--tk-muted)' }}>Score each CV as soon as it lands</p>
          </div>
          <span className="tk-switch is-on" role="img" aria-label="Always on" title="Always on — analysis runs as soon as a CV is uploaded">
            <span className="tk-switch-knob" />
          </span>
        </div>

        {/* Bound to the header GDPR toggle, per des-2.txt §7.3. */}
        <div className="flex items-start justify-between gap-3">
          <div style={{ minWidth: 0 }}>
            <p className="text-[12.5px] font-medium" style={{ color: 'var(--tk-text)' }}>Anonymize personal data</p>
            <p className="text-[11px]" style={{ color: 'var(--tk-muted)' }}>Hide names, photos and contacts</p>
          </div>
          <button
            type="button"
            onClick={canToggleGdpr ? toggleGdpr : undefined}
            disabled={!canToggleGdpr}
            role="switch"
            aria-checked={gdprActive}
            aria-label="Anonymize personal data"
            className={`tk-switch tk-focusable ${gdprActive ? 'is-on' : ''}`}
            style={{ opacity: canToggleGdpr ? 1 : 0.5, cursor: canToggleGdpr ? 'pointer' : 'not-allowed' }}
          >
            <span className="tk-switch-knob" />
          </button>
        </div>

        <div style={{ borderTop: '1px solid var(--tk-border)', paddingTop: 14 }}>
          <p className="text-[11px] leading-relaxed" style={{ color: 'var(--tk-dim)' }}>
            Files are analyzed in parallel (3 at a time) against the selected position's ATS checklist
            using the active AI provider.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Upload;
