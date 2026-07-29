import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function PkIndexPage() {
  const supabase = await createSupabaseServerClient();
  const { data: sessions } = await supabase
    .from("pk_sessions")
    .select("id, status, score_a, score_b, created_at")
    .order("created_at", { ascending: false })
    .limit(30);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-white">PK Battles</h1>
        <p className="mt-1 text-xs text-neutral-400">Open any battle room and watch in real-time.</p>
      </div>

      {!sessions?.length ? (
        <div className="rounded-2xl border border-white/10 bg-neutral-900/30 p-6 text-sm text-neutral-400">
          No PK battles yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {sessions.map((session: any) => (
            <Link
              key={session.id}
              href={`/pk/${session.id}`}
              className="rounded-2xl border border-white/10 bg-neutral-900/30 p-4 hover:border-white/20"
            >
              <div className="text-[11px] uppercase tracking-[0.2em] text-neutral-500">{session.status}</div>
              <div className="mt-2 text-sm font-semibold text-white">
                {(session.score_a ?? 0).toLocaleString()} : {(session.score_b ?? 0).toLocaleString()}
              </div>
              <div className="mt-1 text-xs text-neutral-500">{new Date(session.created_at).toLocaleString()}</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

