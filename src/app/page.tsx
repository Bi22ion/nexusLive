"use client";

import * as React from "react";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { FeaturedPkBattles } from "@/components/market/FeaturedPkBattles";
import { StreamGrid } from "@/components/market/StreamGrid";
import { Loader2, X, Globe, Users, Play } from "lucide-react";
import {
  buildApiFilterParams,
  clientFilterModel,
  type StripcashModel,
} from "@/lib/modelFilters";

interface HomeProps {
  searchParams: Promise<{
    category?: string;
    filter?: string;
    value?: string;
  }>;
}

const CATEGORY_TABS = ["All", "Solo", "Couple", "BDSM", "VR Cams"] as const;

export default function Home({ searchParams }: HomeProps) {
  const [category, setCategory] = React.useState<string | undefined>();
  const [filter, setFilter] = React.useState<string | undefined>();
  const [filterValue, setFilterValue] = React.useState<string | undefined>();
  const [liveStreams, setLiveStreams] = React.useState<any[]>([]);
  const [globalModels, setGlobalModels] = React.useState<StripcashModel[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [globalLoading, setGlobalLoading] = React.useState(false);

  const [feedSource, setFeedSource] = React.useState<"community" | "global">("global");
  const [activePlayerModel, setActivePlayerModel] = React.useState<StripcashModel | null>(null);

  const supabase = React.useMemo(() => createSupabaseBrowserClient(), []);

  const stripcashUserId =
    process.env.NEXT_PUBLIC_STRIPCASH_USER_ID ||
    "88ae5b1a0d76e320bc0a1675ba92a8c9b6876a5915da871ca89c9a3809f3b6";
  const stripcashApiBase =
    process.env.NEXT_PUBLIC_STRIPCASH_API_BASE || "https://go.whitetrafsa.com/api";

  const activeFilter = React.useMemo(
    () => ({ filter, value: filterValue, category }),
    [filter, filterValue, category]
  );

  React.useEffect(() => {
    searchParams.then((params) => {
      setCategory(params.category);
      setFilter(params.filter);
      setFilterValue(params.value);
    });
  }, [searchParams]);

  // Fetch Stripcash models, applying filter params to the API call
  React.useEffect(() => {
    async function fetchStripcashModels() {
      setGlobalLoading(true);
      try {
        const apiParams = buildApiFilterParams(activeFilter);
        const query = new URLSearchParams({
          userId: stripcashUserId,
          limit: "24",
          ...apiParams,
        });
        const res = await fetch(`${stripcashApiBase}/models?${query.toString()}`);
        const data = await res.json();
        let models: StripcashModel[] = [];
        if (data && data.models) {
          models = data.models;
        } else if (Array.isArray(data)) {
          models = data;
        }
        // Client-side filter as fallback for attributes the API may not filter server-side
        const filtered = models.filter((m) => clientFilterModel(m, activeFilter));
        setGlobalModels(filtered.length > 0 ? filtered : models);
      } catch (err) {
        console.error("Failed to fetch Stripcash models:", err);
        setGlobalModels([]);
      } finally {
        setGlobalLoading(false);
      }
    }

    fetchStripcashModels();
  }, [stripcashApiBase, stripcashUserId, activeFilter]);

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
      const range = mapAgeToRangeLocal(filterValue);
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

  const hasActiveFilter = !!(filter && filterValue) || !!category;

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
    <div className="space-y-8 pb-16 relative">
      {activePlayerModel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <div className="relative w-full max-w-4xl bg-neutral-900 border border-purple-500/30 rounded-2xl overflow-hidden shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 bg-neutral-950 border-b border-white/10">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-red-600 animate-pulse" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  {activePlayerModel.username || activePlayerModel.displayName || activePlayerModel.name} - Live Stream
                </h3>
              </div>
              <button
                onClick={() => setActivePlayerModel(null)}
                className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="relative aspect-video w-full bg-black">
              <iframe
                src={`https://stripchat.com/embed/${activePlayerModel.username || activePlayerModel.name}?tourId=${stripcashUserId}&muted=false&autoplay=true`}
                className="w-full h-full border-0"
                allowFullScreen
                allow="autoplay; encrypted-media"
              />
            </div>

            <div className="p-4 bg-neutral-950 flex items-center justify-between text-xs text-neutral-400 border-t border-white/10">
              <span>Broadcasting live from network via secure on-site integration</span>
              <button
                onClick={() => setActivePlayerModel(null)}
                className="px-4 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-white font-semibold transition"
              >
                Close Player
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Source Selector Bar */}
      <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setFeedSource("global")}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${
              feedSource === "global"
                ? "bg-purple-500/15 text-purple-400 border border-purple-500/30"
                : "bg-neutral-900/40 text-neutral-400 border border-white/[0.06] hover:text-neutral-200"
            }`}
          >
            <Globe className="h-4 w-4" />
            Stripcash Models Feed ({globalModels.length})
          </button>

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

      {feedSource === "global" ? (
        <section className="space-y-4">
          <div className="flex flex-col gap-1">
            <h1 className="text-lg font-bold uppercase tracking-tight text-white">
              {hasActiveFilter
                ? `${filterValue || category || ""} Models`
                : "Stripcash Verified Models Feed"}
            </h1>
            <p className="text-xs text-neutral-500">
              {hasActiveFilter
                ? `Showing models matching your ${filterValue || category} filter`
                : "Click any model card to watch live instantly in an on-site player window"}
            </p>
          </div>

          {globalLoading ? (
            <div className="flex min-h-[400px] items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-purple-500" />
            </div>
          ) : globalModels.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {globalModels.map((model: StripcashModel, idx: number) => {
                const modelUsername = model.username || model.displayName || model.name;
                const modelPreview = model.previewUrl || model.avatar || model.imageUrl || model.thumbnailUrl;

                return (
                  <div key={model.id || idx} className="bg-neutral-900 rounded-xl overflow-hidden border border-purple-500/20 flex flex-col">
                    <div className="relative aspect-video bg-neutral-950 flex items-center justify-center overflow-hidden group">
                      {modelPreview ? (
                        <img src={modelPreview} alt={modelUsername} className="w-full h-full object-cover group-hover:scale-105 transition duration-300" />
                      ) : (
                        <span className="text-xs text-neutral-600">No Preview</span>
                      )}
                      <span className="absolute top-2 left-2 bg-red-600 text-xs px-2 py-0.5 rounded font-bold text-white animate-pulse">
                        LIVE
                      </span>
                      <button
                        onClick={() => setActivePlayerModel(model)}
                        className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-2 text-white font-bold text-xs uppercase tracking-wider"
                      >
                        <Play className="h-8 w-8 p-2 rounded-full bg-purple-600 text-white fill-white shadow-lg" />
                      </button>
                    </div>
                    <div className="p-3 flex flex-col flex-1 justify-between">
                      <div>
                        <h4 className="text-white font-semibold">{modelUsername}</h4>
                        <p className="text-xs text-neutral-400 truncate">{model.subject || "Interactive Live Stream"}</p>
                      </div>
                      <div className="flex justify-between items-center mt-3 pt-2 border-t border-white/5 text-xs text-neutral-500">
                        <span>👁 {model.viewersCount || model.usersCount || 0}</span>
                        <button
                          onClick={() => setActivePlayerModel(model)}
                          className="bg-purple-600 hover:bg-purple-500 text-white px-3 py-1 rounded-lg font-medium transition flex items-center gap-1"
                        >
                          <Play className="h-3 w-3 fill-current" /> Watch Live
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-white/[0.08] bg-neutral-900/20 py-16 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-neutral-800">
                <span className="h-2 w-2 animate-pulse rounded-full bg-neutral-600" />
              </div>
              <p className="text-sm font-bold uppercase tracking-widest text-neutral-500">
                {hasActiveFilter
                  ? `No models currently online in ${filterValue || category}`
                  : "No active Stripcash models available"}
              </p>
              {hasActiveFilter && (
                <Link
                  href="/"
                  className="mt-4 inline-flex items-center gap-1 rounded-full bg-white/5 px-4 py-1.5 text-xs font-semibold text-neutral-300 transition-colors hover:bg-white/10 hover:text-white"
                >
                  <X className="h-3 w-3" />
                  Clear filter
                </Link>
              )}
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

function mapAgeToRangeLocal(value: string): [number, number] | null {
  const v = value.toLowerCase();
  if (v.includes("18")) return [18, 21];
  if (v.includes("22") || v.includes("young")) return [22, 29];
  if (v.includes("milf") || v.includes("mature")) return [30, 99];
  return null;
}
