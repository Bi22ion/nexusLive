import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { processQueuedRecordingJobs } from "@/lib/recordings/processRecordingJobs";

function isWorkerAuthorized(request: Request) {
  const configuredKey = process.env.RECORDING_WORKER_KEY;
  if (!configuredKey) return process.env.NODE_ENV !== "production";
  const providedKey = request.headers.get("x-worker-key");
  return providedKey === configuredKey;
}

export async function POST(request: Request) {
  if (!isWorkerAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized worker request" }, { status: 401 });
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { queued, processed } = await processQueuedRecordingJobs(supabase, 10);
    return NextResponse.json({
      ok: true,
      queued,
      processed,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? "Worker processing failed" }, { status: 500 });
  }
}

