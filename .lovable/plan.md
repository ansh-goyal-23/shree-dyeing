# Fix: Stock Inward fails with missing `bill_path` column

## What's happening

The Stock Inward form uploads an optional bill/invoice file and saves `bill_url` / `bill_path` on the `store_stock_inward` header. Those two columns are added by `sql_migrations/20260625_inventory_catalogue_upgrade.sql`, which also creates the `inward-bills` storage bucket. That migration has not been applied to the live Supabase database, so PostgREST rejects the insert with "Could not find the 'bill_path' column ... in the schema cache". (Not verified against the live DB — no direct DB access in this session — but it is the only way this error can occur given the app code.)

## Fix

1. Add a small standalone migration file `sql_migrations/20260807_inward_bill_columns.sql` containing only the missing pieces, so it can be run safely even if part of the older migration already ran:
   - `ALTER TABLE public.store_stock_inward ADD COLUMN IF NOT EXISTS bill_url text, ADD COLUMN IF NOT EXISTS bill_path text;`
   - Create the `inward-bills` storage bucket (`ON CONFLICT DO NOTHING`) plus its read/write/update/delete policies.
   - `NOTIFY pgrst, 'reload schema';` so the schema cache refreshes immediately.
2. You run that SQL in the Supabase SQL editor (manual migrations, as per this project's setup).
3. Make the app resilient so a missing-column schema error never blocks a save: in `useCreateStoreInward` (`src/hooks/useStore.ts`), if the header insert fails with a "column not found in schema cache" error mentioning `bill_url`/`bill_path`, retry the insert once without those two fields and surface a toast noting the bill attachment could not be stored. This mirrors the fallback pattern already used in `useChallan.ts`.

## Notes

- No UI changes; the bill upload field stays as-is.
- No data is moved or dropped; the change is purely additive.
