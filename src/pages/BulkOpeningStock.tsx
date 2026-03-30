import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, Upload, CheckCircle2, XCircle, FileUp, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface CsvRow {
  item_name: string;
  category: string;
  expense_type: string;
  unit: string;
  item_type: string;
  quantity: number;
  company: string;
  error?: string;
  status?: 'pending' | 'success' | 'error';
}

function parseCsv(text: string): CsvRow[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());

  const reqCols = ['item_name', 'category', 'expense_type', 'unit', 'item_type', 'quantity'];
  const missing = reqCols.filter(c => !headers.includes(c));
  if (missing.length > 0) throw new Error(`Missing columns: ${missing.join(', ')}`);

  const hasCompany = headers.includes('company');

  return lines.slice(1).filter(l => l.trim()).map((line, idx) => {
    const values = line.split(',').map(v => v.trim());
    const get = (col: string) => values[headers.indexOf(col)] || '';
    const qty = parseFloat(get('quantity'));
    const row: CsvRow = {
      item_name: get('item_name'),
      category: get('category'),
      expense_type: get('expense_type') || 'Purchase',
      unit: get('unit'),
      item_type: get('item_type') || 'Consumable',
      quantity: isNaN(qty) ? 0 : qty,
      company: hasCompany ? get('company') : '',
      status: 'pending',
    };
    // Validate
    if (!row.item_name) row.error = 'Item name required';
    else if (row.quantity <= 0) row.error = 'Quantity must be > 0';
    else if (!row.unit) row.error = 'Unit required';
    else if (!['Consumable', 'Asset'].includes(row.item_type)) row.error = 'item_type must be Consumable or Asset';
    else if (!['Purchase', 'Direct Expense', 'Asset'].includes(row.expense_type)) row.error = 'Invalid expense_type';
    return row;
  });
}

const BulkOpeningStock: React.FC = () => {
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<CsvRow[]>([]);
  const [stage, setStage] = useState<'upload' | 'preview' | 'processing' | 'done'>('upload');
  const [results, setResults] = useState<{ success: number; failed: number }>({ success: 0, failed: 0 });

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith('.csv')) {
      toast.error('Only CSV files are allowed');
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = parseCsv(ev.target?.result as string);
        if (parsed.length === 0) { toast.error('No data rows found in CSV'); return; }
        setRows(parsed);
        setStage('preview');
      } catch (err: any) {
        toast.error(err.message || 'Failed to parse CSV');
      }
    };
    reader.readAsText(file);
  };

  const validRows = rows.filter(r => !r.error);
  const errorRows = rows.filter(r => !!r.error);

  const processUpload = async () => {
    setStage('processing');
    let success = 0;
    let failed = 0;
    const today = new Date().toISOString().split('T')[0];
    const updatedRows = [...rows];

    // Cache lookups
    const catCache = new Map<string, string>(); // key: "catName|expType" -> id
    const itemCache = new Map<string, string>(); // key: "itemName|catId|expType" -> id

    for (let i = 0; i < updatedRows.length; i++) {
      const row = updatedRows[i];
      if (row.error) { row.status = 'error'; failed++; continue; }

      try {
        // Step 1: Resolve category
        const catKey = `${row.category.toLowerCase()}|${row.expense_type}`;
        let categoryId: string | null = null;
        if (row.category) {
          if (catCache.has(catKey)) {
            categoryId = catCache.get(catKey)!;
          } else {
            const { data: existing } = await supabase
              .from('expense_categories')
              .select('id')
              .ilike('category_name', row.category)
              .eq('expense_type', row.expense_type)
              .single();
            if (existing) {
              categoryId = existing.id;
            } else {
              const { data: created, error: catErr } = await supabase
                .from('expense_categories')
                .insert({ category_name: row.category, expense_type: row.expense_type })
                .select('id')
                .single();
              if (catErr) throw catErr;
              categoryId = created!.id;
            }
            catCache.set(catKey, categoryId);
          }
        }

        // Step 2: Resolve item
        const itemKey = `${row.item_name.toLowerCase()}|${categoryId || ''}|${row.expense_type}`;
        let itemId: string;
        if (itemCache.has(itemKey)) {
          itemId = itemCache.get(itemKey)!;
        } else {
          let q = supabase
            .from('expense_items')
            .select('id')
            .ilike('item_name', row.item_name)
            .eq('expense_type', row.expense_type);
          if (categoryId) q = q.eq('category_id', categoryId);
          const { data: existingItem } = await q.single();

          if (existingItem) {
            itemId = existingItem.id;
          } else {
            const { data: createdItem, error: itemErr } = await supabase
              .from('expense_items')
              .insert({
                item_name: row.item_name,
                category_id: categoryId,
                expense_type: row.expense_type,
                unit: row.unit,
                item_type: row.item_type,
                is_active: true,
              })
              .select('id')
              .single();
            if (itemErr) throw itemErr;
            itemId = createdItem!.id;
          }
          itemCache.set(itemKey, itemId);
        }

        // Step 3: Create transaction
        const { error: txErr } = await supabase.from('inventory_transactions').insert({
          item_id: itemId,
          type: 'IN',
          source: 'Opening Stock',
          quantity: row.quantity,
          reference_id: '',
          date: today,
          notes: 'Bulk opening stock upload',
        });
        if (txErr) throw txErr;

        // Step 4: Upsert stock
        const { data: existingStock } = await supabase
          .from('inventory_stock')
          .select('*')
          .eq('item_id', itemId)
          .single();

        if (existingStock) {
          await supabase
            .from('inventory_stock')
            .update({
              current_stock: Number(existingStock.current_stock) + row.quantity,
              last_updated: new Date().toISOString(),
            })
            .eq('id', existingStock.id);
        } else {
          await supabase.from('inventory_stock').insert({
            item_id: itemId,
            current_stock: row.quantity,
            unit: row.unit,
            item_type: row.item_type === 'Asset' ? 'Asset' : 'Consumable',
            minimum_stock_level: 0,
          });
        }

        row.status = 'success';
        success++;
      } catch (err: any) {
        row.status = 'error';
        row.error = err?.message || 'Unknown error';
        failed++;
      }
    }

    setRows(updatedRows);
    setResults({ success, failed });
    setStage('done');
  };

  const reset = () => {
    setRows([]);
    setStage('upload');
    setResults({ success: 0, failed: 0 });
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => navigate('/inventory')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-2xl font-bold">Upload Opening Stock (CSV)</h1>
      </div>

      {/* Upload Stage */}
      {stage === 'upload' && (
        <Card>
          <CardHeader><CardTitle>Upload CSV File</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="border-2 border-dashed border-muted-foreground/30 rounded-lg p-8 text-center space-y-4">
              <FileUp className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <div>
                <p className="text-sm text-muted-foreground mb-3">
                  Upload a CSV with columns: <code className="text-xs bg-secondary px-1 py-0.5 rounded">item_name, category, expense_type, unit, item_type, quantity</code>
                </p>
                <input ref={fileRef} type="file" accept=".csv" onChange={handleFile} className="hidden" />
                <Button onClick={() => fileRef.current?.click()} variant="outline">
                  <Upload className="h-4 w-4 mr-2" /> Choose CSV File
                </Button>
              </div>
            </div>
            <div className="bg-secondary/50 rounded-lg p-4">
              <p className="text-sm font-medium mb-2">Example CSV:</p>
              <pre className="text-xs text-muted-foreground whitespace-pre-wrap">
{`item_name,category,expense_type,unit,item_type,quantity
YC4G,Dyes,Purchase,gm,Consumable,5000
Caustic,Chemicals,Purchase,kg,Consumable,25
Paper Tubes,Packing,Purchase,piece,Consumable,1000`}
              </pre>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Preview Stage */}
      {stage === 'preview' && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Preview ({rows.length} rows)</CardTitle>
              <div className="flex gap-2">
                {errorRows.length > 0 && (
                  <Badge variant="destructive">{errorRows.length} errors</Badge>
                )}
                <Badge variant="default">{validRows.length} valid</Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-[400px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Item Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Expense Type</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead>Item Type</TableHead>
                    <TableHead className="text-right">Quantity</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row, idx) => (
                    <TableRow key={idx} className={row.error ? 'bg-destructive/10' : ''}>
                      <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                      <TableCell className="font-medium">{row.item_name || '—'}</TableCell>
                      <TableCell>{row.category || '—'}</TableCell>
                      <TableCell>{row.expense_type}</TableCell>
                      <TableCell>{row.unit || '—'}</TableCell>
                      <TableCell>{row.item_type}</TableCell>
                      <TableCell className="text-right">{row.quantity}</TableCell>
                      <TableCell>
                        {row.error ? (
                          <span className="text-destructive text-xs flex items-center gap-1">
                            <XCircle className="h-3 w-3" /> {row.error}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">Ready</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Processing Stage */}
      {stage === 'processing' && (
        <Card>
          <CardContent className="py-12 text-center space-y-3">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto" />
            <p className="text-muted-foreground">Processing rows...</p>
          </CardContent>
        </Card>
      )}

      {/* Done Stage */}
      {stage === 'done' && (
        <Card>
          <CardHeader><CardTitle>Upload Complete</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-4">
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="h-5 w-5 text-primary" />
                <span className="font-medium">{results.success} successful</span>
              </div>
              {results.failed > 0 && (
                <div className="flex items-center gap-2 text-sm">
                  <XCircle className="h-5 w-5 text-destructive" />
                  <span className="font-medium">{results.failed} failed</span>
                </div>
              )}
            </div>

            {results.failed > 0 && (
              <div className="max-h-[300px] overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>Item</TableHead>
                      <TableHead>Error</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.filter(r => r.status === 'error').map((row, idx) => (
                      <TableRow key={idx}>
                        <TableCell>{rows.indexOf(row) + 1}</TableCell>
                        <TableCell>{row.item_name || '—'}</TableCell>
                        <TableCell className="text-destructive text-xs">{row.error}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        {stage === 'preview' && (
          <>
            <Button onClick={processUpload} disabled={validRows.length === 0}>
              <CheckCircle2 className="h-4 w-4 mr-2" /> Confirm & Upload ({validRows.length} items)
            </Button>
            <Button variant="outline" onClick={reset}>Cancel</Button>
          </>
        )}
        {stage === 'done' && (
          <>
            <Button onClick={() => navigate('/inventory')}>Go to Inventory</Button>
            <Button variant="outline" onClick={reset}>Upload Another</Button>
          </>
        )}
      </div>
    </div>
  );
};

export default BulkOpeningStock;
