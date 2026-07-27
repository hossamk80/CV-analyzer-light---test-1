import React, { useState, useRef, useEffect } from 'react';
import { X, Check, ChevronsUpDown } from 'lucide-react';

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
      <label className="text-xs font-semibold text-text-muted mb-1 px-1">{label}</label>
      
      {/* Selector Box */}
      <div 
        className="min-h-[42px] p-1.5 flex flex-wrap gap-1.5 items-center rounded-xl border border-border-main bg-bg-card text-text-main focus-within:border-brand cursor-text text-sm transition-all"
        onClick={() => setIsOpen(true)}
      >
        {selectedValues.map(val => (
          <span 
            key={val} 
            className="inline-flex items-center gap-1 bg-brand/10 border border-brand/20 text-brand text-xs px-2 py-0.5 rounded-full font-medium"
          >
            {val}
            <button 
              type="button" 
              onClick={(e) => {
                e.stopPropagation();
                handleRemove(val);
              }}
              className="hover:text-brand-hover focus:outline-none"
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
          className="flex-1 bg-transparent border-none outline-none min-w-[80px] p-0.5 text-text-main placeholder-text-muted/60 focus:ring-0"
          onFocus={() => setIsOpen(true)}
        />
        
        <ChevronsUpDown className="w-4 h-4 text-text-muted/60 pointer-events-none mr-1" />
      </div>

      {/* Dropdown Options */}
      {isOpen && (
        <div className="absolute top-[calc(100%+4px)] left-0 w-full bg-bg-card border border-border-main rounded-xl shadow-lg z-50 max-h-60 overflow-y-auto p-1 glass-panel animate-in fade-in slide-in-from-top-1 duration-150">
          {filteredOptions.length > 0 ? (
            filteredOptions.map(option => (
              <button
                key={option}
                type="button"
                onClick={() => handleSelect(option)}
                className="w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-bg-hover hover:text-brand flex items-center justify-between text-text-main"
              >
                <span>{option}</span>
              </button>
            ))
          ) : (
            query.trim() === '' && (
              <div className="px-3 py-2 text-xs text-text-muted text-center">No options available</div>
            )
          )}

          {query.trim() !== '' && !options.includes(query.trim()) && !selectedValues.includes(query.trim()) && (
            <button
              type="button"
              onClick={handleAddCustom}
              className="w-full text-left px-3 py-2 rounded-lg text-sm text-brand hover:bg-brand-light flex items-center justify-between font-medium border-t border-border-main/50 mt-1"
            >
              <span>Add Custom: "{query}"</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};
export default MultiSelectFilter;
