import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Bell } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { apiRequest } from '../utils/api.js';

interface AppNotification {
  id: number;
  type: string;
  title: string;
  body: string;
  candidateId: number | null;
  jobId: number | null;
  isRead: number;
  createdAt: string;
}

const POLL_INTERVAL_MS = 60_000;

/** Header bell surfacing in-app notifications (currently strong-match alerts from the upload pipeline). */
export const NotificationsBell: React.FC = () => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const data = await apiRequest('GET', '/api/notifications');
      setItems(data.notifications || []);
      setUnread(data.unreadCount || 0);
    } catch {
      // A failed poll is not worth surfacing — the bell just keeps its last known state.
    }
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [load]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    const onClickOutside = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('mousedown', onClickOutside);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('mousedown', onClickOutside);
    };
  }, [open]);

  const openNotification = async (n: AppNotification) => {
    setOpen(false);
    if (n.isRead === 0) {
      try {
        await apiRequest('POST', `/api/notifications/${n.id}/read`);
      } catch { /* navigating is more important than the read receipt */ }
      load();
    }
    if (n.candidateId) navigate(`/candidate/${n.candidateId}`);
  };

  const markAllRead = async () => {
    try {
      await apiRequest('POST', '/api/notifications/read-all');
      load();
    } catch { /* ignore */ }
  };

  return (
    <div ref={rootRef} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => { setOpen(!open); if (!open) load(); }}
        title="Notifications"
        aria-label={unread > 0 ? `Notifications (${unread} unread)` : 'Notifications'}
        aria-expanded={open}
        className="tk-icon-btn tk-focusable"
        style={{
          width: 36, height: 36, position: 'relative',
          ...(open ? { background: 'var(--tk-accent-soft)', color: 'var(--tk-accent-text)' } : {})
        }}
      >
        <Bell className="w-4 h-4" />
        {unread > 0 && (
          <span
            style={{
              position: 'absolute', top: 5, insetInlineEnd: 5, minWidth: 8, height: 8,
              borderRadius: 99, background: 'var(--tk-accent)',
              boxShadow: '0 0 8px color-mix(in srgb, var(--tk-accent) 70%, transparent)'
            }}
          />
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Notifications"
          className="tk-panel"
          style={{
            position: 'absolute', top: 46, insetInlineEnd: 0, zIndex: 40,
            width: 'min(360px, 84vw)', borderRadius: 16,
            border: '1px solid var(--tk-border-strong)',
            boxShadow: '0 22px 50px rgba(0,0,0,.35)',
            padding: '14px 16px 16px', maxHeight: 420, overflowY: 'auto'
          }}
        >
          <div
            className="flex items-center justify-between gap-2"
            style={{ borderBottom: '1px solid var(--tk-border)', paddingBottom: 10, marginBottom: 10 }}
          >
            <span className="text-[11px] font-bold uppercase tracking-[.14em]" style={{ color: 'var(--tk-accent-text)' }}>
              Notifications
            </span>
            {unread > 0 && (
              <button type="button" onClick={markAllRead} className="tk-btn-neutral tk-focusable" style={{ height: 26, padding: '0 10px', fontSize: 11 }}>
                Mark all read
              </button>
            )}
          </div>

          {items.length === 0 ? (
            <p className="text-xs py-6 text-center" style={{ color: 'var(--tk-muted)' }}>
              No notifications yet.
            </p>
          ) : (
            <div style={{ display: 'grid', gap: 6 }}>
              {items.map(n => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => openNotification(n)}
                  className="tk-focusable text-start"
                  style={{
                    padding: 11, borderRadius: 11, cursor: 'pointer',
                    background: n.isRead === 0 ? 'var(--tk-accent-soft)' : 'var(--tk-inset)',
                    border: '1px solid var(--tk-border)'
                  }}
                >
                  <p className="text-[12.5px] font-medium truncate" style={{ color: 'var(--tk-text)' }}>{n.title}</p>
                  <p className="text-[11px] leading-relaxed" style={{ color: 'var(--tk-muted)' }}>{n.body}</p>
                  <p className="text-[10px] mt-1" style={{ color: 'var(--tk-dim)' }} dir="ltr">
                    {new Date(n.createdAt).toLocaleString()}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default NotificationsBell;
