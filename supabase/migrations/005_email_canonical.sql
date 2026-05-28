-- ============================================================================
-- Email canonicalisation + race-safe unique constraint for welcome codes.
--
-- The /api/subscribe route generates a single-use 10%-off code per email.
-- Before this migration, two abuse paths existed:
--   (a) Concurrent POSTs both passed the application-level
--       "do you already have a code?" lookup and both inserted a row, since
--       nothing in the DB enforced uniqueness on `email`.
--   (b) Email aliases (`bob+1@gmail.com`, `b.o.b@gmail.com`, …) compared as
--       distinct strings to `.eq("email", …)` even though they all deliver
--       to the same Gmail inbox.
--
-- Fix:
--   1. Add `email_canonical`, populated by the application using the rules
--      in src/lib/email.ts:canonicaliseEmail (trim, lowercase, strip
--      plus-addressing, collapse Gmail dot/googlemail variants).
--   2. Backfill existing rows with those same rules. Where there are already
--      multiple active codes for one canonical email (the abuse case
--      pre-fix), keep the most recent active row's canonical and leave the
--      older actives with NULL so the new index can be built without losing
--      data. Inactive rows always get backfilled — they're outside the
--      constraint's WHERE clause regardless.
--   3. Create the partial unique index over (email_canonical) WHERE
--      email_canonical IS NOT NULL AND active = true. Restricting to active
--      rows means an admin deactivation (active=false) frees the canonical
--      and lets the customer subscribe again with a fresh code.
--
-- Idempotent — column add and index create both guard with IF NOT EXISTS,
-- and the backfill UPDATE filters on `email_canonical IS NULL` so re-running
-- is a no-op once the column is populated.
-- ============================================================================

alter table public.discount_codes
  add column if not exists email_canonical text;

-- Backfill: mirror src/lib/email.ts:canonicaliseEmail in SQL.
--
-- The DISTINCT ON picks the row each canonical email should "own" — most
-- recent active row, ties broken by id. Inactive rows are backfilled
-- unconditionally because the unique index doesn't cover them.
with canon as (
  select
    id,
    active,
    created_at,
    case
      when split_part(lower(trim(email)), '@', 2) in ('gmail.com', 'googlemail.com')
        then replace(
               split_part(split_part(lower(trim(email)), '@', 1), '+', 1),
               '.', ''
             ) || '@gmail.com'
      else
        split_part(split_part(lower(trim(email)), '@', 1), '+', 1)
        || '@' || split_part(lower(trim(email)), '@', 2)
    end as canonical
  from public.discount_codes
  where email is not null
),
active_keeper as (
  select distinct on (canonical) id
  from canon
  where active = true
  order by canonical, created_at desc, id desc
)
update public.discount_codes d
set email_canonical = c.canonical
from canon c
where d.id = c.id
  and d.email_canonical is null
  and (
    -- Inactive rows: always set (constraint won't see them).
    not c.active
    -- Active rows: only the most recent per canonical receives the value;
    -- older active duplicates from the pre-fix era stay NULL so the
    -- partial unique index can be built without conflict.
    or c.id in (select id from active_keeper)
  );

create unique index if not exists discount_codes_email_canonical_unique
  on public.discount_codes(email_canonical)
  where email_canonical is not null and active = true;
