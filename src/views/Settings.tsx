import React, { useState, useEffect } from 'react';
import { useI18n } from '../i18n/I18nContext.js';
import { apiRequest } from '../utils/api.js';
import ProviderModelFields from '../components/ProviderModelFields.js';
import { 
  Settings as SettingsIcon, 
  Database, 
  TrendingUp, 
  Mail, 
  Palette, 
  Plus, 
  Trash2, 
  Play, 
  Check, 
  AlertTriangle,
  RotateCcw,
  Pencil,
  X,
  ShieldCheck,
  Shield
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext.js';
import AppearancePanel from '../components/AppearancePanel.js';
import AccessDenied from '../components/AccessDenied.js';
import AuditLogsView from './Settings/AuditLogsView.js';
import RbacSettingsView from './Settings/RbacSettingsView.js';
import ConfirmationModal from '../components/ConfirmationModal.js';

interface Provider {
  id: number;
  providerName: string;
  modelName: string;
  apiKey: string;
  baseUrl: string | null;
  isActive: number;
}

export const Settings: React.FC = () => {
  const { t } = useI18n();
  const { themeMode, accent, setThemeMode, setAccent } = useTheme();

  // General Settings
  const [quota, setQuota] = useState(1000000);
  const [tokensUsed, setTokensUsed] = useState(0);
  
  // Message Templates & GDPR Retention
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [whatsappMessage, setWhatsappMessage] = useState('');
  const [gdprRetentionDays, setGdprRetentionDays] = useState(90);
  const [purgeRunning, setPurgeRunning] = useState(false);

  // Audit Log Retention States (Requirements 1 & 2)
  const [auditLogRetentionDays, setAuditLogRetentionDays] = useState(90);
  const [auditPurgeRunning, setAuditPurgeRunning] = useState(false);
  const [auditPurgeResult, setAuditPurgeResult] = useState<string | null>(null);

  const [pendingConfirm, setPendingConfirm] = useState<{
    title: string;
    description: string;
    warningText?: string;
    confirmWord?: string;
    danger?: boolean;
    onConfirm: () => void;
  } | null>(null);

  // Providers List
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // New Provider Fields
  const [newProvName, setNewProvName] = useState('Google Gemini');
  const [newModelName, setNewModelName] = useState('gemini-2.0-flash');
  const [newApiKey, setNewApiKey] = useState('');
  const [newBaseUrl, setNewBaseUrl] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);

  // Test status
  const [testResult, setTestResult] = useState<Record<number, { success: boolean; message: string }>>({});
  const [testingId, setTestingId] = useState<number | null>(null);

  // Edit provider state
  const [editingProvider, setEditingProvider] = useState<Provider | null>(null);
  const [editProvName, setEditProvName] = useState('');
  const [editModelName, setEditModelName] = useState('');
  const [editApiKey, setEditApiKey] = useState('');
  const [editBaseUrl, setEditBaseUrl] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  const [healthWarning, setHealthWarning] = useState<string | null>(null);

  useEffect(() => {
    fetchSettingsData();
  }, []);

  const fetchSettingsData = async () => {
    setLoading(true);
    setError(null);
    try {
      const s = await apiRequest('GET', '/api/settings');
      const provs = await apiRequest('GET', '/api/ai-providers');
      
      setQuota(s.tokenQuota);
      setTokensUsed(s.tokensUsed);
      setEmailSubject(s.emailSubject);
      setEmailBody(s.emailBody);
      setWhatsappMessage(s.whatsappMessage);
      setGdprRetentionDays(s.gdprRetentionDays || 90);
      setAuditLogRetentionDays(s.auditLogRetentionDays || 90);
      setProviders(provs);

      // Requirement 6: Active AI Model Periodic Health Check
      try {
        const hc = await apiRequest('GET', '/api/ai-providers/health-check');
        if (hc && hc.warning) {
          setHealthWarning(hc.warning);
        } else {
          setHealthWarning(null);
        }
      } catch (hcErr) {
        console.warn('Health check query failed:', hcErr);
      }
    } catch (e: any) {
      console.error('Error fetching settings:', e);
      setError(e.message || 'Failed to fetch settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveGeneralSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (auditLogRetentionDays < 90) {
      alert('Audit log retention period cannot be set below the 90-day minimum floor.');
      return;
    }
    try {
      await apiRequest('PUT', '/api/settings', {
        tokenQuota: quota,
        emailSubject,
        emailBody,
        whatsappMessage,
        gdprRetentionDays,
        auditLogRetentionDays
      });
      alert('General settings & Retention policies saved successfully');
    } catch (e: any) {
      alert('Failed to save settings: ' + e.message);
    }
  };

  const handleRunGdprPurge = () => {
    setPendingConfirm({
      title: 'Run GDPR Retention Purge',
      description: `Are you sure you want to run the GDPR retention purge now? All candidate PII & files older than ${gdprRetentionDays} days will be anonymized.`,
      warningText: 'This action is irreversible.',
      confirmWord: 'PURGE',
      danger: true,
      onConfirm: async () => {
        setPendingConfirm(null);
        setPurgeRunning(true);
        try {
          const res = await apiRequest('POST', '/api/gdpr/purge');
          alert(res.message);
        } catch (e: any) {
          alert('GDPR purge failed: ' + e.message);
        } finally {
          setPurgeRunning(false);
        }
      },
    });
  };

  const handleRunAuditPurge = () => {
    if (auditLogRetentionDays < 90) {
      alert('Audit log retention period cannot be set below the 90-day minimum floor.');
      return;
    }
    setPendingConfirm({
      title: 'Run Audit Log Retention Purge',
      description: `Are you sure you want to run the audit log retention purge now? All audit entries older than ${auditLogRetentionDays} days will be permanently removed.`,
      warningText: 'This action is irreversible.',
      confirmWord: 'PURGE',
      danger: true,
      onConfirm: async () => {
        setPendingConfirm(null);
        setAuditPurgeRunning(true);
        setAuditPurgeResult(null);
        try {
          const res = await apiRequest('POST', '/api/audit-logs/purge', { retentionDays: auditLogRetentionDays });
          setAuditPurgeResult(res.message || `Audit purge completed: deleted ${res.purgedCount} record(s).`);
          alert(res.message);
        } catch (e: any) {
          alert('Audit log purge failed: ' + e.message);
        } finally {
          setAuditPurgeRunning(false);
        }
      },
    });
  };

  const handleResetTokenUsage = () => {
    setPendingConfirm({
      title: 'Reset Token Counter',
      description: 'Are you sure you want to reset the cumulative token counter to zero?',
      danger: false,
      onConfirm: async () => {
        setPendingConfirm(null);
        try {
          await apiRequest('POST', '/api/token-usage/reset');
          setTokensUsed(0);
        } catch (e) {
          console.error('Failed resetting token counter:', e);
        }
      },
    });
  };

  const handleAddProvider = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const result = await apiRequest('POST', '/api/ai-providers', {
        providerName: newProvName,
        modelName: newModelName,
        apiKey: newApiKey,
        baseUrl: newBaseUrl || null
      });
      
      setShowAddForm(false);
      setNewApiKey('');
      setNewBaseUrl('');
      fetchSettingsData();
    } catch (e: any) {
      alert('Failed adding provider: ' + e.message);
    }
  };

  const handleActivateProvider = async (id: number) => {
    try {
      await apiRequest('POST', `/api/ai-providers/${id}/activate`);
      fetchSettingsData();
    } catch (e: any) {
      alert('Failed activating provider: ' + e.message);
    }
  };

  const handleStartEdit = (p: Provider) => {
    setEditingProvider(p);
    setEditProvName(p.providerName);
    setEditModelName(p.modelName);
    setEditApiKey(''); // never pre-fill real key — user must re-enter to change
    setEditBaseUrl(p.baseUrl || '');
  };

  const handleCancelEdit = () => {
    setEditingProvider(null);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProvider) return;
    setEditSaving(true);
    try {
      await apiRequest('PUT', `/api/ai-providers/${editingProvider.id}`, {
        providerName: editProvName,
        modelName: editModelName,
        // Only send apiKey if user actually typed something new
        ...(editApiKey ? { apiKey: editApiKey } : {}),
        baseUrl: editBaseUrl || null
      });
      setEditingProvider(null);
      fetchSettingsData();
    } catch (e: any) {
      alert('Failed to save changes: ' + e.message);
    } finally {
      setEditSaving(false);
    }
  };

  const handleDeleteProvider = (id: number) => {
    setPendingConfirm({
      title: 'Delete AI Provider',
      description: 'Delete this AI provider configuration?',
      danger: true,
      onConfirm: async () => {
        setPendingConfirm(null);
        try {
          await apiRequest('DELETE', `/api/ai-providers/${id}`);
          fetchSettingsData();
        } catch (e: any) {
          alert('Failed to delete: ' + e.message);
        }
      },
    });
  };

  const handleTestConnection = async (p: Provider) => {
    setTestingId(p.id);
    setTestResult(prev => ({ ...prev, [p.id]: { success: false, message: 'Testing connection...' } }));
    
    try {
      const data = await apiRequest('POST', '/api/test-connection', {
        providerName: p.providerName,
        modelName: p.modelName,
        apiKey: p.apiKey, // Sends redacted key which resolves server-side
        baseUrl: p.baseUrl
      });
      
      setTestResult(prev => ({
        ...prev,
        [p.id]: { success: data.success, message: data.message || 'Connection test successful' }
      }));
    } catch (err: any) {
      setTestResult(prev => ({
        ...prev,
        [p.id]: { success: false, message: err.message || 'Connection test failed' }
      }));
    } finally {
      setTestingId(null);
    }
  };

  const [activeTab, setActiveTab] = useState<'general' | 'audit' | 'rbac'>('general');

  const tokenPercentage = Math.min(Math.round((tokensUsed / quota) * 100), 100);

  if (error) {
    return <AccessDenied message={error} onRetry={fetchSettingsData} />;
  }

  return (
    <div className="space-y-6">
      {/* Settings Sub-Navigation Tabs */}
      <div className="flex border-b border-border-main/50 gap-2">
        <button
          onClick={() => setActiveTab('general')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer ${
            activeTab === 'general'
              ? 'border-brand text-brand bg-brand/5 rounded-t-xl'
              : 'border-transparent text-text-muted hover:text-text-main'
          }`}
        >
          <SettingsIcon className="w-4 h-4" />
          <span>General & AI Providers</span>
        </button>

        <button
          onClick={() => setActiveTab('rbac')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer ${
            activeTab === 'rbac'
              ? 'border-brand text-brand bg-brand/5 rounded-t-xl'
              : 'border-transparent text-text-muted hover:text-text-main'
          }`}
        >
          <Shield className="w-4 h-4" />
          <span>Role Capabilities (RBAC)</span>
        </button>

        <button
          onClick={() => setActiveTab('audit')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer ${
            activeTab === 'audit'
              ? 'border-brand text-brand bg-brand/5 rounded-t-xl'
              : 'border-transparent text-text-muted hover:text-text-main'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>Audit Trail Logs</span>
        </button>
      </div>

      {activeTab === 'audit' ? (
        <AuditLogsView />
      ) : activeTab === 'rbac' ? (
        <RbacSettingsView />
      ) : (
        <div className="space-y-8">
      {/* 1. Visual appearance (des-2.txt §4.1 / §10.1.1) */}
      <div className="tk-panel space-y-6">
        <h3 className="text-[11px] font-bold uppercase tracking-[.14em] flex items-center gap-1.5 border-b pb-3" style={{ color: 'var(--tk-accent-text)', borderColor: 'var(--tk-border)' }}>
          <Palette className="w-4 h-4" />
          Visual appearance
        </h3>
        <AppearancePanel themeMode={themeMode} accent={accent} onThemeChange={setThemeMode} onAccentChange={setAccent} />
      </div>

      {/* 2. Token Consumption Meter */}
      <div className="tk-panel space-y-4">
        <h3 className="text-sm font-bold text-text-muted uppercase tracking-wider flex items-center gap-1.5 border-b border-border-main/50 pb-3">
          <TrendingUp className="w-4 h-4 text-brand" />
          {t('tokenUsageTitle')}
        </h3>

        <div className="space-y-3">
          <div className="flex justify-between items-center text-xs font-bold">
            <span className="text-text-muted">Monthly Token Consumption</span>
            <span className="text-text-main">{tokensUsed.toLocaleString()} / {quota.toLocaleString()} Tokens ({tokenPercentage}%)</span>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-bg-hover h-3 rounded-full overflow-hidden">
            <div 
              className={`h-full rounded-full transition-all duration-500 ${
                tokenPercentage > 85 ? 'bg-red-500' : tokenPercentage > 60 ? 'bg-amber-500' : 'bg-brand'
              }`}
              style={{ width: `${tokenPercentage}%` }}
            ></div>
          </div>

          <div className="flex justify-between items-center pt-2">
            <p className="text-[10px] text-text-muted font-medium">Reset this counter at the start of each billing month cycle.</p>
            <button
              onClick={handleResetTokenUsage}
              className="flex items-center gap-1 text-xs text-brand hover:underline font-bold"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{t('resetUsage')}</span>
            </button>
          </div>
        </div>
      </div>

      {/* 3. AI Providers List */}
      <div className="tk-panel space-y-6">
        <div className="flex justify-between items-center border-b border-border-main/50 pb-3">
          <h3 className="text-sm font-bold text-text-muted uppercase tracking-wider flex items-center gap-1.5">
            <Database className="w-4 h-4 text-brand" />
            {t('aiProvidersList')}
          </h3>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="tk-btn-primary tk-focusable flex items-center gap-1.5 text-xs transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Provider</span>
          </button>
        </div>

        {/* Active Model Health Warning Banner (Requirement 6) */}
        {healthWarning && (
          <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-center gap-2.5 text-xs text-amber-500 font-bold">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{healthWarning}</span>
          </div>
        )}

        {/* Add Provider Form */}
        {showAddForm && (
          <form onSubmit={handleAddProvider} className="p-4 bg-bg-main/60 border border-border-main/50 rounded-xl space-y-4">
            <h4 className="text-xs font-bold text-text-muted uppercase tracking-wider">Configure New Service Provider</h4>
            
            <ProviderModelFields
              selectedProvider={newProvName}
              selectedModel={newModelName}
              apiKey={newApiKey}
              onChangeProvider={setNewProvName}
              onChangeModel={setNewModelName}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-text-muted mb-1">{t('apiKey')}</label>
                <input
                  type="password"
                  required
                  value={newApiKey}
                  onChange={(e) => setNewApiKey(e.target.value)}
                  placeholder="Enter API Secret Key"
                  className="w-full px-3 py-2 rounded-lg border border-border-main bg-bg-card text-text-main focus:outline-none focus:border-brand text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-text-muted mb-1">{t('baseUrl')}</label>
                <input
                  type="text"
                  value={newBaseUrl}
                  onChange={(e) => setNewBaseUrl(e.target.value)}
                  placeholder="https://api.openai.com/v1"
                  className="w-full px-3 py-2 rounded-lg border border-border-main bg-bg-card text-text-main focus:outline-none focus:border-brand text-sm"
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
                Save Provider
              </button>
            </div>
          </form>
        )}

        {/* Providers Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-bg-hover/30 border-b border-border-main/50 font-bold text-text-muted uppercase">
                <th className="p-3">Provider Name</th>
                <th className="p-3">Model</th>
                <th className="p-3">API Key</th>
                <th className="p-3 text-center">Status</th>
                <th className="p-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-main/40 text-text-main font-medium">
              {providers.map(p => (
                <React.Fragment key={p.id}>
                  <tr className={`transition-colors ${
                    editingProvider?.id === p.id
                      ? 'bg-brand/5 border-l-2 border-brand'
                      : 'hover:bg-bg-hover/10'
                  }`}>
                    <td className="p-3 font-semibold">{p.providerName}</td>
                    <td className="p-3 text-text-muted">{p.modelName}</td>
                    <td className="p-3 text-text-muted font-mono">{p.apiKey || <span className="text-text-muted/40 italic text-[10px]">not set</span>}</td>
                    
                    <td className="p-3 text-center">
                      {p.isActive === 1 ? (
                        <span className="bg-green-500/10 text-green-500 px-2 py-0.5 rounded-full border border-green-500/20 font-bold">
                          {t('active')}
                        </span>
                      ) : (
                        <button
                          onClick={() => handleActivateProvider(p.id)}
                          className="text-xs text-brand hover:underline font-bold cursor-pointer"
                        >
                          Activate
                        </button>
                      )}
                    </td>

                    <td className="p-3">
                      <div className="flex items-center justify-center gap-2">
                        {/* Edit button */}
                        <button
                          onClick={() =>
                            editingProvider?.id === p.id ? handleCancelEdit() : handleStartEdit(p)
                          }
                          className={`p-1.5 border rounded-lg transition-colors cursor-pointer ${
                            editingProvider?.id === p.id
                              ? 'bg-brand/10 border-brand/30 text-brand'
                              : 'bg-bg-hover border-border-main text-text-muted hover:text-brand'
                          }`}
                          title={editingProvider?.id === p.id ? 'Cancel edit' : 'Edit provider'}
                        >
                          {editingProvider?.id === p.id
                            ? <X className="w-3.5 h-3.5" />
                            : <Pencil className="w-3.5 h-3.5" />}
                        </button>

                        <button
                          onClick={() => handleTestConnection(p)}
                          className="p-1.5 bg-bg-hover border border-border-main text-text-muted hover:text-brand rounded-lg transition-colors cursor-pointer"
                          title={t('testConnection')}
                        >
                          <Play className="w-3.5 h-3.5" />
                        </button>
                        
                        {p.isActive !== 1 && (
                          <button
                            onClick={() => handleDeleteProvider(p.id)}
                            className="p-1.5 bg-red-500/10 border border-red-500/20 text-red-500 hover:bg-red-500/20 rounded-lg transition-colors cursor-pointer"
                            title="Delete Provider"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                      
                      {testResult[p.id] && (
                        <div className={`text-[10px] mt-1 text-center font-bold ${
                          testResult[p.id].success ? 'text-green-500' : 'text-red-500'
                        }`}>
                          {testResult[p.id].message}
                        </div>
                      )}
                    </td>
                  </tr>

                  {/* Inline Edit Form Row */}
                  {editingProvider?.id === p.id && (
                    <tr className="bg-brand/5">
                      <td colSpan={5} className="px-4 pb-4 pt-2">
                        <form onSubmit={handleSaveEdit} className="space-y-3">
                          <p className="text-[10px] font-bold text-brand uppercase tracking-wider flex items-center gap-1">
                            <Pencil className="w-3 h-3" />
                            Editing: {p.providerName}
                          </p>
                          
                          <ProviderModelFields
                            selectedProvider={editProvName}
                            selectedModel={editModelName}
                            apiKey={editApiKey}
                            providerId={p.id}
                            onChangeProvider={setEditProvName}
                            onChangeModel={setEditModelName}
                          />

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                              <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">
                                New API Key <span className="text-text-muted/50 normal-case font-medium">(leave empty to keep current)</span>
                              </label>
                              <input
                                type="password"
                                placeholder="Enter new key to replace..."
                                value={editApiKey}
                                onChange={e => setEditApiKey(e.target.value)}
                                className="tk-field tk-focusable"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">Server URL (Optional)</label>
                              <input
                                type="url"
                                placeholder="https://..."
                                value={editBaseUrl}
                                onChange={e => setEditBaseUrl(e.target.value)}
                                className="tk-field tk-focusable"
                              />
                            </div>
                          </div>
                          <div className="flex justify-end gap-2 mt-3">
                            <button
                              type="button"
                              onClick={handleCancelEdit}
                              className="px-3 py-1.5 border border-border-main rounded-lg text-xs font-bold text-text-muted hover:text-text-main cursor-pointer"
                            >
                              Cancel
                            </button>
                            <button
                              type="submit"
                              disabled={editSaving}
                              className="tk-btn-primary tk-focusable flex items-center gap-1.5 text-xs transition-colors cursor-pointer disabled:opacity-60"
                            >
                              <Check className="w-3.5 h-3.5" />
                              {editSaving ? 'Saving...' : 'Save Changes'}
                            </button>
                          </div>
                        </form>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. Outreach Message Templates */}
      <form onSubmit={handleSaveGeneralSettings} className="tk-panel space-y-6">
        <h3 className="text-sm font-bold text-text-muted uppercase tracking-wider flex items-center gap-1.5 border-b border-border-main/50 pb-3">
          <Mail className="w-4 h-4 text-brand" />
          {t('messageTemplates')}
        </h3>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-1.5 px-1">{t('tokenQuota')}</label>
              <input
                type="number"
                required
                value={quota}
                onChange={(e) => setQuota(parseInt(e.target.value) || 0)}
                className="tk-field tk-focusable"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-1.5 px-1">{t('emailSubject')}</label>
              <input
                type="text"
                required
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
                className="tk-field tk-focusable"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-1.5 px-1">{t('emailBody')}</label>
            <textarea
              required
              rows={4}
              value={emailBody}
              onChange={(e) => setEmailBody(e.target.value)}
              className="tk-field tk-focusable"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-1.5 px-1">{t('whatsappText')}</label>
            <textarea
              required
              rows={2}
              value={whatsappMessage}
              onChange={(e) => setWhatsappMessage(e.target.value)}
              className="tk-field tk-focusable"
            />
          </div>

          {/* Placeholders Help Notice */}
          <div className="bg-bg-hover border border-border-main/50 p-4 rounded-xl space-y-1">
            <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-brand" />
              Supported Placeholder Tags
            </span>
            <p className="text-[11px] text-text-muted leading-relaxed">
              Use these placeholdertags to substitute per-candidate data: 
              <span className="font-mono text-brand font-bold mx-1">{"{name}"}</span>, 
              <span className="font-mono text-brand font-bold mx-1">{"{job}"}</span>, 
              <span className="font-mono text-brand font-bold mx-1">{"{score}"}</span>, 
              <span className="font-mono text-brand font-bold mx-1">{"{status}"}</span>, 
              <span className="font-mono text-brand font-bold mx-1">{"{degree}"}</span>, 
              <span className="font-mono text-brand font-bold mx-1">{"{experience}"}</span>.
            </p>
          </div>
          {/* GDPR Data Retention Policy Card (Phase 4.5) */}
          <div className="p-4 bg-bg-main/50 border border-border-main/60 rounded-xl space-y-3">
            <div className="flex justify-between items-center">
              <div>
                <span className="text-xs font-bold text-text-main uppercase tracking-wider block">
                  GDPR Candidate Data Retention Period (Days)
                </span>
                <span className="text-[11px] text-text-muted">
                  Candidates older than this threshold will have their raw CV files and PII contact data automatically purged.
                </span>
              </div>

              <button
                type="button"
                onClick={handleRunGdprPurge}
                disabled={purgeRunning}
                className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 rounded-xl text-xs font-bold transition-all cursor-pointer disabled:opacity-50 shrink-0"
              >
                {purgeRunning ? 'Purging...' : 'Run Purge Now'}
              </button>
            </div>

            <div className="max-w-xs">
              <input
                type="number"
                min={1}
                max={3650}
                required
                value={gdprRetentionDays}
                onChange={(e) => setGdprRetentionDays(parseInt(e.target.value) || 90)}
                className="w-full px-3 py-2 rounded-lg border border-border-main bg-bg-card text-text-main font-bold focus:outline-none focus:border-brand text-xs"
              />
            </div>
          </div>

          {/* Security Audit Log Retention Policy Card (Requirements 1 & 2) */}
          <div className="p-4 bg-bg-main/50 border border-border-main/60 rounded-xl space-y-3">
            <div className="flex justify-between items-center">
              <div>
                <span className="text-xs font-bold text-text-main uppercase tracking-wider block">
                  Audit Log Retention Period (Days)
                </span>
                <span className="text-[11px] text-text-muted">
                  Security audit trail records older than this threshold will be automatically purged. (Minimum floor: 90 days).
                </span>
              </div>

              <button
                type="button"
                onClick={handleRunAuditPurge}
                disabled={auditPurgeRunning}
                className="px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 border border-amber-500/20 rounded-xl text-xs font-bold transition-all cursor-pointer disabled:opacity-50 shrink-0"
              >
                {auditPurgeRunning ? 'Purging...' : 'Run Audit Purge Now'}
              </button>
            </div>

            <div className="max-w-xs space-y-1">
              <input
                type="number"
                min={90}
                max={3650}
                required
                value={auditLogRetentionDays}
                onChange={(e) => setAuditLogRetentionDays(parseInt(e.target.value) || 90)}
                className="w-full px-3 py-2 rounded-lg border border-border-main bg-bg-card text-text-main font-bold focus:outline-none focus:border-brand text-xs"
              />
            </div>
            {auditPurgeResult && (
              <p className="text-xs font-bold text-emerald-500">{auditPurgeResult}</p>
            )}
          </div>
        </div>

        <div className="flex justify-end pt-4 border-t border-border-main/50">
          <button
            type="submit"
            className="tk-btn-primary tk-focusable text-xs transition-all cursor-pointer"
          >
            {t('saveSettings')}
          </button>
        </div>
      </form>
    </div>
  )}

  <ConfirmationModal
    isOpen={!!pendingConfirm}
    onClose={() => setPendingConfirm(null)}
    onConfirm={() => pendingConfirm?.onConfirm()}
    title={pendingConfirm?.title || ''}
    description={pendingConfirm?.description || ''}
    warningText={pendingConfirm?.warningText}
    confirmWord={pendingConfirm?.confirmWord}
    danger={pendingConfirm?.danger}
  />
</div>
  );
};

export default Settings;
