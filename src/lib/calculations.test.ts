import { describe, it, expect } from 'vitest';
import { calculateChallanNet, PACKAGING_DEDUCTION_KG } from './calculations';

describe('calculateChallanNet (gross -> net on a challan line)', () => {
  it('deducts 0.12 kg per paper tube', () => {
    expect(PACKAGING_DEDUCTION_KG.paper_tube).toBe(0.12);
    expect(calculateChallanNet(10, 5, 'paper_tube')).toBe(9.4);
  });

  it('deducts 0.18 kg per chesse', () => {
    expect(PACKAGING_DEDUCTION_KG.chesse).toBe(0.18);
    expect(calculateChallanNet(10, 5, 'chesse')).toBe(9.1);
  });

  it('rounds to 3 decimals and can go below zero when gross is less than the packaging', () => {
    expect(calculateChallanNet(7.23, 7, 'paper_tube')).toBe(6.39);
    expect(calculateChallanNet(0.5, 7, 'paper_tube')).toBeLessThan(0);
  });
});
