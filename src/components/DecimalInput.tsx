import React, { useState, useEffect } from 'react';

interface DecimalInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  value: number;
  onValueChange: (val: number) => void;
  decimalPlaces?: number;
}

/**
 * A number input that properly handles decimal entry like .05, 0.0, etc.
 * Uses string state internally to avoid clearing partial decimal inputs.
 */
const DecimalInput: React.FC<DecimalInputProps> = ({
  value,
  onValueChange,
  decimalPlaces,
  className = '',
  ...props
}) => {
  const [displayValue, setDisplayValue] = useState(value ? String(value) : '');

  // Sync from parent only when the parsed value actually differs
  useEffect(() => {
    const parsed = parseFloat(displayValue);
    if (isNaN(parsed) && value === 0) return;
    if (parsed !== value) {
      setDisplayValue(value ? String(value) : '');
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setDisplayValue(raw);
    const parsed = parseFloat(raw);
    if (!isNaN(parsed)) {
      onValueChange(parsed);
    } else if (raw === '' || raw === '-') {
      onValueChange(0);
    }
  };

  const handleBlur = () => {
    // Clean up display on blur
    if (displayValue === '' || displayValue === '.' || displayValue === '-') {
      setDisplayValue(value ? String(value) : '');
    }
  };

  return (
    <input
      type="number"
      step="any"
      value={displayValue}
      onChange={handleChange}
      onBlur={handleBlur}
      className={className}
      {...props}
    />
  );
};

export default DecimalInput;
