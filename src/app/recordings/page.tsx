import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function RecordingsPage() {
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id ?? null;

  const { data: vods } = await supabase
    .from("vod_assets")
    .select(`
      id,
      host_id,
      title,
      description,
      price_tokens,
      created_at,
      status,
      visibility,
      host_profile:profiles!vod_assets_host_id_fkey(
        username,
        display_name
      )
    `)
    .eq("status", "ready")
    .in("visibility", ["public", "paid"])
    .order("created_at", { ascending: false })
    .limit(60);

  let ownedMap = new Set<string>();
  if (uid && vods?.length) {
    const { data: accessRows } = await supabase
      .from("vod_access")
      .select("vod_id")
      .eq("user_id", uid)
      .in("vod_id", vods.map((v: any) => v.id));
    ownedMap = new Set((accessRows ?? []).map((r: any) => r.vod_id));
  }

  return (
    <div className="space-y-6 px-6 py-8">
      <div>
        <h1 className="text-2xl font-black uppercase italic tracking-tighter text-white">Replay Rooms</h1>
        <p className="mt-1 text-xs text-neutral-400">Watch archived streams. Paid entries unlock private recordings.</p>
      </div>

      {!vods?.length ? (
        <div className="rounded-2xl border border-white/10 bg-neutral-900/30 p-6 text-sm text-neutral-400">
          No recordings available yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {vods.map((vod: any) => {
            const owned = ownedMap.has(vod.id);
            const hostProfile = Array.isArray(vod.host_profile) ? vod.host_profile[0] : vod.host_profile;
            const hostName = hostProfile?.display_name || hostProfile?.username || "Host";
            return (
              <div key={vod.id} className="rounded-2xl border border-white/10 bg-neutral-900/30 p-4">
                <div className="text-xs uppercase tracking-[0.2em] text-neutral-500">{hostName}</div>
                <div className="mt-2 text-sm font-semibold text-white">{vod.title}</div>
                <div className="mt-1 line-clamp-2 text-xs text-neutral-400">{vod.description || "No description."}</div>
                <div className="mt-3 flex items-center justify-between text-xs text-neutral-400">
                  <span>{new Date(vod.created_at).toLocaleDateString()}</span>
                  <span>{vod.visibility === "public" ? "Free" : `${vod.price_tokens} tokens`}</span>
                </div>
                <Link
                  href={`/recordings/${vod.id}`}
                  className="mt-4 inline-flex rounded-full border border-white/10 px-3 py-1.5 text-xs font-bold text-white hover:bg-white/5"
                >
                  {owned || vod.visibility === "public" ? "Watch now" : "Open paywall"}
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

