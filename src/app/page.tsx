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
  const [globalModels, setGlobalModels] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [globalLoading, setGlobalLoading] = React.useState(false);
  
  const [feedSource, setFeedSource] = React.useState<"community" | "global">("community");
  
  const supabase = React.useMemo(() => createSupabaseBrowserClient(), []);

  // Stripcash Configuration Credentials
  const stripcashUserId = process.env.NEXT_PUBLIC_STRIPCASH_USER_ID || "88ae5b1a0d76e320bc0a1675ba92a8c9b6876a5915da871ca89c9a3809f3b6";
  const stripcashApiBase = process.env.NEXT_PUBLIC_STRIPCASH_API_BASE || "https://go.whitetrafsa.com/api";

  React.useEffect(() => {
    searchParams.then((params) => {
      setCategory(params.category);
      setFilter(params.filter);
      setFilterValue(params.value);
    });
  }, [searchParams]);

  // Fetch Stripcash models when global feed is selected
  React.useEffect(() => {
    if (feedSource !== "global") return;

    async function fetchStripcashModels() {
      setGlobalLoading(true);
      try {
        const res = await fetch(`${stripcashApiBase}/models?userId=${stripcashUserId}&limit=24`);
        const data = await res.json();
        if (data && data.models) {
          setGlobalModels(data.models);
        } else if (Array.isArray(data)) {
          setGlobalModels(data);
        }
      } catch (err) {
        console.error("Failed to fetch Stripcash models:", err);
      } finally {
        setGlobalLoading(false);
      }
    }

    fetchStripcashModels();
  }, [feedSource, stripcashApiBase, stripcashUserId]);

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
      {/* Source Selector Bar */}
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
            Stripcash Models Feed
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

      {/* Render Stripcash Models Feed vs Community Stream Lists */}
      {feedSource === "global" ? (
        <section className="space-y-4">
          <div className="flex flex-col gap-1">
            <h1 className="text-lg font-bold uppercase tracking-tight text-white">
              Stripcash Verified Models Feed
            </h1>
            <p className="text-xs text-neutral-500">
              Fetched dynamically via Stripcash API endpoint ({stripcashApiBase})
            </p>
          </div>
          
          {globalLoading ? (
            <div className="flex min-h-[400px] items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-purple-500" />
            </div>
          ) : globalModels.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {globalModels.map((model: any, idx: number) => (
                <div key={model.id || idx} className="bg-neutral-900 rounded-xl overflow-hidden border border-purple-500/20">
                  <div className="relative aspect-video bg-neutral-950 flex items-center justify-center">
                    {model.previewUrl || model.avatar ? (
                      <img src={model.previewUrl || model.avatar} alt={model.username} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-xs text-neutral-600">No Preview</span>
                    )}
                    <span className="absolute top-2 left-2 bg-red-600 text-xs px-2 py-0.5 rounded font-bold text-white animate-pulse">
                      LIVE
                    </span>
                  </div>
                  <div className="p-3">
                    <h4 className="text-white font-semibold">{model.username || model.displayName}</h4>
                    <p className="text-xs text-neutral-400 truncate">{model.subject || "Live Interactive Stream"}</p>
                    <div className="flex justify-between items-center mt-3 text-xs text-neutral-500">
                      <span>👁 {model.viewersCount || model.usersCount || 0}</span>
                      <a 
                        href={`https://go.whitetrafsa.com/${stripcashUserId}?tour_id=${model.id || ''}`} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="bg-purple-600 hover:bg-purple-500 text-white px-3 py-1 rounded-full font-medium"
                      >
                        Watch Live
                      </a>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-white/[0.08] bg-neutral-900/20 py-16 text-center">
              <p className="text-sm font-bold uppercase tracking-widest text-neutral-500">
                No active Stripcash models available or check API response format.
              </p>
            </div>
          )}
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
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
