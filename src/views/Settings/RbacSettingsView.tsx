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

const CAPABILITY_LABELS: Record<Capability, { title: string; desc: string }> = {
  view_dashboard: { title: 'View Dashboard & Results', desc: 'Access candidate rankings, match scores, and overview' },
  manage_jobs: { title: 'Manage Job Positions', desc: 'Create, edit, and archive job openings' },
  upload_cvs: { title: 'Upload & Analyze CVs', desc: 'Upload candidate resume batches and run AI parsing' },
  change_status: { title: 'Change Candidate Status', desc: 'Update candidate pipeline status (Shortlisted, Interviewing, etc.)' },
  delete_data: { title: 'Delete Candidates & Jobs', desc: 'Permanently remove candidates, files, and job listings' },
  manage_settings: { title: 'Manage System Settings', desc: 'Configure AI providers, prompts, theme, and security' },
  toggle_gdpr: { title: 'Toggle GDPR Anonymization', desc: 'Mask or unmask PII contact information across the interface' }
};

export const RbacSettingsView: React.FC = () => {
  const { language } = useI18n();
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
      setError(err.message || 'Failed to load RBAC matrix');
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
      setSuccessMsg('RBAC capabilities updated and enforced successfully.');
    } catch (err: any) {
      setError(err.message || 'Failed to save RBAC matrix');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px] text-text-muted text-sm gap-2">
        <RefreshCw className="w-5 h-5 animate-spin text-brand" />
        <span>Loading role permissions matrix...</span>
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center border-b border-border-main/50 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand/10 border border-brand/20 flex items-center justify-center">
            <Shield className="w-5 h-5 text-brand" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-text-main">
              {language === 'ar' ? 'إدارة الصلاحيات والأدوار (Dynamic RBAC)' : 'Dynamic Role Capabilities Matrix'}
            </h2>
            <p className="text-xs text-text-muted">
              {language === 'ar' ? 'تعديل صلاحيات كل دور في النظام وتطبيقها ديناميكياً' : 'Configure and enforce fine-grained capabilities per role (Admin, Manager, Recruiter).'}
            </p>
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="tk-btn-primary tk-focusable flex items-center gap-1.5 text-xs transition-colors cursor-pointer disabled:opacity-50"
        >
          {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          <span>{saving ? 'Saving...' : 'Save Matrix'}</span>
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
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-bg-main/60 border-b border-border-main text-text-muted font-bold uppercase tracking-wider">
              <tr>
                <th className="py-3.5 px-5">Capability / Permission</th>
                <th className="py-3.5 px-4 text-center w-28">
                  <span className="text-purple-500 bg-purple-500/10 px-2 py-0.5 rounded-full border border-purple-500/20">Admin</span>
                </th>
                <th className="py-3.5 px-4 text-center w-28">
                  <span className="text-blue-500 bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/20">Manager</span>
                </th>
                <th className="py-3.5 px-4 text-center w-28">
                  <span className="text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">Recruiter</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-main/40 text-text-main font-medium">
              {capabilities.map(cap => {
                const info = CAPABILITY_LABELS[cap];
                return (
                  <tr key={cap} className="hover:bg-bg-hover/30 transition-colors">
                    <td className="py-3.5 px-5">
                      <div className="font-bold text-text-main text-xs">{info.title}</div>
                      <div className="text-[11px] text-text-muted">{info.desc}</div>
                    </td>

                    {roles.map(r => {
                      const enabled = matrix[r]?.[cap] || false;
                      return (
                        <td key={r} className="py-3.5 px-4 text-center">
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
