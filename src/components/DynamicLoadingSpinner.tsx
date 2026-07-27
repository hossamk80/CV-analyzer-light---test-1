import React from 'react';

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  label?: string;
}

export const DynamicLoadingSpinner: React.FC<SpinnerProps> = ({ size = 'md', label }) => {
  const sizeClasses = {
    sm: 'w-6 h-6 border-2',
    md: 'w-10 h-10 border-3',
    lg: 'w-16 h-16 border-4'
  };

  return (
    <div className="flex flex-col items-center justify-center p-4">
      <div className="relative">
        {/* Animated outer glowing ring */}
        <div className={`absolute inset-0 rounded-full blur-md opacity-40 animate-pulse bg-brand`}></div>
        {/* Core spinner */}
        <div
          className={`${sizeClasses[size]} rounded-full border-brand/20 border-t-brand animate-spin`}
        ></div>
      </div>
      {label && (
        <p className="mt-4 text-sm font-medium text-text-muted animate-pulse">{label}</p>
      )}
    </div>
  );
};
export default DynamicLoadingSpinner;
