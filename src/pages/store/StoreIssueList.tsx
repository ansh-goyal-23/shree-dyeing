import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useStoreIssueList, useStoreIssueLineDetails } from '@/hooks/useStore';
import { issueTypeLabel } from '@/pages/store/StoreIssueForm';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { ArrowUpFromLine, Plus, Pencil, ChevronDown, ChevronRight } from 'lucide-react';

const IssueLines: React.FC<{ issueNumber: string }> = ({ issueNumber }) => {
  const { data: lines = [], isLoading } = useStoreIssueLineDetails(issueNumber);

  if (isLoading) {
    return <div className="py-3 text-sm text-muted-foreground">Loading items…</div>;
  }
  if (!lines.length) {
    return <div className="py-3 text-sm text-muted-foreground">No line items found.</div>;
  }

  return (
    <div className="rounded-md border border-border bg-muted/30 p-2">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Item Type</TableHead>
            <TableHead>Item</TableHead>
            <TableHead className="text-right">Qty</TableHead>
            <TableHead>Unit</TableHead>
            <TableHead>Rack</TableHead>
            <TableHead>Purpose</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {lines.map(l => (
            <TableRow key={l.id}>
              <TableCell>{issueTypeLabel(l.item_type)}</TableCell>
              <TableCell className="font-medium">{l.item_name}</TableCell>
              <TableCell className="text-right">{Number(l.quantity).toFixed(3)}</TableCell>
              <TableCell>{l.unit}</TableCell>
              <TableCell>{l.rack_code ? `${l.rack_code}${l.rack_name ? ` — ${l.rack_name}` : ''}` : '—'}</TableCell>
              <TableCell>{l.purpose || '—'}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

const StoreIssueList: React.FC = () => {
  const { data: rows = [], isLoading } = useStoreIssueList();
  const [expanded, setExpanded] = useState<string | null>(null);

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
              <TableHead className="w-8"></TableHead>
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
              <TableRow><TableCell colSpan={7} className="text-center py-6 text-muted-foreground">Loading…</TableCell></TableRow>
            ) : rows.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-6 text-muted-foreground">No internal issues yet.</TableCell></TableRow>
            ) : rows.map(r => (
              <React.Fragment key={r.id}>
                <TableRow
                  className="cursor-pointer"
                  onClick={() => setExpanded(e => (e === r.issue_number ? null : r.issue_number))}
                >
                  <TableCell>
                    {expanded === r.issue_number
                      ? <ChevronDown className="h-4 w-4" />
                      : <ChevronRight className="h-4 w-4" />}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{r.issue_number}</TableCell>
                  <TableCell>{r.issue_date}</TableCell>
                  <TableCell>{r.department || '—'}</TableCell>
                  <TableCell>{r.issued_to || '—'}</TableCell>
                  <TableCell className="max-w-[260px] truncate">{r.remarks || '—'}</TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Link to={`/store/internal-issues/${r.id}/edit`} data-owner-id={r.created_by || undefined}>
                      <Button variant="ghost" size="icon"><Pencil className="h-4 w-4" /></Button>
                    </Link>
                  </TableCell>
                </TableRow>
                {expanded === r.issue_number && (
                  <TableRow>
                    <TableCell colSpan={7} className="p-2">
                      <IssueLines issueNumber={r.issue_number} />
                    </TableCell>
                  </TableRow>
                )}
              </React.Fragment>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
};

export default StoreIssueList;
