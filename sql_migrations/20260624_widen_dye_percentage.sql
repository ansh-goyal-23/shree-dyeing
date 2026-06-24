-- Widen dye percentage scale so values are stored as entered (up to 6 decimals)
-- instead of being rounded to 4 decimal places.

alter table public.recipe_dyes
  alter column percentage type numeric(14,6);

alter table public.step_dyes
  alter column percentage type numeric(14,6);
