import React, { useState, useEffect } from 'react';
import { useI18n } from '../i18n/I18nContext.js';
import { apiRequest } from '../utils/api.js';
import { 
  MessageSquareCode, 
  Plus, 
  Trash2, 
  Check, 
  RotateCcw,
  Sparkles,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import AccessDenied from '../components/AccessDenied.js';
import ConfirmationModal from '../components/ConfirmationModal.js';

interface PromptVersion {
  id: number;
  name: string;
  analysisPrompt: string;
  reanalysisPrompt: string;
  isActive: number;
}

export const PromptSettings: React.FC = () => {
  const { t } = useI18n();

  const [promptsList, setPromptsList] = useState<PromptVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  // New Prompt fields
  const [newName, setNewName] = useState('');
  const [newAnalysis, setNewAnalysis] = useState('');
  const [newReanalysis, setNewReanalysis] = useState('');

  // Expand states for previewing details in table
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const [pendingConfirm, setPendingConfirm] = useState<{
    title: string;
    description: string;
    danger?: boolean;
    onConfirm: () => void;
  } | null>(null);

  useEffect(() => {
    fetchPrompts();
  }, []);

  const fetchPrompts = async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await apiRequest('GET', '/api/prompts');
      setPromptsList(list);
    } catch (e: any) {
      console.error('Failed loading prompts:', e);
      setError(e.message || t('accessDeniedBody'));
    } finally {
      setLoading(false);
    }
  };

  const handleActivatePrompt = async (id: number) => {
    try {
      await apiRequest('POST', `/api/prompts/${id}/activate`);
      fetchPrompts();
    } catch (e: any) {
      alert(t('promptActionFailed', { reason: e.message }));
    }
  };

  const handleDeletePrompt = (id: number) => {
    setPendingConfirm({
      title: t('deletePromptTitle'),
      description: t('deletePromptDesc'),
      danger: true,
      onConfirm: async () => {
        setPendingConfirm(null);
        try {
          await apiRequest('DELETE', `/api/prompts/${id}`);
          fetchPrompts();
        } catch (e: any) {
          alert(t('promptActionFailed', { reason: e.message }));
        }
      },
    });
  };

  const handleRestoreDefaults = () => {
    setPendingConfirm({
      title: t('restoreDefaultsTitle'),
      description: t('restoreDefaultsDesc'),
      danger: false,
      onConfirm: async () => {
        setPendingConfirm(null);
        try {
          await apiRequest('POST', '/api/prompts/restore-defaults');
          fetchPrompts();
        } catch (e: any) {
          alert(t('promptActionFailed', { reason: e.message }));
        }
      },
    });
  };

  const handleCreatePrompt = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('POST', '/api/prompts', {
        name: newName,
        analysisPrompt: newAnalysis,
        reanalysisPrompt: newReanalysis
      });

      setShowAddForm(false);
      setNewName('');
      setNewAnalysis('');
      setNewReanalysis('');
      fetchPrompts();
    } catch (e: any) {
      alert(t('promptActionFailed', { reason: e.message }));
    }
  };

  const loadDefaultTemplate = async () => {
    try {
      const defaults = await apiRequest('GET', '/api/prompts/defaults');
      setNewAnalysis(defaults.analysisPrompt);
      setNewReanalysis(defaults.reanalysisPrompt);
    } catch (e) {
      console.error('Error loading default template:', e);
    }
  };

  const toggleExpand = (id: number) => {
    setExpandedId(expandedId === id ? null : id);
  };

  if (error) {
    return <AccessDenied message={error} onRetry={fetchPrompts} />;
  }

  const microLabel = 'block text-[10.5px] font-bold uppercase tracking-[.1em] mb-1.5 text-text-muted';

  return (
    <div className="space-y-4">
      <div className="tk-panel flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center shrink-0" style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--tk-accent-soft)', color: 'var(--tk-accent-text)' }}>
            <MessageSquareCode className="w-4 h-4" />
          </div>
          <div className="space-y-0.5">
            <h2 className="text-[15px] font-medium" style={{ color: 'var(--tk-text)' }}>{t('promptTitle')}</h2>
            <p className="text-[11px]" style={{ color: 'var(--tk-muted)' }}>{t('promptSubtitle')}</p>
          </div>
        </div>

        <div className="flex gap-2 flex-wrap">
          <button
            onClick={handleRestoreDefaults}
            className="tk-btn-neutral tk-focusable"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{t('restoreDefaults')}</span>
          </button>

          <button
            onClick={() => {
              setShowAddForm(!showAddForm);
              loadDefaultTemplate();
            }}
            className="tk-btn-primary tk-focusable"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{t('addNewPrompt')}</span>
          </button>
        </div>
      </div>

      {/* Add Prompt Version Form */}
      {showAddForm && (
        <form onSubmit={handleCreatePrompt} className="tk-panel space-y-3">
          <h3 className={microLabel}>{t('addNewPrompt')}</h3>

          <div>
            <label className={microLabel}>{t('promptName')}</label>
            <input
              type="text"
              required
              placeholder={t('promptNamePlaceholder')}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="tk-field tk-focusable"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className={microLabel}>{t('analysisPrompt')}</label>
              <textarea
                required
                rows={12}
                value={newAnalysis}
                onChange={(e) => setNewAnalysis(e.target.value)}
                className="tk-field tk-focusable"
                style={{ height: 'auto', paddingBlock: 9, lineHeight: 1.7, resize: 'vertical' }}
              />
            </div>

            <div>
              <label className={microLabel}>{t('reanalysisPrompt')}</label>
              <textarea
                required
                rows={12}
                value={newReanalysis}
                onChange={(e) => setNewReanalysis(e.target.value)}
                className="tk-field tk-focusable"
                style={{ height: 'auto', paddingBlock: 9, lineHeight: 1.7, resize: 'vertical' }}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="tk-btn-neutral tk-focusable"
            >
              {t('cancel')}
            </button>
            <button type="submit" className="tk-btn-primary tk-focusable">
              {t('saveVersion')}
            </button>
          </div>
        </form>
      )}

      {/* Prompts Versions List */}
      <div className="tk-panel overflow-hidden">
        {loading ? (
          <div className="py-12 text-center text-[12.5px]" style={{ color: 'var(--tk-muted)' }}>{t('loadingPrompts')}</div>
        ) : promptsList.length === 0 ? (
          <div className="py-12 text-center text-[12.5px]" style={{ color: 'var(--tk-muted)' }}>{t('noPromptVersions')}</div>
        ) : (
          <div className="divide-y divide-border-main/50">
            {promptsList.map(p => {
              const isExpanded = expandedId === p.id;
              return (
                <div key={p.id} className="p-4 space-y-3">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => toggleExpand(p.id)}
                        className="p-1 rounded-lg hover:bg-bg-hover text-text-muted hover:text-text-main transition-colors"
                      >
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                      <div>
                        <h4 className="text-[13px] font-semibold" style={{ color: 'var(--tk-text)' }}>{p.name}</h4>
                        <span className="text-[10px]" style={{ color: 'var(--tk-muted)' }}>{t('versionId', { id: String(p.id) })}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {p.isActive === 1 ? (
                        <span className="bg-green-500/10 text-green-500 px-2.5 py-0.5 rounded-full border border-green-500/20 text-xs font-bold flex items-center gap-1">
                          <Check className="w-3.5 h-3.5" />
                          {t('active')}
                        </span>
                      ) : (
                        <button
                          onClick={() => handleActivatePrompt(p.id)}
                          className="text-[11.5px] text-brand hover:underline font-bold cursor-pointer"
                        >
                          {t('activateVersion')}
                        </button>
                      )}

                      {p.isActive !== 1 && (
                        <button
                          onClick={() => handleDeletePrompt(p.id)}
                          className="p-1.5 bg-red-500/10 border border-red-500/20 text-red-500 hover:bg-red-500/20 rounded-lg transition-colors cursor-pointer"
                          title={t('deleteVersion')}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Expanded instructions preview */}
                  {isExpanded && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-3 bg-bg-main/50 rounded-xl border border-border-main/50 animate-in slide-in-from-top-1 duration-150">
                      <div>
                        <span className="block text-[10px] font-bold text-text-muted uppercase mb-1.5 px-0.5">{t('analysisPrompt')}</span>
                        <pre className="p-3 bg-bg-card border border-border-main rounded-lg text-[10px] text-text-muted overflow-auto max-h-72 font-mono whitespace-pre-wrap">
                          {p.analysisPrompt}
                        </pre>
                      </div>
                      <div>
                        <span className="block text-[10px] font-bold text-text-muted uppercase mb-1.5 px-0.5">{t('reanalysisPrompt')}</span>
                        <pre className="p-3 bg-bg-card border border-border-main rounded-lg text-[10px] text-text-muted overflow-auto max-h-72 font-mono whitespace-pre-wrap">
                          {p.reanalysisPrompt}
                        </pre>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <ConfirmationModal
        isOpen={!!pendingConfirm}
        onClose={() => setPendingConfirm(null)}
        onConfirm={() => pendingConfirm?.onConfirm()}
        title={pendingConfirm?.title || ''}
        description={pendingConfirm?.description || ''}
        danger={pendingConfirm?.danger}
      />
    </div>
  );
};

export default PromptSettings;
