import { createSupabaseServerClient } from "@/lib/supabase/server";
import { FeaturedPkBattles } from "@/components/market/FeaturedPkBattles";
import { StreamGrid } from "@/components/market/StreamGrid";

// Force-dynamic ensures the marketplace updates the instant a creator hits "Go Live"
// This prevents the "dummy data" or "stale data" issue.
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function Recommended() {
  const supabase = await createSupabaseServerClient();

  // 1. Fetching all live programs with creator profile data
  // We name the join 'host_profile' to match exactly what the StreamGrid expects
  const { data: liveStreams, error } = await supabase
    .from("program_schedule")
    .select(`
      *,
      host_profile:profiles!program_schedule_host_fkey(
        id,
        username,
        avatar_url,
        display_name
      )
    `)
    .eq("status", "live")
    .not("media_url", "is", null)
    .neq("media_url", "")
    .not("started_at", "is", null)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Recommended Fetch Error:", error.message);
  }

  // 2. High-performance filtering for the UI
  // Separates PK Battles from Standard Solo streams
  const pkStreams = liveStreams?.filter(s => s.is_pk === true) || [];
  const soloStreams = liveStreams?.filter(s => s.is_pk !== true) || [];

  return (
    <div className="space-y-10 pb-20 bg-black min-h-screen">

      {/* 1. TOP SECTION: PK BATTLES */}
      {pkStreams.length > 0 && (
        <section className="px-6 pt-10">
          <div className="mb-4">
            <h2 className="text-xl font-black text-red-600 uppercase italic tracking-tighter">
              Live PK Battles
            </h2>
          </div>
          <FeaturedPkBattles initialData={pkStreams} />
        </section>
      )}

      {/* 2. MAIN MARKETPLACE SECTION */}
      <section className="px-6 pt-6">
        <div className="mb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="text-lg sm:text-xl font-semibold text-white uppercase tracking-tighter italic">
              Recommended Streams
            </h1>
            <p className="mt-1 text-xs text-neutral-400">Curated live streams recommended for you.</p>
          </div>

          {/* Quick Category Filters */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 sm:pb-0 no-scrollbar">
            {['All', 'Solo', 'Dancing', 'Singing', 'Talk'].map((tab) => (
              <button
                key={tab}
                className="whitespace-nowrap px-4 py-1.5 rounded-full bg-neutral-900 border border-white/5 text-[10px] font-bold uppercase hover:border-red-600 transition-all text-neutral-300 hover:text-white"
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* 3. THE LIVE GRID */}
        {soloStreams.length > 0 ? (
          <StreamGrid initialData={soloStreams} />
        ) : (
          <div className="py-20 text-center rounded-3xl border border-dashed border-white/10 bg-neutral-900/20">
            <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-neutral-800 mb-4">
              <div className="h-2 w-2 rounded-full bg-neutral-600 animate-ping" />
            </div>
            <p className="text-sm text-neutral-500 uppercase tracking-widest font-bold">
              No live rooms active
            </p>
            <p className="text-xs text-neutral-600 mt-1 italic">
              Start a broadcast in the Studio to be the first on the list!
            </p>
          </div>
        )}
      </section>
    </div>
  );
}