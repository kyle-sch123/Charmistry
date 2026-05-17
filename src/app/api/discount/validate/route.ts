import { createServerSupabase } from "@/lib/supabase-server";
import { resolveDiscount } from "@/lib/discounts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Body {
  code?: string;
  subtotal?: number;
  email?: string;
}

export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const code = typeof body.code === "string" ? body.code.trim() : "";
  const subtotal = Number(body.subtotal ?? 0);
  const email = typeof body.email === "string" ? body.email.trim() : "";

  if (!code) return Response.json({ error: "code_required" }, { status: 400 });
  if (!Number.isFinite(subtotal) || subtotal <= 0) {
    return Response.json({ error: "invalid_subtotal" }, { status: 400 });
  }

  const supabase = createServerSupabase();
  const result = await resolveDiscount(supabase, code, subtotal, email || undefined);

  if (typeof result === "string") {
    return Response.json({ error: result }, { status: 400 });
  }

  return Response.json({
    success: true,
    code: result.code.code,
    discount_type: result.code.discount_type,
    discount_value: Number(result.code.discount_value),
    amount: result.amount,
  });
}
