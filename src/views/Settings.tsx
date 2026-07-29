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

  // The server returns a stable `warningCode` (plus an English `warning` fallback) so the
  // banner can be rendered in the active interface language.
  const [health, setHealth] = useState<{ code?: string; text?: string; model?: string; provider?: string } | null>(null);

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
        if (hc && (hc.warningCode || hc.warning)) {
          setHealth({ code: hc.warningCode, text: hc.warning, model: hc.modelName, provider: hc.providerName });
        } else {
          setHealth(null);
        }
      } catch (hcErr) {
        console.warn('Health check query failed:', hcErr);
      }
    } catch (e: any) {
      console.error('Error fetching settings:', e);
      setError(e.message || t('accessDeniedBody'));
    } finally {
      setLoading(false);
    }
  };

  const handleSaveGeneralSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (auditLogRetentionDays < 90) {
      alert(t('auditMinimumError'));
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
      alert(t('settingsSaved'));
    } catch (e: any) {
      alert(t('settingsSaveFailed', { reason: e.message }));
    }
  };

  // The token budget lives in the same settings row as the templates, but it belongs
  // next to the meter it governs — so it gets its own save path.
  const [quotaSaving, setQuotaSaving] = useState(false);
  const handleSaveQuota = async () => {
    setQuotaSaving(true);
    try {
      await apiRequest('PUT', '/api/settings', { tokenQuota: quota });
      alert(t('tokenQuotaSaved'));
    } catch (e: any) {
      alert(t('settingsSaveFailed', { reason: e.message }));
    } finally {
      setQuotaSaving(false);
    }
  };

  const handleRunGdprPurge = () => {
    setPendingConfirm({
      title: t('gdprPurgeTitle'),
      description: t('gdprPurgeDesc', { days: String(gdprRetentionDays) }),
      warningText: t('irreversibleAction'),
      confirmWord: 'PURGE',
      danger: true,
      onConfirm: async () => {
        setPendingConfirm(null);
        setPurgeRunning(true);
        try {
          const res = await apiRequest('POST', '/api/gdpr/purge');
          alert(res.message);
        } catch (e: any) {
          alert(t('purgeFailed', { reason: e.message }));
        } finally {
          setPurgeRunning(false);
        }
      },
    });
  };

  const handleRunAuditPurge = () => {
    if (auditLogRetentionDays < 90) {
      alert(t('auditMinimumError'));
      return;
    }
    setPendingConfirm({
      title: t('auditPurgeTitle'),
      description: t('auditPurgeDesc', { days: String(auditLogRetentionDays) }),
      warningText: t('irreversibleAction'),
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
          alert(t('purgeFailed', { reason: e.message }));
        } finally {
          setAuditPurgeRunning(false);
        }
      },
    });
  };

  const handleResetTokenUsage = () => {
    setPendingConfirm({
      title: t('resetTokenTitle'),
      description: t('resetTokenDesc'),
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
      alert(t('addProviderFailed', { reason: e.message }));
    }
  };

  const handleActivateProvider = async (id: number) => {
    try {
      await apiRequest('POST', `/api/ai-providers/${id}/activate`);
      fetchSettingsData();
    } catch (e: any) {
      alert(t('activateProviderFailed', { reason: e.message }));
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
      alert(t('saveProviderFailed', { reason: e.message }));
    } finally {
      setEditSaving(false);
    }
  };

  const handleDeleteProvider = (id: number) => {
    setPendingConfirm({
      title: t('deleteProviderTitle'),
      description: t('deleteProviderDesc'),
      danger: true,
      onConfirm: async () => {
        setPendingConfirm(null);
        try {
          await apiRequest('DELETE', `/api/ai-providers/${id}`);
          fetchSettingsData();
        } catch (e: any) {
          alert(t('deleteProviderFailed', { reason: e.message }));
        }
      },
    });
  };

  const handleTestConnection = async (p: Provider) => {
    setTestingId(p.id);
    setTestResult(prev => ({ ...prev, [p.id]: { success: false, message: t('testingConnection') } }));
    
    try {
      const data = await apiRequest('POST', '/api/test-connection', {
        providerName: p.providerName,
        modelName: p.modelName,
        apiKey: p.apiKey, // Sends redacted key which resolves server-side
        baseUrl: p.baseUrl
      });
      
      setTestResult(prev => ({
        ...prev,
        [p.id]: { success: data.success, message: data.message || t('connectionSuccess') }
      }));
    } catch (err: any) {
      setTestResult(prev => ({
        ...prev,
        [p.id]: { success: false, message: err.message || t('connectionFailed') }
      }));
    } finally {
      setTestingId(null);
    }
  };

  const [activeTab, setActiveTab] = useState<'general' | 'audit' | 'rbac'>('general');

  const sectionHeading =
    'text-[10.5px] font-bold uppercase tracking-[.14em] flex items-center gap-1.5 pb-2.5 text-brand border-b border-border-main/50';
  const microLabel = 'block text-[10.5px] font-bold uppercase tracking-[.1em] mb-1.5 text-text-muted';

  // Guard against a zero/unset budget producing NaN or Infinity in the meter.
  const tokenPercentage = quota > 0 ? Math.min(Math.round((tokensUsed / quota) * 100), 100) : 0;

  if (error) {
    return <AccessDenied message={error} onRetry={fetchSettingsData} />;
  }

  return (
    <div className="space-y-4">
      {/* Settings Sub-Navigation Tabs */}
      <div className="flex gap-2 flex-wrap" style={{ borderBottom: '1px solid var(--tk-border)' }}>
        {([
          { id: 'general' as const, label: t('tabGeneral'), Icon: SettingsIcon },
          { id: 'rbac' as const, label: t('tabRbac'), Icon: Shield },
          { id: 'audit' as const, label: t('tabAudit'), Icon: ShieldCheck }
        ]).map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className="tk-focusable flex items-center gap-2 px-3 py-2 text-[11.5px] font-bold cursor-pointer"
            style={{
              borderBottom: `2px solid ${activeTab === id ? 'var(--tk-accent)' : 'transparent'}`,
              color: activeTab === id ? 'var(--tk-accent-text)' : 'var(--tk-muted)',
              background: activeTab === id ? 'var(--tk-accent-soft)' : 'transparent',
              borderRadius: activeTab === id ? '9px 9px 0 0' : 0
            }}
          >
            <Icon className="w-3.5 h-3.5" />
            <span>{label}</span>
          </button>
        ))}
      </div>

      {activeTab === 'audit' ? (
        <AuditLogsView />
      ) : activeTab === 'rbac' ? (
        <RbacSettingsView />
      ) : (
        <div className="space-y-4">
      {/* 1. Visual appearance (des-2.txt §4.1 / §10.1.1) */}
      <div className="tk-panel space-y-4">
        <h3 className={sectionHeading}>
          <Palette className="w-3.5 h-3.5" />
          {t('visualAppearance')}
        </h3>
        <AppearancePanel themeMode={themeMode} accent={accent} onThemeChange={setThemeMode} onAccentChange={setAccent} />
      </div>

      {/* 2. Token Consumption Meter */}
      <div className="tk-panel space-y-3">
        <h3 className={sectionHeading}>
          <TrendingUp className="w-3.5 h-3.5" />
          {t('tokenUsageTitle')}
        </h3>

        <div className="space-y-2.5">
          <div className="flex justify-between items-center gap-3 flex-wrap text-[11.5px] font-semibold">
            <span style={{ color: 'var(--tk-muted)' }}>{t('monthlyConsumption')}</span>
            <span style={{ color: 'var(--tk-text)', fontVariantNumeric: 'tabular-nums' }}>
              {t('tokenCounterOf', {
                used: tokensUsed.toLocaleString(),
                quota: quota.toLocaleString(),
                percent: String(tokenPercentage)
              })}
            </span>
          </div>

          {/* Progress Bar */}
          <div className="tk-progress-track" style={{ height: 8 }}>
            <div
              className="tk-progress-fill"
              style={{
                width: `${tokenPercentage}%`,
                ...(tokenPercentage > 85
                  ? { background: '#ef4444' }
                  : tokenPercentage > 60
                    ? { background: '#f59e0b' }
                    : {})
              }}
            />
          </div>

          {/* Editable budget — sits next to the meter it drives. */}
          <div className="flex items-end gap-2 flex-wrap pt-1">
            <div style={{ minWidth: 180 }}>
              <label className={microLabel}>{t('tokenQuota')}</label>
              <input
                type="number"
                min={0}
                value={quota}
                onChange={(e) => setQuota(parseInt(e.target.value) || 0)}
                className="tk-field tk-focusable"
                style={{ fontVariantNumeric: 'tabular-nums' }}
              />
            </div>
            <button
              type="button"
              onClick={handleSaveQuota}
              disabled={quotaSaving}
              className="tk-btn-primary tk-focusable"
              style={{ opacity: quotaSaving ? 0.6 : 1 }}
            >
              {quotaSaving ? t('saving') : t('saveQuota')}
            </button>
            <button
              type="button"
              onClick={handleResetTokenUsage}
              className="tk-btn-neutral tk-focusable"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{t('resetUsage')}</span>
            </button>
          </div>
          <p className="text-[11px]" style={{ color: 'var(--tk-dim)' }}>{t('resetUsageHint')}</p>

          {/* What the counter actually measures, and what it does not. */}
          <div style={{ padding: 12, borderRadius: 11, background: 'var(--tk-inset)', border: '1px solid var(--tk-border)' }}>
            <p className="text-[10.5px] font-bold uppercase tracking-[.1em] flex items-center gap-1.5 mb-1" style={{ color: 'var(--tk-accent-text)' }}>
              <AlertTriangle className="w-3.5 h-3.5" />
              {t('tokenHelpTitle')}
            </p>
            <p className="text-[11px] leading-relaxed" style={{ color: 'var(--tk-muted)' }}>
              {t('tokenHelpBody')}
            </p>
          </div>
        </div>
      </div>

      {/* 3. AI Providers List */}
      <div className="tk-panel space-y-4">
        <div className="flex justify-between items-center gap-3 flex-wrap pb-2.5" style={{ borderBottom: '1px solid var(--tk-border)' }}>
          <h3 className="text-[10.5px] font-bold uppercase tracking-[.14em] flex items-center gap-1.5 text-brand">
            <Database className="w-3.5 h-3.5" />
            {t('aiProvidersList')}
          </h3>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="tk-btn-primary tk-focusable"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{t('addProvider')}</span>
          </button>
        </div>

        {/* Active Model Health Warning Banner (Requirement 6) */}
        {health && (
          <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-center gap-2.5 text-[11.5px] text-amber-500 font-bold">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>
              {health.code
                ? t(`health_${health.code}` as any, { model: health.model || '', provider: health.provider || '' })
                : health.text}
            </span>
          </div>
        )}

        {/* Add Provider Form */}
        {showAddForm && (
          <form onSubmit={handleAddProvider} className="space-y-3" style={{ padding: 13, borderRadius: 11, background: 'var(--tk-inset)', border: '1px solid var(--tk-border)' }}>
            <h4 className={microLabel}>{t('configureNewProvider')}</h4>
            
            <ProviderModelFields
              selectedProvider={newProvName}
              selectedModel={newModelName}
              apiKey={newApiKey}
              onChangeProvider={setNewProvName}
              onChangeModel={setNewModelName}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className={microLabel}>{t('apiKey')}</label>
                <input
                  type="password"
                  required
                  value={newApiKey}
                  onChange={(e) => setNewApiKey(e.target.value)}
                  placeholder={t('apiKeyPlaceholder')}
                  className="tk-field tk-focusable"
                />
              </div>

              <div>
                <label className={microLabel}>{t('baseUrl')}</label>
                <input
                  type="text"
                  value={newBaseUrl}
                  onChange={(e) => setNewBaseUrl(e.target.value)}
                  placeholder="https://…"
                  className="tk-field tk-focusable"
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
                {t('saveProvider')}
              </button>
            </div>
          </form>
        )}

        {/* Providers Table */}
        <div className="tk-table-scroll">
          <table className="tk-table">
            <thead>
              <tr>
                <th>{t('providerName')}</th>
                <th>{t('modelName')}</th>
                <th>{t('apiKey')}</th>
                <th style={{ textAlign: 'center' }}>{t('status')}</th>
                <th style={{ textAlign: 'center' }}>{t('actions')}</th>
              </tr>
            </thead>
            <tbody>
              {providers.map(p => (
                <React.Fragment key={p.id}>
                  <tr style={{ background: editingProvider?.id === p.id ? 'var(--tk-accent-soft)' : 'transparent' }}>
                    <td className="font-semibold" style={{ color: 'var(--tk-text)' }}>{p.providerName}</td>
                    <td style={{ color: 'var(--tk-muted)' }} dir="ltr">{p.modelName}</td>
                    <td className="font-mono" style={{ color: 'var(--tk-muted)' }} dir="ltr">
                      {p.apiKey || <span className="italic text-[10px]" style={{ color: 'var(--tk-dim)' }}>{t('apiKeyNotSet')}</span>}
                    </td>

                    <td style={{ textAlign: 'center' }}>
                      {p.isActive === 1 ? (
                        <span className="bg-green-500/10 text-green-500 px-2 py-0.5 rounded-full border border-green-500/20 font-bold text-[10.5px]">
                          {t('active')}
                        </span>
                      ) : (
                        <button
                          onClick={() => handleActivateProvider(p.id)}
                          className="text-[11.5px] text-brand hover:underline font-bold cursor-pointer"
                        >
                          {t('activate')}
                        </button>
                      )}
                    </td>

                    <td>
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
                          title={editingProvider?.id === p.id ? t('cancelEdit') : t('editProvider')}
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
                            title={t('deleteProvider')}
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
                    <tr style={{ background: 'var(--tk-accent-soft)' }}>
                      <td colSpan={5} style={{ padding: '4px 10px 14px' }}>
                        <form onSubmit={handleSaveEdit} className="space-y-3">
                          <p className="text-[10px] font-bold text-brand uppercase tracking-wider flex items-center gap-1">
                            <Pencil className="w-3 h-3" />
                            {t('editingProvider', { name: p.providerName })}
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
                              <label className={microLabel}>
                                {t('newApiKey')} <span className="normal-case font-medium" style={{ color: 'var(--tk-dim)' }}>{t('newApiKeyHint')}</span>
                              </label>
                              <input
                                type="password"
                                placeholder={t('newApiKeyPlaceholder')}
                                value={editApiKey}
                                onChange={e => setEditApiKey(e.target.value)}
                                className="tk-field tk-focusable"
                              />
                            </div>
                            <div>
                              <label className={microLabel}>{t('baseUrl')}</label>
                              <input
                                type="url"
                                placeholder="https://…"
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
                              className="tk-btn-neutral tk-focusable"
                            >
                              {t('cancel')}
                            </button>
                            <button
                              type="submit"
                              disabled={editSaving}
                              className="tk-btn-primary tk-focusable disabled:opacity-60"
                            >
                              <Check className="w-3.5 h-3.5" />
                              {editSaving ? t('saving') : t('saveChanges')}
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
      <form onSubmit={handleSaveGeneralSettings} className="tk-panel space-y-4">
        <h3 className={sectionHeading}>
          <Mail className="w-3.5 h-3.5" />
          {t('messageTemplates')}
        </h3>

        <div className="space-y-3">
          <div>
            <label className={microLabel}>{t('emailSubject')}</label>
            <input
              type="text"
              required
              value={emailSubject}
              onChange={(e) => setEmailSubject(e.target.value)}
              className="tk-field tk-focusable"
            />
          </div>

          <div>
            <label className={microLabel}>{t('emailBody')}</label>
            <textarea
              required
              rows={4}
              value={emailBody}
              onChange={(e) => setEmailBody(e.target.value)}
              className="tk-field tk-focusable"
              style={{ height: 'auto', paddingBlock: 9, lineHeight: 1.7, resize: 'vertical' }}
            />
          </div>

          <div>
            <label className={microLabel}>{t('whatsappText')}</label>
            <textarea
              required
              rows={2}
              value={whatsappMessage}
              onChange={(e) => setWhatsappMessage(e.target.value)}
              className="tk-field tk-focusable"
              style={{ height: 'auto', paddingBlock: 9, lineHeight: 1.7, resize: 'vertical' }}
            />
          </div>

          {/* Placeholders Help Notice */}
          <div className="space-y-1" style={{ padding: 12, borderRadius: 11, background: 'var(--tk-inset)', border: '1px solid var(--tk-border)' }}>
            <span className="text-[10px] font-bold uppercase tracking-[.1em] flex items-center gap-1.5" style={{ color: 'var(--tk-accent-text)' }}>
              <AlertTriangle className="w-3.5 h-3.5" />
              {t('placeholderTagsTitle')}
            </span>
            <p className="text-[11px] leading-relaxed" style={{ color: 'var(--tk-muted)' }}>
              {t('placeholderTagsBody')}
              <span dir="ltr" className="font-mono text-brand font-bold mx-1">
                {"{name}"} {"{job}"} {"{score}"} {"{status}"} {"{degree}"} {"{experience}"}
              </span>
            </p>
          </div>
          {/* GDPR Data Retention Policy Card (Phase 4.5) */}
          <div className="space-y-2.5" style={{ padding: 12, borderRadius: 11, background: 'var(--tk-inset)', border: '1px solid var(--tk-border)' }}>
            <div className="flex justify-between items-start gap-3 flex-wrap">
              <div style={{ minWidth: 0, flex: '1 1 240px' }}>
                <span className="text-[11.5px] font-semibold block" style={{ color: 'var(--tk-text)' }}>
                  {t('gdprRetentionTitle')}
                </span>
                <span className="text-[11px]" style={{ color: 'var(--tk-muted)' }}>
                  {t('gdprRetentionHint')}
                </span>
              </div>

              <button
                type="button"
                onClick={handleRunGdprPurge}
                disabled={purgeRunning}
                className="tk-focusable shrink-0 disabled:opacity-50"
                style={{ height: 30, borderRadius: 9, paddingInline: 11, fontSize: 11, fontWeight: 600, cursor: 'pointer', background: 'rgba(239,68,68,.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,.2)' }}
              >
                {purgeRunning ? t('purging') : t('runPurgeNow')}
              </button>
            </div>

            <div style={{ maxWidth: 200 }}>
              <input
                type="number"
                min={1}
                max={3650}
                required
                value={gdprRetentionDays}
                onChange={(e) => setGdprRetentionDays(parseInt(e.target.value) || 90)}
                className="tk-field tk-focusable"
                style={{ fontVariantNumeric: 'tabular-nums' }}
              />
            </div>
          </div>

          {/* Security Audit Log Retention Policy Card (Requirements 1 & 2) */}
          <div className="space-y-2.5" style={{ padding: 12, borderRadius: 11, background: 'var(--tk-inset)', border: '1px solid var(--tk-border)' }}>
            <div className="flex justify-between items-start gap-3 flex-wrap">
              <div style={{ minWidth: 0, flex: '1 1 240px' }}>
                <span className="text-[11.5px] font-semibold block" style={{ color: 'var(--tk-text)' }}>
                  {t('auditRetentionTitle')}
                </span>
                <span className="text-[11px]" style={{ color: 'var(--tk-muted)' }}>
                  {t('auditRetentionHint')}
                </span>
              </div>

              <button
                type="button"
                onClick={handleRunAuditPurge}
                disabled={auditPurgeRunning}
                className="tk-focusable shrink-0 disabled:opacity-50"
                style={{ height: 30, borderRadius: 9, paddingInline: 11, fontSize: 11, fontWeight: 600, cursor: 'pointer', background: 'rgba(245,158,11,.1)', color: '#f59e0b', border: '1px solid rgba(245,158,11,.2)' }}
              >
                {auditPurgeRunning ? t('purging') : t('runAuditPurgeNow')}
              </button>
            </div>

            <div style={{ maxWidth: 200 }}>
              <input
                type="number"
                min={90}
                max={3650}
                required
                value={auditLogRetentionDays}
                onChange={(e) => setAuditLogRetentionDays(parseInt(e.target.value) || 90)}
                className="tk-field tk-focusable"
                style={{ fontVariantNumeric: 'tabular-nums' }}
              />
            </div>
            {auditPurgeResult && (
              <p className="text-[11.5px] font-semibold text-emerald-500">{auditPurgeResult}</p>
            )}
          </div>
        </div>

        <div className="flex justify-end pt-3" style={{ borderTop: '1px solid var(--tk-border)' }}>
          <button type="submit" className="tk-btn-primary tk-focusable">
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
