import React, { useRef, useState } from 'react';
import { UploadCloud, FileText, CheckCircle, AlertCircle, RefreshCw, SkipForward, X, RotateCw } from 'lucide-react';
import { useI18n } from '../i18n/I18nContext.js';

interface UploadFileState {
  id: string;
  name: string;
  size: number;
  progress: number;
  status: 'queued' | 'processing' | 'success' | 'error' | 'skipped';
  error?: string;
  /** Stable code from the server, translated on this side. */
  errorCode?: string;
  /** Raw provider text, shown as a collapsible technical detail. */
  errorDetail?: string;
  skipReason?: 'duplicate_same_job';
  existingCandidateName?: string;
}

interface LaserUploadZoneProps {
  files: UploadFileState[];
  onFilesSelected: (files: File[]) => void;
  onClear: () => void;
  /** Drops a single row from the queue. */
  onRemove: (id: string) => void;
  /** Re-runs one failed file. */
  onRetry: (id: string) => void;
  disabled?: boolean;
}

/** Drop zone + processing queue — des-2.txt §7 (left column of the Upload screen). */
export const LaserUploadZone: React.FC<LaserUploadZoneProps> = ({
  files,
  onFilesSelected,
  onClear,
  onRemove,
  onRetry,
  disabled = false
}) => {
  const { t } = useI18n();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const [expandedDetail, setExpandedDetail] = useState<string | null>(null);

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

  // Unit symbols are the SI abbreviations, identical in both locales.
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 KB';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const doneCount = files.filter(f => f.status === 'success' || f.status === 'skipped').length;

  return (
    <div style={{ display: 'grid', gap: 10 }}>
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
          padding: 'clamp(18px,2.2vw,32px) clamp(14px,1.6vw,22px)',
          borderRadius: 14,
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
            width: 46, height: 46, borderRadius: 14, background: 'var(--tk-accent-soft)',
            color: 'var(--tk-accent-text)', boxShadow: '0 0 24px color-mix(in srgb, var(--tk-accent) 28%, transparent)'
          }}
        >
          <UploadCloud className="w-6 h-6" />
        </div>

        <p className="font-medium mt-3" style={{ fontSize: 'clamp(15px,1.6vw,18px)', color: 'var(--tk-text)' }}>
          {t('dragDropCVs')}
        </p>
        <p className="text-[11.5px] mt-1.5" style={{ color: 'var(--tk-muted)' }}>
          {t('supportedFiles')}
        </p>
        <span className="tk-btn-primary mt-3.5" style={{ pointerEvents: 'none' }}>
          {t('browseFiles')}
        </span>
        <p className="text-[11px] mt-2.5" style={{ color: 'var(--tk-dim)' }}>
          {t('parallelProcessNotice')}
        </p>
      </div>

      {/* Processing queue */}
      {files.length > 0 && (
        <div className="tk-panel">
          <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
            <h4 className="text-[14px] font-medium" style={{ color: 'var(--tk-text)' }}>{t('processingCvs')}</h4>
            <div className="flex items-center gap-3">
              <span className="text-[11px]" style={{ color: 'var(--tk-muted)', fontVariantNumeric: 'tabular-nums' }}>
                {t('filesDoneCount', { total: String(files.length), done: String(doneCount) })}
              </span>
              <button
                type="button"
                onClick={onClear}
                className="tk-btn-neutral tk-focusable"
                style={{ height: 28, padding: '0 10px', fontSize: 11 }}
              >
                {t('clearList')}
              </button>
            </div>
          </div>

          <div className="tk-row-list" style={{ maxHeight: 300, overflowY: 'auto' }}>
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
                      minWidth: 74, justifyContent: 'center',
                      ...(file.status === 'error' ? { background: 'rgba(239,68,68,.1)', color: '#ef4444' } : {})
                    }}
                  >
                    {file.status === 'processing' && <RefreshCw className="w-3 h-3 animate-spin" />}
                    {file.status === 'success' && <CheckCircle className="w-3 h-3" />}
                    {file.status === 'skipped' && <SkipForward className="w-3 h-3" />}
                    {file.status === 'error' && <AlertCircle className="w-3 h-3" />}
                    {t(`uploadStatus_${file.status}` as any)}
                  </span>

                  {/* Retry just this file, without re-uploading the whole batch. */}
                  {file.status === 'error' && (
                    <button
                      type="button"
                      onClick={() => onRetry(file.id)}
                      className="tk-icon-btn tk-focusable shrink-0"
                      style={{ width: 24, height: 24 }}
                      title={t('retryFile')}
                      aria-label={t('retryFile')}
                    >
                      <RotateCw className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {/* Drop this one CV from the list — the rest of the batch is untouched. */}
                  <button
                    type="button"
                    onClick={() => onRemove(file.id)}
                    className="tk-icon-btn tk-focusable shrink-0"
                    style={{ width: 24, height: 24 }}
                    title={t('removeFile')}
                    aria-label={t('removeFile')}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                {file.status === 'skipped' && (
                  <p className="text-[11px] mt-1.5 leading-relaxed" style={{ color: 'var(--tk-dim)' }}>
                    {t('duplicateAlready')}
                    {file.existingCandidateName && <> {t('duplicateAs', { name: file.existingCandidateName })}</>}
                    {'. '}
                    {t('duplicateUseReanalyze')}
                  </p>
                )}

                {file.status === 'error' && (
                  <div className="mt-1.5" style={{ display: 'grid', gap: 4 }}>
                    <p className="text-[11px] leading-relaxed" style={{ color: '#ef4444' }}>
                      {file.errorCode ? t(`aiError_${file.errorCode}` as any) : (file.error || t('aiError_unknown'))}
                    </p>
                    {/* A failed call bills nothing — worth saying, since a quota
                        error is exactly when people worry about that. */}
                    <p className="text-[10px]" style={{ color: 'var(--tk-dim)' }}>{t('aiErrorNoTokensSpent')}</p>
                    {file.errorDetail && (
                      <div>
                        <button
                          type="button"
                          onClick={() => setExpandedDetail(expandedDetail === file.id ? null : file.id)}
                          className="tk-focusable text-[10px] font-semibold"
                          style={{ background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--tk-muted)' }}
                        >
                          {t('technicalDetails')}
                        </button>
                        {expandedDetail === file.id && (
                          <p
                            className="text-[10px] mt-1 leading-relaxed"
                            dir="ltr"
                            style={{
                              padding: 8, borderRadius: 8, background: 'var(--tk-inset)',
                              border: '1px solid var(--tk-border)', color: 'var(--tk-muted)',
                              fontFamily: 'ui-monospace, SFMono-Regular, monospace', wordBreak: 'break-word'
                            }}
                          >
                            {file.errorDetail}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
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
