import { describe, it, expect } from 'vitest';
import { prepareLines, lineHasContent, customLineError } from './challanLines';

type Row = Record<string, unknown>;
const product = (o: Row = {}) => ({ lot_no: '123', amount: 100, net_weight: 5, ...o });
const custom = (o: Row = {}) => ({ is_custom: true, lot_no: '', description: '', amount: 0, ...o });

describe('challan lines (product vs other item)', () => {
  it('keeps product rows with a lot and drops blank ones', () => {
    expect(lineHasContent(product())).toBe(true);
    expect(lineHasContent({ lot_no: '' })).toBe(false);
  });

  it('keeps an other-item row with a description or an amount, drops a fully blank one', () => {
    expect(lineHasContent(custom({ description: 'Scissors' }))).toBe(true);
    expect(lineHasContent(custom({ amount: 50 }))).toBe(true);
    expect(lineHasContent(custom())).toBe(false);
  });

  it('rejects an amount with no description, and a negative amount', () => {
    expect(customLineError([custom({ amount: 50 })])).toMatch(/no description/);
    expect(customLineError([custom({ description: 'Tool', amount: -1 })])).toMatch(/negative/);
    expect(customLineError([custom({ description: 'Tool', amount: 0 })])).toBeNull();
    expect(customLineError([custom({ description: 'Tool', amount: 250 })])).toBeNull();
  });

  it('prepareLines blanks weights/lot on other items so they cannot affect kg or stock', () => {
    const { lines, error } = prepareLines([
      product(),
      custom({ description: '  Spare gears x2  ', amount: 1250.456, lot_no: '999', net_weight: 3, rate: 7, num_of_units: 4 }),
      custom(),
      { lot_no: '' },
    ]);
    expect(error).toBeNull();
    expect(lines).toHaveLength(2);
    const c = lines[1] as Row;
    expect(c.is_custom).toBe(true);
    expect(c.description).toBe('Spare gears x2');
    expect(c.amount).toBe(1250.46);
    expect(c.lot_no).toBe('');
    expect(c.net_weight).toBe(0);
    expect(c.rate).toBe(0);
    expect(c.num_of_units).toBe(0);
    expect(lines[0]).toEqual(product());
  });

  it('reports the error when an amount has no description', () => {
    expect(prepareLines([product(), custom({ amount: 10 })]).error).toMatch(/no description/);
  });
});
