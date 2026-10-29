import type { PackagingType } from '@/types/challan';

const CHESSE_WEIGHT = 0.180;

/** Weight of the packaging per unit (tube or chesse), deducted from gross to get net on a challan. */
export const PACKAGING_DEDUCTION_KG: Record<PackagingType, number> = {
  paper_tube: 0.12,
  chesse: 0.18,
};

/** Net weight on a dispatch/return challan line: gross minus packaging weight per unit. */
export const calculateChallanNet = (gross: number, units: number, type: PackagingType): number =>
  parseFloat((gross - PACKAGING_DEDUCTION_KG[type] * units).toFixed(3));

export const calculateNetWeight = (gross: number, count: number): number => {
  return parseFloat((gross - count * CHESSE_WEIGHT).toFixed(3));
};

export const calculateDyeGrams = (percentage: number, netWeight: number): number => {
  return parseFloat(((percentage / 100) * netWeight * 1000).toFixed(3));
};
