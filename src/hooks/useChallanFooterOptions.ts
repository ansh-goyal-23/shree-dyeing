import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface ReceiverEntry {
  name: string;
  contact: string;
}

export function useChallanFooterOptions() {
  return useQuery({
    queryKey: ['challan_footer_options'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('challans')
        .select('prepared_by_name, receiver_name, receiver_contact_number');
      if (error) throw error;

      const preparedBySet = new Set<string>();
      const receiverMap = new Map<string, string>();

      (data || []).forEach((r: any) => {
        if (r.prepared_by_name?.trim()) preparedBySet.add(r.prepared_by_name.trim());
        if (r.receiver_name?.trim()) {
          // Keep the latest contact for each receiver name
          const name = r.receiver_name.trim();
          if (!receiverMap.has(name) || r.receiver_contact_number?.trim()) {
            receiverMap.set(name, r.receiver_contact_number?.trim() || '');
          }
        }
      });

      const preparedByOptions = Array.from(preparedBySet).sort();
      const receiverOptions: ReceiverEntry[] = Array.from(receiverMap.entries())
        .map(([name, contact]) => ({ name, contact }))
        .sort((a, b) => a.name.localeCompare(b.name));

      return { preparedByOptions, receiverOptions };
    },
  });
}
