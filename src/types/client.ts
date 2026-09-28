export type ClientRateMode = 'flat' | 'tiered';

export interface Client {
  id: string;
  client_name: string;
  contact_person: string;
  phone_number: string;
  notes: string;
  created_at: string;
  // Rate system (2026-09-28): defaults to 'flat' for every client until
  // explicitly switched to 'tiered' in Client Rate Master. Optional here so
  // existing client-creation call sites (ClientSelect's quick-add) don't
  // need to specify them -- the database defaults ('flat', null, null) apply.
  rate_mode?: ClientRateMode;
  paper_tube_baseline_kg_per_cone?: number | null;
  paper_tube_extra_cone_surcharge?: number | null;
}
