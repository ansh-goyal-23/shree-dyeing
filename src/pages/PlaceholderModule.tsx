import React from 'react';
import { Construction } from 'lucide-react';
import { useLocation } from 'react-router-dom';

const moduleNames: Record<string, string> = {
  '/production': 'Production',
  '/expenses': 'Expenses',
  '/dispatch': 'Dispatch',
};

const PlaceholderModule: React.FC = () => {
  const location = useLocation();
  const name = moduleNames[location.pathname] || 'Module';

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-4">
      <Construction className="w-16 h-16 text-muted-foreground" />
      <h1 className="text-2xl font-semibold tracking-tight">{name}</h1>
      <p className="text-muted-foreground">This module will be added in future.</p>
    </div>
  );
};

export default PlaceholderModule;
