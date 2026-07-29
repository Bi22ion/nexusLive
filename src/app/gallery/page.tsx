import { createSupabaseServerClient } from "@/lib/supabase/server";
import { StreamGrid } from "@/components/market/StreamGrid";

// Force-dynamic ensures the page updates
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function Gallery() {
  const supabase = await createSupabaseServerClient();

  // Fetch all host profiles
  const { data: models, error } = await supabase
    .from("profiles")
    .select("id, username, avatar_url, display_name, country_code")
    .eq("role", "host")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Gallery Fetch Error:", error.message);
  }

  // For gallery, we can show models as streams, perhaps with placeholder
  // Since StreamGrid expects stream format, we need to adapt
  // For now, create mock streams for models
  const mockStreams = models?.map(model => ({
    id: model.id,
    host: model.id,
    title: model.display_name || model.username,
    category: "Gallery",
    is_pk: false,
    status: "offline", // or something
    media_url: null,
    host_profile: model
  })) || [];

  return (
    <div className="space-y-10 pb-20 bg-black min-h-screen">
      <section className="px-6 pt-10">
        <div className="mb-4">
          <h2 className="text-xl font-black text-white uppercase italic tracking-tighter">
            Model Gallery
          </h2>
        </div>
        <StreamGrid initialData={mockStreams} />
      </section>
    </div>
  );
}