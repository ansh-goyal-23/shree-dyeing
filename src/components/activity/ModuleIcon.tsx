import React from 'react';
import {
  Palette, Truck, DollarSign, ClipboardList, Warehouse, Users, Activity, LogIn, Wrench, Package, Box,
} from 'lucide-react';

const map: Record<string, React.ComponentType<{ className?: string }>> = {
  auth: LogIn,
  user: Users,
  admin: Users,
  shade: Palette,
  lot: Palette,
  recipe: Palette,
  sampling: ClipboardList,
  dispatch: Truck,
  challan: Truck,
  expense: DollarSign,
  store: Warehouse,
  inventory: Warehouse,
  asset: Wrench,
  item: Package,
  fg: Box,
  edy: Box,
  system: Activity,
};

export const ModuleIcon: React.FC<{ module: string; className?: string }> = ({ module, className = 'h-4 w-4' }) => {
  const key = (module || '').toLowerCase();
  const Comp = map[key] || Activity;
  return <Comp className={className} />;
};

export default ModuleIcon;
