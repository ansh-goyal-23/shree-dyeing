import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLotsForFG, useCreateFGReceipt, useStoreRacks } from '@/hooks/useStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PackageCheck, Save, Check, ChevronsUpDown } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const FinishedGoodsReceive: React.FC = () => {
  const navigate = useNavigate();
  const { data: lots = [], isLoading: lotsLoading } = useLotsForFG();
  const createFG = useCreateFGReceipt();
  const { data: racks = [] } = useStoreRacks();

  const today = new Date().toISOString().slice(0, 10);
  const [open, setOpen] = useState(false);
  const [selectedLotNo, setSelectedLotNo] = useState<string>('');
  const [form, setForm] = useState({
    receipt_date: today,
    lot_no: '',
    shade_number: '',
    cone_count: '',
    gross_weight: '',
    rack_id: '',
  });

  const selectedLot = useMemo(
    () => (lots as any[]).find(l => l.lot_no === selectedLotNo),
    [lots, selectedLotNo],
  );

  const pickLot = (lotNo: string) => {
    const l = (lots as any[]).find(x => x.lot_no === lotNo);
    setSelectedLotNo(lotNo);
    setOpen(false);
    if (l) {
      setForm(f => ({
        ...f,
        lot_no: l.lot_no || '',
        shade_number: l.shade_number || l.color_name || '',
        cone_count: l.cone_count != null ? String(l.cone_count) : f.cone_count,
        gross_weight: l.net_weight != null ? String(l.net_weight) : f.gross_weight,
      }));
    }
  };

  const handleSave = async () => {
    if (!selectedLotNo) { toast.error('Select a lot'); return; }
    const lotNo = form.lot_no.trim();
    if (!lotNo) { toast.error('Lot No is required'); return; }
    const gw = parseFloat(form.gross_weight);
    if (!(gw > 0)) { toast.error('Enter a valid gross weight'); return; }
    const cones = form.cone_count ? parseInt(form.cone_count, 10) : null;
    try {
      const r = await createFG.mutateAsync({
        receipt_date: form.receipt_date,
        lot_no: lotNo,
        shade: form.shade_number || null,
        gross_weight: gw,
        cone_count: cones,
        rack_id: form.rack_id || null,
      });
      toast.success(`Receipt ${r.receipt_number} saved — finished goods stock updated`);
      navigate('/store/finished-goods');
    } catch (e: any) {
      toast.error(e.message || 'Failed to receive lot');
    }
  };

  return (
    <div className="p-6 space-y-4 max-w-4xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <PackageCheck className="h-6 w-6" /> Receive Finished Lot
        </h1>
        <Button variant="outline" onClick={() => navigate('/store/finished-goods')}>Back</Button>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Lot Selection</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>Search & Select Lot *</Label>
            <Popover open={open} onOpenChange={setOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  className="w-full justify-between font-normal"
                >
                  {selectedLotNo
                    ? `${selectedLotNo}${selectedLot?.color_name ? ` — ${selectedLot.color_name}` : ''}`
                    : (lotsLoading ? 'Loading lots…' : 'Search by lot no, shade, client…')}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <Command
                  filter={(value, search) => value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0}
                >
                  <CommandInput placeholder="Search lots…" />
                  <CommandList>
                    <CommandEmpty>
                      {(lots as any[]).length === 0
                        ? 'No eligible lots — all have already been received or none exist.'
                        : 'No matches.'}
                    </CommandEmpty>
                    <CommandGroup>
                      {(lots as any[]).map(l => {
                        const label = `${l.lot_no} ${l.color_name || ''} ${l.yarn_company_name || ''} ${l.denier || ''}`;
                        return (
                          <CommandItem key={l.lot_no} value={label} onSelect={() => pickLot(l.lot_no)}>
                            <Check className={cn('mr-2 h-4 w-4', selectedLotNo === l.lot_no ? 'opacity-100' : 'opacity-0')} />
                            <div className="flex flex-col">
                              <span className="font-medium">{l.lot_no}</span>
                              <span className="text-xs text-muted-foreground">
                                {l.color_name || '—'} · {l.yarn_company_name || '—'} · {l.denier || '—'} · {Number(l.net_weight || 0).toFixed(3)} kg · {l.status}
                              </span>
                            </div>
                          </CommandItem>
                        );
                      })}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            <p className="text-xs text-muted-foreground mt-1">
              Pre-fills the entry fields below. All values remain editable.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Entry Details</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <Label>Date *</Label>
            <Input
              type="date"
              value={form.receipt_date}
              onChange={(e) => setForm(f => ({ ...f, receipt_date: e.target.value }))}
            />
          </div>
          <div>
            <Label>Lot # *</Label>
            <Input
              value={form.lot_no}
              onChange={(e) => setForm(f => ({ ...f, lot_no: e.target.value }))}
            />
          </div>
          <div>
            <Label>Shade #</Label>
            <Input
              value={form.shade_number}
              onChange={(e) => setForm(f => ({ ...f, shade_number: e.target.value }))}
            />
          </div>
          <div>
            <Label>Gross Weight (kg) *</Label>
            <Input
              type="number" step="any"
              value={form.gross_weight}
              onChange={(e) => setForm(f => ({ ...f, gross_weight: e.target.value }))}
            />
          </div>
          <div>
            <Label>No. of Cones</Label>
            <Input
              type="number" min="0" step="1"
              value={form.cone_count}
              onChange={(e) => setForm(f => ({ ...f, cone_count: e.target.value }))}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => navigate('/store/finished-goods')}>Cancel</Button>
        <Button onClick={handleSave} disabled={createFG.isPending}>
          <Save className="h-4 w-4 mr-1" />
          {createFG.isPending ? 'Saving…' : 'Receive Lot'}
        </Button>
      </div>
    </div>
  );
};

export default FinishedGoodsReceive;
