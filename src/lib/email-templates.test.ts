import { afterEach, describe, expect, it, vi } from "vitest";
import type { Order, OrderItem } from "@/types";
import { orderConfirmationHtml, welcomeEmailHtml } from "./email-templates";

const order: Order = {
  id: "0f5c2a9e-6d3b-4c1a-9e7f-2b8d4a6c1e3f",
  email: "customer@example.com",
  first_name: "Test",
  last_name: "Customer",
  phone: null,
  shipping_address_line1: "12 Loop Street",
  shipping_address_line2: null,
  shipping_city: "Cape Town",
  shipping_postal_code: "8001",
  shipping_country: "South Africa",
  subtotal: 650,
  shipping_cost: 0,
  shipping_method: "pudo_locker",
  total: 650,
  currency: "ZAR",
  status: "paid",
  shipping_status: "pending",
  courier: null,
  tracking_number: null,
  tracking_url: null,
  waybill_number: null,
  shipped_at: null,
  payfast_payment_id: null,
  payfast_pf_payment_id: null,
  user_id: null,
  notes: null,
  created_at: "2026-11-25T08:00:00.000Z",
  updated_at: "2026-11-25T08:00:00.000Z",
  paid_at: "2026-11-25T08:01:00.000Z",
  discount_code: null,
  discount_amount: 0,
};

const items: OrderItem[] = [
  {
    id: "item-1",
    order_id: order.id,
    product_id: null,
    product_name: "Daily Affair Ring",
    product_slug: "daily-affair-ring",
    product_image_url: null,
    unit_price: 650,
    quantity: 1,
    line_total: 650,
    created_at: "2026-11-25T08:00:00.000Z",
  },
];

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("links back to the shop", () => {
  it("tags the order confirmation's Continue Shopping button as transactional", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://charmistry.co.za");
    expect(orderConfirmationHtml(order, items)).toContain(
      'href="https://charmistry.co.za/?utm_source=transactional&amp;utm_medium=email&amp;utm_campaign=order-confirmation&amp;utm_content=continue-shopping_btn"',
    );
  });

  it("tags the welcome email's Shop Now button", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://charmistry.co.za");
    expect(welcomeEmailHtml("WELCOME-ABC123")).toContain(
      'href="https://charmistry.co.za/?utm_source=resend&amp;utm_medium=email&amp;utm_campaign=flow_welcome&amp;utm_content=shop-now_btn"',
    );
  });

  it("still sends the plain link when the site address is malformed", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "charmistry.co.za");
    expect(welcomeEmailHtml("WELCOME-ABC123")).toContain('href="charmistry.co.za"');
    expect(orderConfirmationHtml(order, items)).toContain('href="charmistry.co.za"');
  });
});
