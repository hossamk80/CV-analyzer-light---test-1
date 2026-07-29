import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../utils/api.js';
import { useI18n } from '../../i18n/I18nContext.js';
import AccessDenied from '../../components/AccessDenied.js';
import { Shield, Save, RefreshCw, Check, AlertCircle } from 'lucide-react';

type UserRole = 'admin' | 'manager' | 'recruiter';
type Capability = 
  | 'view_dashboard'
  | 'manage_jobs'
  | 'upload_cvs'
  | 'change_status'
  | 'delete_data'
  | 'manage_settings'
  | 'toggle_gdpr';

type RbacMatrix = Record<UserRole, Record<Capability, boolean>>;

export const RbacSettingsView: React.FC = () => {
  const { t } = useI18n();
  const [matrix, setMatrix] = useState<RbacMatrix | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    fetchRbacMatrix();
  }, []);

  const fetchRbacMatrix = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiRequest('GET', '/api/rbac');
      setMatrix(data);
    } catch (err: any) {
      setError(err.message || t('rbacLoadFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = (role: UserRole, capability: Capability) => {
    if (!matrix) return;
    setMatrix(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        [role]: {
          ...prev[role],
          [capability]: !prev[role][capability]
        }
      };
    });
  };

  const handleSave = async () => {
    if (!matrix) return;
    setSaving(true);
    setError(null);
    setSuccessMsg(null);
    try {
      await apiRequest('PUT', '/api/rbac', matrix);
      setSuccessMsg(t('rbacSaved'));
    } catch (err: any) {
      setError(err.message || t('rbacSaveFailed'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px] text-text-muted text-sm gap-2">
        <RefreshCw className="w-5 h-5 animate-spin text-brand" />
        <span>{t('rbacLoading')}</span>
      </div>
    );
  }

  if (error) {
    return <AccessDenied message={error} onRetry={fetchRbacMatrix} />;
  }

  if (!matrix) return null;

  const roles: UserRole[] = ['admin', 'manager', 'recruiter'];
  const capabilities: Capability[] = [
    'view_dashboard',
    'manage_jobs',
    'upload_cvs',
    'change_status',
    'delete_data',
    'manage_settings',
    'toggle_gdpr'
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center gap-3 flex-wrap pb-3" style={{ borderBottom: '1px solid var(--tk-border)' }}>
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center shrink-0" style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--tk-accent-soft)', color: 'var(--tk-accent-text)' }}>
            <Shield className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-[15px] font-medium" style={{ color: 'var(--tk-text)' }}>{t('rbacTitle')}</h2>
            <p className="text-[11px]" style={{ color: 'var(--tk-muted)' }}>{t('rbacSubtitle')}</p>
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="tk-btn-primary tk-focusable disabled:opacity-50"
        >
          {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          <span>{saving ? t('saving') : t('rbacSaveMatrix')}</span>
        </button>
      </div>

      {successMsg && (
        <div className="p-3.5 bg-green-500/10 border border-green-500/20 rounded-xl text-green-500 text-xs font-bold flex items-center gap-2">
          <Check className="w-4 h-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* RBAC Matrix Table */}
      <div className="tk-panel overflow-hidden">
        <div className="tk-table-scroll">
          <table className="tk-table">
            <thead>
              <tr>
                <th>{t('rbacColumnCapability')}</th>
                <th style={{ textAlign: 'center', width: 110 }}>
                  <span className="text-purple-500 bg-purple-500/10 px-2 py-0.5 rounded-full border border-purple-500/20">{t('admin')}</span>
                </th>
                <th style={{ textAlign: 'center', width: 110 }}>
                  <span className="text-blue-500 bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/20">{t('manager')}</span>
                </th>
                <th style={{ textAlign: 'center', width: 110 }}>
                  <span className="text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">{t('recruiter')}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {capabilities.map(cap => {
                return (
                  <tr key={cap}>
                    <td>
                      <div className="font-semibold text-[12px]" style={{ color: 'var(--tk-text)' }}>{t(`cap_${cap}` as any)}</div>
                      <div className="text-[11px]" style={{ color: 'var(--tk-muted)' }}>{t(`cap_${cap}_desc` as any)}</div>
                    </td>

                    {roles.map(r => {
                      const enabled = matrix[r]?.[cap] || false;
                      return (
                        <td key={r} style={{ textAlign: 'center' }}>
                          <input
                            type="checkbox"
                            checked={enabled}
                            onChange={() => handleToggle(r, cap)}
                            className="w-4 h-4 accent-brand rounded cursor-pointer"
                          />
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default RbacSettingsView;
