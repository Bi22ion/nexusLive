import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { StreamGrid } from "@/components/market/StreamGrid";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function History() {
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) redirect("/login");

  // Get user's viewed streams
  const { data: history } = await supabase
    .from("user_history")
    .select(`
      stream_id,
      viewed_at,
      program_schedule!inner(
        *,
        host_profile:profiles!program_schedule_host_fkey(
          id,
          username,
          avatar_url,
          display_name,
          country_code
        )
      )
    `)
    .eq("user_id", uid)
    .order("viewed_at", { ascending: false });

  const streams = history?.map(h => ({
    ...h.program_schedule,
    viewed_at: h.viewed_at
  })) || [];

  return (
    <div className="space-y-10 pb-20 bg-black min-h-screen">
      <section className="px-6 pt-10">
        <div className="mb-4">
          <h2 className="text-xl font-black text-white uppercase italic tracking-tighter">
            Watch History
          </h2>
        </div>
        {streams.length > 0 ? (
          <StreamGrid initialData={streams} />
        ) : (
          <div className="py-20 text-center rounded-3xl border border-dashed border-white/10 bg-neutral-900/20">
            <p className="text-sm text-neutral-500 uppercase tracking-widest font-bold">
              No watch history
            </p>
            <p className="text-xs text-neutral-600 mt-1 italic">
              Streams you watch will appear here.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}