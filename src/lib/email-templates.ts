export function welcomeEmailHtml(discountCode: string): string {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://charmistry.co.za";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Welcome to the Charmistry Club</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link href="https://fonts.googleapis.com/css2?family=Gilda+Display&family=Outfit:wght@300;400;500&display=swap" rel="stylesheet" />
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
                <a href="${siteUrl}" style="color:#B8B5B0;text-decoration:underline;">Unsubscribe</a>
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
