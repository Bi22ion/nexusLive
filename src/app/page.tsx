"use client";

import * as React from "react";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { FeaturedPkBattles } from "@/components/market/FeaturedPkBattles";
import { StreamGrid } from "@/components/market/StreamGrid";
import { subscribeWithRetry } from "@/lib/realtime/subscribeWithRetry";
import { Loader2, X, Globe, Users } from "lucide-react";

interface HomeProps {
  searchParams: Promise<{
    category?: string;
    filter?: string;
    value?: string;
  }>;
}

const CATEGORY_TABS = ["All", "Solo", "Couple", "BDSM", "VR Cams"] as const;

function mapAgeToRange(value: string): [number, number] | null {
  const v = value.toLowerCase();
  if (v.includes("18")) return [18, 21];
  if (v.includes("22") || v.includes("young")) return [22, 29];
  if (v.includes("milf") || v.includes("mature")) return [30, 99];
  return null;
}

export default function Home({ searchParams }: HomeProps) {
  const [category, setCategory] = React.useState<string | undefined>();
  const [filter, setFilter] = React.useState<string | undefined>();
  const [filterValue, setFilterValue] = React.useState<string | undefined>();
  const [liveStreams, setLiveStreams] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  
  // New state to toggle between Community Creators and Global Network Feed
  const [feedSource, setFeedSource] = React.useState<"community" | "global">("community");
  
  const supabase = React.useMemo(() => createSupabaseBrowserClient(), []);

  React.useEffect(() => {
    searchParams.then((params) => {
      setCategory(params.category);
      setFilter(params.filter);
      setFilterValue(params.value);
    });
  }, [searchParams]);

  const fetchLiveStreams = React.useCallback(async () => {
    if (!supabase) return;

    let query = supabase
      .from("program_schedule")
      .select(`
        *,
        host_profile:profiles!program_schedule_host_fkey(
          id, username, avatar_url, display_name, age, ethnicity, body_type, tags
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

  const applyClientFilter = (stream: any): boolean => {
    if (!filter || !filterValue) return true;
    const profile = stream.host_profile && !Array.isArray(stream.host_profile)
      ? stream.host_profile
      : Array.isArray(stream.host_profile)
        ? stream.host_profile[0]
        : null;

    const v = filterValue.toLowerCase();

    if (filter === "Age") {
      const range = mapAgeToRange(filterValue);
      if (range && profile?.age != null) {
        const age = Number(profile.age);
        return age >= range[0] && age <= range[1];
      }
      return true;
    }

    if (filter === "Ethnicity") {
      const eth = (profile?.ethnicity ?? "").toLowerCase();
      return eth.includes(v);
    }

    if (filter === "Body Type") {
      const bt = (profile?.body_type ?? "").toLowerCase();
      return bt.includes(v);
    }

    if (filter === "Tags") {
      const tags = Array.isArray(profile?.tags) ? profile.tags : [];
      return tags.some((t: string) => t.toLowerCase().includes(v));
    }

    return true;
  };

  const filteredStreams = liveStreams.filter(applyClientFilter);

  const pkStreams = filteredStreams.filter((s) => s.is_pk === true) || [];
  const soloStreams = filteredStreams.filter((s) => s.is_pk !== true) || [];

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
      {/* Source Selector Bar: Lets viewers switch between local community creators and global models widget */}
      <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setFeedSource("community")}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${
              feedSource === "community"
                ? "bg-red-500/15 text-red-400 border border-red-500/30"
                : "bg-neutral-900/40 text-neutral-400 border border-white/[0.06] hover:text-neutral-200"
            }`}
          >
            <Users className="h-4 w-4" />
            Community Creators ({soloStreams.length})
          </button>
          
          <button
            onClick={() => setFeedSource("global")}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${
              feedSource === "global"
                ? "bg-purple-500/15 text-purple-400 border border-purple-500/30"
                : "bg-neutral-900/40 text-neutral-400 border border-white/[0.06] hover:text-neutral-200"
            }`}
          >
            <Globe className="h-4 w-4" />
            Global Models Feed
          </button>
        </div>

        {feedSource === "community" && (
          <Link
            href="/studio"
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-semibold transition"
          >
            Start Streaming
          </Link>
        )}
      </div>

      {filter && filterValue && (
        <div className="flex items-center gap-3 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-2.5">
          <span className="text-xs uppercase tracking-wider text-neutral-500">
            {filter}
          </span>
          <span className="text-sm font-bold text-white">{filterValue}</span>
          <Link
            href="/"
            className="ml-auto inline-flex items-center gap-1 rounded-full bg-white/5 px-3 py-1 text-[11px] font-semibold text-neutral-300 transition-colors hover:bg-white/10 hover:text-white"
          >
            <X className="h-3 w-3" />
            Clear
          </Link>
        </div>
      )}

      {/* Conditionally Render Content Based on Feed Source Choice */}
      {feedSource === "global" ? (
        <section className="space-y-4">
          <div className="flex flex-col gap-1">
            <h1 className="text-lg font-bold uppercase tracking-tight text-white">
              Global Verified Models
            </h1>
            <p className="text-xs text-neutral-500">
              Live interactive streams from across the world powered by secure network feeds
            </p>
          </div>
          
          <div className="w-full min-h-[750px] bg-neutral-950 rounded-2xl overflow-hidden border border-purple-500/20 shadow-2xl relative">
            <iframe
              src="https://t.frtayb.com/421947/3664/0?target=widgets&po=6533&aff_sub5=SF_0060G000004ImDN"
              title="Global Live Models Feed"
              className="w-full h-full min-h-[750px] border-0"
              sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
              loading="lazy"
            />
          </div>
        </section>
      ) : (
        <>
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
                  {filter && filterValue ? filterValue : "Recommended For You"}
                </h1>
                <p className="mt-0.5 text-xs text-neutral-500">
                  Real-time feeds from active community creators
                </p>
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                {CATEGORY_TABS.map((tab) => {
                  const cat = tab.toLowerCase();
                  const isActive = !category || category === cat || (category === "all" && tab === "All");
                  const href = tab === "All"
                    ? (filter && filterValue ? `/?filter=${encodeURIComponent(filter)}&value=${encodeURIComponent(filterValue)}` : "/")
                    : `?category=${cat}${filter && filterValue ? `&filter=${encodeURIComponent(filter)}&value=${encodeURIComponent(filterValue)}` : ""}`;
                  return (
                    <a
                      key={tab}
                      href={href}
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
                  {filter && filterValue ? "No matching streams for this filter" : "No live rooms active"}
                </p>
                <p className="mt-1 text-xs text-neutral-600">
                  {filter && filterValue
                    ? "Try a different filter or clear it to see all live streams"
                    : "Switch to the Global Models feed above or start a broadcast in your Studio"}
                </p>
              </div>
            )}
          </section>

          {soloStreams.length > 0 && !filter && (
            <section>
              <div className="mb-3 flex items-center gap-2">
                <span className="h-4 w-1 rounded-full bg-violet-500" />
                <h2 className="text-sm font-bold uppercase tracking-tight text-white">New Models</h2>
              </div>
              <StreamGrid initialData={soloStreams.slice(0, 5)} />
            </section>
          )}
        </>
      )}
    </div>
  );
}
