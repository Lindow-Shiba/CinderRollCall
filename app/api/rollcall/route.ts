import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, type Squad } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const DISCORD_API = "https://discord.com/api/v10";

async function botRequest(path: string, method: string, body?: unknown) {
  const token = process.env.DISCORD_BOT_TOKEN!;
  const res = await fetch(`${DISCORD_API}${path}`, {
    method,
    headers: { Authorization: `Bot ${token}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`Discord API error ${res.status}: ${await res.text()}`);
  return res.status === 204 ? null : res.json();
}

function attendanceEmoji(attendance: string) {
  if (attendance === "yes") return "👍";
  if (attendance === "maybe") return "〰️";
  return "👎";
}

function buildRollCallMessage(opts: {
  title: string;
  description?: string | null;
  opTimeUnix: number;
  rollCallId: string;
  squads: Squad[];
  rsvps?: { display_name: string; squad_id: number | null; attendance: string }[];
  pingRoleIds?: string[];
}) {
  const { title, description, opTimeUnix, rollCallId, squads, rsvps = [], pingRoleIds } = opts;

  // One field per squad showing members with emoji
  const squadFields = squads.map(s => {
    const members = rsvps
      .filter(r => r.squad_id === s.id)
      .map(r => `${attendanceEmoji(r.attendance)} ${r.display_name}`);
    return {
      name: `${s.name} (${members.length})`,
      value: members.length > 0 ? members.join("\n") : "—",
      inline: true,
    };
  });

  const embed = {
    title,
    description: description ?? undefined,
    color: 0xC0392B,
    fields: [
      {
        name: "🗓️ Op Time (ET)",
        value: `<t:${opTimeUnix}:F> (<t:${opTimeUnix}:R>)`,
        inline: false,
      },
      ...squadFields,
    ],
    footer: { text: `Roll Call ID: ${rollCallId}` },
  };

  // Squad dropdown (no absent option)
  const squadOptions = squads.map(s => ({
    label: s.name,
    description: s.kind.charAt(0).toUpperCase() + s.kind.slice(1),
    value: String(s.id),
  }));

  const components = [
    {
      type: 1,
      components: [
        {
          type: 3,
          custom_id: `squad_select:${rollCallId}`,
          placeholder: "1. Select your squad / team / reserve",
          options: squadOptions.slice(0, 25),
          min_values: 1,
          max_values: 1,
        },
      ],
    },
    {
      type: 1,
      components: [
        { type: 2, style: 3, label: "👍 Yes", custom_id: `attend:yes:${rollCallId}` },
        { type: 2, style: 2, label: "〰️ Maybe", custom_id: `attend:maybe:${rollCallId}` },
        { type: 2, style: 4, label: "👎 No", custom_id: `attend:no:${rollCallId}` },
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
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const { platoonId, title, description, opTimeUnix, channelId, pingRoleIds } = body;
  if (!platoonId || !title || !opTimeUnix || !channelId) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const sb = supabaseAdmin();
  const [pRes, sqRes] = await Promise.all([
    sb.from("platoons").select("*").eq("id", platoonId).single(),
    sb.from("squads").select("*").eq("platoon_id", platoonId).order("sort_order"),
  ]);

  if (pRes.error || !pRes.data) return NextResponse.json({ error: "Platoon not found" }, { status: 404 });
  const squads = (sqRes.data as Squad[]) ?? [];

  const { data: rollCallData, error: rcErr } = await sb
    .from("roll_calls")
    .insert({ platoon_id: platoonId, title, description: description?.trim() || null, op_time_unix: opTimeUnix })
    .select("id").single();

  if (rcErr || !rollCallData) return NextResponse.json({ error: "Failed to save roll call" }, { status: 500 });

  const message = buildRollCallMessage({
    title, description, opTimeUnix, rollCallId: rollCallData.id, squads, pingRoleIds: pingRoleIds ?? [],
  });

  try {
    const posted = await botRequest(`/channels/${channelId}/messages`, "POST", message);
    await sb.from("roll_calls").update({ discord_channel_id: channelId, discord_message_id: posted.id }).eq("id", rollCallData.id);
  } catch (err) {
    console.error("Failed to post to Discord:", err);
    return NextResponse.json({ error: "Failed to post to Discord" }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
