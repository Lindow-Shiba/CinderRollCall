"use client";

import { useState, useRef } from "react";
import type { Squad } from "@/lib/supabase";

type Props = {
  platoonId: number;
  squads: Squad[];
};

export function SortableSquadList({ platoonId, squads: initialSquads }: Props) {
  const [squads, setSquads] = useState<Squad[]>(initialSquads);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);

  const byKind = {
    squad: squads.filter(s => s.kind === "squad"),
    team: squads.filter(s => s.kind === "team"),
    reserve: squads.filter(s => s.kind === "reserve"),
  };

  function handleDragStart(index: number) {
    dragItem.current = index;
  }

  function handleDragEnter(index: number) {
    dragOverItem.current = index;
    // Reorder in state for visual feedback
    const newSquads = [...squads];
    const draggedItem = newSquads.splice(dragItem.current!, 1)[0];
    newSquads.splice(index, 0, draggedItem);
    dragItem.current = index;
    setSquads(newSquads);
  }

  function handleDragEnd() {
    dragItem.current = null;
    dragOverItem.current = null;
    saveOrder();
  }

  async function saveOrder() {
    setSaving(true);
    setSaved(false);
    try {
      const order = squads.map((s, i) => ({ id: s.id, sort_order: (i + 1) * 10 }));
      await fetch("/api/squads/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platoonId, order }),
      });
      // Update local sort_order values
      setSquads(squads.map((s, i) => ({ ...s, sort_order: (i + 1) * 10 })));
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  }

  const kindLabels: Record<string, string> = { squad: "SQUADS", team: "TEAMS", reserve: "RESERVES" };

  return (
    <div>
      {(["squad", "team", "reserve"] as const).map(kind => {
        const list = squads.filter(s => s.kind === kind);
        if (list.length === 0) return null;
        return (
          <div key={kind} style={{ marginBottom: "12px" }}>
            <div style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.1em", color: "var(--muted)", textTransform: "uppercase", marginBottom: "4px" }}>
              {kindLabels[kind]}
            </div>
            {list.map((s) => {
              const globalIndex = squads.findIndex(sq => sq.id === s.id);
              return (
                <div
                  key={s.id}
                  draggable
                  onDragStart={() => handleDragStart(globalIndex)}
                  onDragEnter={() => handleDragEnter(globalIndex)}
                  onDragEnd={handleDragEnd}
                  onDragOver={e => e.preventDefault()}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "7px 0",
                    borderBottom: "1px solid #1e2938",
                    cursor: "grab",
                    userSelect: "none",
                  }}
                >
                  {/* Drag handle */}
                  <span style={{ color: "var(--muted)", fontSize: "14px", cursor: "grab", flexShrink: 0 }}>⠿</span>
                  <span style={{ flex: 1, fontSize: "13px" }}>{s.name}</span>
                  <form method="POST" action="/api/admin/actions" style={{ flexShrink: 0 }}>
                    <input type="hidden" name="action" value="squad.delete" />
                    <input type="hidden" name="id" value={s.id} />
                    <button
                      type="submit"
                      style={{ fontSize: "11px", color: "var(--muted)", background: "none", border: "none", cursor: "pointer" }}
                      onClick={e => { if (!confirm(`Remove ${s.name}?`)) e.preventDefault(); }}
                    >
                      Remove
                    </button>
                  </form>
                </div>
              );
            })}
          </div>
        );
      })}
      {saving && <div style={{ fontSize: "11px", color: "var(--muted)", marginTop: "6px" }}>Saving order…</div>}
      {saved && <div style={{ fontSize: "11px", color: "#3fb950", marginTop: "6px" }}>✓ Order saved</div>}
    </div>
  );
}
