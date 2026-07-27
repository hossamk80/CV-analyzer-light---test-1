import React, { useState, useEffect } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  warningText?: string;
  confirmWord?: string;
  confirmButtonText?: string;
  cancelButtonText?: string;
  danger?: boolean;
  loading?: boolean;
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  warningText,
  confirmWord,
  confirmButtonText = 'Confirm',
  cancelButtonText = 'Cancel',
  danger = true,
  loading = false
}) => {
  const [typedValue, setTypedValue] = useState('');

  useEffect(() => {
    if (isOpen) {
      setTypedValue('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const isConfirmed = confirmWord 
    ? typedValue.trim().toUpperCase() === confirmWord.trim().toUpperCase()
    : true;

  const handleConfirm = () => {
    if (!isConfirmed || loading) return;
    onConfirm();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div 
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirmation-modal-title"
        aria-describedby="confirmation-modal-warning"
        className="bg-bg-card border border-border-main rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl glass-panel"
      >
        <div className="flex items-center gap-3 border-b border-border-main/50 pb-3">
          <div className={`p-2.5 rounded-xl ${danger ? 'bg-red-500/10 text-red-500 border border-red-500/20' : 'bg-brand/10 text-brand border border-brand/20'}`}>
            <AlertTriangle className="w-5 h-5 shrink-0" aria-hidden="true" />
          </div>
          <h3 id="confirmation-modal-title" className="text-base font-bold text-text-main text-start">
            {title}
          </h3>
        </div>

        <div className="space-y-3 text-xs text-start">
          <p className="text-text-main font-medium leading-relaxed">
            {description}
          </p>

          {warningText && (
            <div id="confirmation-modal-warning" className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 font-semibold space-y-1">
              <p className="flex items-center gap-1.5 text-[11px]">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span>{warningText}</span>
              </p>
            </div>
          )}

          {confirmWord && (
            <div className="space-y-1.5 pt-1">
              <label className="block text-[11px] font-bold text-text-muted">
                Type <span className="font-mono text-text-main select-all uppercase">"{confirmWord}"</span> to proceed:
              </label>
              <input
                type="text"
                value={typedValue}
                onChange={(e) => setTypedValue(e.target.value)}
                placeholder={confirmWord}
                className="w-full px-3 py-2 rounded-xl border border-border-main bg-bg-main/50 text-text-main focus:outline-none focus:border-brand text-xs font-mono"
              />
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border-main/50">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 bg-bg-card border border-border-main text-text-muted hover:text-text-main rounded-xl font-bold text-xs cursor-pointer transition-colors"
          >
            {cancelButtonText}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!isConfirmed || loading}
            className={`px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
              danger
                ? 'bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500/20'
                : 'bg-brand text-white hover:bg-brand/90'
            }`}
          >
            {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            <span>{confirmButtonText}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationModal;
