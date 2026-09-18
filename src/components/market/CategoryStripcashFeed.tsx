"use client";

import * as React from "react";
import Link from "next/link";
import { Loader2, Play, X } from "lucide-react";
import {
  clientFilterModel,
  type StripcashModel,
} from "@/lib/modelFilters";
import { extractModelsArray, buildAffiliateUrl } from "@/lib/stripcashUtils";
import { StripcashModelPlayer } from "@/components/live/StripcashModelPlayer";

interface CategoryStripcashFeedProps {
  categoryName: string;
  apiParams: Record<string, string>;
}

export function CategoryStripcashFeed({
  categoryName,
  apiParams,
}: CategoryStripcashFeedProps) {
  const [models, setModels] = React.useState<StripcashModel[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [activePlayer, setActivePlayer] = React.useState<StripcashModel | null>(null);

  React.useEffect(() => {
    async function fetchModels() {
      setLoading(true);
      try {
        const query = new URLSearchParams({ limit: "24", ...apiParams });
        const res = await fetch(`/api/models?${query.toString()}`);
        if (!res.ok) throw new Error(`API returned ${res.status}`);
        const data = await res.json();
        const list: StripcashModel[] = extractModelsArray(data) as StripcashModel[];
        // Client-side fallback filter
        const categorySlug = Object.keys(apiParams).length > 0
          ? apiParams.tags || apiParams.isVr || apiParams.isNew || apiParams.country || ""
          : "";
        const filtered = Array.isArray(list)
          ? list.filter((m) =>
              clientFilterModel(m, {
                category: categoryName.toLowerCase().includes("vr")
                  ? "vr"
                  : categoryName.toLowerCase().includes("new")
                    ? "new"
                    : categoryName.toLowerCase().includes("bdsm")
                      ? "bdsm"
                      : categoryName.toLowerCase().includes("ticket")
                        ? "tickets"
                        : categoryName.toLowerCase().includes("ukrainian")
                          ? "ukrainian"
                          : undefined,
              })
            )
          : [];
        setModels(filtered);
      } catch (err) {
        console.error(`Failed to fetch ${categoryName} models:`, err);
        setModels([]);
      } finally {
        setLoading(false);
      }
    }

    fetchModels();
  }, [apiParams, categoryName]);

  return (
    <div className="space-y-4">
      {/* Player Modal — HLS video or safe affiliate launch overlay */}
      {activePlayer && (
        <StripcashModelPlayer
          model={activePlayer}
          affiliateUrl={buildAffiliateUrl(activePlayer)}
          onClose={() => setActivePlayer(null)}
        />
      )}

      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-bold uppercase tracking-tight text-white">
          {categoryName} Models Feed
        </h2>
        <p className="text-xs text-neutral-500">
          Click any model card to watch live instantly
        </p>
      </div>

      {loading ? (
        <div className="flex min-h-[300px] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-purple-500" />
        </div>
      ) : models.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {models.map((model, idx) => {
            const modelUsername = model.username || model.displayName || model.name;
            const modelPreview = model.previewUrl || model.avatar || model.imageUrl || model.thumbnailUrl;

            return (
              <div
                key={model.id || idx}
                className="bg-neutral-900 rounded-xl overflow-hidden border border-purple-500/20 flex flex-col"
              >
                <div className="relative aspect-video bg-neutral-950 flex items-center justify-center overflow-hidden group">
                  {modelPreview ? (
                    <img
                      src={modelPreview}
                      alt={modelUsername}
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                    />
                  ) : (
                    <span className="text-xs text-neutral-600">No Preview</span>
                  )}
                  <span className="absolute top-2 left-2 bg-red-600 text-xs px-2 py-0.5 rounded font-bold text-white animate-pulse">
                    LIVE
                  </span>
                  <button
                    onClick={() => setActivePlayer(model)}
                    className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-2 text-white font-bold text-xs uppercase tracking-wider"
                  >
                    <Play className="h-8 w-8 p-2 rounded-full bg-purple-600 text-white fill-white shadow-lg" />
                  </button>
                </div>
                <div className="p-3 flex flex-col flex-1 justify-between">
                  <div>
                    <h4 className="text-white font-semibold">{modelUsername}</h4>
                    <p className="text-xs text-neutral-400 truncate">
                      {model.subject || "Interactive Live Stream"}
                    </p>
                  </div>
                  <div className="flex justify-between items-center mt-3 pt-2 border-t border-white/5 text-xs text-neutral-500">
                    <span>👁 {model.viewersCount || model.usersCount || 0}</span>
                    <button
                      onClick={() => setActivePlayer(model)}
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
            No models currently online in {categoryName}
          </p>
          <p className="mt-2 text-xs text-neutral-600">
            Check back soon or browse other categories
          </p>
          <Link
            href="/"
            className="mt-4 inline-flex items-center gap-1 rounded-full bg-white/5 px-4 py-1.5 text-xs font-semibold text-neutral-300 transition-colors hover:bg-white/10 hover:text-white"
          >
            Back to Home
          </Link>
        </div>
      )}
    </div>
  );
}
