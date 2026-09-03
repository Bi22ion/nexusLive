import { createSupabaseServerClient } from "@/lib/supabase/server";
import { FeaturedPkBattles } from "@/components/market/FeaturedPkBattles";
import { StreamGrid } from "@/components/market/StreamGrid";
import { CategoryStripcashFeed } from "@/components/market/CategoryStripcashFeed";
import {
  getSpecialCategoryFilter,
  getSpecialCategoryLabel,
} from "@/lib/modelFilters";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface CategoryPageProps {
  params: Promise<{ slug: string }>;
}

const SPECIAL_SLUGS = ["ukrainian", "new", "vr", "bdsm", "tickets"];

export default async function CategoryPage({ params }: CategoryPageProps) {
  const { slug } = await params;
  const supabase = await createSupabaseServerClient();

  // Fetch live community streams in this category
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

  const pkStreams = liveStreams?.filter((s) => s.is_pk === true) || [];
  const soloStreams = liveStreams?.filter((s) => s.is_pk !== true) || [];

  const categoryName = getSpecialCategoryLabel(slug);
  const isSpecial = SPECIAL_SLUGS.includes(slug.toLowerCase());
  const specialApiParams = isSpecial ? getSpecialCategoryFilter(slug) : null;

  return (
    <div className="space-y-10 pb-20 bg-black min-h-screen">
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

      {/* Stripcash feed for special categories */}
      {isSpecial && specialApiParams && (
        <section className="px-6 pt-6">
          <CategoryStripcashFeed
            categoryName={categoryName}
            apiParams={specialApiParams}
          />
        </section>
      )}

      {/* Community streams */}
      <section className="px-6 pt-6">
        <div className="mb-6">
          <h1 className="text-lg sm:text-xl font-semibold text-white uppercase tracking-tighter italic">
            {categoryName} Streams
          </h1>
          <p className="mt-1 text-xs text-neutral-400">
            Live streams in the {categoryName} category.
          </p>
        </div>

        {soloStreams.length > 0 ? (
          <StreamGrid initialData={soloStreams} />
        ) : (
          <div className="py-20 text-center rounded-3xl border border-dashed border-white/10 bg-neutral-900/20">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-neutral-800">
              <span className="h-2 w-2 animate-pulse rounded-full bg-neutral-600" />
            </div>
            <p className="text-sm text-neutral-500 uppercase tracking-widest font-bold">
              No {categoryName.toLowerCase()} streams active
            </p>
            <p className="mt-2 text-xs text-neutral-600">
              Check back soon or browse other categories
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
