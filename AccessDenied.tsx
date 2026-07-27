import React from 'react';
import { ShieldAlert } from 'lucide-react';
import { useI18n } from '../i18n/I18nContext.js';

interface AccessDeniedProps {
  message?: string;
  onRetry?: () => void;
}

export const AccessDenied: React.FC<AccessDeniedProps> = ({ message, onRetry }) => {
  const { language } = useI18n();

  return (
    <div className="flex flex-col items-center justify-center min-h-[40vh] p-6 text-center">
      <div className="p-6 bg-red-500/10 border border-red-500/20 rounded-2xl max-w-md w-full glass-panel shadow-lg">
        <div className="w-12 h-12 bg-red-500/20 rounded-2xl flex items-center justify-center mx-auto mb-3.5 text-red-500 border border-red-500/30">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <h3 className="text-lg font-bold text-red-500 mb-1">
          {language === 'ar' ? 'تم رفض الوصول (403)' : 'Access Denied (403)'}
        </h3>
        <p className="text-text-muted text-xs leading-relaxed mb-4">
          {message || (language === 'ar'
            ? 'ليس لديك الصلاحيات الكافية للقيام بهذا الإجراء أو عرض هذه البيانات.'
            : 'You do not have sufficient role clearances to access this resource.')}
        </p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="px-4 py-2 bg-bg-card border border-border-main text-text-main rounded-xl text-xs font-semibold hover:bg-bg-hover transition-colors cursor-pointer"
          >
            {language === 'ar' ? 'إعادة المحاولة' : 'Try Again'}
          </button>
        )}
      </div>
    </div>
  );
};

export default AccessDenied;
