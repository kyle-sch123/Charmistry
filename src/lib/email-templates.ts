/**
 * Transactional email HTML templates (Resend).
 *
 * All templates are written as inline-styled tables — that's the
 * lowest-common-denominator that Outlook, Gmail and Apple Mail all render
 * consistently. Do not introduce external stylesheets or <link> tags; many
 * clients strip them silently.
 *
 * Three templates:
 * - orderConfirmationHtml() — customer-facing receipt.
 * - merchantOrderNotificationHtml() — fulfilment team's new-order alert,
 *   with the customer's email and phone as reply-to / call targets.
 * - welcomeEmailHtml() — newsletter signup, includes the generated code.
 *
 * escapeHtml() runs on every user-supplied field; never inline an order
 * field without going through it.
 */

import type { Order, OrderItem } from "@/types";
import { shippingMethodLabel } from "@/lib/shipping";

function formatZar(amount: number): string {
  return `R${amount.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function orderConfirmationHtml(order: Order, items: OrderItem[]): string {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://charmistry.co.za";
  const shortId = order.id.slice(0, 8).toUpperCase();

  const itemRows = items
    .map(
      (item) => `
      <tr>
        <td style="padding:16px 0;border-bottom:1px solid #E0DDD8;">
          <p style="margin:0;font-family:'Gilda Display','Georgia',serif;font-size:15px;color:#0A0A0A;">${escapeHtml(item.product_name)}</p>
          <p style="margin:4px 0 0;font-size:11px;color:#6B6B6B;letter-spacing:0.05em;">Qty ${item.quantity} &middot; ${formatZar(Number(item.unit_price))}</p>
        </td>
        <td style="padding:16px 0;border-bottom:1px solid #E0DDD8;text-align:right;font-size:13px;color:#0A0A0A;">
          ${formatZar(Number(item.line_total))}
        </td>
      </tr>`,
    )
    .join("");

  const shippingLines = [
    `${order.first_name} ${order.last_name}`,
    order.shipping_address_line1,
    order.shipping_address_line2 ?? "",
    `${order.shipping_city}, ${order.shipping_postal_code}`,
    order.shipping_country,
  ]
    .filter(Boolean)
    .map((line) => escapeHtml(line))
    .join("<br/>");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Order confirmation &middot; Charmistry</title>
</head>
<body style="margin:0;padding:0;background:#FAFAF8;font-family:'Outfit',sans-serif;color:#0A0A0A;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#FAFAF8;">
    <tr>
      <td align="center" style="padding:48px 16px;">
        <table width="560" cellpadding="0" cellspacing="0" role="presentation" style="max-width:560px;width:100%;background:#FFFFFF;border:1px solid #E0DDD8;">
          <tr>
            <td style="padding:40px 48px 32px;border-bottom:1px solid #E0DDD8;text-align:center;">
              <p style="margin:0;font-family:'Gilda Display','Georgia',serif;font-size:22px;letter-spacing:0.15em;text-transform:uppercase;color:#0A0A0A;">Charmistry</p>
            </td>
          </tr>
          <tr>
            <td style="padding:48px 48px 24px;">
              <p style="margin:0 0 8px;font-family:'Gilda Display','Georgia',serif;font-size:28px;line-height:1.2;color:#0A0A0A;">Thank you for your order.</p>
              <p style="margin:16px 0 0;font-size:13px;line-height:1.8;color:#6B6B6B;letter-spacing:0.05em;">
                Your payment has been received and your pieces are being prepared with care. We'll follow up with tracking details as soon as your order ships.
              </p>
              <p style="margin:24px 0 0;font-size:11px;color:#6B6B6B;letter-spacing:0.15em;text-transform:uppercase;">Order #${shortId}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 48px 24px;">
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                ${itemRows}
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:0 48px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td style="padding:8px 0;font-size:12px;color:#6B6B6B;">Subtotal</td>
                  <td style="padding:8px 0;text-align:right;font-size:12px;color:#0A0A0A;">${formatZar(Number(order.subtotal))}</td>
                </tr>
                ${
                  Number(order.discount_amount) > 0
                    ? `<tr>
                  <td style="padding:8px 0;font-size:12px;color:#6B6B6B;">Discount${order.discount_code ? ` (${escapeHtml(order.discount_code)})` : ""}</td>
                  <td style="padding:8px 0;text-align:right;font-size:12px;color:#0A0A0A;">−${formatZar(Number(order.discount_amount))}</td>
                </tr>`
                    : ""
                }
                <tr>
                  <td style="padding:8px 0;font-size:12px;color:#6B6B6B;">Shipping${shippingMethodLabel(order.shipping_method) ? ` &middot; ${escapeHtml(shippingMethodLabel(order.shipping_method))}` : ""}</td>
                  <td style="padding:8px 0;text-align:right;font-size:12px;color:#0A0A0A;">${Number(order.shipping_cost) === 0 ? "Free" : formatZar(Number(order.shipping_cost))}</td>
                </tr>
                <tr>
                  <td style="padding:12px 0 0;border-top:1px solid #0A0A0A;font-size:13px;color:#0A0A0A;letter-spacing:0.1em;text-transform:uppercase;">Total</td>
                  <td style="padding:12px 0 0;border-top:1px solid #0A0A0A;text-align:right;font-family:'Gilda Display','Georgia',serif;font-size:22px;color:#0A0A0A;">${formatZar(Number(order.total))}</td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 48px;border-top:1px solid #E0DDD8;">
              <p style="margin:0 0 8px;font-size:10px;letter-spacing:0.2em;text-transform:uppercase;color:#6B6B6B;">Shipping to</p>
              <p style="margin:0;font-size:13px;line-height:1.7;color:#0A0A0A;">${shippingLines}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 48px;border-top:1px solid #E0DDD8;text-align:center;">
              <a href="${siteUrl}" style="display:inline-block;padding:14px 36px;background:#0A0A0A;font-family:'Outfit',sans-serif;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:#FAFAF8;text-decoration:none;">Continue Shopping</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function merchantOrderNotificationHtml(order: Order, items: OrderItem[]): string {
  const shortId = order.id.slice(0, 8).toUpperCase();
  const createdAt = new Date(order.created_at).toLocaleString("en-ZA", {
    dateStyle: "medium",
    timeStyle: "short",
  });
  const totalUnits = items.reduce((acc, i) => acc + i.quantity, 0);
  const methodLabel = shippingMethodLabel(order.shipping_method);
  const isPudo = order.shipping_method === "pudo_locker";

  const itemRows = items
    .map(
      (item) => `
      <tr>
        <td style="padding:12px 8px;border-bottom:1px solid #E0DDD8;vertical-align:top;">
          <p style="margin:0;font-size:14px;color:#0A0A0A;font-weight:600;">${escapeHtml(item.product_name)}</p>
          <p style="margin:4px 0 0;font-size:11px;color:#6B6B6B;">SKU: ${escapeHtml(item.product_slug)}</p>
        </td>
        <td style="padding:12px 8px;border-bottom:1px solid #E0DDD8;text-align:center;font-size:14px;color:#0A0A0A;">${item.quantity}</td>
        <td style="padding:12px 8px;border-bottom:1px solid #E0DDD8;text-align:right;font-size:13px;color:#6B6B6B;">${formatZar(Number(item.unit_price))}</td>
        <td style="padding:12px 8px;border-bottom:1px solid #E0DDD8;text-align:right;font-size:14px;color:#0A0A0A;font-weight:600;">${formatZar(Number(item.line_total))}</td>
      </tr>`,
    )
    .join("");

  const addressLines = [
    `${order.first_name} ${order.last_name}`,
    order.shipping_address_line1,
    order.shipping_address_line2 ?? "",
    `${order.shipping_city}, ${order.shipping_postal_code}`,
    order.shipping_country,
  ]
    .filter(Boolean)
    .map((line) => escapeHtml(line))
    .join("<br/>");

  const notesBlock = order.notes
    ? `<tr>
        <td style="padding:16px 24px;border-top:1px solid #E0DDD8;background:#FFF8E1;">
          <p style="margin:0 0 6px;font-size:11px;letter-spacing:0.15em;text-transform:uppercase;color:#7A5D00;">Customer Notes</p>
          <p style="margin:0;font-size:13px;color:#0A0A0A;line-height:1.6;">${escapeHtml(order.notes)}</p>
        </td>
      </tr>`
    : "";

  // Locker-to-locker orders: the customer names their preferred locker in the
  // notes above or by email, so flag it prominently for fulfilment. If none was
  // given, ship to the nearest available locker to their address.
  const pudoBlock = isPudo
    ? `<tr>
        <td style="padding:16px 24px;border-top:1px solid #E0DDD8;background:#E7F1FB;">
          <p style="margin:0 0 6px;font-size:11px;letter-spacing:0.15em;text-transform:uppercase;color:#0B4A8F;">Locker Delivery &middot; Action Needed</p>
          <p style="margin:0;font-size:13px;color:#0A0A0A;line-height:1.6;">This is a locker-to-locker order. Use the customer's preferred locker (from their notes above or a follow-up email); if none was provided, ship to the nearest available locker to their delivery address.</p>
        </td>
      </tr>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>New order #${shortId}</title>
</head>
<body style="margin:0;padding:0;background:#F4F4F2;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#0A0A0A;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#F4F4F2;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table width="640" cellpadding="0" cellspacing="0" role="presentation" style="max-width:640px;width:100%;background:#FFFFFF;border:1px solid #E0DDD8;">

          <tr>
            <td style="padding:24px 32px;background:#0A0A0A;color:#FAFAF8;">
              <p style="margin:0;font-size:11px;letter-spacing:0.25em;text-transform:uppercase;opacity:0.7;">Charmistry &middot; New Order</p>
              <p style="margin:6px 0 0;font-size:22px;font-weight:600;">Order #${shortId}</p>
              <p style="margin:6px 0 0;font-size:12px;opacity:0.7;">${escapeHtml(createdAt)}</p>
            </td>
          </tr>

          <tr>
            <td style="padding:24px 32px;background:#E8F5E9;border-bottom:1px solid #E0DDD8;">
              <p style="margin:0;font-size:13px;color:#1B5E20;">
                <strong>Payment received.</strong> This order is ready to pack and ship.
              </p>
            </td>
          </tr>

          <tr>
            <td style="padding:24px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td width="50%" style="vertical-align:top;padding-right:12px;">
                    <p style="margin:0 0 8px;font-size:10px;letter-spacing:0.2em;text-transform:uppercase;color:#6B6B6B;">Ship To</p>
                    <p style="margin:0;font-size:13px;line-height:1.7;color:#0A0A0A;">${addressLines}</p>
                    ${methodLabel ? `<p style="margin:10px 0 0;font-size:12px;line-height:1.5;color:#0A0A0A;"><span style="color:#6B6B6B;">Via:</span> ${escapeHtml(methodLabel)}</p>` : ""}
                  </td>
                  <td width="50%" style="vertical-align:top;padding-left:12px;border-left:1px solid #E0DDD8;">
                    <p style="margin:0 0 8px;font-size:10px;letter-spacing:0.2em;text-transform:uppercase;color:#6B6B6B;">Customer</p>
                    <p style="margin:0;font-size:13px;line-height:1.7;color:#0A0A0A;">
                      <a href="mailto:${escapeHtml(order.email)}" style="color:#0A0A0A;">${escapeHtml(order.email)}</a>
                      ${order.phone ? `<br/><a href="tel:${escapeHtml(order.phone)}" style="color:#0A0A0A;">${escapeHtml(order.phone)}</a>` : ""}
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:0 32px 16px;">
              <p style="margin:0 0 12px;font-size:10px;letter-spacing:0.2em;text-transform:uppercase;color:#6B6B6B;">Items (${totalUnits})</p>
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="border-top:1px solid #0A0A0A;">
                <thead>
                  <tr>
                    <th style="padding:10px 8px;text-align:left;font-size:10px;letter-spacing:0.15em;text-transform:uppercase;color:#6B6B6B;font-weight:600;">Item</th>
                    <th style="padding:10px 8px;text-align:center;font-size:10px;letter-spacing:0.15em;text-transform:uppercase;color:#6B6B6B;font-weight:600;">Qty</th>
                    <th style="padding:10px 8px;text-align:right;font-size:10px;letter-spacing:0.15em;text-transform:uppercase;color:#6B6B6B;font-weight:600;">Unit</th>
                    <th style="padding:10px 8px;text-align:right;font-size:10px;letter-spacing:0.15em;text-transform:uppercase;color:#6B6B6B;font-weight:600;">Line</th>
                  </tr>
                </thead>
                <tbody>
                  ${itemRows}
                </tbody>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:8px 32px 24px;">
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td style="padding:6px 8px;font-size:12px;color:#6B6B6B;">Subtotal</td>
                  <td style="padding:6px 8px;text-align:right;font-size:12px;color:#0A0A0A;">${formatZar(Number(order.subtotal))}</td>
                </tr>
                ${
                  Number(order.discount_amount) > 0
                    ? `<tr>
                  <td style="padding:6px 8px;font-size:12px;color:#6B6B6B;">Discount${order.discount_code ? ` (${escapeHtml(order.discount_code)})` : ""}</td>
                  <td style="padding:6px 8px;text-align:right;font-size:12px;color:#0A0A0A;">−${formatZar(Number(order.discount_amount))}</td>
                </tr>`
                    : ""
                }
                <tr>
                  <td style="padding:6px 8px;font-size:12px;color:#6B6B6B;">Shipping${methodLabel ? ` &middot; ${escapeHtml(methodLabel)}` : ""}</td>
                  <td style="padding:6px 8px;text-align:right;font-size:12px;color:#0A0A0A;">${Number(order.shipping_cost) === 0 ? "Free" : formatZar(Number(order.shipping_cost))}</td>
                </tr>
                <tr>
                  <td style="padding:12px 8px 0;border-top:2px solid #0A0A0A;font-size:13px;color:#0A0A0A;text-transform:uppercase;letter-spacing:0.1em;font-weight:600;">Total (${escapeHtml(order.currency)})</td>
                  <td style="padding:12px 8px 0;border-top:2px solid #0A0A0A;text-align:right;font-size:20px;color:#0A0A0A;font-weight:700;">${formatZar(Number(order.total))}</td>
                </tr>
              </table>
            </td>
          </tr>

          ${pudoBlock}

          ${notesBlock}

          <tr>
            <td style="padding:16px 32px;background:#FAFAF8;border-top:1px solid #E0DDD8;">
              <p style="margin:0;font-size:11px;color:#6B6B6B;line-height:1.6;">
                Payment reference: <code style="font-size:11px;color:#0A0A0A;">${escapeHtml(order.payfast_pf_payment_id ?? order.payfast_payment_id ?? "—")}</code><br/>
                Order ID: <code style="font-size:11px;color:#0A0A0A;">${escapeHtml(order.id)}</code>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function escapeHtml(value: string | number | null | undefined): string {
  // String() coerces numbers (PayFast's `pf_payment_id` arrives as a string
  // in form-encoded ITN bodies, but the column has historically held both
  // numeric and string ids), null, and undefined so the merchant template
  // doesn't crash when it inlines `order.payfast_pf_payment_id` — the
  // previous signature accepted only string and threw
  // `value.replace is not a function` on a number, which silently dropped
  // the merchant notification email.
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function welcomeEmailHtml(discountCode: string): string {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://charmistry.co.za";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Welcome to the Charmistry Club</title>
</head>
<body style="margin:0;padding:0;background:#FAFAF8;font-family:'Outfit',sans-serif;color:#0A0A0A;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#FAFAF8;">
    <tr>
      <td align="center" style="padding:48px 16px;">
        <table width="560" cellpadding="0" cellspacing="0" role="presentation" style="max-width:560px;width:100%;background:#FFFFFF;border:1px solid #E0DDD8;">

          <!-- Header -->
          <tr>
            <td style="padding:40px 48px 32px;border-bottom:1px solid #E0DDD8;text-align:center;">
              <p style="margin:0;font-family:'Gilda Display','Georgia',serif;font-size:22px;letter-spacing:0.15em;text-transform:uppercase;color:#0A0A0A;">
                Charmistry
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:48px 48px 40px;">
              <p style="margin:0 0 8px;font-family:'Gilda Display','Georgia',serif;font-size:28px;line-height:1.2;color:#0A0A0A;">
                Welcome to the Club.
              </p>
              <p style="margin:24px 0 0;font-size:13px;line-height:1.8;color:#6B6B6B;letter-spacing:0.05em;">
                Thank you for joining the Charmistry Club. As a member, you'll be the first to hear about new collections, exclusive promos, and special events made just for you.
              </p>
              <p style="margin:16px 0 0;font-size:13px;line-height:1.8;color:#6B6B6B;letter-spacing:0.05em;">
                To get you started, here's a welcome discount — yours to use on your first order:
              </p>

              <!-- Discount Code Box -->
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:32px 0;">
                <tr>
                  <td style="border:1px solid #0A0A0A;padding:20px;text-align:center;">
                    <p style="margin:0 0 4px;font-size:10px;letter-spacing:0.3em;text-transform:uppercase;color:#6B6B6B;">
                      Your discount code
                    </p>
                    <p style="margin:0;font-family:'Gilda Display','Georgia',serif;font-size:24px;letter-spacing:0.2em;color:#0A0A0A;">
                      ${discountCode}
                    </p>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 32px;font-size:12px;color:#B8B5B0;letter-spacing:0.05em;">
                Valid for 10% off your first order. Single use only.
              </p>

              <!-- CTA Button -->
              <table cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td style="background:#0A0A0A;">
                    <a href="${siteUrl}" style="display:inline-block;padding:14px 36px;font-family:'Outfit',sans-serif;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:#FAFAF8;text-decoration:none;">
                      Shop Now
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:24px 48px;border-top:1px solid #E0DDD8;text-align:center;">
              <p style="margin:0;font-size:11px;color:#B8B5B0;letter-spacing:0.05em;line-height:1.8;">
                You're receiving this because you joined the Charmistry Club.<br/>
                To unsubscribe, reply to this email with "unsubscribe" in the subject line.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
