-- ============================================================================
-- Discount-code redemption RPCs.
--
-- These functions are the only safe way to mutate uses_count from application
-- code. They take a row lock under the hood so two concurrent checkouts can
-- never both succeed on the last redemption of a max_uses=1 code.
--
-- Called from src/lib/discounts.ts via supabase.rpc('redeem_discount_code', …)
-- and supabase.rpc('refund_discount_code', …).
-- ============================================================================

-- Conditionally increment uses_count if the code is still redeemable.
-- Returns true on success, false if the code is exhausted/inactive/expired.
create or replace function public.redeem_discount_code(code_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  rows_affected integer;
begin
  update public.discount_codes
    set uses_count = uses_count + 1
    where id = code_id
      and active = true
      and (expires_at is null or expires_at > now())
      and (max_uses is null or uses_count < max_uses);
  get diagnostics rows_affected = row_count;
  return rows_affected > 0;
end;
$$;

-- Decrement uses_count, used when a downstream step (e.g. Paystack
-- initialisation) fails after a successful redeem. Floor at 0.
create or replace function public.refund_discount_code(code_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.discount_codes
    set uses_count = greatest(0, uses_count - 1)
    where id = code_id
      and uses_count > 0;
end;
$$;

-- Lock down execution: only the service role should be invoking these.
revoke all on function public.redeem_discount_code(uuid) from public;
revoke all on function public.refund_discount_code(uuid) from public;
grant execute on function public.redeem_discount_code(uuid) to service_role;
grant execute on function public.refund_discount_code(uuid) to service_role;
