const CHESSE_WEIGHT = 0.160;

export const calculateNetWeight = (gross: number, count: number): number => {
  return parseFloat((gross - count * CHESSE_WEIGHT).toFixed(3));
};

export const calculateDyeGrams = (percentage: number, netWeight: number): number => {
  return parseFloat(((percentage / 100) * netWeight * 1000).toFixed(3));
};
