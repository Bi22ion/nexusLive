import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PurchaseVodButton } from "@/components/vod/PurchaseVodButton";
import { VideoPlayer } from "@/components/VideoPlayer";

export const dynamic = "force-dynamic";

export default async function RecordingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id ?? null;

  const { data: vod } = await supabase
    .from("vod_assets")
    .select(`
      id,
      host_id,
      title,
      description,
      playback_url,
      price_tokens,
      visibility,
      status,
      created_at,
      host_profile:profiles!vod_assets_host_id_fkey(
        username,
        display_name
      )
    `)
    .eq("id", id)
    .maybeSingle();

  if (!vod) {
    return <div className="p-6 text-sm text-neutral-400">Recording not found.</div>;
  }

  const isPublic = vod.visibility === "public" || vod.price_tokens === 0;
  let hasAccess = isPublic;
  if (!hasAccess && uid) {
    const { data: access } = await supabase
      .from("vod_access")
      .select("vod_id")
      .eq("user_id", uid)
      .eq("vod_id", id)
      .maybeSingle();
    hasAccess = !!access;
  }

  const hostProfile = Array.isArray(vod.host_profile) ? vod.host_profile[0] : vod.host_profile;
  const hostName = hostProfile?.display_name || hostProfile?.username || "Host";

  return (
    <div className="space-y-5 px-6 py-8">
      <Link href="/recordings" className="text-xs text-neutral-400 hover:text-white">
        ← Back to replay rooms
      </Link>

      <div className="rounded-2xl border border-white/10 bg-neutral-900/30 p-5">
        <div className="text-xs uppercase tracking-[0.2em] text-neutral-500">{hostName}</div>
        <h1 className="mt-2 text-xl font-bold text-white">{vod.title}</h1>
        <p className="mt-2 text-sm text-neutral-300">{vod.description || "No description."}</p>
        <div className="mt-2 text-xs text-neutral-500">{new Date(vod.created_at).toLocaleString()}</div>
      </div>

      {!hasAccess ? (
        <div className="rounded-2xl border border-dashed border-violet-500/40 bg-violet-900/10 p-6">
          <div className="text-sm text-neutral-300">
            This replay is premium content. Unlock once and watch anytime.
          </div>
          {uid ? (
            <div className="mt-4">
              <PurchaseVodButton vodId={vod.id} priceTokens={vod.price_tokens ?? 0} />
            </div>
          ) : (
            <div className="mt-4 text-xs text-neutral-400">
              Please <Link href="/login" className="text-violet-400 hover:underline">log in</Link> to purchase access.
            </div>
          )}
        </div>
      ) : vod.status !== "ready" || !vod.playback_url ? (
        <div className="rounded-2xl border border-white/10 bg-neutral-900/30 p-6 text-sm text-neutral-400">
          Recording is still processing. Please check again soon.
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-black">
          <div className="aspect-video">
            <VideoPlayer src={vod.playback_url} />
          </div>
        </div>
      )}
    </div>
  );
}

