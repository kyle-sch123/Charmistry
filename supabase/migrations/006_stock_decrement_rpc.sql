-- ============================================================================
-- Atomic, oversell-safe stock decrement on payment confirmation.
--
-- Stock is validated at checkout but only DECREMENTED here, once payment is
-- confirmed — the PayFast ITN pending→paid winner, or a R0 (100%-off) order
-- created paid directly. Called from src/lib/inventory.ts:decrementProductStock
-- via supabase.rpc('decrement_product_stock', { items }).
--
-- Why an RPC: each product row is locked (FOR UPDATE) before its decrement, so
-- two concurrent confirmations can neither lose an update nor drive stock
-- negative. quantity is clamped at 0; in_stock flips to false at zero so a
-- depleted piece drops out of the in-stock filters. Any line whose paid
-- quantity exceeded the stock on hand is returned in `oversold` so the merchant
-- can reconcile — the payment already succeeded, so we never reject here.
--
--   items  : jsonb array of {"product_id": uuid, "qty": int}
--   returns: { "oversold": [ {product_id, requested, available}, ... ] }
--
-- Idempotency: the CALLERS guarantee one invocation per order (the ITN
-- pending→paid transition is race-safe; the R0 path runs once at insert), so
-- this function is intentionally not self-idempotent per order.
--
-- Idempotent to re-run as a migration (create or replace + revoke/grant).
-- ============================================================================

create or replace function public.decrement_product_stock(items jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  item jsonb;
  pid uuid;
  qty integer;
  avail integer;
  oversold jsonb := '[]'::jsonb;
begin
  if items is null or jsonb_typeof(items) <> 'array' then
    return jsonb_build_object('oversold', oversold);
  end if;

  for item in select value from jsonb_array_elements(items)
  loop
    pid := nullif(item->>'product_id', '')::uuid;
    qty := greatest(0, floor(coalesce((item->>'qty')::numeric, 0))::integer);
    if pid is null or qty = 0 then
      continue;
    end if;

    -- Lock the row so concurrent confirmations serialise on it.
    select quantity into avail from public.products where id = pid for update;
    if not found then
      continue; -- product was deleted between order and confirmation
    end if;

    update public.products
      set quantity  = greatest(0, quantity - qty),
          in_stock  = case when (quantity - qty) > 0 then in_stock else false end
      where id = pid;

    if qty > avail then
      oversold := oversold || jsonb_build_object(
        'product_id', pid, 'requested', qty, 'available', avail
      );
    end if;
  end loop;

  return jsonb_build_object('oversold', oversold);
end;
$$;

-- Service role only — the same lockdown as the discount RPCs (migration 004).
revoke all on function public.decrement_product_stock(jsonb) from public;
grant execute on function public.decrement_product_stock(jsonb) to service_role;
