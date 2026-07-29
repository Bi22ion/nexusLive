import { createSupabaseServerClient } from "@/lib/supabase/server";
import { StreamGrid } from "@/components/market/StreamGrid";
import { ModelLiveSession } from "@/components/live/ModelLiveSession";

export default async function ModelPage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const supabase = await createSupabaseServerClient();

  // Fetch profile by username first
  let { data: profile } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url")
    .eq("username", username)
    .maybeSingle();

  // Fallback: if route slug is actually a host UUID, resolve by id.
  if (!profile && /^[0-9a-fA-F-]{36}$/.test(username)) {
    const { data: profileById } = await supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url")
      .eq("id", username)
      .maybeSingle();
    profile = profileById;
  }

  if (!profile) {
    return <div className="p-6 text-white">Model not found</div>;
  }

  // Fetch live stream if any
  const { data: stream } = await supabase
    .from("program_schedule")
    .select("*")
    .eq("host", profile.id)
    .eq("status", "live")
    .single();
  // Fetch other live streams for "More live models"
  const { data: otherStreams } = await supabase
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
    .neq("host", profile.id)
    .order("created_at", { ascending: false })
    .limit(10);

  return (
    <div className="space-y-6">
      <ModelLiveSession hostId={profile.id} hostProfile={profile} initialStream={stream ?? null} />

      <div>
        <h2 className="text-lg font-semibold">More live models</h2>
        <div className="mt-4">
          <StreamGrid initialData={otherStreams || []} />
        </div>
      </div>
    </div>
  );
}

