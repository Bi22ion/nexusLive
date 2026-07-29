import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { processQueuedRecordingJobs } from "@/lib/recordings/processRecordingJobs";

function isCronAuthorized(request: Request) {
  const configuredSecret = process.env.CRON_SECRET;
  if (!configuredSecret) return process.env.NODE_ENV !== "production";

  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return false;
  const provided = authHeader.slice("Bearer ".length);
  return provided === configuredSecret;
}

export async function GET(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized cron request" }, { status: 401 });
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { queued, processed } = await processQueuedRecordingJobs(supabase, 10);
    return NextResponse.json({ ok: true, queued, processed });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? "Cron processing failed" }, { status: 500 });
  }
}

