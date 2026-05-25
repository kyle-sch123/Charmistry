const KLAVIYO_API_KEY = process.env.KLAVIYO_API_KEY;
const KLAVIYO_TRACK_URL = "https://a.klaviyo.com/api/track";

export function isKlaviyoConfigured(): boolean {
  return Boolean(KLAVIYO_API_KEY);
}

export async function trackKlaviyoEvent(
  event: string,
  customer: {
    email: string;
    first_name?: string;
    last_name?: string;
  },
  properties: Record<string, unknown>,
): Promise<void> {
  if (!KLAVIYO_API_KEY) {
    return;
  }

  const payload = {
    token: KLAVIYO_API_KEY,
    event,
    customer_properties: {
      email: customer.email,
      $first_name: customer.first_name,
      $last_name: customer.last_name,
    },
    properties,
  };

  const data = Buffer.from(JSON.stringify(payload)).toString("base64");
  const response = await fetch(
    `${KLAVIYO_TRACK_URL}?data=${encodeURIComponent(data)}`,
    {
      method: "GET",
    },
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Klaviyo track event failed: ${response.status} ${response.statusText} - ${text}`,
    );
  }
}
