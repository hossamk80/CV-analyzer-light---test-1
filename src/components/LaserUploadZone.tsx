import React, { useRef, useState } from 'react';
import { UploadCloud, FileText, CheckCircle, AlertCircle, RefreshCw, SkipForward } from 'lucide-react';
import { useI18n } from '../i18n/I18nContext.js';

interface UploadFileState {
  id: string;
  name: string;
  size: number;
  progress: number;
  status: 'queued' | 'processing' | 'success' | 'error' | 'skipped';
  error?: string;
  skipReason?: 'duplicate_same_job';
  existingCandidateName?: string;
}

interface LaserUploadZoneProps {
  files: UploadFileState[];
  onFilesSelected: (files: File[]) => void;
  onClear: () => void;
  disabled?: boolean;
}

const STATUS_LABEL: Record<UploadFileState['status'], string> = {
  queued: 'Queued',
  processing: 'Parsing',
  success: 'Parsed',
  error: 'Failed',
  skipped: 'Duplicate'
};

/** Drop zone + processing queue — des-2.txt §7 (left column of the Upload screen). */
export const LaserUploadZone: React.FC<LaserUploadZoneProps> = ({
  files,
  onFilesSelected,
  onClear,
  disabled = false
}) => {
  const { t } = useI18n();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragActive, setIsDragActive] = useState(false);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled) return;
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setIsDragActive(true);
    } else if (e.type === 'dragleave') {
      setIsDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    if (disabled) return;

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      onFilesSelected(Array.from(e.dataTransfer.files));
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      onFilesSelected(Array.from(e.target.files));
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const doneCount = files.filter(f => f.status === 'success' || f.status === 'skipped').length;

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      {/* Drop zone */}
      <div
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        onClick={() => !disabled && fileInputRef.current?.click()}
        className="tk-focusable text-center"
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-label={t('dragDropCVs')}
        onKeyDown={(e) => {
          if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            fileInputRef.current?.click();
          }
        }}
        style={{
          padding: 'clamp(24px,3vw,44px) clamp(18px,2vw,28px)',
          borderRadius: 18,
          border: `1.5px dashed ${isDragActive ? 'var(--tk-accent)' : 'var(--tk-accent-line)'}`,
          background: 'var(--tk-dropzone)',
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.5 : 1,
          transition: 'border-color 180ms ease'
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.docx,.png,.jpg,.jpeg"
          onChange={handleChange}
          className="hidden"
          disabled={disabled}
        />

        <div
          className="mx-auto flex items-center justify-center"
          style={{
            width: 56, height: 56, borderRadius: 17, background: 'var(--tk-accent-soft)',
            color: 'var(--tk-accent-text)', boxShadow: '0 0 30px color-mix(in srgb, var(--tk-accent) 28%, transparent)'
          }}
        >
          <UploadCloud className="w-7 h-7" />
        </div>

        <p className="font-medium mt-4" style={{ fontSize: 'clamp(17px,2vw,21px)', color: 'var(--tk-text)' }}>
          {t('dragDropCVs')}
        </p>
        <p className="text-xs mt-1.5" style={{ color: 'var(--tk-muted)' }}>
          {t('supportedFiles')}
        </p>
        <span className="tk-btn-primary mt-4" style={{ height: 38, padding: '0 18px', fontSize: 12.5, pointerEvents: 'none' }}>
          Browse files
        </span>
        <p className="text-[11px] mt-3" style={{ color: 'var(--tk-dim)' }}>
          {t('parallelProcessNotice')}
        </p>
      </div>

      {/* Processing queue */}
      {files.length > 0 && (
        <div className="tk-panel">
          <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
            <h4 className="text-[15px] font-medium" style={{ color: 'var(--tk-text)' }}>{t('processingCvs')}</h4>
            <div className="flex items-center gap-3">
              <span className="text-[11px]" style={{ color: 'var(--tk-muted)', fontVariantNumeric: 'tabular-nums' }}>
                {files.length} files · {doneCount} done
              </span>
              <button
                type="button"
                onClick={onClear}
                className="tk-btn-neutral tk-focusable"
                style={{ height: 30, padding: '0 12px', fontSize: 11 }}
              >
                Clear list
              </button>
            </div>
          </div>

          <div className="tk-row-list" style={{ maxHeight: 340, overflowY: 'auto' }}>
            {files.map(file => (
              <div key={file.id}>
                <div className="flex items-center gap-3 flex-wrap">
                  <FileText className="w-4 h-4 shrink-0" style={{ color: 'var(--tk-muted)' }} />
                  <div style={{ flex: '1 1 140px', minWidth: 0 }}>
                    <p
                      className="text-[12.5px] truncate"
                      dir="ltr"
                      title={file.name}
                      style={{ color: 'var(--tk-text)', fontFamily: 'ui-monospace, SFMono-Regular, monospace' }}
                    >
                      {file.name}
                    </p>
                    <p className="text-[11px]" style={{ color: 'var(--tk-dim)', fontVariantNumeric: 'tabular-nums' }}>
                      {formatBytes(file.size)}
                    </p>
                  </div>

                  <div className="tk-progress-track" style={{ flex: '1 1 90px', height: 4 }}>
                    <div className="tk-progress-fill" style={{ width: `${file.progress}%` }} />
                  </div>

                  <span
                    className={`tk-pill ${file.status === 'success' ? 'is-active' : ''}`}
                    style={{
                      width: 72, justifyContent: 'center',
                      ...(file.status === 'error' ? { background: 'rgba(239,68,68,.1)', color: '#ef4444' } : {})
                    }}
                  >
                    {file.status === 'processing' && <RefreshCw className="w-3 h-3 animate-spin" />}
                    {file.status === 'success' && <CheckCircle className="w-3 h-3" />}
                    {file.status === 'skipped' && <SkipForward className="w-3 h-3" />}
                    {file.status === 'error' && <AlertCircle className="w-3 h-3" />}
                    {STATUS_LABEL[file.status]}
                  </span>
                </div>

                {file.status === 'skipped' && (
                  <p className="text-[11px] mt-1.5 leading-relaxed" style={{ color: 'var(--tk-dim)' }}>
                    Already analyzed for this job
                    {file.existingCandidateName && <> as <strong style={{ color: 'var(--tk-soft)' }}>{file.existingCandidateName}</strong></>}
                    . Use <strong style={{ color: 'var(--tk-soft)' }}>Re-analyze</strong> on the candidate to refresh it.
                  </p>
                )}

                {file.status === 'error' && file.error && (
                  <p className="text-[11px] mt-1.5 leading-relaxed" style={{ color: '#ef4444' }}>
                    {file.error.includes('AI Provider not configured') ? t('noProviderConfigured') : file.error}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
export default LaserUploadZone;
