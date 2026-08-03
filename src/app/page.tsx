"use client";

import * as React from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { FeaturedPkBattles } from "@/components/market/FeaturedPkBattles";
import { StreamGrid } from "@/components/market/StreamGrid";
import { subscribeWithRetry } from "@/lib/realtime/subscribeWithRetry";
import { Loader2 } from "lucide-react";

interface HomeProps {
  searchParams: Promise<{ category?: string }>;
}

const CATEGORY_TABS = ["All", "Solo", "Couple", "BDSM", "VR Cams"] as const;

export default function Home({ searchParams }: HomeProps) {
  const [category, setCategory] = React.useState<string | undefined>();
  const [liveStreams, setLiveStreams] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const supabase = React.useMemo(() => createSupabaseBrowserClient(), []);

  const fetchLiveStreams = React.useCallback(async () => {
    if (!supabase) return;

    let query = supabase
      .from("program_schedule")
      .select(`
        *,
        host_profile:profiles!program_schedule_host_fkey(
          id, username, avatar_url, display_name
        )
      `)
      .eq("status", "live")
      .order("created_at", { ascending: false });

    if (category && category !== "all") {
      if (category === "solo") {
        query = query.eq("is_pk", false);
      } else {
        query = query.eq("category", category);
      }
    }

    const { data, error } = await query;
    if (!error && data) {
      setLiveStreams(data);
      setLoading(false);
      return;
    }

    const { data: fallbackData } = await supabase
      .from("program_schedule")
      .select("*")
      .eq("status", "live")
      .order("created_at", { ascending: false });
    setLiveStreams(fallbackData ?? []);
    setLoading(false);
  }, [category, supabase]);

  React.useEffect(() => {
    searchParams.then((params) => setCategory(params.category));
  }, [searchParams]);

  React.useEffect(() => {
    fetchLiveStreams();
  }, [fetchLiveStreams]);

  React.useEffect(() => {
    const timer = setInterval(fetchLiveStreams, 15000);
    return () => clearInterval(timer);
  }, [fetchLiveStreams]);

  React.useEffect(() => {
    if (!supabase) return;
    const channel = supabase.channel("home-live-sync");
    channel.on(
      "postgres_changes",
      { event: "*", schema: "public", table: "program_schedule" },
      () => fetchLiveStreams()
    );
    const stop = subscribeWithRetry(channel);
    return () => {
      stop();
      supabase.removeChannel(channel);
    };
  }, [fetchLiveStreams, supabase]);

  const pkStreams = liveStreams?.filter((s) => s.is_pk === true) || [];
  const soloStreams = liveStreams?.filter((s) => s.is_pk !== true) || [];

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-neutral-500">
          <Loader2 className="h-7 w-7 animate-spin" />
          <span className="text-xs uppercase tracking-[0.2em]">Loading live streams</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-16">
      {pkStreams.length > 0 && (
        <section>
          <div className="mb-3 flex items-center gap-2">
            <span className="h-4 w-1 rounded-full bg-red-600" />
            <h2 className="text-sm font-bold uppercase tracking-tight text-white">
              Live PK Battles
            </h2>
          </div>
          <FeaturedPkBattles initialData={pkStreams} />
        </section>
      )}

      <section>
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-lg font-bold uppercase tracking-tight text-white">
              Recommended For You
            </h1>
            <p className="mt-0.5 text-xs text-neutral-500">Real-time feeds from active creators</p>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            {CATEGORY_TABS.map((tab) => {
              const cat = tab.toLowerCase();
              const isActive = !category || category === cat || (category === "all" && tab === "All");
              return (
                <a
                  key={tab}
                  href={tab === "All" ? "/" : `?category=${cat}`}
                  className={`whitespace-nowrap rounded-full border px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-wider transition-all ${
                    isActive
                      ? "border-red-500/40 bg-red-500/10 text-red-400"
                      : "border-white/[0.06] bg-neutral-900/40 text-neutral-400 hover:border-white/10 hover:text-neutral-200"
                  }`}
                >
                  {tab}
                </a>
              );
            })}
          </div>
        </div>

        {soloStreams.length > 0 ? (
          <StreamGrid initialData={soloStreams} />
        ) : (
          <div className="rounded-2xl border border-dashed border-white/[0.08] bg-neutral-900/20 py-16 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-neutral-800">
              <span className="h-2 w-2 animate-pulse rounded-full bg-neutral-600" />
            </div>
            <p className="text-sm font-bold uppercase tracking-widest text-neutral-500">
              No live rooms active
            </p>
            <p className="mt-1 text-xs text-neutral-600">
              Start a broadcast in the Studio to be the first on the list
            </p>
          </div>
        )}
      </section>

      {soloStreams.length > 0 && (
        <section>
          <div className="mb-3 flex items-center gap-2">
            <span className="h-4 w-1 rounded-full bg-violet-500" />
            <h2 className="text-sm font-bold uppercase tracking-tight text-white">New Models</h2>
          </div>
          <StreamGrid initialData={soloStreams.slice(0, 5)} />
        </section>
      )}
    </div>
  );
}
