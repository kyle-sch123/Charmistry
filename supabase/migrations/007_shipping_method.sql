-- ============================================================================
-- Record the carrier the customer chose at checkout.
--
-- Charmistry now offers two shipping methods (PUDO Locker-to-Locker and
-- Standard Economy via The Courier Guy) instead of a single flat rate. The
-- chosen method id is written onto the order at /api/checkout and surfaced on
-- the customer + merchant confirmation emails so fulfilment knows how to ship —
-- and, for PUDO, to look for the customer's preferred locker in the notes /
-- their email.
--
-- Nullable + no default: historical orders (and any order created before this
-- column existed) simply carry NULL, which the app renders as an unspecified
-- method. Idempotent — safe to re-run.
-- ============================================================================

alter table public.orders
  add column if not exists shipping_method text;

comment on column public.orders.shipping_method is
  'Chosen shipping method id: pudo_locker | courier_economy. NULL for legacy orders.';
