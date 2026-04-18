"use client";

import { useEffect, useState } from "react";
import type { Platoon, Squad } from "@/lib/supabase";

type Props = {
  platoons: Platoon[];
  squads: Squad[];
};

const EDGE = "https://wvcuddamlhtigvyuqzay.supabase.co/functions/v1/discord-setup";

type Channel = { id: string; name: string };
type Role = { id: string; name: string };

function estToUnix(local: string): number | null {
  if (!local) return null;
  const ms = new Date(local + ":00-05:00").getTime();
  if (Number.isNaN(ms)) return null;
  return Math.floor(ms / 1000);
}

function unixToEstPreview(unix: number): string {
  return new Date(unix * 1000).toLocaleString("en-US", {
    timeZone: "America/New_York",
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

export function RollCallForm({ platoons, squads }: Props) {
  const [platoonId, setPlatoonId] = useState<number>(platoons[0]?.id ?? 0);
  const [title, setTitle] = useState("Cinder Platoon Roll Call");
  const [description, setDescription] = useState(
    "Please respond accordingly for the op.\n\nRemember to download the mods."
  );
  const [opTime, setOpTime] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  // Discord channel + role selection
  const [channels, setChannels] = useState<Channel[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<string>("");
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [discordLoading, setDiscordLoading] = useState(true);

  const platoonSquads = squads.filter((s) => s.platoon_id === platoonId);
  const opUnix = estToUnix(opTime);

  useEffect(() => {
    async function loadDiscord() {
      setDiscordLoading(true);
      try {
        const config = await fetch(`${EDGE}?action=config`).then(r => r.json());
        if (!config?.guild_id) return;

        const [chRes, rolesRes] = await Promise.all([
          fetch(`${EDGE}?action=channels&guildId=${config.guild_id}`),
          fetch(`${EDGE}?action=roles&guildId=${config.guild_id}`),
        ]);
        const chList: Channel[] = await chRes.json();
        const roleList: Role[] = await rolesRes.json();
        setChannels(chList);
        setRoles(roleList);

        // Pre-select saved defaults
        if (config.channel_id) setSelectedChannel(config.channel_id);
        if (config.ping_role_id) setSelectedRoles(config.ping_role_id.split(",").filter(Boolean));
      } catch (e) {
        console.error("Failed to load Discord config", e);
      } finally {
        setDiscordLoading(false);
      }
    }
    loadDiscord();
  }, []);

  function toggleRole(roleId: string) {
    setSelectedRoles(prev =>
      prev.includes(roleId) ? prev.filter(r => r !== roleId) : [...prev, roleId]
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setResult(null);
    if (!opUnix) {
      setResult({ ok: false, msg: "Pick an operation date/time (EST)." });
      return;
    }
    if (!selectedChannel) {
      setResult({ ok: false, msg: "Please select a Discord channel." });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/rollcall", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platoonId,
          title,
          description,
          opTimeUnix: opUnix,
          channelId: selectedChannel,
          pingRoleIds: selectedRoles,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setResult({ ok: false, msg: data.error ?? "Failed to post." });
      } else {
        setResult({ ok: true, msg: "Roll call posted to Discord! ✅" });
      }
    } catch (err) {
      setResult({ ok: false, msg: String(err) });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-6 md:grid-cols-[1fr_320px]">
      <div className="space-y-5">
        <div>
          <label>Platoon</label>
          <select value={platoonId} onChange={(e) => setPlatoonId(Number(e.target.value))}>
            {platoons.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label>Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={200}
            required
          />
        </div>

        <div>
          <label>Description</label>
          <textarea
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={1500}
          />
        </div>

        <div>
          <label>Op date &amp; time <span className="text-muted text-xs">(EST — Eastern Standard Time)</span></label>
          <input
            type="datetime-local"
            value={opTime}
            onChange={(e) => setOpTime(e.target.value)}
            required
          />
          {opUnix && (
            <p className="text-xs text-muted mt-1">🕐 {unixToEstPreview(opUnix)}</p>
          )}
        </div>

        {/* Discord channel */}
        <div>
          <label>Post to channel</label>
          {discordLoading ? (
            <p className="text-muted text-sm">Loading channels…</p>
          ) : channels.length === 0 ? (
            <p className="text-accent text-sm">No Discord server configured. Set up in <a href="/admin" className="underline">Admin</a>.</p>
          ) : (
            <select value={selectedChannel} onChange={e => setSelectedChannel(e.target.value)} required>
              <option value="">— Select a channel —</option>
              {channels.map(c => (
                <option key={c.id} value={c.id}>#{c.name}</option>
              ))}
            </select>
          )}
        </div>

        {/* Ping roles */}
        {roles.length > 0 && (
          <div>
            <label className="mb-2 block">Ping roles <span className="text-muted text-xs">(optional)</span></label>
            <div className="border border-border rounded-md max-h-40 overflow-y-auto p-3 space-y-1">
              {roles.map(r => (
                <label key={r.id} className="flex items-center gap-2 text-sm cursor-pointer hover:text-text">
                  <input
                    type="checkbox"
                    checked={selectedRoles.includes(r.id)}
                    onChange={() => toggleRole(r.id)}
                    className="accent-red-500"
                  />
                  {r.name}
                </label>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={submitting}
            className="bg-accent hover:bg-accentHover disabled:bg-border disabled:text-muted disabled:cursor-not-allowed text-white font-medium px-5 py-2.5 rounded-md transition-colors"
          >
            {submitting ? "Posting…" : "Post roll call"}
          </button>
          {result && (
            <span className={result.ok ? "text-green-400 text-sm" : "text-accent text-sm"}>
              {result.msg}
            </span>
          )}
        </div>
      </div>

      {/* Preview */}
      <aside className="bg-panel border border-border rounded-lg p-4 h-fit sticky top-6">
        <div className="text-xs text-muted uppercase tracking-wider mb-3">Preview</div>
        <div className="text-sm space-y-2 text-text/90">
          <div className="font-semibold text-base">{title || "(title)"}</div>
          {description && <div className="text-muted text-xs whitespace-pre-wrap">{description}</div>}
          <div className="text-xs">
            🗓️ {opUnix ? unixToEstPreview(opUnix) : "(pick a date/time)"}
          </div>
          {platoonSquads.length > 0 && (
            <div className="text-xs">
              <div className="font-semibold mt-2 mb-1">Squads</div>
              {platoonSquads.map(s => (
                <div key={s.id}>• {s.name} <span className="text-muted">({s.kind})</span></div>
              ))}
            </div>
          )}
        </div>
      </aside>
    </form>
  );
}
