import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, type Squad } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const DISCORD_API = "https://discord.com/api/v10";

async function botRequest(path: string, method: string, body?: unknown) {
  const token = process.env.DISCORD_BOT_TOKEN!;
  const res = await fetch(`${DISCORD_API}${path}`, {
    method,
    headers: {
      Authorization: `Bot ${token}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Discord API error ${res.status}: ${text}`);
  }
  return res.status === 204 ? null : res.json();
}

function buildRollCallMessage(opts: {
  title: string;
  description?: string | null;
  opTimeUnix: number;
  rollCallId: string;
  squads: Squad[];
  pingRoleIds?: string[];
}) {
  const { title, description, opTimeUnix, rollCallId, squads, pingRoleIds } = opts;

  const squadLines = squads.map(s => `• ${s.name} *(${s.kind})*`).join("\n") || "—";

  const embed = {
    title,
    description: description ?? undefined,
    color: 0xE84141,
    fields: [
      {
        name: "🗓️ Op Time (EST)",
        value: `<t:${opTimeUnix}:F> (<t:${opTimeUnix}:R>)`,
        inline: false,
      },
      {
        name: "Squads",
        value: squadLines,
        inline: false,
      },
      { name: "👍 Yes (0)", value: "—", inline: true },
      { name: "〰️ Maybe (0)", value: "—", inline: true },
      { name: "👎 No (0)", value: "—", inline: true },
    ],
    footer: { text: `Roll Call ID: ${rollCallId}` },
  };

  const squadOptions = squads.map(s => ({
    label: `${s.name} (${s.kind})`,
    value: String(s.id),
  }));
  squadOptions.unshift({ label: "— No squad / unassigned —", value: "none" });

  const components = [
    {
      type: 1,
      components: [
        {
          type: 3,
          custom_id: `squad_select:${rollCallId}`,
          placeholder: "Select your squad (optional)",
          options: squadOptions.slice(0, 25),
          min_values: 1,
          max_values: 1,
        },
      ],
    },
    {
      type: 1,
      components: [
        { type: 2, style: 3, label: "✅ Yes", custom_id: `attend:yes:${rollCallId}` },
        { type: 2, style: 2, label: "〰️ Maybe", custom_id: `attend:maybe:${rollCallId}` },
        { type: 2, style: 4, label: "❌ No", custom_id: `attend:no:${rollCallId}` },
      ],
    },
  ];

  const pingContent = pingRoleIds && pingRoleIds.length > 0
    ? pingRoleIds.map(id => `<@&${id}>`).join(" ")
    : undefined;

  return { content: pingContent, embeds: [embed], components };
}

export async function POST(req: NextRequest) {
  let body: {
    platoonId?: number;
    title?: string;
    description?: string;
    opTimeUnix?: number;
    channelId?: string;
    pingRoleIds?: string[];
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { platoonId, title, description, opTimeUnix, channelId, pingRoleIds } = body;

  if (!platoonId || !title || !opTimeUnix || !channelId) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const sb = supabaseAdmin();

  const [pRes, sqRes] = await Promise.all([
    sb.from("platoons").select("*").eq("id", platoonId).single(),
    sb.from("squads").select("*").eq("platoon_id", platoonId).order("sort_order"),
  ]);

  if (pRes.error || !pRes.data) {
    return NextResponse.json({ error: "Platoon not found" }, { status: 404 });
  }

  const squads = (sqRes.data as Squad[]) ?? [];

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
    return NextResponse.json({ error: "Failed to save roll call" }, { status: 500 });
  }

  const message = buildRollCallMessage({
    title,
    description,
    opTimeUnix,
    rollCallId: rollCallData.id,
    squads,
    pingRoleIds: pingRoleIds ?? [],
  });

  try {
    const posted = await botRequest(`/channels/${channelId}/messages`, "POST", message);
    await sb.from("roll_calls").update({
      discord_channel_id: channelId,
      discord_message_id: posted.id,
    }).eq("id", rollCallData.id);
  } catch (err) {
    console.error("Failed to post to Discord:", err);
    return NextResponse.json({ error: "Failed to post to Discord" }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
