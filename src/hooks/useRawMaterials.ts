import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { logActivity } from '@/lib/activityLog';
import { logBusinessEvent } from '@/lib/activityCenter';
import type { RawMaterial, RawMaterialCategory } from '@/types/rawMaterial';

const sb = supabase as any;

const mapMaterial = (r: any): RawMaterial => ({
  id: r.id,
  category: r.category,
  brand: r.brand || null,
  supplier: r.supplier || null,
  spec_name: r.spec_name || null,
  denier_count: r.denier_count || null,
  unit: r.unit || 'kg',
  is_active: r.is_active ?? true,
  remarks: r.remarks || null,
  created_at: r.created_at,
  current_quantity: Number(r.current_quantity) || 0,
});

const norm = (v?: string | null) => (v || '').trim().toLowerCase();

export function useRawMaterials(category?: RawMaterialCategory) {
  return useQuery({
    queryKey: ['raw_materials_with_stock', category],
    queryFn: async () => {
      let query = sb.from('raw_materials_with_stock').select('*');
      if (category) query = query.eq('category', category);
      const { data, error } = await query.order('created_at', { ascending: true });
      if (error) throw error;
      return (data || []).map(mapMaterial);
    },
  });
}

export interface AddRawMaterialInput {
  category: RawMaterialCategory;
  brand?: string;
  supplier?: string;
  spec_name?: string;
  denier_count?: string;
  unit: string;
  quantity: number;
  remarks?: string;
}

// Adding a material tops up an existing row (matched on category + brand +
// supplier + spec_name + denier_count, case-insensitive) instead of ever
// creating a duplicate -- the quantity itself is never stored directly,
// only ever added via a transaction row (current_quantity = SUM).
export function useAddRawMaterial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: AddRawMaterialInput) => {
      const { data: candidates, error: findErr } = await sb
        .from('raw_materials')
        .select('*')
        .eq('category', input.category)
        .eq('is_active', true);
      if (findErr) throw findErr;

      const match = (candidates || []).find((m: any) =>
        norm(m.brand) === norm(input.brand) &&
        norm(m.supplier) === norm(input.supplier) &&
        norm(m.spec_name) === norm(input.spec_name) &&
        norm(m.denier_count) === norm(input.denier_count)
      );

      let materialId: string;
      if (match) {
        materialId = match.id;
      } else {
        const { data: created, error: createErr } = await sb
          .from('raw_materials')
          .insert({
            category: input.category,
            brand: input.brand || null,
            supplier: input.supplier || null,
            spec_name: input.spec_name || null,
            denier_count: input.denier_count || null,
            unit: input.unit,
            remarks: input.remarks || null,
          })
          .select()
          .single();
        if (createErr) throw createErr;
        materialId = created.id;
      }

      const { error: txnErr } = await sb.from('raw_material_transactions').insert({
        material_id: materialId,
        transaction_type: 'add',
        quantity: input.quantity,
        remarks: input.remarks || null,
      });
      if (txnErr) throw txnErr;

      const label = [input.brand, input.supplier, input.spec_name, input.denier_count].filter(Boolean).join(' / ') || input.category;
      logActivity({
        action: 'Raw Material Add', referenceType: 'raw_material', referenceId: materialId,
        section: 'Raw Material Stock', itemLabel: label, next: input.quantity, unit: input.unit,
      });
      logBusinessEvent({
        module: 'store', eventType: 'raw_material.add', severity: 'success',
        entityType: 'raw_material', entityId: materialId,
        summary: `Added ${input.quantity} ${input.unit} of ${label}`,
        details: { category: input.category, quantity: input.quantity, unit: input.unit },
      });

      return materialId;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['raw_materials_with_stock'] }),
  });
}

export interface IssueRawMaterialInput {
  material: RawMaterial;
  quantity: number;
  issued_to: string;
  remarks?: string;
}

export function useIssueRawMaterial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: IssueRawMaterialInput) => {
      if (input.quantity <= 0) throw new Error('Quantity must be greater than zero.');

      // Re-check current stock right before issuing to narrow (not fully
      // eliminate) the race window against a concurrent issue.
      const { data: fresh, error: freshErr } = await sb
        .from('raw_materials_with_stock')
        .select('current_quantity')
        .eq('id', input.material.id)
        .single();
      if (freshErr) throw freshErr;
      const available = Number(fresh?.current_quantity) || 0;
      if (input.quantity > available + 0.0001) {
        throw new Error(`Only ${available} ${input.material.unit} available.`);
      }

      const { error } = await sb.from('raw_material_transactions').insert({
        material_id: input.material.id,
        transaction_type: 'issue',
        quantity: -Math.abs(input.quantity),
        issued_to: input.issued_to.trim(),
        remarks: input.remarks || null,
      });
      if (error) throw error;

      const label = [input.material.brand, input.material.supplier, input.material.spec_name, input.material.denier_count]
        .filter(Boolean).join(' / ') || input.material.category;
      logActivity({
        action: 'Raw Material Issue', referenceType: 'raw_material', referenceId: input.material.id,
        section: 'Raw Material Stock', itemLabel: label,
        prev: available, next: available - input.quantity, unit: input.material.unit,
      });
      logBusinessEvent({
        module: 'store', eventType: 'raw_material.issue', severity: 'info',
        entityType: 'raw_material', entityId: input.material.id,
        summary: `Issued ${input.quantity} ${input.material.unit} of ${label} to ${input.issued_to.trim()}`,
        details: { category: input.material.category, quantity: input.quantity, issued_to: input.issued_to.trim() },
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['raw_materials_with_stock'] }),
  });
}
