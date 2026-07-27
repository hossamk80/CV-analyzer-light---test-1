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
}

export const LaserUploadZone: React.FC<LaserUploadZoneProps> = ({
  files,
  onFilesSelected,
  onClear
}) => {
  const { t } = useI18n();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragActive, setIsDragActive] = useState(false);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragActive(true);
    } else if (e.type === "dragleave") {
      setIsDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const selected = Array.from(e.dataTransfer.files);
      onFilesSelected(selected);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      const selected = Array.from(e.target.files);
      onFilesSelected(selected);
    }
  };

  const onButtonClick = () => {
    fileInputRef.current?.click();
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="w-full">
      {/* Upload Target Area */}
      <div
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        onClick={onButtonClick}
        className={`relative overflow-hidden w-full p-8 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all duration-300 min-h-[220px] bg-bg-card/50 ${
          isDragActive 
            ? 'border-brand bg-brand-light/10 shadow-2xl scale-[1.01]' 
            : 'border-border-main hover:border-brand hover:bg-bg-card'
        }`}
      >
        {/* Animated Laser Border Line */}
        {isDragActive && (
          <div className="absolute inset-0 pointer-events-none rounded-2xl">
            <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-transparent via-brand to-transparent animate-[pan_1.5s_infinite_linear]"></div>
            <div className="absolute bottom-0 left-0 w-full h-[3px] bg-gradient-to-r from-transparent via-brand to-transparent animate-[pan_1.5s_infinite_linear]"></div>
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.docx,.png,.jpg,.jpeg"
          onChange={handleChange}
          className="hidden"
        />

        <UploadCloud className={`w-14 h-14 mb-4 transition-transform duration-300 ${isDragActive ? 'scale-110 text-brand' : 'text-text-muted/70'}`} />
        
        <p className="text-base font-semibold text-text-main mb-1 text-center">
          {t('dragDropCVs')}
        </p>
        <p className="text-xs text-text-muted text-center mb-2">
          {t('supportedFiles')}
        </p>
        <span className="text-xs text-brand bg-brand-light px-3 py-1 rounded-full font-medium">
          {t('parallelProcessNotice')}
        </span>
      </div>

      {/* File Processing List */}
      {files.length > 0 && (
        <div className="mt-6 space-y-3 bg-bg-card p-4 rounded-2xl border border-border-main glass-panel max-h-[300px] overflow-y-auto">
          <div className="flex justify-between items-center mb-2 px-1">
            <h4 className="text-xs font-bold text-text-muted uppercase tracking-wider">{t('processingCvs')}</h4>
            <button
              onClick={onClear}
              className="text-xs text-brand hover:underline font-medium"
            >
              Clear List
            </button>
          </div>

          {files.map(file => (
            <div key={file.id} className="p-3 bg-bg-main/60 rounded-xl border border-border-main/50 flex flex-col gap-2">
              <div className="flex justify-between items-center gap-4">
                <div className="flex items-center gap-2.5 overflow-hidden">
                  <FileText className="w-5 h-5 text-brand shrink-0" />
                  <div className="overflow-hidden">
                    <p className="text-sm font-semibold text-text-main truncate" title={file.name}>{file.name}</p>
                    <p className="text-xs text-text-muted">{formatBytes(file.size)}</p>
                  </div>
                </div>

                <div className="flex items-center shrink-0">
                  {file.status === 'queued' && (
                    <span className="text-xs font-medium text-text-muted">Queued</span>
                  )}
                  {file.status === 'processing' && (
                    <RefreshCw className="w-4 h-4 text-brand animate-spin" />
                  )}
                  {file.status === 'success' && (
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  )}
                  {file.status === 'skipped' && (
                    <span className="flex items-center gap-1 text-[10px] font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20 rounded-full px-2 py-0.5">
                      <SkipForward className="w-3 h-3" />
                      Already Exists
                    </span>
                  )}
                  {file.status === 'error' && (
                    <span title={file.error}>
                      <AlertCircle className="w-5 h-5 text-red-500" />
                    </span>
                  )}
                </div>
              </div>

              {/* Progress Bar */}
              {(file.status === 'processing' || file.status === 'queued') && (
                <div className="w-full bg-bg-hover h-1.5 rounded-full overflow-hidden">
                  <div 
                    className="bg-brand h-full transition-all duration-300 rounded-full" 
                    style={{ width: `${file.progress}%` }}
                  ></div>
                </div>
              )}

              {/* Duplicate warning */}
              {file.status === 'skipped' && (
                <div className="flex items-start gap-2 bg-amber-500/8 border border-amber-500/20 rounded-lg px-3 py-2">
                  <SkipForward className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                  <p className="text-[11px] text-amber-500 font-medium leading-relaxed">
                    This CV was already analyzed for this job position
                    {file.existingCandidateName && (
                      <> as <span className="font-bold">{file.existingCandidateName}</span>.</>
                    )} To re-analyze, open the candidate profile and use the <span className="font-bold">Re-analyze</span> button.
                  </p>
                </div>
              )}

              {file.status === 'error' && file.error && (
                <p className="text-[11px] text-red-500 font-medium leading-relaxed px-1">
                  {file.error.includes('AI Provider not configured') ? t('noProviderConfigured') : file.error}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
export default LaserUploadZone;
