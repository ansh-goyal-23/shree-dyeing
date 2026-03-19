import React, { useState, useRef, useEffect, useMemo } from 'react';

interface Props {
  value: string;
  onChange: (value: string) => void;
  suggestions: string[];
  placeholder?: string;
  className?: string;
}

const LotFieldAutocomplete: React.FC<Props> = ({ value, onChange, suggestions, placeholder, className }) => {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const unique = useMemo(() => {
    const map = new Map<string, string>();
    suggestions.forEach(s => {
      const trimmed = s.trim();
      if (trimmed && !map.has(trimmed.toLowerCase())) map.set(trimmed.toLowerCase(), trimmed);
    });
    return Array.from(map.values()).sort();
  }, [suggestions]);

  const filtered = useMemo(() => {
    if (!value.trim()) return unique;
    const lower = value.toLowerCase().trim();
    return unique.filter(s => s.toLowerCase().includes(lower));
  }, [unique, value]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false);
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
        onFocus={() => setOpen(true)}
        className={className || 'input-industrial w-full'}
        placeholder={placeholder}
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 max-h-40 overflow-y-auto rounded-md border bg-popover text-popover-foreground shadow-md">
          {filtered.map(s => (
            <button
              key={s}
              type="button"
              onMouseDown={e => e.preventDefault()}
              onClick={() => { onChange(s); setOpen(false); }}
              className="w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground btn-transition"
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default LotFieldAutocomplete;
