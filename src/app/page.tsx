"use client";

import * as React from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { FeaturedPkBattles } from "@/components/market/FeaturedPkBattles";
import { StreamGrid } from "@/components/market/StreamGrid";
import { subscribeWithRetry } from "@/lib/realtime/subscribeWithRetry";

interface HomeProps {
  searchParams: Promise<{ category?: string }>;
}

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
          id,
          username,
          avatar_url,
          display_name
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

    // Fallback query if join/filter assumptions fail on some DB states.
    const { data: fallbackData } = await supabase
      .from("program_schedule")
      .select("*")
      .eq("status", "live")
      .order("created_at", { ascending: false });
    setLiveStreams(fallbackData ?? []);
    setLoading(false);
  }, [category, supabase]);

  // Parse search params on client side
  React.useEffect(() => {
    searchParams.then(params => setCategory(params.category));
  }, [searchParams]);

  // Fetch initial data
  React.useEffect(() => {
    fetchLiveStreams();
  }, [fetchLiveStreams]);

  // Polling fallback keeps public home updated even if websocket reconnects fail.
  React.useEffect(() => {
    const timer = setInterval(() => {
      fetchLiveStreams();
    }, 8000);
    return () => clearInterval(timer);
  }, [fetchLiveStreams]);

  // Real-time updates
  React.useEffect(() => {
    if (!supabase) return;

    const channel = supabase.channel(`home-live-sync-${Math.random().toString(36).substring(7)}`);
    channel.on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "program_schedule"
      },
      () => {
        fetchLiveStreams();
      }
    );

    const stop = subscribeWithRetry(channel);
    return () => {
      stop();
      supabase.removeChannel(channel);
    };
  }, [fetchLiveStreams, supabase]);

  // High-performance filtering for the UI
  const pkStreams = liveStreams?.filter(s => s.is_pk === true) || [];
  const soloStreams = liveStreams?.filter(s => s.is_pk !== true) || [];

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black">
        <div className="text-white">Loading live streams...</div>
      </div>
    );
  }

  return (
    <div className="space-y-10 pb-20 bg-black min-h-screen">

      {/* 1. TOP SECTION: PK BATTLES */}
      {pkStreams.length > 0 && (
        <section className="px-6 pt-10">
          <div className="mb-4">
            <h2 className="text-xl font-black text-red-600 uppercase italic tracking-tighter">
              Live PK Battles
            </h2>
          </div>
          <FeaturedPkBattles initialData={pkStreams} />
        </section>
      )}

      {/* 2. MAIN MARKETPLACE SECTION */}
      <section className="px-6 pt-6">
        <div className="mb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="text-lg sm:text-xl font-semibold text-white uppercase tracking-tighter italic">
              Recommended For You
            </h1>
            <p className="mt-1 text-xs text-neutral-400">Real-time streaming feeds from active creators.</p>
          </div>

          {/* Quick Category Filters */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 sm:pb-0 no-scrollbar">
            {["All", "Solo", "Couple", "BDSM", "VR Cams"].map((tab) => (
              <a
                key={tab}
                href={`?category=${tab.toLowerCase()}`}
                className="whitespace-nowrap px-4 py-1.5 rounded-full bg-neutral-900 border border-white/5 text-[10px] font-bold uppercase hover:border-red-600 transition-all text-neutral-300 hover:text-white"
              >
                {tab}
              </a>
            ))}
          </div>
        </div>

        {/* 3. THE LIVE GRID */}
        {soloStreams.length > 0 ? (
          <StreamGrid initialData={soloStreams} />
        ) : (
          <div className="py-20 text-center rounded-3xl border border-dashed border-white/10 bg-neutral-900/20">
            <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-neutral-800 mb-4">
              <div className="h-2 w-2 rounded-full bg-neutral-600 animate-ping" />
            </div>
            <p className="text-sm text-neutral-500 uppercase tracking-widest font-bold">
              No live rooms active
            </p>
            <p className="text-xs text-neutral-600 mt-1 italic">
              Start a broadcast in the Studio to be the first on the list!
            </p>
          </div>
        )}
      </section>

      {/* 4. DISCOVERY / NEW MODELS SECTION */}
      {soloStreams.length > 0 && (
        <section className="px-6">
          <div className="mb-4">
            <h2 className="text-lg sm:text-xl font-semibold text-white uppercase tracking-tighter italic">
              New Models
            </h2>
          </div>
          <div className="mt-4">
            {/* Show the same streams but could be filtered for 'new' profiles in the future */}
            <StreamGrid initialData={soloStreams.slice(0, 6)} />
          </div>
        </section>
      )}
    </div>
  );
}