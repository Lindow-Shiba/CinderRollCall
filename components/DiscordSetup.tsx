"use client";

import { useEffect, useState } from "react";

const EDGE = "https://wvcuddamlhtigvyuqzay.supabase.co/functions/v1/discord-setup";

type Guild = { id: string; name: string };
type Channel = { id: string; name: string };
type Role = { id: string; name: string };

export default function DiscordSetup() {
  const [guilds, setGuilds] = useState<Guild[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);

  const [selectedGuild, setSelectedGuild] = useState<Guild | null>(null);
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  // Load current config + guilds on mount
  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [configRes, guildsRes] = await Promise.all([
          fetch(`${EDGE}?action=config`),
          fetch(`${EDGE}?action=guilds`),
        ]);
        const config = await configRes.json();
        const guildList: Guild[] = await guildsRes.json();
        setGuilds(guildList);

        if (config?.guild_id) {
          const g = guildList.find(g => g.id === config.guild_id) ?? { id: config.guild_id, name: config.guild_name ?? config.guild_id };
          setSelectedGuild(g);

          const [chRes, rolesRes] = await Promise.all([
            fetch(`${EDGE}?action=channels&guildId=${config.guild_id}`),
            fetch(`${EDGE}?action=roles&guildId=${config.guild_id}`),
          ]);
          const chList: Channel[] = await chRes.json();
          const roleList: Role[] = await rolesRes.json();
          setChannels(chList);
          setRoles(roleList);

          if (config.channel_id) {
            const ch = chList.find(c => c.id === config.channel_id) ?? { id: config.channel_id, name: config.channel_name ?? config.channel_id };
            setSelectedChannel(ch);
          }
          if (config.ping_role_id) {
            setSelectedRoles(config.ping_role_id.split(",").filter(Boolean));
          }
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function onGuildChange(guildId: string) {
    const guild = guilds.find(g => g.id === guildId) ?? null;
    setSelectedGuild(guild);
    setSelectedChannel(null);
    setSelectedRoles([]);
    setChannels([]);
    setRoles([]);
    if (!guildId) return;
    const [chRes, rolesRes] = await Promise.all([
      fetch(`${EDGE}?action=channels&guildId=${guildId}`),
      fetch(`${EDGE}?action=roles&guildId=${guildId}`),
    ]);
    setChannels(await chRes.json());
    setRoles(await rolesRes.json());
  }

  function toggleRole(roleId: string) {
    setSelectedRoles(prev =>
      prev.includes(roleId) ? prev.filter(r => r !== roleId) : [...prev, roleId]
    );
  }

  async function save() {
    if (!selectedGuild || !selectedChannel) {
      setResult({ ok: false, msg: "Please select a server and channel." });
      return;
    }
    setSaving(true);
    setResult(null);
    try {
      const res = await fetch(`${EDGE}?action=save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guild_id: selectedGuild.id,
          guild_name: selectedGuild.name,
          channel_id: selectedChannel.id,
          channel_name: selectedChannel.name,
          ping_role_id: selectedRoles.join(",") || null,
          ping_role_name: selectedRoles.map(id => roles.find(r => r.id === id)?.name ?? id).join(",") || null,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setResult({ ok: true, msg: "Discord settings saved!" });
      } else {
        setResult({ ok: false, msg: data.error ?? "Failed to save." });
      }
    } catch (e) {
      setResult({ ok: false, msg: String(e) });
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="text-muted text-sm">Loading Discord settings…</p>;

  return (
    <div className="space-y-5">
      {/* Server */}
      <div>
        <label>Discord Server</label>
        <select
          value={selectedGuild?.id ?? ""}
          onChange={e => onGuildChange(e.target.value)}
        >
          <option value="">— Select a server —</option>
          {guilds.map(g => (
            <option key={g.id} value={g.id}>{g.name}</option>
          ))}
        </select>
      </div>

      {/* Channel */}
      {channels.length > 0 && (
        <div>
          <label>Post roll calls to channel</label>
          <select
            value={selectedChannel?.id ?? ""}
            onChange={e => {
              const ch = channels.find(c => c.id === e.target.value) ?? null;
              setSelectedChannel(ch);
            }}
          >
            <option value="">— Select a channel —</option>
            {channels.map(c => (
              <option key={c.id} value={c.id}>#{c.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Roles (checkboxes) */}
      {roles.length > 0 && (
        <div>
          <label className="mb-2 block">Ping roles <span className="text-muted">(optional — tick all that apply)</span></label>
          <div className="border border-border rounded-md max-h-48 overflow-y-auto p-3 space-y-1">
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

      <button
        onClick={save}
        disabled={saving}
        className="bg-accent hover:bg-accentHover disabled:bg-border disabled:text-muted disabled:cursor-not-allowed text-white font-medium px-5 py-2.5 rounded-md transition-colors"
      >
        {saving ? "Saving…" : "Save Discord settings"}
      </button>

      {result && (
        <p className={result.ok ? "text-green-400 text-sm" : "text-accent text-sm"}>
          {result.msg}
        </p>
      )}
    </div>
  );
}
