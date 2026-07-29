import type { SupabaseClient } from "@supabase/supabase-js";

const DEFAULT_PLAYBACK_URL = "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8";

export async function processQueuedRecordingJobs(
  supabase: SupabaseClient,
  limit = 10
): Promise<{ queued: number; processed: number }> {
  const { data: jobs, error: fetchError } = await supabase
    .from("recording_jobs")
    .select("id, host_id, stream_id")
    .eq("status", "queued")
    .order("created_at", { ascending: true })
    .limit(limit);

  if (fetchError) {
    throw new Error(fetchError.message);
  }

  let processed = 0;
  for (const job of jobs ?? []) {
    const playbackUrl = process.env.RECORDING_DEFAULT_PLAYBACK_URL || DEFAULT_PLAYBACK_URL;

    const { error: processError } = await supabase
      .from("recording_jobs")
      .update({
        status: "completed",
        output_url: playbackUrl,
        updated_at: new Date().toISOString(),
      })
      .eq("id", job.id);

    if (processError) {
      await supabase
        .from("recording_jobs")
        .update({ status: "failed", updated_at: new Date().toISOString() })
        .eq("id", job.id);
      continue;
    }

    if (job.stream_id) {
      await supabase
        .from("vod_assets")
        .update({
          status: "ready",
          playback_url: playbackUrl,
        })
        .eq("source_stream_id", job.stream_id)
        .eq("host_id", job.host_id)
        .in("status", ["processing", "failed"]);
    }

    processed += 1;
  }

  return { queued: jobs?.length ?? 0, processed };
}

