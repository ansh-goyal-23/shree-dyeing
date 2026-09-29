export type RawMaterialCategory = 'grey_yarn' | 'chemical' | 'color' | 'packing_polythene' | 'oil';

export const RAW_MATERIAL_CATEGORIES: { value: RawMaterialCategory; label: string }[] = [
  { value: 'grey_yarn', label: 'Grey Yarn' },
  { value: 'chemical', label: 'Chemical' },
  { value: 'color', label: 'Color' },
  { value: 'packing_polythene', label: 'Packing Polythene' },
  { value: 'oil', label: 'Oil' },
];

export const RAW_MATERIAL_CATEGORY_LABEL: Record<RawMaterialCategory, string> =
  Object.fromEntries(RAW_MATERIAL_CATEGORIES.map(c => [c.value, c.label])) as Record<RawMaterialCategory, string>;

/** Which structured fields apply to a category, and what to call them in the UI. */
export const RAW_MATERIAL_FIELDS: Record<RawMaterialCategory, {
  brand?: string; supplier?: string; spec_name?: string; denier_count?: string; defaultUnit: string;
}> = {
  grey_yarn: { brand: 'Brand', spec_name: 'Yarn Type', denier_count: 'Denier/Count', defaultUnit: 'kg' },
  chemical: { brand: 'Brand', spec_name: 'Chemical Name', defaultUnit: 'kg' },
  color: { brand: 'Brand', spec_name: 'Color Name', defaultUnit: 'kg' },
  packing_polythene: { spec_name: 'Size Type', defaultUnit: 'pcs' },
  oil: { supplier: 'Supplier', defaultUnit: 'ltr' },
};

export interface RawMaterial {
  id: string;
  category: RawMaterialCategory;
  brand: string | null;
  supplier: string | null;
  spec_name: string | null;
  denier_count: string | null;
  unit: string;
  is_active: boolean;
  remarks: string | null;
  created_at: string;
  current_quantity: number;
}

export type RawMaterialTxnType = 'add' | 'issue';

export interface RawMaterialTransaction {
  id: string;
  material_id: string;
  transaction_type: RawMaterialTxnType;
  quantity: number;
  issued_to: string | null;
  remarks: string | null;
  created_at: string;
  created_by: string | null;
}
