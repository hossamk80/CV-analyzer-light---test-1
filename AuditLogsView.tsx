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
  const { language } = useI18n();
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
      setError(err.message || 'Failed to fetch audit logs');
    } finally {
      setLoading(false);
    }
  };

  const getActionBadge = (actionType: string) => {
    switch (actionType) {
      case 'status_change':
        return <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-blue-500/10 text-blue-500 border border-blue-500/20 rounded-full px-2.5 py-0.5"><UserCheck className="w-3 h-3" /> Status Change</span>;
      case 'cv_upload':
        return <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-green-500/10 text-green-500 border border-green-500/20 rounded-full px-2.5 py-0.5"><FileText className="w-3 h-3" /> CV Upload</span>;
      case 'prompt_edit':
        return <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-purple-500/10 text-purple-500 border border-purple-500/20 rounded-full px-2.5 py-0.5"><SettingsIcon className="w-3 h-3" /> Prompt Edit</span>;
      case 'settings_change':
        return <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20 rounded-full px-2.5 py-0.5"><SettingsIcon className="w-3 h-3" /> Settings Change</span>;
      case 'provider_change':
        return <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-indigo-500/10 text-indigo-500 border border-indigo-500/20 rounded-full px-2.5 py-0.5"><Cpu className="w-3 h-3" /> AI Provider</span>;
      case 'ai_failover':
        return <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-red-500/10 text-red-500 border border-red-500/20 rounded-full px-2.5 py-0.5"><AlertOctagon className="w-3 h-3 text-red-500 animate-pulse" /> AI Failover</span>;
      case 'notification_sent':
        return <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-cyan-500/10 text-cyan-500 border border-cyan-500/20 rounded-full px-2.5 py-0.5"><Send className="w-3 h-3" /> Notification Sent</span>;
      default:
        return <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-bg-hover text-text-muted border border-border-main rounded-full px-2.5 py-0.5">{actionType}</span>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px] text-text-muted text-sm gap-2">
        <RefreshCw className="w-5 h-5 animate-spin text-brand" />
        <span>Loading system audit logs...</span>
      </div>
    );
  }

  if (error) {
    return <AccessDenied message={error} onRetry={fetchLogs} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center border-b border-border-main/50 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand/10 border border-brand/20 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-brand" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-text-main">
              {language === 'ar' ? 'سجل العمليات والتدقيق (Audit Logs)' : 'Security Audit Trail Log'}
            </h2>
            <p className="text-xs text-text-muted">
              {language === 'ar' ? 'تتبع غير قابل للتعديل لجميع أنشطة المستخدمين، تغييرات الصلاحيات، والأحداث' : 'Append-only immutable record of system actions, role changes, and failover events.'}
            </p>
          </div>
        </div>

        <button
          onClick={fetchLogs}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-bg-card border border-border-main rounded-xl text-xs font-semibold text-text-main hover:bg-bg-hover transition-colors cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>{language === 'ar' ? 'تحديث' : 'Refresh'}</span>
        </button>
      </div>

      <div className="bg-bg-card border border-border-main rounded-2xl overflow-hidden shadow-sm glass-panel">
        {logs.length === 0 ? (
          <div className="p-8 text-center text-text-muted text-sm">
            No audit logs recorded yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-bg-main/60 border-b border-border-main text-text-muted font-bold uppercase tracking-wider">
                <tr>
                  <th className="py-3.5 px-4"># ID</th>
                  <th className="py-3.5 px-4">Timestamp</th>
                  <th className="py-3.5 px-4">Actor</th>
                  <th className="py-3.5 px-4">Action Type</th>
                  <th className="py-3.5 px-4">Target</th>
                  <th className="py-3.5 px-4">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-main/40 text-text-main font-medium">
                {logs.map(log => (
                  <tr 
                    key={log.id} 
                    onClick={() => setSelectedLog(log)}
                    className="hover:bg-bg-hover/40 transition-colors cursor-pointer"
                  >
                    <td className="py-3 px-4 font-mono text-text-muted text-[11px]">#{log.id}</td>
                    <td className="py-3 px-4 whitespace-nowrap text-text-muted">
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span>{new Date(log.createdAt).toLocaleString()}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-text-main">{log.actorUsername}</span>
                        <span className="text-[10px] uppercase font-bold text-brand bg-brand/10 border border-brand/20 px-1.5 py-0.2 rounded-md">
                          {log.actorRole}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      {getActionBadge(log.actionType)}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap text-text-muted">
                      {log.targetEntity ? `${log.targetEntity} #${log.targetEntityId || ''}` : '-'}
                    </td>
                    <td className="py-3 px-4 max-w-xs truncate text-text-muted" title={log.details || ''}>
                      {log.details || '-'}
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
          <div className="bg-bg-card border border-border-main rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl glass-panel">
            <div className="flex justify-between items-center border-b border-border-main/50 pb-3">
              <h3 className="text-base font-bold text-text-main flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-brand" />
                Audit Log Details #{selectedLog.id}
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
                  <p className="text-[10px] font-bold uppercase text-text-muted">Actor</p>
                  <p className="font-bold text-text-main">{selectedLog.actorUsername} ({selectedLog.actorRole})</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase text-text-muted">Timestamp</p>
                  <p className="font-semibold text-text-main">{new Date(selectedLog.createdAt).toLocaleString()}</p>
                </div>
              </div>

              <div>
                <p className="text-[10px] font-bold uppercase text-text-muted mb-1">Details</p>
                <p className="p-2.5 bg-bg-main/50 rounded-xl border border-border-main/50 text-text-main font-medium leading-relaxed">
                  {selectedLog.details || 'No details provided'}
                </p>
              </div>

              {selectedLog.beforeValue && (
                <div>
                  <p className="text-[10px] font-bold uppercase text-text-muted mb-1">Before State</p>
                  <pre className="p-2.5 bg-bg-main/70 rounded-xl border border-border-main/50 text-[11px] text-amber-500 font-mono overflow-x-auto">
                    {selectedLog.beforeValue}
                  </pre>
                </div>
              )}

              {selectedLog.afterValue && (
                <div>
                  <p className="text-[10px] font-bold uppercase text-text-muted mb-1">After State</p>
                  <pre className="p-2.5 bg-bg-main/70 rounded-xl border border-border-main/50 text-[11px] text-green-500 font-mono overflow-x-auto">
                    {selectedLog.afterValue}
                  </pre>
                </div>
              )}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-2 bg-brand hover:bg-brand-hover text-white rounded-xl font-bold text-xs shadow-md transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AuditLogsView;
