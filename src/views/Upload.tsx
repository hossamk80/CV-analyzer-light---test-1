import React, { useState, useEffect } from 'react';
import { useI18n } from '../i18n/I18nContext.js';
import { apiRequest } from '../utils/api.js';
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
        setSelectedJobId(String(data[0].id));
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

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-brand/10 border border-brand/20 flex items-center justify-center">
          <UploadCloud className="w-5 h-5 text-brand" />
        </div>
        <h2 className="text-xl font-black text-text-main">{t('uploadCvs')}</h2>
      </div>

      <div className="bg-bg-card border border-border-main p-6 rounded-2xl max-w-2xl">
        {loadingJobs ? (
          <div className="text-center py-6 text-text-muted">Loading target jobs list...</div>
        ) : jobs.length === 0 ? (
          <div className="p-4 bg-amber-500/10 border border-amber-500/20 text-amber-500 text-sm font-semibold rounded-xl text-center">
            You must create a job position definition first before uploading candidate CVs!
          </div>
        ) : (
          <div className="space-y-5">
            {/* Target Job Selector */}
            <div>
              <label className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-2 px-1">
                {t('selectJob')}
              </label>
              <select
                value={selectedJobId}
                onChange={(e) => setSelectedJobId(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-border-main bg-bg-main/50 text-text-main focus:outline-none focus:border-brand text-sm transition-all"
              >
                {jobs.map(j => (
                  <option key={j.id} value={j.id} disabled={j.status === 'Paused'}>
                    {j.title} ({j.department}) {j.status === 'Paused' ? '⚠️ (PAUSED - Inactive)' : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Upload Zone */}
            <LaserUploadZone
              files={files}
              onFilesSelected={handleFilesSelected}
              onClear={handleClearList}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default Upload;
