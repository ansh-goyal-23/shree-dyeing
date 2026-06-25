import React from 'react';
import { Link } from 'react-router-dom';
import { useStoreIssueList } from '@/hooks/useStore';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { ArrowUpFromLine, Plus, Pencil } from 'lucide-react';

const StoreIssueList: React.FC = () => {
  const { data: rows = [], isLoading } = useStoreIssueList();

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ArrowUpFromLine className="h-6 w-6" /> Internal Issues
          </h1>
          <p className="text-sm text-muted-foreground">
            Materials issued from store to factory departments. Each entry reduces stock.
          </p>
        </div>
        <Link to="/store/internal-issues/create">
          <Button><Plus className="h-4 w-4 mr-1" /> New Internal Issue</Button>
        </Link>
      </div>

      <Card className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Issue #</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Issued To</TableHead>
              <TableHead>Remarks</TableHead>
              <TableHead className="w-[80px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">Loading…</TableCell></TableRow>
            ) : rows.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">No internal issues yet.</TableCell></TableRow>
            ) : rows.map(r => (
              <TableRow key={r.id}>
                <TableCell className="font-mono text-xs">{r.issue_number}</TableCell>
                <TableCell>{r.issue_date}</TableCell>
                <TableCell>{r.department || '—'}</TableCell>
                <TableCell>{r.issued_to || '—'}</TableCell>
                <TableCell className="max-w-[260px] truncate">{r.remarks || '—'}</TableCell>
                <TableCell>
                  <Link to={`/store/internal-issues/${r.id}/edit`} data-owner-id={r.created_by || undefined}>
                    <Button variant="ghost" size="icon"><Pencil className="h-4 w-4" /></Button>
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
};

export default StoreIssueList;
