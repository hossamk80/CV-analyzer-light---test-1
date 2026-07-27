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
      setFetchError(err.message || 'Failed to fetch live models from provider API.');
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
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <label className="block text-sm font-medium text-text-muted mb-1">{t('providerName')}</label>
        <select
          value={selectedProvider}
          onChange={handleProviderChange}
          className="w-full px-3 py-2 rounded-lg border border-border-main bg-bg-card text-text-main focus:outline-none focus:border-brand"
        >
          {AI_PROVIDERS_CATALOG.map(p => (
            <option key={p.name} value={p.name}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <div className="flex justify-between items-center mb-1">
          <label className="block text-sm font-medium text-text-muted">{t('modelName')}</label>
          <button
            type="button"
            onClick={() => handleFetchLiveModels(selectedProvider, apiKey)}
            disabled={fetchingModels}
            className="flex items-center gap-1 text-[11px] font-bold text-brand hover:underline cursor-pointer disabled:opacity-50"
            title="Fetch live models directly from provider API"
          >
            <RefreshCw className={`w-3 h-3 ${fetchingModels ? 'animate-spin' : ''}`} />
            <span>{fetchingModels ? 'Fetching...' : 'Refresh Models'}</span>
          </button>
        </div>

        <select
          value={showCustomModel ? 'Custom' : selectedModel}
          onChange={handleModelChange}
          className="w-full px-3 py-2 rounded-lg border border-border-main bg-bg-card text-text-main focus:outline-none focus:border-brand text-sm"
        >
          {modelOptions.map(m => (
            <option key={m} value={m}>
              {m} (Live Verified)
            </option>
          ))}
          <option value="Custom">Custom (Unverified)</option>
        </select>

        {fetchError && (
          <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-amber-500 font-medium">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>{fetchError} (Showing cached options)</span>
          </div>
        )}

        {showCustomModel && (
          <input
            type="text"
            placeholder="Enter custom model identifier (e.g. gemini-2.0-flash)"
            value={customModelValue}
            onChange={handleCustomModelChange}
            className="mt-2 w-full px-3 py-2 rounded-lg border border-border-main bg-bg-card text-text-main focus:outline-none focus:border-brand text-sm font-mono"
          />
        )}
      </div>
    </div>
  );
};
export default ProviderModelFields;
