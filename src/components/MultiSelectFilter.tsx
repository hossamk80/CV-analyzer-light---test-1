import React, { useState, useRef, useEffect } from 'react';
import { X, ChevronsUpDown } from 'lucide-react';
import { useI18n } from '../i18n/I18nContext.js';

interface MultiSelectFilterProps {
  label: string;
  placeholder: string;
  options: string[];
  selectedValues: string[];
  onChange: (values: string[]) => void;
}

export const MultiSelectFilter: React.FC<MultiSelectFilterProps> = ({
  label,
  placeholder,
  options,
  selectedValues,
  onChange
}) => {
  const { t } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter options based on query
  const filteredOptions = options.filter(option =>
    option.toLowerCase().includes(query.toLowerCase()) && !selectedValues.includes(option)
  );

  const handleSelect = (val: string) => {
    onChange([...selectedValues, val]);
    setQuery('');
    setIsOpen(false);
  };

  const handleRemove = (val: string) => {
    onChange(selectedValues.filter(v => v !== val));
  };

  const handleAddCustom = () => {
    const trimmed = query.trim();
    if (trimmed && !selectedValues.includes(trimmed)) {
      onChange([...selectedValues, trimmed]);
      setQuery('');
      setIsOpen(false);
    }
  };

  return (
    <div className="flex flex-col w-full relative" ref={containerRef}>
      <label className="text-[10.5px] font-bold uppercase tracking-[.1em] mb-1.5" style={{ color: 'var(--tk-muted)' }}>{label}</label>
      
      {/* Selector Box */}
      <div 
        className="min-h-[34px] p-1.5 flex flex-wrap gap-1.5 items-center cursor-text text-[12px]" style={{ borderRadius: 9, border: '1px solid var(--tk-border-strong)', background: 'var(--tk-inset)', color: 'var(--tk-text)' }}
        onClick={() => setIsOpen(true)}
      >
        {selectedValues.map(val => (
          <span 
            key={val} 
            className="tk-pill is-active"
          >
            {val}
            <button 
              type="button" 
              onClick={(e) => {
                e.stopPropagation();
                handleRemove(val);
              }}
              className="tk-focusable"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </span>
        ))}
        
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={selectedValues.length === 0 ? placeholder : ''}
          className="flex-1 bg-transparent border-none outline-none min-w-[70px] p-0.5 text-[12px]" style={{ color: 'var(--tk-text)' }}
          onFocus={() => setIsOpen(true)}
        />
        
        <ChevronsUpDown className="w-4 h-4 pointer-events-none me-1" style={{ color: 'var(--tk-muted)' }} />
      </div>

      {/* Dropdown Options */}
      {isOpen && (
        <div className="absolute w-full z-50 max-h-60 overflow-y-auto p-1" style={{ top: 'calc(100% + 4px)', insetInlineStart: 0, borderRadius: 12, border: '1px solid var(--tk-border-strong)', background: 'var(--tk-panel)', boxShadow: '0 22px 50px rgba(0,0,0,.35)' }}>
          {filteredOptions.length > 0 ? (
            filteredOptions.map(option => (
              <button
                key={option}
                type="button"
                onClick={() => handleSelect(option)}
                className="w-full text-start px-3 py-2 rounded-lg text-[12px] flex items-center justify-between tk-focusable" style={{ color: 'var(--tk-text)' }}
              >
                <span>{option}</span>
              </button>
            ))
          ) : (
            query.trim() === '' && (
              <div className="px-3 py-2 text-[11.5px] text-center" style={{ color: 'var(--tk-muted)' }}>{t('noOptionsAvailable')}</div>
            )
          )}

          {query.trim() !== '' && !options.includes(query.trim()) && !selectedValues.includes(query.trim()) && (
            <button
              type="button"
              onClick={handleAddCustom}
              className="w-full text-start px-3 py-2 rounded-lg text-[12px] flex items-center justify-between mt-1 tk-focusable" style={{ color: 'var(--tk-accent-text)', borderTop: '1px solid var(--tk-border)' }}
            >
              <span>{t('addCustomOption', { value: query })}</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};
export default MultiSelectFilter;
