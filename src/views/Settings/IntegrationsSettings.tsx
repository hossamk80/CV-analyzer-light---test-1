import React, { useState, useEffect } from 'react';
import { useI18n } from '../../i18n/I18nContext.js';
import { apiRequest } from '../../utils/api.js';
import { 
  Link2, 
  Linkedin, 
  Database, 
  Webhook, 
  Check, 
  AlertTriangle, 
  Play, 
  Save, 
  ChevronDown, 
  ChevronUp, 
  Loader2 
} from 'lucide-react';

import AccessDenied from '../../components/AccessDenied.js';

export const IntegrationsSettings: React.FC = () => {
  const { t } = useI18n();

  // Loading States
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saveStatus, setSaveStatus] = useState<Record<string, { success: boolean; message: string } | null>>({});
  const [testResult, setTestResult] = useState<Record<string, { success: boolean; message: string } | null>>({});
  const [testingPlatform, setTestingPlatform] = useState<string | null>(null);
  const [savingPlatform, setSavingPlatform] = useState<string | null>(null);

  // Accordion Expand/Collapse States
  const [expandedPlatform, setExpandedPlatform] = useState<string | null>('LinkedIn');

  // LinkedIn State
  const [liActive, setLiActive] = useState(false);
  const [liClientId, setLiClientId] = useState('');
  const [liClientSecret, setLiClientSecret] = useState('');
  const [liRedirectUri, setLiRedirectUri] = useState('');
  const [liSyncDate, setLiSyncDate] = useState('');

  // Odoo State
  const [odActive, setOdActive] = useState(false);
  const [odUrl, setOdUrl] = useState('');
  const [odDb, setOdDb] = useState('');
  const [odEmail, setOdEmail] = useState('');
  const [odPassword, setOdPassword] = useState('');
  const [odSyncDate, setOdSyncDate] = useState('');

  // Custom Webhook State
  const [custActive, setCustActive] = useState(false);
  const [custPlatformName, setCustPlatformName] = useState('');
  const [custOriginalName, setCustOriginalName] = useState('Custom');
  const [custUrl, setCustUrl] = useState('');
  const [custAuthType, setCustAuthType] = useState('Bearer');
  const [custAuthValue, setCustAuthValue] = useState('');
  const [custPayload, setCustPayload] = useState('{\n  "name": "{name}",\n  "email": "{email}",\n  "score": "{score}"\n}');
  const [custSyncDate, setCustSyncDate] = useState('');

  // Older databases seeded these as the literal English strings 'Never synced' /
  // 'Custom'; treat them as unset so the UI can render its own localized text.
  const normalize = (value: string | null | undefined, legacy: string) =>
    !value || value === legacy ? '' : value;

  useEffect(() => {
    fetchIntegrations();
  }, []);

  const fetchIntegrations = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await apiRequest('GET', '/api/integrations');
      
      const li = data.find((i: any) => i.platformName === 'LinkedIn');
      if (li) {
        setLiActive(li.isActive === 1);
        setLiClientId(li.clientId || '');
        setLiClientSecret(li.clientSecret || '');
        setLiRedirectUri(li.endpointUrl || '');
        setLiSyncDate(normalize(li.lastSyncDate, 'Never synced'));
      }

      const od = data.find((i: any) => i.platformName === 'Odoo');
      if (od) {
        setOdActive(od.isActive === 1);
        setOdUrl(od.endpointUrl || '');
        setOdDb(od.clientId || '');
        setOdEmail(od.clientSecret || '');
        setOdPassword(od.apiKey || '');
        setOdSyncDate(normalize(od.lastSyncDate, 'Never synced'));
      }

      const cust = data.find((i: any) => i.platformName !== 'LinkedIn' && i.platformName !== 'Odoo');
      if (cust) {
        setCustActive(cust.isActive === 1);
        setCustPlatformName(normalize(cust.platformName, 'Custom'));
        setCustOriginalName(cust.platformName);
        setCustUrl(cust.endpointUrl || '');
        setCustAuthType(cust.clientId || 'Bearer');
        setCustAuthValue(cust.apiKey || '');
        setCustPayload(cust.customHeaders || '{}');
        setCustSyncDate(normalize(cust.lastSyncDate, 'Never synced'));
      }
    } catch (err: any) {
      setError(err.message || t('accessDeniedBody'));
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (platform: string, currentVal: boolean) => {
    const newVal = !currentVal;
    
    // Update local state first
    if (platform === 'LinkedIn') setLiActive(newVal);
    else if (platform === 'Odoo') setOdActive(newVal);
    else setCustActive(newVal);

    try {
      const dbPlatformName = platform === 'Custom' ? custOriginalName : platform;
      await apiRequest('PUT', `/api/integrations/${dbPlatformName}`, {
        isActive: newVal
      });
    } catch (err: any) {
      // Revert if error
      if (platform === 'LinkedIn') setLiActive(currentVal);
      else if (platform === 'Odoo') setOdActive(currentVal);
      else setCustActive(currentVal);
      
      alert(t('integrationStatusFailed', { reason: err.message }));
    }
  };

  const handleTestConnection = async (platform: string) => {
    setTestingPlatform(platform);
    setTestResult(prev => ({ ...prev, [platform]: null }));

    let payload: any = { platformName: platform };
    if (platform === 'LinkedIn') {
      payload.clientId = liClientId;
      payload.clientSecret = liClientSecret;
      payload.endpointUrl = liRedirectUri;
    } else if (platform === 'Odoo') {
      payload.endpointUrl = odUrl;
      payload.clientId = odDb;
      payload.clientSecret = odEmail;
      payload.apiKey = odPassword;
    } else {
      payload.platformName = custPlatformName;
      payload.endpointUrl = custUrl;
      payload.clientId = custAuthType;
      payload.apiKey = custAuthValue;
    }

    try {
      const res = await apiRequest('POST', '/api/integrations/test-connection', payload);
      setTestResult(prev => ({
        ...prev,
        [platform]: { success: res.success, message: res.message || t('testConnectionSuccess') }
      }));
    } catch (err: any) {
      setTestResult(prev => ({
        ...prev,
        [platform]: { success: false, message: err.message || t('testConnectionFailed') }
      }));
    } finally {
      setTestingPlatform(null);
    }
  };

  const handleSaveSettings = async (platform: string) => {
    setSavingPlatform(platform);
    setSaveStatus(prev => ({ ...prev, [platform]: null }));

    let payload: any = {};
    let dbPlatformName = platform;

    if (platform === 'LinkedIn') {
      payload.clientId = liClientId;
      payload.clientSecret = liClientSecret;
      payload.endpointUrl = liRedirectUri;
      payload.isActive = liActive;
    } else if (platform === 'Odoo') {
      payload.endpointUrl = odUrl;
      payload.clientId = odDb;
      payload.clientSecret = odEmail;
      payload.apiKey = odPassword;
      payload.isActive = odActive;
    } else {
      dbPlatformName = custOriginalName;
      payload.platformName = custPlatformName;
      payload.endpointUrl = custUrl;
      payload.clientId = custAuthType;
      payload.apiKey = custAuthValue;
      payload.customHeaders = custPayload;
      payload.isActive = custActive;
    }

    try {
      const res = await apiRequest('PUT', `/api/integrations/${dbPlatformName}`, payload);
      if (platform === 'Custom') {
        // If custom platformName changed, update the original name tracker
        setCustOriginalName(res.platformName);
      }
      setSaveStatus(prev => ({
        ...prev,
        [platform]: { success: true, message: t('saveIntegrationSuccess') }
      }));
      // Clear message after 3 seconds
      setTimeout(() => {
        setSaveStatus(prev => ({ ...prev, [platform]: null }));
      }, 3000);
    } catch (err: any) {
      setSaveStatus(prev => ({
        ...prev,
        [platform]: { success: false, message: err.message || t('saveIntegrationFailed') }
      }));
    } finally {
      setSavingPlatform(null);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[300px] space-y-4">
        <Loader2 className="w-7 h-7 text-brand animate-spin" />
        <p className="text-[12.5px]" style={{ color: 'var(--tk-muted)' }}>{t('loadingIntegrations')}</p>
      </div>
    );
  }

  if (error) {
    return <AccessDenied message={error} onRetry={fetchIntegrations} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col space-y-1 pb-3" style={{ borderBottom: '1px solid var(--tk-border)' }}>
        <h2 className="text-[15px] font-medium flex items-center gap-2" style={{ color: 'var(--tk-text)' }}>
          <Link2 className="w-4 h-4 text-brand" />
          {t('integrationsTitle')}
        </h2>
        <p className="text-[11px]" style={{ color: 'var(--tk-muted)' }}>
          {t('integrationsSub')}
        </p>
      </div>

      <div className="space-y-3">
        {/* Module 1: LinkedIn AI Sourcing */}
        <div className="tk-panel overflow-hidden transition-all duration-300">
          <div 
            className="flex items-center justify-between gap-3 cursor-pointer hover:bg-bg-hover/30 transition-colors"
            style={{ padding: 13 }}
            onClick={() => setExpandedPlatform(expandedPlatform === 'LinkedIn' ? null : 'LinkedIn')}
          >
            <div className="flex items-center gap-4">
              <div className="p-2.5 bg-blue-500/10 text-blue-500 rounded-xl">
                <Linkedin className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-[13px] font-semibold" style={{ color: 'var(--tk-text)' }}>{t('linkedInSourcing')}</h3>
                <p className="text-[11px] mt-0.5" style={{ color: 'var(--tk-muted)' }}>{t('linkedInDesc')}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4" onClick={(e) => e.stopPropagation()}>
              {/* Enable toggle switch */}
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-text-muted">{liActive ? t('enabled') : t('disabled')}</span>
                <button
                  onClick={() => handleToggleActive('LinkedIn', liActive)}
                  className={`tk-switch tk-focusable ${liActive ? 'is-on' : ''}`}
                  role="switch"
                  aria-checked={!!liActive}
                >
                  <span className="tk-switch-knob" />
                </button>
              </div>
              
              <button 
                onClick={() => setExpandedPlatform(expandedPlatform === 'LinkedIn' ? null : 'LinkedIn')}
                className="p-1.5 hover:bg-bg-hover text-text-muted hover:text-text-main rounded-lg transition-colors cursor-pointer"
              >
                {expandedPlatform === 'LinkedIn' ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {expandedPlatform === 'LinkedIn' && (
            <div className="space-y-4" style={{ padding: 14, borderTop: '1px solid var(--tk-border)' }}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10.5px] font-bold text-text-muted uppercase tracking-[.1em] mb-1.5">
                    {t('linkedInClientId')}
                  </label>
                  <input
                    type="text"
                    value={liClientId}
                    onChange={(e) => setLiClientId(e.target.value)}
                    placeholder={t('phLinkedInClientId')}
                    className="tk-field tk-focusable"
                  />
                </div>
                <div>
                  <label className="block text-[10.5px] font-bold text-text-muted uppercase tracking-[.1em] mb-1.5">
                    {t('linkedInClientSecret')}
                  </label>
                  <input
                    type="password"
                    value={liClientSecret}
                    onChange={(e) => setLiClientSecret(e.target.value)}
                    placeholder="••••••••••••••••"
                    className="tk-field tk-focusable"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-[10.5px] font-bold text-text-muted uppercase tracking-[.1em] mb-1.5">
                    {t('linkedInRedirectUri')}
                  </label>
                  <input
                    type="text"
                    value={liRedirectUri}
                    onChange={(e) => setLiRedirectUri(e.target.value)}
                    placeholder="https://your-ats.com/api/integrations/linkedin/callback"
                    className="tk-field tk-focusable"
                  />
                </div>
              </div>

              {testResult['LinkedIn'] && (
                <div className={`p-3 rounded-lg border text-xs font-bold flex items-center gap-2 ${
                  testResult['LinkedIn']?.success 
                    ? 'bg-green-500/10 border-green-500/20 text-green-600 dark:text-green-400' 
                    : 'bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400'
                }`}>
                  {testResult['LinkedIn']?.success ? <Check className="w-4 h-4 flex-shrink-0" /> : <AlertTriangle className="w-4 h-4 flex-shrink-0" />}
                  <p>{testResult['LinkedIn']?.message}</p>
                </div>
              )}

              {saveStatus['LinkedIn'] && (
                <div className={`p-3 rounded-lg border text-xs font-bold flex items-center gap-2 ${
                  saveStatus['LinkedIn']?.success 
                    ? 'bg-green-500/10 border-green-500/20 text-green-600 dark:text-green-400' 
                    : 'bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400'
                }`}>
                  <Check className="w-4 h-4 flex-shrink-0" />
                  <p>{saveStatus['LinkedIn']?.message}</p>
                </div>
              )}

              <div className="flex justify-between items-center pt-2 border-t border-border-main/50">
                <span className="text-[10px]" style={{ color: 'var(--tk-muted)' }}>{t('lastSync', { date: liSyncDate || t('neverSynced') })}</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleTestConnection('LinkedIn')}
                    disabled={testingPlatform !== null || savingPlatform !== null}
                    className="tk-btn-neutral tk-focusable disabled:opacity-50"
                  >
                    {testingPlatform === 'LinkedIn' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                    <span>{t('testConnection')}</span>
                  </button>
                  <button
                    onClick={() => handleSaveSettings('LinkedIn')}
                    disabled={testingPlatform !== null || savingPlatform !== null}
                    className="tk-btn-primary tk-focusable disabled:opacity-50"
                  >
                    {savingPlatform === 'LinkedIn' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    <span>{t('saveConnection')}</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Module 2: Odoo ERP Sync */}
        <div className="tk-panel overflow-hidden transition-all duration-300">
          <div 
            className="flex items-center justify-between gap-3 cursor-pointer hover:bg-bg-hover/30 transition-colors"
            style={{ padding: 13 }}
            onClick={() => setExpandedPlatform(expandedPlatform === 'Odoo' ? null : 'Odoo')}
          >
            <div className="flex items-center gap-4">
              <div className="p-2.5 bg-purple-500/10 text-purple-500 rounded-xl">
                <Database className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-[13px] font-semibold" style={{ color: 'var(--tk-text)' }}>{t('odooErp')}</h3>
                <p className="text-[11px] mt-0.5" style={{ color: 'var(--tk-muted)' }}>{t('odooDesc')}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-text-muted">{odActive ? t('enabled') : t('disabled')}</span>
                <button
                  onClick={() => handleToggleActive('Odoo', odActive)}
                  className={`tk-switch tk-focusable ${odActive ? 'is-on' : ''}`}
                  role="switch"
                  aria-checked={!!odActive}
                >
                  <span className="tk-switch-knob" />
                </button>
              </div>
              
              <button 
                onClick={() => setExpandedPlatform(expandedPlatform === 'Odoo' ? null : 'Odoo')}
                className="p-1.5 hover:bg-bg-hover text-text-muted hover:text-text-main rounded-lg transition-colors cursor-pointer"
              >
                {expandedPlatform === 'Odoo' ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {expandedPlatform === 'Odoo' && (
            <div className="space-y-4" style={{ padding: 14, borderTop: '1px solid var(--tk-border)' }}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10.5px] font-bold text-text-muted uppercase tracking-[.1em] mb-1.5">
                    {t('odooUrl')}
                  </label>
                  <input
                    type="text"
                    value={odUrl}
                    onChange={(e) => setOdUrl(e.target.value)}
                    placeholder="https://your-company.odoo.com"
                    className="tk-field tk-focusable"
                  />
                </div>
                <div>
                  <label className="block text-[10.5px] font-bold text-text-muted uppercase tracking-[.1em] mb-1.5">
                    {t('odooDb')}
                  </label>
                  <input
                    type="text"
                    value={odDb}
                    onChange={(e) => setOdDb(e.target.value)}
                    placeholder={t('phOdooDb')}
                    className="tk-field tk-focusable"
                  />
                </div>
                <div>
                  <label className="block text-[10.5px] font-bold text-text-muted uppercase tracking-[.1em] mb-1.5">
                    {t('odooEmail')}
                  </label>
                  <input
                    type="email"
                    value={odEmail}
                    onChange={(e) => setOdEmail(e.target.value)}
                    placeholder="admin@your-company.com"
                    className="tk-field tk-focusable"
                  />
                </div>
                <div>
                  <label className="block text-[10.5px] font-bold text-text-muted uppercase tracking-[.1em] mb-1.5">
                    {t('odooPassword')}
                  </label>
                  <input
                    type="password"
                    value={odPassword}
                    onChange={(e) => setOdPassword(e.target.value)}
                    placeholder="••••••••••••••••"
                    className="tk-field tk-focusable"
                  />
                </div>
              </div>

              {testResult['Odoo'] && (
                <div className={`p-3 rounded-lg border text-xs font-bold flex items-center gap-2 ${
                  testResult['Odoo']?.success 
                    ? 'bg-green-500/10 border-green-500/20 text-green-600 dark:text-green-400' 
                    : 'bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400'
                }`}>
                  {testResult['Odoo']?.success ? <Check className="w-4 h-4 flex-shrink-0" /> : <AlertTriangle className="w-4 h-4 flex-shrink-0" />}
                  <p>{testResult['Odoo']?.message}</p>
                </div>
              )}

              {saveStatus['Odoo'] && (
                <div className={`p-3 rounded-lg border text-xs font-bold flex items-center gap-2 ${
                  saveStatus['Odoo']?.success 
                    ? 'bg-green-500/10 border-green-500/20 text-green-600 dark:text-green-400' 
                    : 'bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400'
                }`}>
                  <Check className="w-4 h-4 flex-shrink-0" />
                  <p>{saveStatus['Odoo']?.message}</p>
                </div>
              )}

              <div className="flex justify-between items-center pt-2 border-t border-border-main/50">
                <span className="text-[10px]" style={{ color: 'var(--tk-muted)' }}>{t('lastSync', { date: odSyncDate || t('neverSynced') })}</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleTestConnection('Odoo')}
                    disabled={testingPlatform !== null || savingPlatform !== null}
                    className="tk-btn-neutral tk-focusable disabled:opacity-50"
                  >
                    {testingPlatform === 'Odoo' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                    <span>{t('testConnection')}</span>
                  </button>
                  <button
                    onClick={() => handleSaveSettings('Odoo')}
                    disabled={testingPlatform !== null || savingPlatform !== null}
                    className="tk-btn-primary tk-focusable disabled:opacity-50"
                  >
                    {savingPlatform === 'Odoo' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    <span>{t('saveConnection')}</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Module 3: Custom Webhook / API */}
        <div className="tk-panel overflow-hidden transition-all duration-300">
          <div 
            className="flex items-center justify-between gap-3 cursor-pointer hover:bg-bg-hover/30 transition-colors"
            style={{ padding: 13 }}
            onClick={() => setExpandedPlatform(expandedPlatform === 'Custom' ? null : 'Custom')}
          >
            <div className="flex items-center gap-4">
              <div className="p-2.5 bg-amber-500/10 text-amber-500 rounded-xl">
                <Webhook className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-[13px] font-semibold" style={{ color: 'var(--tk-text)' }}>{custPlatformName || t('customPlatform')}</h3>
                <p className="text-[11px] mt-0.5" style={{ color: 'var(--tk-muted)' }}>{t('customDesc')}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-text-muted">{custActive ? t('enabled') : t('disabled')}</span>
                <button
                  onClick={() => handleToggleActive('Custom', custActive)}
                  className={`tk-switch tk-focusable ${custActive ? 'is-on' : ''}`}
                  role="switch"
                  aria-checked={!!custActive}
                >
                  <span className="tk-switch-knob" />
                </button>
              </div>
              
              <button 
                onClick={() => setExpandedPlatform(expandedPlatform === 'Custom' ? null : 'Custom')}
                className="p-1.5 hover:bg-bg-hover text-text-muted hover:text-text-main rounded-lg transition-colors cursor-pointer"
              >
                {expandedPlatform === 'Custom' ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {expandedPlatform === 'Custom' && (
            <div className="space-y-4" style={{ padding: 14, borderTop: '1px solid var(--tk-border)' }}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10.5px] font-bold text-text-muted uppercase tracking-[.1em] mb-1.5">
                    {t('customPlatformName')}
                  </label>
                  <input
                    type="text"
                    value={custPlatformName}
                    onChange={(e) => setCustPlatformName(e.target.value)}
                    placeholder={t('phCustomPlatform')}
                    className="tk-field tk-focusable"
                  />
                </div>
                <div>
                  <label className="block text-[10.5px] font-bold text-text-muted uppercase tracking-[.1em] mb-1.5">
                    {t('customBaseUrl')}
                  </label>
                  <input
                    type="text"
                    value={custUrl}
                    onChange={(e) => setCustUrl(e.target.value)}
                    placeholder="https://api.yourdomain.com/v1/recruitment"
                    className="tk-field tk-focusable"
                  />
                </div>
                <div>
                  <label className="block text-[10.5px] font-bold text-text-muted uppercase tracking-[.1em] mb-1.5">
                    {t('customAuthType')}
                  </label>
                  <select
                    value={custAuthType}
                    onChange={(e) => setCustAuthType(e.target.value)}
                    className="tk-field tk-focusable"
                  >
                    <option value="Bearer">{t('authBearer')}</option>
                    <option value="ApiKey">{t('authApiKey')}</option>
                    <option value="Basic">{t('authBasic')}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10.5px] font-bold text-text-muted uppercase tracking-[.1em] mb-1.5">
                    {t('customAuthValue')}
                  </label>
                  <input
                    type="text"
                    value={custAuthValue}
                    onChange={(e) => setCustAuthValue(e.target.value)}
                    placeholder={t('phCustomAuthValue')}
                    className="tk-field tk-focusable"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-[10.5px] font-bold text-text-muted uppercase tracking-[.1em] mb-1.5">
                    {t('customPayloadMapping')}
                  </label>
                  <textarea
                    rows={4}
                    value={custPayload}
                    onChange={(e) => setCustPayload(e.target.value)}
                    placeholder={t('phCustomPayload')}
                    className="tk-field tk-focusable"
                  />
                </div>
              </div>

              {testResult['Custom'] && (
                <div className={`p-3 rounded-lg border text-xs font-bold flex items-center gap-2 ${
                  testResult['Custom']?.success 
                    ? 'bg-green-500/10 border-green-500/20 text-green-600 dark:text-green-400' 
                    : 'bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400'
                }`}>
                  {testResult['Custom']?.success ? <Check className="w-4 h-4 flex-shrink-0" /> : <AlertTriangle className="w-4 h-4 flex-shrink-0" />}
                  <p>{testResult['Custom']?.message}</p>
                </div>
              )}

              {saveStatus['Custom'] && (
                <div className={`p-3 rounded-lg border text-xs font-bold flex items-center gap-2 ${
                  saveStatus['Custom']?.success 
                    ? 'bg-green-500/10 border-green-500/20 text-green-600 dark:text-green-400' 
                    : 'bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400'
                }`}>
                  <Check className="w-4 h-4 flex-shrink-0" />
                  <p>{saveStatus['Custom']?.message}</p>
                </div>
              )}

              <div className="flex justify-between items-center pt-2 border-t border-border-main/50">
                <span className="text-[10px]" style={{ color: 'var(--tk-muted)' }}>{t('lastSync', { date: custSyncDate || t('neverSynced') })}</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleTestConnection('Custom')}
                    disabled={testingPlatform !== null || savingPlatform !== null}
                    className="tk-btn-neutral tk-focusable disabled:opacity-50"
                  >
                    {testingPlatform === 'Custom' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                    <span>{t('testConnection')}</span>
                  </button>
                  <button
                    onClick={() => handleSaveSettings('Custom')}
                    disabled={testingPlatform !== null || savingPlatform !== null}
                    className="tk-btn-primary tk-focusable disabled:opacity-50"
                  >
                    {savingPlatform === 'Custom' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    <span>{t('saveConnection')}</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default IntegrationsSettings;
