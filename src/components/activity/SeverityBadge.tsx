import React from 'react';
import { cn } from '@/lib/utils';

const map: Record<string, string> = {
  information: 'bg-blue-100 text-blue-800 border-blue-200',
  info: 'bg-blue-100 text-blue-800 border-blue-200',
  success: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  warning: 'bg-orange-100 text-orange-800 border-orange-200',
  error: 'bg-red-100 text-red-800 border-red-200',
  critical: 'bg-red-900 text-red-50 border-red-900',
};

export const SeverityBadge: React.FC<{ severity: string; className?: string }> = ({ severity, className }) => {
  const cls = map[severity.toLowerCase()] || map.info;
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border', cls, className)}>
      {severity}
    </span>
  );
};

export default SeverityBadge;
