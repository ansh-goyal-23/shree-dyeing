import { generateChallanPdfBlob } from '@/lib/challanPdf';
import type { Challan, ChallanItem } from '@/types/challan';
import { writeFile } from 'fs/promises';
import { test, expect } from 'vitest';

test('generate challan pdf for visual qa', async () => {
  const challan: Challan = {
    id: 'test',
    challan_number: 'CHL-001',
    date: '2026-08-01',
    client_name: 'Test Client',
    client_id: 'client1',
    notes: 'Test notes line one. Test notes line two.',
    prepared_by_name: 'Admin User',
    receiver_name: 'Receiver Person',
    receiver_contact_number: '9876543210',
    created_at: '2026-08-01T10:00:00Z',
    challan_kind: 'production',
  };

  const items: ChallanItem[] = [
    {
      id: 'item1',
      challan_id: 'test',
      lot_no: 'LOT-001',
      ref_no: 'REF-001',
      shade_number: '168',
      color_name: 'Red',
      denier: '75/36',
      lot_type: 'Production',
      packaging_type: 'chesse',
      num_of_units: 25,
      gross_weight: 55.25,
      net_weight: 50.5,
      rate: 12.5,
      amount: 631.25,
    },
    {
      id: 'item2',
      challan_id: 'test',
      lot_no: 'LOT-002',
      ref_no: 'REF-002',
      shade_number: '450',
      color_name: 'Blue',
      denier: '150/48',
      lot_type: 'Sampling',
      packaging_type: 'paper_tube',
      num_of_units: 25,
      gross_weight: 55.25,
      net_weight: 50,
      rate: 12.5,
      amount: 625,
    },
  ];

  const blob = generateChallanPdfBlob(challan, items);
  const buffer = Buffer.isBuffer(blob) ? blob : Buffer.from(await blob.arrayBuffer());
  await writeFile('/tmp/browser/challan.pdf', buffer);

  expect(buffer.length).toBeGreaterThan(0);
});
