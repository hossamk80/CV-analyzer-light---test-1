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
      setError(e.message || 'Failed to load prompts');
    } finally {
      setLoading(false);
    }
  };

  const handleActivatePrompt = async (id: number) => {
    try {
      await apiRequest('POST', `/api/prompts/${id}/activate`);
      fetchPrompts();
    } catch (e: any) {
      alert('Failed activating prompt version: ' + e.message);
    }
  };

  const handleDeletePrompt = (id: number) => {
    setPendingConfirm({
      title: 'Delete Prompt Version',
      description: 'Are you sure you want to delete this prompt version?',
      danger: true,
      onConfirm: async () => {
        setPendingConfirm(null);
        try {
          await apiRequest('DELETE', `/api/prompts/${id}`);
          fetchPrompts();
        } catch (e: any) {
          alert('Failed deleting prompt version: ' + e.message);
        }
      },
    });
  };

  const handleRestoreDefaults = () => {
    setPendingConfirm({
      title: 'Restore Default Prompts',
      description: 'Restore built-in default prompts as a new draft?',
      danger: false,
      onConfirm: async () => {
        setPendingConfirm(null);
        try {
          await apiRequest('POST', '/api/prompts/restore-defaults');
          fetchPrompts();
        } catch (e: any) {
          alert('Failed restoring default prompts: ' + e.message);
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
      alert('Failed creating prompt version: ' + e.message);
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-bg-card border border-border-main p-5 rounded-2xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand/10 border border-brand/20 flex items-center justify-center">
            <MessageSquareCode className="w-5 h-5 text-brand" />
          </div>
          <div className="space-y-0.5">
            <h2 className="text-xl font-black text-text-main">{t('promptTitle')}</h2>
            <p className="text-xs text-text-muted">Edit and version system instructions that direct AI CV parsing.</p>
          </div>
        </div>

        <div className="flex gap-2 flex-wrap">
          <button
            onClick={handleRestoreDefaults}
            className="flex items-center gap-1.5 px-3 py-2 bg-bg-hover border border-border-main text-text-main text-xs font-bold rounded-xl hover:bg-border-main transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{t('restoreDefaults')}</span>
          </button>
          
          <button
            onClick={() => {
              setShowAddForm(!showAddForm);
              loadDefaultTemplate();
            }}
            className="flex items-center gap-1.5 px-3 py-2 bg-brand hover:bg-brand-hover text-white text-xs font-bold rounded-xl shadow-md transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{t('addNewPrompt')}</span>
          </button>
        </div>
      </div>

      {/* Add Prompt Version Form */}
      {showAddForm && (
        <form onSubmit={handleCreatePrompt} className="bg-bg-card border border-border-main p-6 rounded-2xl space-y-4">
          <h3 className="text-sm font-bold text-text-muted uppercase tracking-wider">Create Prompt Version</h3>
          
          <div>
            <label className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-1.5 px-1">{t('promptName')}</label>
            <input
              type="text"
              required
              placeholder="e.g. Gemini 2.5 optimized prompt v2"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border-main bg-bg-main/50 text-text-main focus:outline-none focus:border-brand text-sm"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-1.5 px-1">{t('analysisPrompt')}</label>
              <textarea
                required
                rows={12}
                value={newAnalysis}
                onChange={(e) => setNewAnalysis(e.target.value)}
                className="w-full p-3 rounded-lg border border-border-main bg-bg-main/50 text-text-main focus:outline-none focus:border-brand text-xs font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-1.5 px-1">{t('reanalysisPrompt')}</label>
              <textarea
                required
                rows={12}
                value={newReanalysis}
                onChange={(e) => setNewReanalysis(e.target.value)}
                className="w-full p-3 rounded-lg border border-border-main bg-bg-main/50 text-text-main focus:outline-none focus:border-brand text-xs font-mono"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="px-4 py-2 border border-border-main rounded-lg text-xs font-bold text-text-muted hover:text-text-main"
            >
              {t('cancel')}
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-brand text-white rounded-lg font-bold text-xs shadow-md shadow-brand/10 transition-colors cursor-pointer"
            >
              Save Version
            </button>
          </div>
        </form>
      )}

      {/* Prompts Versions List */}
      <div className="bg-bg-card border border-border-main rounded-2xl overflow-hidden">
        {loading ? (
          <div className="py-12 text-center text-text-muted">Loading prompt versions...</div>
        ) : promptsList.length === 0 ? (
          <div className="py-12 text-center text-text-muted">No prompt versions. Restore defaults to seed.</div>
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
                        <h4 className="text-sm font-bold text-text-main">{p.name}</h4>
                        <span className="text-[10px] text-text-muted">Version ID: #{p.id}</span>
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
                          className="text-xs text-brand hover:underline font-bold cursor-pointer"
                        >
                          Activate
                        </button>
                      )}

                      {p.isActive !== 1 && (
                        <button
                          onClick={() => handleDeletePrompt(p.id)}
                          className="p-1.5 bg-red-500/10 border border-red-500/20 text-red-500 hover:bg-red-500/20 rounded-lg transition-colors cursor-pointer"
                          title="Delete version"
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
