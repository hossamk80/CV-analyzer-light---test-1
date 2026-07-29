import React, { useState, useEffect } from 'react';
import { AI_PROVIDERS_CATALOG } from '../utils/aiCatalog.js';
import { useI18n } from '../i18n/I18nContext.js';
import { RefreshCw, AlertCircle } from 'lucide-react';
import { apiRequest } from '../utils/api.js';

interface ProviderModelFieldsProps {
  selectedProvider: string;
  selectedModel: string;
  apiKey?: string;
  providerId?: number;
  onChangeProvider: (prov: string) => void;
  onChangeModel: (model: string) => void;
}

export const ProviderModelFields: React.FC<ProviderModelFieldsProps> = ({
  selectedProvider,
  selectedModel,
  apiKey,
  providerId,
  onChangeProvider,
  onChangeModel
}) => {
  const { t } = useI18n();
  const fieldLabel = 'block text-[10.5px] font-bold uppercase tracking-[.1em] mb-1.5 text-text-muted';
  const [modelOptions, setModelOptions] = useState<string[]>([]);
  const [fetchingModels, setFetchingModels] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [showCustomModel, setShowCustomModel] = useState(false);
  const [customModelValue, setCustomModelValue] = useState('');

  // Auto-fetch live model list whenever provider or API key changes
  useEffect(() => {
    const catalogItem = AI_PROVIDERS_CATALOG.find(p => p.name === selectedProvider);
    const initialOptions = catalogItem ? catalogItem.models : [];
    setModelOptions(initialOptions);

    if (apiKey && apiKey.length > 5) {
      handleFetchLiveModels(selectedProvider, apiKey);
    } else {
      setFetchError(null);
    }

    const isCustom = !initialOptions.includes(selectedModel) && selectedModel !== '';
    setShowCustomModel(isCustom || selectedModel === 'Custom');
    if (isCustom) {
      setCustomModelValue(selectedModel);
    }
  }, [selectedProvider, apiKey]);

  const handleFetchLiveModels = async (provName: string, key?: string) => {
    setFetchingModels(true);
    setFetchError(null);
    try {
      const res = await apiRequest('POST', '/api/ai-providers/models', {
        providerName: provName,
        apiKey: key || apiKey,
        providerId
      });
      if (res.success && Array.isArray(res.models) && res.models.length > 0) {
        setModelOptions(res.models);
        setFetchError(null);
        // If current selected model is not in live list and not custom, auto-select first live model
        if (!res.models.includes(selectedModel) && selectedModel !== 'Custom' && !showCustomModel) {
          onChangeModel(res.models[0]);
        }
      }
    } catch (err: any) {
      console.warn('[Live Model Fetch Error]', err);
      setFetchError(err.message || t('connectionFailed'));
      // Keep cached / catalog options instead of clearing
    } finally {
      setFetchingModels(false);
    }
  };

  const handleProviderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const prov = e.target.value;
    onChangeProvider(prov);
    
    const catalogItem = AI_PROVIDERS_CATALOG.find(p => p.name === prov);
    const defaultModel = catalogItem && catalogItem.models.length > 0 ? catalogItem.models[0] : 'Custom';
    onChangeModel(defaultModel);
  };

  const handleModelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const model = e.target.value;
    if (model === 'Custom') {
      setShowCustomModel(true);
      onChangeModel(customModelValue || 'custom-model');
    } else {
      setShowCustomModel(false);
      onChangeModel(model);
    }
  };

  const handleCustomModelChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setCustomModelValue(val);
    onChangeModel(val);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <div>
        <label className={fieldLabel}>{t('providerName')}</label>
        <select
          value={selectedProvider}
          onChange={handleProviderChange}
          className="tk-field tk-focusable"
          style={{ cursor: 'pointer' }}
        >
          {AI_PROVIDERS_CATALOG.map(p => (
            <option key={p.name} value={p.name}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <div className="flex justify-between items-center gap-2 mb-1.5">
          <label className={fieldLabel} style={{ marginBottom: 0 }}>{t('modelName')}</label>
          <button
            type="button"
            onClick={() => handleFetchLiveModels(selectedProvider, apiKey)}
            disabled={fetchingModels}
            className="flex items-center gap-1 text-[11px] font-bold text-brand hover:underline cursor-pointer disabled:opacity-50"
            title={t('fetchModelsTitle')}
          >
            <RefreshCw className={`w-3 h-3 ${fetchingModels ? 'animate-spin' : ''}`} />
            <span>{fetchingModels ? t('fetchingModels') : t('refreshModels')}</span>
          </button>
        </div>

        <select
          value={showCustomModel ? 'Custom' : selectedModel}
          onChange={handleModelChange}
          className="tk-field tk-focusable"
          style={{ cursor: 'pointer' }}
        >
          {modelOptions.map(m => (
            <option key={m} value={m}>
              {t('modelLiveVerified', { model: m })}
            </option>
          ))}
          <option value="Custom">{t('modelCustom')}</option>
        </select>

        {fetchError && (
          <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-amber-500 font-medium">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>{t('showingCachedOptions', { error: fetchError })}</span>
          </div>
        )}

        {showCustomModel && (
          <input
            type="text"
            placeholder={t('customModelPlaceholder')}
            value={customModelValue}
            onChange={handleCustomModelChange}
            className="tk-field tk-focusable mt-2"
            style={{ fontFamily: 'ui-monospace, SFMono-Regular, monospace' }}
          />
        )}
      </div>
    </div>
  );
};
export default ProviderModelFields;
