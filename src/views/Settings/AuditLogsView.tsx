import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../utils/api.js';
import { useI18n } from '../../i18n/I18nContext.js';
import AccessDenied from '../../components/AccessDenied.js';
import { 
  ShieldCheck, 
  UserCheck, 
  FileText, 
  Settings as SettingsIcon, 
  Cpu, 
  Send, 
  AlertOctagon, 
  RefreshCw,
  Clock,
  ChevronRight
} from 'lucide-react';

interface AuditLogItem {
  id: number;
  actorUsername: string;
  actorRole: string;
  actionType: string;
  targetEntity?: string;
  targetEntityId?: number;
  beforeValue?: string;
  afterValue?: string;
  details?: string;
  createdAt: string;
}

export const AuditLogsView: React.FC = () => {
  const { t, language } = useI18n();
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedLog, setSelectedLog] = useState<AuditLogItem | null>(null);

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiRequest('GET', '/api/audit-logs');
      setLogs(data);
    } catch (err: any) {
      setError(err.message || t('auditLoadFailed'));
    } finally {
      setLoading(false);
    }
  };

  // Badge colour + icon per action type; the label itself is localized.
  const ACTION_BADGES: Record<string, { cls: string; Icon: React.ComponentType<{ className?: string }> }> = {
    status_change: { cls: 'bg-blue-500/10 text-blue-500 border-blue-500/20', Icon: UserCheck },
    cv_upload: { cls: 'bg-green-500/10 text-green-500 border-green-500/20', Icon: FileText },
    prompt_edit: { cls: 'bg-purple-500/10 text-purple-500 border-purple-500/20', Icon: SettingsIcon },
    settings_change: { cls: 'bg-amber-500/10 text-amber-500 border-amber-500/20', Icon: SettingsIcon },
    provider_change: { cls: 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20', Icon: Cpu },
    ai_failover: { cls: 'bg-red-500/10 text-red-500 border-red-500/20', Icon: AlertOctagon },
    notification_sent: { cls: 'bg-cyan-500/10 text-cyan-500 border-cyan-500/20', Icon: Send }
  };

  const getActionBadge = (actionType: string) => {
    const badge = ACTION_BADGES[actionType];
    if (!badge) {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-bg-hover text-text-muted border border-border-main rounded-full px-2 py-0.5">
          {actionType}
        </span>
      );
    }
    const { cls, Icon } = badge;
    return (
      <span className={`inline-flex items-center gap-1 text-[10px] font-bold border rounded-full px-2 py-0.5 ${cls}`}>
        <Icon className="w-3 h-3" />
        {t(`audit_${actionType}` as any)}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px] text-text-muted text-sm gap-2">
        <RefreshCw className="w-5 h-5 animate-spin text-brand" />
        <span>{t('auditLoading')}</span>
      </div>
    );
  }

  if (error) {
    return <AccessDenied message={error} onRetry={fetchLogs} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center gap-3 flex-wrap pb-3" style={{ borderBottom: '1px solid var(--tk-border)' }}>
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center shrink-0" style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--tk-accent-soft)', color: 'var(--tk-accent-text)' }}>
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-[15px] font-medium" style={{ color: 'var(--tk-text)' }}>{t('auditTitle')}</h2>
            <p className="text-[11px]" style={{ color: 'var(--tk-muted)' }}>{t('auditSubtitle')}</p>
          </div>
        </div>

        <button
          onClick={fetchLogs}
          className="tk-btn-neutral tk-focusable"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>{t('refresh')}</span>
        </button>
      </div>

      <div className="tk-panel overflow-hidden">
        {logs.length === 0 ? (
          <div className="p-8 text-center text-[12.5px]" style={{ color: 'var(--tk-muted)' }}>
            {t('auditEmpty')}
          </div>
        ) : (
          <div className="tk-table-scroll">
            <table className="tk-table">
              <thead>
                <tr>
                  <th>{t('auditColId')}</th>
                  <th>{t('auditColTimestamp')}</th>
                  <th>{t('auditColActor')}</th>
                  <th>{t('auditColAction')}</th>
                  <th>{t('auditColTarget')}</th>
                  <th>{t('auditColDetails')}</th>
                </tr>
              </thead>
              <tbody>
                {logs.map(log => (
                  <tr
                    key={log.id}
                    onClick={() => setSelectedLog(log)}
                    className="cursor-pointer"
                  >
                    <td className="font-mono text-[11px]" style={{ color: 'var(--tk-muted)' }}>#{log.id}</td>
                    <td className="whitespace-nowrap" style={{ color: 'var(--tk-muted)' }}>
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span>{new Date(log.createdAt).toLocaleString(language === 'ar' ? 'ar' : 'en')}</span>
                      </div>
                    </td>
                    <td className="whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold" style={{ color: 'var(--tk-text)' }}>{log.actorUsername}</span>
                        <span className="text-[10px] font-bold text-brand bg-brand/10 border border-brand/20 px-1.5 py-0.5 rounded-md">
                          {t(log.actorRole as any)}
                        </span>
                      </div>
                    </td>
                    <td className="whitespace-nowrap">
                      {getActionBadge(log.actionType)}
                    </td>
                    <td className="whitespace-nowrap" style={{ color: 'var(--tk-muted)' }}>
                      {log.targetEntity ? `${log.targetEntity} #${log.targetEntityId || ''}` : '—'}
                    </td>
                    <td className="max-w-xs truncate" style={{ color: 'var(--tk-muted)' }} title={log.details || ''}>
                      {log.details || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Selected Log Inspector Modal */}
      {selectedLog && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="tk-panel max-w-lg w-full space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-border-main/50 pb-3">
              <h3 className="text-base font-bold text-text-main flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-brand" />
                {t('auditDetailsTitle', { id: String(selectedLog.id) })}
              </h3>
              <button 
                onClick={() => setSelectedLog(null)}
                className="text-text-muted hover:text-text-main text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2 p-3 bg-bg-main/50 rounded-xl border border-border-main/50">
                <div>
                  <p className="text-[10px] font-bold uppercase text-text-muted">{t('auditColActor')}</p>
                  <p className="font-bold text-text-main">{selectedLog.actorUsername} ({t(selectedLog.actorRole as any)})</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase text-text-muted">{t('auditColTimestamp')}</p>
                  <p className="font-semibold text-text-main">{new Date(selectedLog.createdAt).toLocaleString(language === 'ar' ? 'ar' : 'en')}</p>
                </div>
              </div>

              <div>
                <p className="text-[10px] font-bold uppercase text-text-muted mb-1">{t('auditColDetails')}</p>
                <p className="p-2.5 bg-bg-main/50 rounded-xl border border-border-main/50 text-text-main font-medium leading-relaxed">
                  {selectedLog.details || t('auditNoDetails')}
                </p>
              </div>

              {selectedLog.beforeValue && (
                <div>
                  <p className="text-[10px] font-bold uppercase text-text-muted mb-1">{t('auditBeforeState')}</p>
                  <pre className="p-2.5 bg-bg-main/70 rounded-xl border border-border-main/50 text-[11px] text-amber-500 font-mono overflow-x-auto">
                    {selectedLog.beforeValue}
                  </pre>
                </div>
              )}

              {selectedLog.afterValue && (
                <div>
                  <p className="text-[10px] font-bold uppercase text-text-muted mb-1">{t('auditAfterState')}</p>
                  <pre className="p-2.5 bg-bg-main/70 rounded-xl border border-border-main/50 text-[11px] text-green-500 font-mono overflow-x-auto">
                    {selectedLog.afterValue}
                  </pre>
                </div>
              )}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setSelectedLog(null)}
                className="tk-btn-primary tk-focusable"
              >
                {t('close')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AuditLogsView;
