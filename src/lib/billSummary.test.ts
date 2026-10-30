import { describe, it, expect } from 'vitest';
import { buildBill } from './billSummary';

const nums = new Map([['c1', 'CH-1'], ['c2', 'CH-2']]);

describe('buildBill with "other item" lines', () => {
  it('keeps yarn lines rolled up and adds each other item as its own line (no qty / rate)', () => {
    const bill = buildBill(
      [
        { challan_id: 'c1', denier: '150/0', net_weight: 10, rate: 250, amount: 2500 },
        { challan_id: 'c2', denier: '150/0', net_weight: 5, rate: 250, amount: 1250 },
        { challan_id: 'c2', is_custom: true, description: 'Spare gears x2', amount: 800, net_weight: 0, rate: 0 },
        { challan_id: 'c1', is_custom: true, description: 'Raw material (nylon 70D)', amount: 400 },
      ],
      [],
      nums,
    );
    expect(bill.lines.map(l => l.item)).toEqual([
      'Polyester Yarn — 150/0 Dyed Yarn',
      'Raw material (nylon 70D)',
      'Spare gears x2',
    ]);
    const [yarn, raw, gears] = bill.lines;
    expect(yarn.qty).toBe(15);
    expect(yarn.amount).toBe(3750);
    expect(raw).toMatchObject({ line: 2, qty: null, rate: null, amount: 400, challans: ['CH-1'] });
    expect(gears).toMatchObject({ line: 3, qty: null, rate: null, amount: 800, challans: ['CH-2'] });
    expect(bill.totalQty).toBe(15); // other items add money, not kg
    expect(bill.subtotal).toBe(4950);
  });

  it('a challan with only other items still bills, with no yarn line and zero kg', () => {
    const bill = buildBill(
      [{ challan_id: 'c1', is_custom: true, description: 'Dyeing tool kit', amount: 1500 }],
      [],
      nums,
    );
    expect(bill.lines).toHaveLength(1);
    expect(bill.totalQty).toBe(0);
    expect(bill.subtotal).toBe(1500);
  });

  it('puts the cone surcharge line after the other items', () => {
    const bill = buildBill(
      [
        { challan_id: 'c1', denier: '75/0', net_weight: 4, rate: 100, amount: 400, paper_tube_surcharge: 20 },
        { challan_id: 'c1', is_custom: true, description: 'Tool', amount: 50 },
      ],
      [],
      nums,
    );
    expect(bill.lines.map(l => l.item)).toEqual([
      'Polyester Yarn — 75/0 Dyed Yarn',
      'Tool',
      'Paper tube extra cone surcharge',
    ]);
    expect(bill.subtotal).toBe(470);
  });
});
