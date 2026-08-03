"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Eye, Heart, Maximize2, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { LiveStreamViewer } from "@/components/live/LiveStreamViewer";

export type StreamCardModel = {
  id: string;
  hostId: string;
  streamId?: string;
  username: string;
  displayName: string;
  title?: string | null;
  description?: string | null;
  previewUrl?: string | null;
  region?: string | null;
  viewers: number;
  isLive: boolean;
  category?: string | null;
};

export function StreamCard({ model }: { model: StreamCardModel }) {
  const [mounted, setMounted] = React.useState(false);
  const [isFollowing, setIsFollowing] = React.useState(false);
  const [showLiveModal, setShowLiveModal] = React.useState(false);
  const [followBusy, setFollowBusy] = React.useState(false);
  const supabase = React.useMemo(() => createSupabaseBrowserClient(), []);

  React.useEffect(() => setMounted(true), []);

  const handleFollow = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (followBusy) return;

    if (!supabase) {
      toast.error("Unable to initialize connection.");
      return;
    }

    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) {
      toast.error("Please log in to follow");
      return;
    }

    setFollowBusy(true);
    try {
      const { error } = await supabase
        .from("user_favorites")
        .insert({ user_id: authData.user.id, model_id: model.hostId });

      if (error) {
        if (error.code === "23505") {
          setIsFollowing(true);
          toast.info("Already following");
        } else {
          throw error;
        }
      } else {
        setIsFollowing(true);
        toast.success("Followed!");
      }
    } catch {
      toast.error("Failed to follow");
    } finally {
      setFollowBusy(false);
    }
  };

  const handleExpand = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (model.streamId) setShowLiveModal(true);
  };

  return (
    <>
      <Link
        href={`/model/${encodeURIComponent(model.username || model.hostId)}`}
        className="group block focus:outline-none"
      >
        <motion.div
          whileHover={{ y: -4 }}
          transition={{ type: "spring", stiffness: 300, damping: 24 }}
          className="overflow-hidden rounded-2xl border border-white/[0.06] bg-neutral-900/40 transition-colors group-hover:border-white/15"
        >
          {/* Thumbnail */}
          <div className="relative aspect-[4/5] overflow-hidden bg-gradient-to-br from-neutral-800 to-neutral-950">
            {model.previewUrl ? (
              <img
                src={model.previewUrl}
                alt={model.displayName}
                className="absolute inset-0 h-full w-full object-cover opacity-90 transition-all duration-500 group-hover:scale-105 group-hover:opacity-100"
              />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-violet-900/20 via-neutral-900 to-cyan-900/20" />
            )}

            {/* Top overlay badges */}
            <div className="absolute left-2.5 top-2.5 flex items-center gap-1.5">
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider shadow-lg backdrop-blur-sm transition-all",
                  model.isLive
                    ? "bg-red-600/90 text-white shadow-red-600/20"
                    : "bg-neutral-800/80 text-neutral-300"
                )}
              >
                {model.isLive && (
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
                )}
                {model.isLive ? "Live" : "Offline"}
              </span>
              {model.category && (
                <span className="rounded-full bg-black/50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-200 backdrop-blur-sm">
                  {model.category}
                </span>
              )}
            </div>

            {/* Expand button */}
            {model.streamId && (
              <button
                type="button"
                onClick={handleExpand}
                className="absolute right-2.5 top-2.5 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white opacity-0 backdrop-blur-sm transition-all hover:bg-black/70 group-hover:opacity-100"
                aria-label="Open live preview"
              >
                <Maximize2 className="h-3.5 w-3.5" />
              </button>
            )}

            {/* Bottom gradient + info */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent p-3 pt-10">
              <div className="truncate text-sm font-bold text-white">{model.displayName}</div>
              {model.title && (
                <div className="mt-0.5 truncate text-[11px] text-neutral-300">{model.title}</div>
              )}

              <div className="mt-2 flex items-center justify-between">
                <div className="inline-flex items-center gap-1 text-[11px] text-neutral-300">
                  <Eye className="h-3.5 w-3.5 text-neutral-400" />
                  <span className="tabular-nums" suppressHydrationWarning>
                    {mounted ? model.viewers.toLocaleString("en-US") : "—"}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleFollow}
                  disabled={followBusy}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-all disabled:opacity-50",
                    isFollowing
                      ? "bg-rose-500/20 text-rose-300"
                      : "bg-white/10 text-neutral-200 hover:bg-white/20"
                  )}
                >
                  <Heart className={cn("h-3 w-3", isFollowing && "fill-rose-400 text-rose-400")} />
                  {isFollowing ? "Following" : "Follow"}
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      </Link>

      {/* Live preview modal */}
      {showLiveModal && model.streamId && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative h-[85vh] w-[92vw] max-w-6xl overflow-hidden rounded-2xl border border-white/10 bg-black"
          >
            <button
              type="button"
              onClick={() => setShowLiveModal(false)}
              className="absolute right-3 top-3 z-20 flex h-9 w-9 items-center justify-center rounded-full bg-black/70 text-white transition-colors hover:bg-black"
              aria-label="Close live preview"
            >
              <X className="h-5 w-5" />
            </button>
            <LiveStreamViewer streamId={model.streamId} hostId={model.hostId} />
          </motion.div>
        </div>
      )}
    </>
  );
}
