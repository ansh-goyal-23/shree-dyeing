import React, { useState, useEffect } from 'react';

interface DecimalInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value' | 'type'> {
  value: number;
  onValueChange: (value: number) => void;
  step?: string;
}

/**
 * A number input that preserves intermediate decimal strings like "0.", "0.0", ".05"
 * so the user can type without the input auto-clearing or rounding.
 */
const DecimalInput: React.FC<DecimalInputProps> = ({ value, onValueChange, step = '0.001', ...rest }) => {
  const [display, setDisplay] = useState<string>(value ? String(value) : '');

  // Sync display when value changes externally (not during user typing)
  useEffect(() => {
    setDisplay(prev => {
      const parsed = prev === '' ? 0 : parseFloat(prev);
      // Only update display if the numeric value actually changed
      if (!isNaN(parsed) && parsed === value) return prev;
      return value ? String(value) : '';
    });
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setDisplay(raw);

    if (raw === '' || raw === '.' || raw === '0.') {
      onValueChange(0);
      return;
    }

    const num = parseFloat(raw);
    if (!isNaN(num)) {
      onValueChange(num);
    }
  };

  return (
    <input
      type="number"
      step={step}
      value={display}
      onChange={handleChange}
      {...rest}
    />
  );
};

export default DecimalInput;
