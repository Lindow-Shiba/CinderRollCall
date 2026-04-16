import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, type Webhook, type Squad } from "@/lib/supabase";
import { postRollCall } from "@/lib/discord";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let body: {
    platoonId?: number;
    title?: string;
    description?: string;
    opTimeUnix?: number;
    pingRoleOverride?: string | null;
    webhookId?: number;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { platoonId, title, description, opTimeUnix, pingRoleOverride, webhookId } = body;

  if (!platoonId || !title || !opTimeUnix || !webhookId) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }
  if (typeof title !== "string" || title.length > 200) {
    return NextResponse.json({ error: "Title too long" }, { status: 400 });
  }
  if (description !== undefined && (typeof description !== "string" || description.length > 1500)) {
    return NextResponse.json({ error: "Description too long" }, { status: 400 });
  }

  const sb = supabaseAdmin();

  const [whRes, pRes, sqRes] = await Promise.all([
    sb.from("webhooks").select("*").eq("id", webhookId).single(),
    sb.from("platoons").select("*").eq("id", platoonId).single(),
    sb.from("squads").select("*").eq("platoon_id", platoonId).order("sort_order"),
  ]);

  if (whRes.error || !whRes.data) {
    return NextResponse.json({ error: "Webhook not found" }, { status: 404 });
  }
  if (pRes.error || !pRes.data) {
    return NextResponse.json({ error: "Platoon not found" }, { status: 404 });
  }
  const webhook = whRes.data as Webhook;
  const platoon = pRes.data;
  if (webhook.platoon_id !== platoon.id) {
    return NextResponse.json({ error: "Webhook/platoon mismatch" }, { status: 400 });
  }

  const squads = (sqRes.data as Squad[]) ?? [];
  const squadLines = squads.map((s) => `• ${s.name}  _(${s.kind})_`);

  let pingRoleId = pingRoleOverride || platoon.ping_role_id || null;
  if (pingRoleId !== null && !/^\d{5,25}$/.test(String(pingRoleId))) {
    return NextResponse.json({ error: "Ping role must be a numeric Discord ID" }, { status: 400 });
  }

  // Save roll call to DB to get an ID for the RSVP page
  const { data: rollCallData, error: rollCallError } = await sb
    .from("roll_calls")
    .insert({
      platoon_id: platoonId,
      title,
      description: description?.trim() || null,
      op_time_unix: opTimeUnix,
    })
    .select("id")
    .single();

  if (rollCallError || !rollCallData) {
    console.error("Failed to save roll call:", rollCallError);
    return NextResponse.json({ error: "Failed to save roll call" }, { status: 500 });
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const rsvpUrl = `${siteUrl}/rsvp/${rollCallData.id}`;

  try {
    await postRollCall(webhook.url, {
      title,
      description: description?.trim() || undefined,
      opTimeUnix,
      pingRoleId,
      squadLines,
      rsvpUrl,
    });
  } catch (err) {
    console.error("postRollCall failed:", err);
    return NextResponse.json({ error: "Failed to post to Discord" }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
