export type OrderStatus = 'Open' | 'Partially Sent' | 'Fulfilled' | 'Cancelled';

export interface Order {
  id: string;
  client_name: string;
  poc: string;
  order_date: string;
  color_name: string;
  yarn_type: string;
  sample_type: string;
  shade_no: string;
  order_qty: number;
  uom: string;
  notes: string;
  is_cancelled: boolean;
  created_at: string;
  updated_at: string;
  created_by?: string | null;
}

// Row shape returned by the `orders_with_status` view: the base Order columns
// plus the live-calculated qty_sent / balance_qty / status. Qty Sent and
// Balance Qty are NEVER stored -- they're computed from matching challan_items
// every time this view is queried (see sql_migrations/20260926_orders.sql and
// its staging companion), the same "derived, never stored" pattern already
// used for Store's current-stock views.
export interface OrderWithStatus extends Order {
  qty_sent: number;
  balance_qty: number;
  status: OrderStatus;
}

export interface OrderInput {
  client_name: string;
  poc?: string;
  order_date: string;
  color_name: string;
  yarn_type?: string;
  sample_type?: string;
  shade_no?: string;
  order_qty: number;
  uom?: string;
  notes?: string;
}
