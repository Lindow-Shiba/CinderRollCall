import { getSession } from "@/lib/session";
import { supabaseAdmin, type Platoon, type Squad } from "@/lib/supabase";
import DiscordSetup from "@/components/DiscordSetup";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminPage({
  searchParams,
}: {
  searchParams: { err?: string };
}) {
  const session = await getSession();

  if (!session.admin) {
    return (
      <div className="max-w-md mx-auto mt-16">
        <h1 className="text-2xl font-semibold mb-2 text-center">Admin access</h1>
        <p className="text-muted text-sm mb-6 text-center">
          Enter the admin password to manage platoons and squads.
        </p>
        <form
          method="POST"
          action="/api/admin/login"
          className="bg-panel border border-border rounded-lg p-6 space-y-4"
        >
          <div>
            <label>Password</label>
            <input type="password" name="password" autoFocus required />
          </div>
          {searchParams.err && (
            <p className="text-accent text-sm">Wrong password.</p>
          )}
          <button
            type="submit"
            className="bg-accent hover:bg-accentHover text-white font-medium px-4 py-2 rounded-md w-full"
          >
            Sign in
          </button>
        </form>
      </div>
    );
  }

  const sb = supabaseAdmin();
  const [pRes, sRes] = await Promise.all([
    sb.from("platoons").select("*").order("name"),
    sb.from("squads").select("*").order("sort_order"),
  ]);

  const platoons = (pRes.data as Platoon[]) ?? [];
  const squads = (sRes.data as Squad[]) ?? [];

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold">Admin</h1>
          <p className="text-muted text-sm mt-1">
            Manage platoons, squads, and Discord settings.
          </p>
        </div>
        <form method="POST" action="/api/admin/logout">
          <button type="submit" className="text-muted hover:text-text text-sm underline">
            Lock admin
          </button>
        </form>
      </div>

      {searchParams.err && (
        <div className="bg-accent/10 border border-accent/40 text-accent rounded-md px-4 py-2 text-sm mb-6">
          Error: {searchParams.err}
        </div>
      )}

      {/* ---------- Discord setup ---------- */}
      <section className="bg-panel border border-border rounded-lg p-6 mb-6">
        <h2 className="text-lg font-semibold mb-1">Discord Setup</h2>
        <p className="text-muted text-sm mb-4">Configure the default server for the bot. Channel and ping roles are chosen per roll call on the Post page.</p>
        <DiscordSetup />
      </section>

      {/* ---------- Create platoon ---------- */}
      <section className="bg-panel border border-border rounded-lg p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">New platoon</h2>
        <form method="POST" action="/api/admin/actions" className="flex gap-3 items-end">
          <input type="hidden" name="action" value="platoon.create" />
          <div className="flex-1">
            <label>Name</label>
            <input type="text" name="name" placeholder="Cinder Platoon" required />
          </div>
          <button
            type="submit"
            className="bg-accent hover:bg-accentHover text-white font-medium px-4 py-2 rounded-md"
          >
            Add
          </button>
        </form>
      </section>

      {/* ---------- Existing platoons ---------- */}
      {platoons.map((p) => {
        const pSquads = squads.filter((s) => s.platoon_id === p.id);
        return (
          <section key={p.id} className="bg-panel border border-border rounded-lg p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">{p.name}</h2>
              <form method="POST" action="/api/admin/actions">
                <input type="hidden" name="action" value="platoon.delete" />
                <input type="hidden" name="id" value={p.id} />
                <button type="submit" className="text-muted hover:text-accent text-sm">
                  Delete platoon
                </button>
              </form>
            </div>

            {/* Edit name */}
            <form
              method="POST"
              action="/api/admin/actions"
              className="flex gap-3 items-end mb-6"
            >
              <input type="hidden" name="action" value="platoon.update" />
              <input type="hidden" name="id" value={p.id} />
              <div className="flex-1">
                <label>Name</label>
                <input type="text" name="name" defaultValue={p.name} required />
              </div>
              <button
                type="submit"
                className="bg-border hover:bg-border/80 text-text font-medium px-4 py-2 rounded-md"
              >
                Save
              </button>
            </form>

            {/* Squads */}
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted mb-3">
              Squads / Teams / Reserves
            </h3>
            {pSquads.length > 0 && (
              <ul className="mb-4 space-y-1">
                {pSquads.map((s) => (
                  <li key={s.id} className="flex items-center gap-2 text-sm">
                    <span className="inline-block w-12 text-muted font-mono text-xs">
                      {s.sort_order}
                    </span>
                    <span className="flex-1">{s.name}</span>
                    <span className="text-muted text-xs w-20">{s.kind}</span>
                    <form method="POST" action="/api/admin/actions">
                      <input type="hidden" name="action" value="squad.delete" />
                      <input type="hidden" name="id" value={s.id} />
                      <button type="submit" className="text-muted hover:text-accent text-xs">
                        remove
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            )}
            <form
              method="POST"
              action="/api/admin/actions"
              className="grid grid-cols-[1fr_140px_100px_auto] gap-3 items-end"
            >
              <input type="hidden" name="action" value="squad.create" />
              <input type="hidden" name="platoon_id" value={p.id} />
              <div>
                <label>Name</label>
                <input type="text" name="name" placeholder="Cinder 1-1" required />
              </div>
              <div>
                <label>Kind</label>
                <select name="kind" defaultValue="squad">
                  <option value="squad">Squad</option>
                  <option value="team">Team</option>
                  <option value="reserve">Reserve</option>
                </select>
              </div>
              <div>
                <label>Sort</label>
                <input type="number" name="sort_order" defaultValue={(pSquads.length + 1) * 10} />
              </div>
              <button
                type="submit"
                className="bg-border hover:bg-border/80 text-text font-medium px-4 py-2 rounded-md"
              >
                Save
              </button>
            </form>
          </section>
        );
      })}
    </div>
  );
}
