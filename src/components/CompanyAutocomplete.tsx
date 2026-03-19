import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useApp } from '@/context/AppContext';

interface Props {
  value: string;
  onChange: (value: string) => void;
}

const CompanyAutocomplete: React.FC<Props> = ({ value, onChange }) => {
  const { masterItems } = useApp();
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const companies = useMemo(() => {
    const set = new Set<string>();
    masterItems.forEach(m => { if (m.company.trim()) set.add(m.company.trim()); });
    return Array.from(set).sort();
  }, [masterItems]);

  const filtered = useMemo(() => {
    if (!value.trim()) return companies;
    const lower = value.toLowerCase();
    return companies.filter(c => c.toLowerCase().includes(lower));
  }, [companies, value]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={wrapperRef} className="relative">
      <input
        type="text"
        value={value}
        onChange={e => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => { setFocused(true); setOpen(true); }}
        onBlur={() => setFocused(false)}
        className="input-industrial w-full"
        placeholder="Type or select company"
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 max-h-40 overflow-y-auto rounded-md border bg-popover text-popover-foreground shadow-md">
          {filtered.map(c => (
            <button
              key={c}
              type="button"
              onMouseDown={e => e.preventDefault()}
              onClick={() => { onChange(c); setOpen(false); }}
              className="w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground btn-transition"
            >
              {c}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default CompanyAutocomplete;
