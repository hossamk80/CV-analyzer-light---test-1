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
  const [liSyncDate, setLiSyncDate] = useState('Never synced');

  // Odoo State
  const [odActive, setOdActive] = useState(false);
  const [odUrl, setOdUrl] = useState('');
  const [odDb, setOdDb] = useState('');
  const [odEmail, setOdEmail] = useState('');
  const [odPassword, setOdPassword] = useState('');
  const [odSyncDate, setOdSyncDate] = useState('Never synced');

  // Custom Webhook State
  const [custActive, setCustActive] = useState(false);
  const [custPlatformName, setCustPlatformName] = useState('Custom Platform');
  const [custOriginalName, setCustOriginalName] = useState('Custom');
  const [custUrl, setCustUrl] = useState('');
  const [custAuthType, setCustAuthType] = useState('Bearer');
  const [custAuthValue, setCustAuthValue] = useState('');
  const [custPayload, setCustPayload] = useState('{\n  "name": "{name}",\n  "email": "{email}",\n  "score": "{score}"\n}');
  const [custSyncDate, setCustSyncDate] = useState('Never synced');

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
        setLiSyncDate(li.lastSyncDate || 'Never synced');
      }

      const od = data.find((i: any) => i.platformName === 'Odoo');
      if (od) {
        setOdActive(od.isActive === 1);
        setOdUrl(od.endpointUrl || '');
        setOdDb(od.clientId || '');
        setOdEmail(od.clientSecret || '');
        setOdPassword(od.apiKey || '');
        setOdSyncDate(od.lastSyncDate || 'Never synced');
      }

      const cust = data.find((i: any) => i.platformName !== 'LinkedIn' && i.platformName !== 'Odoo');
      if (cust) {
        setCustActive(cust.isActive === 1);
        setCustPlatformName(cust.platformName || 'Custom');
        setCustOriginalName(cust.platformName);
        setCustUrl(cust.endpointUrl || '');
        setCustAuthType(cust.clientId || 'Bearer');
        setCustAuthValue(cust.apiKey || '');
        setCustPayload(cust.customHeaders || '{}');
        setCustSyncDate(cust.lastSyncDate || 'Never synced');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load integrations settings');
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
      
      alert('Failed to update integration status: ' + err.message);
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
        [platform]: { success: true, message: t('saveIntegrationSuccess') || 'Saved connection configuration.' }
      }));
      // Clear message after 3 seconds
      setTimeout(() => {
        setSaveStatus(prev => ({ ...prev, [platform]: null }));
      }, 3000);
    } catch (err: any) {
      setSaveStatus(prev => ({
        ...prev,
        [platform]: { success: false, message: err.message || t('saveIntegrationFailed') || 'Failed to save settings.' }
      }));
    } finally {
      setSavingPlatform(null);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[300px] space-y-4">
        <Loader2 className="w-8 h-8 text-brand animate-spin" />
        <p className="text-sm text-text-muted">Loading integration settings...</p>
      </div>
    );
  }

  if (error) {
    return <AccessDenied message={error} onRetry={fetchIntegrations} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col space-y-1.5 border-b border-border-main/50 pb-4">
        <h2 className="text-lg font-bold text-text-main flex items-center gap-2">
          <Link2 className="w-5 h-5 text-brand" />
          {t('integrationsTitle') || 'Integrations & API Connections'}
        </h2>
        <p className="text-xs text-text-muted">
          {t('integrationsSub') || 'Manage third-party ERP, sourcing syncs, and custom webhook payloads.'}
        </p>
      </div>

      <div className="space-y-4">
        {/* Module 1: LinkedIn AI Sourcing */}
        <div className="bg-bg-card border border-border-main rounded-2xl overflow-hidden shadow-sm transition-all duration-300">
          <div 
            className="p-5 flex items-center justify-between cursor-pointer hover:bg-bg-hover/30 transition-colors"
            onClick={() => setExpandedPlatform(expandedPlatform === 'LinkedIn' ? null : 'LinkedIn')}
          >
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-500/10 text-blue-500 rounded-xl">
                <Linkedin className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-text-main">{t('linkedInSourcing') || 'LinkedIn AI Sourcing'}</h3>
                <p className="text-xs text-text-muted mt-0.5">{t('linkedInDesc') || 'Connect to LinkedIn Recruiter API to source candidates.'}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4" onClick={(e) => e.stopPropagation()}>
              {/* Enable toggle switch */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-text-muted">{liActive ? t('enabled') : t('disabled')}</span>
                <button
                  onClick={() => handleToggleActive('LinkedIn', liActive)}
                  className={`w-10 h-6 flex items-center rounded-full p-1 cursor-pointer transition-all ${
                    liActive ? 'bg-brand justify-end' : 'bg-border-main justify-start'
                  }`}
                >
                  <span className="bg-white w-4 h-4 rounded-full shadow-sm block"></span>
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
            <div className="p-6 border-t border-border-main bg-bg-main/10 space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-1.5 px-1">
                    {t('linkedInClientId') || 'Client ID'}
                  </label>
                  <input
                    type="text"
                    value={liClientId}
                    onChange={(e) => setLiClientId(e.target.value)}
                    placeholder="Enter LinkedIn Client ID"
                    className="w-full px-3 py-2 rounded-lg border border-border-main bg-bg-main/50 text-text-main focus:outline-none focus:border-brand text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-1.5 px-1">
                    {t('linkedInClientSecret') || 'Client Secret'}
                  </label>
                  <input
                    type="password"
                    value={liClientSecret}
                    onChange={(e) => setLiClientSecret(e.target.value)}
                    placeholder="••••••••••••••••"
                    className="w-full px-3 py-2 rounded-lg border border-border-main bg-bg-main/50 text-text-main focus:outline-none focus:border-brand text-sm"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-1.5 px-1">
                    {t('linkedInRedirectUri') || 'OAuth Redirect URI'}
                  </label>
                  <input
                    type="text"
                    value={liRedirectUri}
                    onChange={(e) => setLiRedirectUri(e.target.value)}
                    placeholder="https://your-ats.com/api/integrations/linkedin/callback"
                    className="w-full px-3 py-2 rounded-lg border border-border-main bg-bg-main/50 text-text-main focus:outline-none focus:border-brand text-sm"
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
                <span className="text-[10px] text-text-muted">Last sync: {liSyncDate}</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleTestConnection('LinkedIn')}
                    disabled={testingPlatform !== null || savingPlatform !== null}
                    className="flex items-center gap-1.5 px-4 py-2 bg-bg-hover hover:bg-bg-hover/80 border border-border-main text-text-main text-xs font-bold rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {testingPlatform === 'LinkedIn' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                    <span>{t('testConnection') || 'Test Connection'}</span>
                  </button>
                  <button
                    onClick={() => handleSaveSettings('LinkedIn')}
                    disabled={testingPlatform !== null || savingPlatform !== null}
                    className="flex items-center gap-1.5 px-4 py-2 bg-brand hover:bg-brand-hover text-white text-xs font-bold rounded-lg shadow-sm transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {savingPlatform === 'LinkedIn' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    <span>{t('saveSettings') || 'Save Connection'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Module 2: Odoo ERP Sync */}
        <div className="bg-bg-card border border-border-main rounded-2xl overflow-hidden shadow-sm transition-all duration-300">
          <div 
            className="p-5 flex items-center justify-between cursor-pointer hover:bg-bg-hover/30 transition-colors"
            onClick={() => setExpandedPlatform(expandedPlatform === 'Odoo' ? null : 'Odoo')}
          >
            <div className="flex items-center gap-4">
              <div className="p-3 bg-purple-500/10 text-purple-500 rounded-xl">
                <Database className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-text-main">{t('odooErp') || 'Odoo ERP Sync'}</h3>
                <p className="text-xs text-text-muted mt-0.5">{t('odooDesc') || 'Synchronize jobs and applicant details automatically.'}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-text-muted">{odActive ? t('enabled') : t('disabled')}</span>
                <button
                  onClick={() => handleToggleActive('Odoo', odActive)}
                  className={`w-10 h-6 flex items-center rounded-full p-1 cursor-pointer transition-all ${
                    odActive ? 'bg-brand justify-end' : 'bg-border-main justify-start'
                  }`}
                >
                  <span className="bg-white w-4 h-4 rounded-full shadow-sm block"></span>
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
            <div className="p-6 border-t border-border-main bg-bg-main/10 space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-1.5 px-1">
                    {t('odooUrl') || 'Odoo Server URL'}
                  </label>
                  <input
                    type="text"
                    value={odUrl}
                    onChange={(e) => setOdUrl(e.target.value)}
                    placeholder="https://your-company.odoo.com"
                    className="w-full px-3 py-2 rounded-lg border border-border-main bg-bg-main/50 text-text-main focus:outline-none focus:border-brand text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-1.5 px-1">
                    {t('odooDb') || 'Database Name'}
                  </label>
                  <input
                    type="text"
                    value={odDb}
                    onChange={(e) => setOdDb(e.target.value)}
                    placeholder="Enter Odoo Database Name"
                    className="w-full px-3 py-2 rounded-lg border border-border-main bg-bg-main/50 text-text-main focus:outline-none focus:border-brand text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-1.5 px-1">
                    {t('odooEmail') || 'Admin Email'}
                  </label>
                  <input
                    type="email"
                    value={odEmail}
                    onChange={(e) => setOdEmail(e.target.value)}
                    placeholder="admin@your-company.com"
                    className="w-full px-3 py-2 rounded-lg border border-border-main bg-bg-main/50 text-text-main focus:outline-none focus:border-brand text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-1.5 px-1">
                    {t('odooPassword') || 'API Key / Password'}
                  </label>
                  <input
                    type="password"
                    value={odPassword}
                    onChange={(e) => setOdPassword(e.target.value)}
                    placeholder="••••••••••••••••"
                    className="w-full px-3 py-2 rounded-lg border border-border-main bg-bg-main/50 text-text-main focus:outline-none focus:border-brand text-sm"
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
                <span className="text-[10px] text-text-muted">Last sync: {odSyncDate}</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleTestConnection('Odoo')}
                    disabled={testingPlatform !== null || savingPlatform !== null}
                    className="flex items-center gap-1.5 px-4 py-2 bg-bg-hover hover:bg-bg-hover/80 border border-border-main text-text-main text-xs font-bold rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {testingPlatform === 'Odoo' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                    <span>{t('testConnection') || 'Test Connection'}</span>
                  </button>
                  <button
                    onClick={() => handleSaveSettings('Odoo')}
                    disabled={testingPlatform !== null || savingPlatform !== null}
                    className="flex items-center gap-1.5 px-4 py-2 bg-brand hover:bg-brand-hover text-white text-xs font-bold rounded-lg shadow-sm transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {savingPlatform === 'Odoo' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    <span>{t('saveSettings') || 'Save Connection'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Module 3: Custom Webhook / API */}
        <div className="bg-bg-card border border-border-main rounded-2xl overflow-hidden shadow-sm transition-all duration-300">
          <div 
            className="p-5 flex items-center justify-between cursor-pointer hover:bg-bg-hover/30 transition-colors"
            onClick={() => setExpandedPlatform(expandedPlatform === 'Custom' ? null : 'Custom')}
          >
            <div className="flex items-center gap-4">
              <div className="p-3 bg-amber-500/10 text-amber-500 rounded-xl">
                <Webhook className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-text-main">{custPlatformName}</h3>
                <p className="text-xs text-text-muted mt-0.5">{t('customDesc') || 'Configure an arbitrary custom API endpoint and payload mapping schemas.'}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-text-muted">{custActive ? t('enabled') : t('disabled')}</span>
                <button
                  onClick={() => handleToggleActive('Custom', custActive)}
                  className={`w-10 h-6 flex items-center rounded-full p-1 cursor-pointer transition-all ${
                    custActive ? 'bg-brand justify-end' : 'bg-border-main justify-start'
                  }`}
                >
                  <span className="bg-white w-4 h-4 rounded-full shadow-sm block"></span>
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
            <div className="p-6 border-t border-border-main bg-bg-main/10 space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-1.5 px-1">
                    {t('customPlatformName') || 'Platform Name'}
                  </label>
                  <input
                    type="text"
                    value={custPlatformName}
                    onChange={(e) => setCustPlatformName(e.target.value)}
                    placeholder="e.g. Local HR Webhook"
                    className="w-full px-3 py-2 rounded-lg border border-border-main bg-bg-main/50 text-text-main focus:outline-none focus:border-brand text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-1.5 px-1">
                    {t('customBaseUrl') || 'Base API URL'}
                  </label>
                  <input
                    type="text"
                    value={custUrl}
                    onChange={(e) => setCustUrl(e.target.value)}
                    placeholder="https://api.yourdomain.com/v1/recruitment"
                    className="w-full px-3 py-2 rounded-lg border border-border-main bg-bg-main/50 text-text-main focus:outline-none focus:border-brand text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-1.5 px-1">
                    {t('customAuthType') || 'Authentication Type'}
                  </label>
                  <select
                    value={custAuthType}
                    onChange={(e) => setCustAuthType(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-border-main bg-bg-main/50 text-text-main focus:outline-none focus:border-brand text-sm"
                  >
                    <option value="Bearer">Bearer Token</option>
                    <option value="ApiKey">API Key Header</option>
                    <option value="Basic">Basic Auth</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-1.5 px-1">
                    {t('customAuthValue') || 'Auth Value'}
                  </label>
                  <input
                    type="text"
                    value={custAuthValue}
                    onChange={(e) => setCustAuthValue(e.target.value)}
                    placeholder="Enter security token / key value"
                    className="w-full px-3 py-2 rounded-lg border border-border-main bg-bg-main/50 text-text-main focus:outline-none focus:border-brand text-sm"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-1.5 px-1">
                    {t('customPayloadMapping') || 'JSON Payload Mapping Schema'}
                  </label>
                  <textarea
                    rows={4}
                    value={custPayload}
                    onChange={(e) => setCustPayload(e.target.value)}
                    placeholder="Define template field mapping structure in JSON"
                    className="w-full px-3 py-2 rounded-lg border border-border-main bg-bg-main/50 text-text-main focus:outline-none focus:border-brand text-sm font-mono"
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
                <span className="text-[10px] text-text-muted">Last sync: {custSyncDate}</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleTestConnection('Custom')}
                    disabled={testingPlatform !== null || savingPlatform !== null}
                    className="flex items-center gap-1.5 px-4 py-2 bg-bg-hover hover:bg-bg-hover/80 border border-border-main text-text-main text-xs font-bold rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {testingPlatform === 'Custom' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                    <span>{t('testConnection') || 'Test Connection'}</span>
                  </button>
                  <button
                    onClick={() => handleSaveSettings('Custom')}
                    disabled={testingPlatform !== null || savingPlatform !== null}
                    className="flex items-center gap-1.5 px-4 py-2 bg-brand hover:bg-brand-hover text-white text-xs font-bold rounded-lg shadow-sm transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {savingPlatform === 'Custom' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    <span>{t('saveSettings') || 'Save Connection'}</span>
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
