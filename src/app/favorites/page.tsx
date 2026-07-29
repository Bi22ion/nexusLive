import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { StreamGrid } from "@/components/market/StreamGrid";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function Favorites() {
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) redirect("/login");

  // Get user's favorite model ids
  const { data: favorites } = await supabase
    .from("user_favorites")
    .select("model_id")
    .eq("user_id", uid);

  const modelIds = favorites?.map(f => f.model_id) || [];

  if (modelIds.length === 0) {
    return (
      <div className="space-y-10 pb-20 bg-black min-h-screen px-6 pt-10">
        <div className="py-20 text-center rounded-3xl border border-dashed border-white/10 bg-neutral-900/20">
          <p className="text-sm text-neutral-500 uppercase tracking-widest font-bold">
            No favorites yet
          </p>
          <p className="text-xs text-neutral-600 mt-1 italic">
            Follow models to see them here!
          </p>
        </div>
      </div>
    );
  }

  // Get live streams from favorite models
  const { data: liveStreams, error } = await supabase
    .from("program_schedule")
    .select(`
      *,
      host_profile:profiles!program_schedule_host_fkey(
        id,
        username,
        avatar_url,
        display_name,
        country_code
      )
    `)
    .eq("status", "live")
    .in("host", modelIds)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Favorites Fetch Error:", error.message);
  }

  const streams = liveStreams || [];

  return (
    <div className="space-y-10 pb-20 bg-black min-h-screen">
      <section className="px-6 pt-10">
        <div className="mb-4">
          <h2 className="text-xl font-black text-white uppercase italic tracking-tighter">
            Your Favorites
          </h2>
        </div>
        {streams.length > 0 ? (
          <StreamGrid initialData={streams} />
        ) : (
          <div className="py-20 text-center rounded-3xl border border-dashed border-white/10 bg-neutral-900/20">
            <p className="text-sm text-neutral-500 uppercase tracking-widest font-bold">
              No live favorites
            </p>
            <p className="text-xs text-neutral-600 mt-1 italic">
              Your favorite models aren't live right now.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}