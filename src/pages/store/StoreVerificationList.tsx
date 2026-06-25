import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  useVerificationSessions,
  useCreateVerificationSession,
  STORE_CATEGORIES,
} from '@/hooks/useStore';
import type { StoreItemCategory } from '@/types/store';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { ClipboardCheck, Plus, Eye } from 'lucide-react';
import { toast } from 'sonner';


const statusVariant = (s: string) =>
  s === 'approved' ? 'default' : s === 'cancelled' ? 'destructive' : 'secondary';

const StoreVerificationList: React.FC = () => {
  const { data: sessions = [], isLoading } = useVerificationSessions();
  const create = useCreateVerificationSession();
  const navigate = useNavigate();

  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [title, setTitle] = useState('');
  const [remarks, setRemarks] = useState('');
  const [cats, setCats] = useState<StoreItemCategory[]>([]);

  const toggleCat = (c: StoreItemCategory) =>
    setCats(cs => cs.includes(c) ? cs.filter(x => x !== c) : [...cs, c]);

  const submit = async () => {
    try {
      const s = await create.mutateAsync({
        session_date: date,
        title: title || null,
        remarks: remarks || null,
        categories: cats.length ? cats : null,
      });
      toast.success(`Session ${s.session_number} created`);
      setOpen(false);
      setTitle(''); setRemarks(''); setCats([]);
      navigate(`/store/stock-verification/${s.id}`);
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to create session');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ClipboardCheck className="h-6 w-6" /> Stock Verification
          </h1>
          <p className="text-sm text-muted-foreground">
            Physical stock counting sessions. Approval creates stock adjustment transactions.
          </p>
        </div>
        <WriteGuard>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" /> New Session</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>New Verification Session</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Session Date</Label>
                  <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
                </div>
                <div>
                  <Label>Title (optional)</Label>
                  <Input
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    placeholder="e.g. June 2026 — Raw Materials"
                  />
                </div>
                <div>
                  <Label>Limit to Categories (optional)</Label>
                  <div className="grid grid-cols-2 gap-2 pt-2">
                    {STORE_CATEGORIES.map(c => (
                      <label key={c.value} className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={cats.includes(c.value)}
                          onCheckedChange={() => toggleCat(c.value)}
                        />
                        {c.label}
                      </label>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Empty = snapshot all active items.
                  </p>
                </div>
                <div>
                  <Label>Remarks</Label>
                  <Textarea value={remarks} onChange={e => setRemarks(e.target.value)} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button onClick={submit} disabled={create.isPending}>
                  {create.isPending ? 'Creating...' : 'Create & Snapshot Stock'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </WriteGuard>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Session #</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Adjustments</TableHead>
                <TableHead className="w-[80px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-6">Loading...</TableCell></TableRow>
              ) : sessions.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">No sessions yet.</TableCell></TableRow>
              ) : sessions.map(s => (
                <TableRow key={s.id}>
                  <TableCell className="font-mono">{s.session_number}</TableCell>
                  <TableCell>{s.session_date}</TableCell>
                  <TableCell>{s.title || '-'}</TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(s.status) as any}>{s.status}</Badge>
                  </TableCell>
                  <TableCell className="text-right">{s.adjustment_count}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" asChild>
                      <Link to={`/store/stock-verification/${s.id}`}>
                        <Eye className="h-4 w-4" />
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default StoreVerificationList;
