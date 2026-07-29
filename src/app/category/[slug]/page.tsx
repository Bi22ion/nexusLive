import { createSupabaseServerClient } from "@/lib/supabase/server";
import { FeaturedPkBattles } from "@/components/market/FeaturedPkBattles";
import { StreamGrid } from "@/components/market/StreamGrid";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface CategoryPageProps {
  params: Promise<{ slug: string }>;
}

export default async function CategoryPage({ params }: CategoryPageProps) {
  const { slug } = await params;
  const supabase = await createSupabaseServerClient();

  // Fetch live streams in this category
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
    .eq("category", slug)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Category Fetch Error:", error.message);
  }

  // Separate PK and solo
  const pkStreams = liveStreams?.filter(s => s.is_pk === true) || [];
  const soloStreams = liveStreams?.filter(s => s.is_pk !== true) || [];

  const categoryName = slug.charAt(0).toUpperCase() + slug.slice(1);

  return (
    <div className="space-y-10 pb-20 bg-black min-h-screen">

      {/* PK Battles in category */}
      {pkStreams.length > 0 && (
        <section className="px-6 pt-10">
          <div className="mb-4">
            <h2 className="text-xl font-black text-red-600 uppercase italic tracking-tighter">
              {categoryName} PK Battles
            </h2>
          </div>
          <FeaturedPkBattles initialData={pkStreams} />
        </section>
      )}

      {/* Main section */}
      <section className="px-6 pt-6">
        <div className="mb-6">
          <h1 className="text-lg sm:text-xl font-semibold text-white uppercase tracking-tighter italic">
            {categoryName} Streams
          </h1>
          <p className="mt-1 text-xs text-neutral-400">Live streams in the {categoryName} category.</p>
        </div>

        {soloStreams.length > 0 ? (
          <StreamGrid initialData={soloStreams} />
        ) : (
          <div className="py-20 text-center rounded-3xl border border-dashed border-white/10 bg-neutral-900/20">
            <p className="text-sm text-neutral-500 uppercase tracking-widest font-bold">
              No {categoryName.toLowerCase()} streams active
            </p>
          </div>
        )}
      </section>
    </div>
  );
}