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
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

const card: React.CSSProperties = {
  background: "#0d1117",
  border: "1px solid #1e2938",
  borderRadius: "8px",
  padding: "20px",
};

const sectionLabel: React.CSSProperties = {
  fontSize: "10px",
  fontWeight: 700,
  letterSpacing: "0.12em",
  textTransform: "uppercase" as const,
  color: "var(--muted)",
  marginBottom: "12px",
  display: "flex",
  alignItems: "center",
  gap: "8px",
};

const divider: React.CSSProperties = {
  flex: 1,
  height: "1px",
  background: "#1e2938",
};

export function RollCallForm({ platoons, squads }: Props) {
  const [platoonId, setPlatoonId] = useState<number>(platoons[0]?.id ?? 0);
  const [title, setTitle] = useState("Cinder Platoon Roll Call");
  const [description, setDescription] = useState("Please respond accordingly for the op.\n\nRemember to download the mods.");
  const [opTime, setOpTime] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

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
        if (config.channel_id) setSelectedChannel(config.channel_id);
        if (config.ping_role_id) setSelectedRoles(config.ping_role_id.split(",").filter(Boolean));
      } catch (e) {
        console.error(e);
      } finally {
        setDiscordLoading(false);
      }
    }
    loadDiscord();
  }, []);

  function toggleRole(roleId: string) {
    setSelectedRoles(prev => prev.includes(roleId) ? prev.filter(r => r !== roleId) : [...prev, roleId]);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setResult(null);
    if (!opUnix) { setResult({ ok: false, msg: "Pick an operation date/time (EST)." }); return; }
    if (!selectedChannel) { setResult({ ok: false, msg: "Select a Discord channel." }); return; }
    setSubmitting(true);
    try {
      const res = await fetch("/api/rollcall", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platoonId, title, description, opTimeUnix: opUnix, channelId: selectedChannel, pingRoleIds: selectedRoles }),
      });
      const data = await res.json();
      if (!res.ok) {
        setResult({ ok: false, msg: data.error ?? "Failed to post." });
      } else {
        setResult({ ok: true, msg: "Roll call posted to Discord!" });
      }
    } catch (err) {
      setResult({ ok: false, msg: String(err) });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid gap-6" style={{ gridTemplateColumns: "1fr 300px" }}>
      <form onSubmit={submit} className="space-y-4">

        {/* Op Details */}
        <div style={card}>
          <div style={sectionLabel}><span>Operation Details</span><span style={divider} /></div>
          <div className="space-y-4">
            <div>
              <label>Platoon</label>
              <select value={platoonId} onChange={(e) => setPlatoonId(Number(e.target.value))}>
                {platoons.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label>Title</label>
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} required />
            </div>
            <div>
              <label>Description</label>
              <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={1500} />
            </div>
            <div>
              <label>Op Date & Time — EST</label>
              <input type="datetime-local" value={opTime} onChange={(e) => setOpTime(e.target.value)} required />
              {opUnix && (
                <div style={{ fontSize: "11px", color: "var(--muted)", marginTop: "4px" }}>
                  🕐 {unixToEstPreview(opUnix)}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Discord */}
        <div style={card}>
          <div style={sectionLabel}><span>Discord</span><span style={divider} /></div>
          <div className="space-y-4">
            <div>
              <label>Post to Channel</label>
              {discordLoading ? (
                <div style={{ fontSize: "12px", color: "var(--muted)" }}>Loading channels…</div>
              ) : channels.length === 0 ? (
                <div style={{ fontSize: "12px", color: "var(--accent)" }}>
                  No server configured. Set up Discord in <a href="/admin" style={{ textDecoration: "underline" }}>Admin</a>.
                </div>
              ) : (
                <select value={selectedChannel} onChange={e => setSelectedChannel(e.target.value)} required>
                  <option value="">— Select channel —</option>
                  {channels.map(c => <option key={c.id} value={c.id}>#{c.name}</option>)}
                </select>
              )}
            </div>
            {roles.length > 0 && (
              <div>
                <label>Ping Roles (optional)</label>
                <div style={{ border: "1px solid #1e2938", borderRadius: "6px", maxHeight: "140px", overflowY: "auto", padding: "8px" }}>
                  {roles.map(r => (
                    <label key={r.id} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "4px 0", fontSize: "13px", cursor: "pointer", textTransform: "none", letterSpacing: "normal", color: "var(--text)" }}>
                      <input type="checkbox" checked={selectedRoles.includes(r.id)} onChange={() => toggleRole(r.id)} style={{ accentColor: "var(--accent)", width: "14px", height: "14px" }} />
                      {r.name}
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Submit */}
        <div className="flex items-center gap-4">
          <button
            type="submit"
            disabled={submitting}
            style={{
              background: submitting ? "var(--border)" : "var(--accent)",
              color: submitting ? "var(--muted)" : "white",
              border: "none",
              borderRadius: "6px",
              padding: "10px 24px",
              fontSize: "12px",
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              cursor: submitting ? "not-allowed" : "pointer",
              transition: "background 0.15s",
            }}
          >
            {submitting ? "Posting…" : "Post Roll Call"}
          </button>
          {result && (
            <span style={{ fontSize: "13px", color: result.ok ? "#3fb950" : "var(--accent)" }}>
              {result.msg}
            </span>
          )}
        </div>
      </form>

      {/* Preview */}
      <div>
        <div style={{ ...card, position: "sticky", top: "20px" }}>
          <div style={sectionLabel}><span>Preview</span><span style={divider} /></div>
          <div style={{ fontSize: "13px" }}>
            <div style={{ fontWeight: 700, fontSize: "15px", marginBottom: "4px" }}>{title || "(title)"}</div>
            {description && <div style={{ color: "var(--muted)", fontSize: "12px", whiteSpace: "pre-wrap", marginBottom: "8px" }}>{description}</div>}
            <div style={{ fontSize: "12px", color: "var(--muted)", marginBottom: "8px" }}>
              🗓️ {opUnix ? unixToEstPreview(opUnix) : "(pick a date/time)"}
            </div>
            {platoonSquads.length > 0 && (
              <div>
                <div style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.1em", color: "var(--muted)", marginBottom: "6px" }}>SQUADS</div>
                {platoonSquads.map(s => (
                  <div key={s.id} style={{ fontSize: "12px", padding: "2px 0", color: "var(--text)" }}>
                    • {s.name} <span style={{ color: "var(--muted)" }}>({s.kind})</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
