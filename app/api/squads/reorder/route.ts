import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let body: { platoonId?: number; order?: { id: number; sort_order: number }[] };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const { order } = body;
  if (!order || !Array.isArray(order)) {
    return NextResponse.json({ error: "Invalid order" }, { status: 400 });
  }

  const sb = supabaseAdmin();
  await Promise.all(
    order.map(({ id, sort_order }) =>
      sb.from("squads").update({ sort_order }).eq("id", id)
    )
  );

  return NextResponse.json({ ok: true });
}
