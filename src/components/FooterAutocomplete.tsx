import React, { useState, useRef, useEffect, useMemo } from 'react';

interface Props {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
  onSelect?: (value: string) => void;
}

const FooterAutocomplete: React.FC<Props> = ({ value, onChange, options, placeholder, onSelect }) => {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    if (!value.trim()) return options;
    const lower = value.toLowerCase();
    return options.filter(o => o.toLowerCase().includes(lower));
  }, [options, value]);

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
        onFocus={() => setOpen(true)}
        className="input-industrial w-full"
        placeholder={placeholder}
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 max-h-40 overflow-y-auto rounded-md border bg-popover text-popover-foreground shadow-md">
          {filtered.map(o => (
            <button
              key={o}
              type="button"
              onMouseDown={e => e.preventDefault()}
              onClick={() => {
                onChange(o);
                onSelect?.(o);
                setOpen(false);
              }}
              className="w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground btn-transition"
            >
              {o}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default FooterAutocomplete;
