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
  const supabase = React.useMemo(() => createSupabaseBrowserClient(), []);

  React.useEffect(() => setMounted(true), []);

  const handleFollow = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!supabase) {
      toast.error("Unable to initialize Supabase client.");
      return;
    }

    const { data: user } = await supabase.auth.getUser();
    if (!user.user) {
      toast.error("Please log in to follow");
      return;
    }

    try {
      const { error } = await supabase
        .from("user_favorites")
        .insert({ user_id: user.user.id, model_id: model.hostId });

      if (error) {
        if (error.code === '23505') { // unique violation
          toast.info("Already following");
        } else {
          throw error;
        }
      } else {
        setIsFollowing(true);
        toast.success("Followed!");
      }
    } catch (error) {
      console.error("Follow error:", error);
      toast.error("Failed to follow");
    }
  };

  return (
    <>
    <Link href={`/model/${encodeURIComponent(model.username || model.hostId)}`} className="block">
      <motion.div
        whileHover={{ y: -3 }}
        transition={{ type: "spring", stiffness: 250, damping: 22 }}
        className="group overflow-hidden rounded-2xl border border-white/10 bg-neutral-900/30 hover:border-white/20"
      >
        <div className="relative aspect-[4/5] bg-gradient-to-br from-neutral-900 to-neutral-950">
          {model.previewUrl ? (
            <img
              src={model.previewUrl}
              alt={model.displayName}
              className="absolute inset-0 h-full w-full object-cover opacity-90"
            />
          ) : (
            <div className="absolute inset-0 opacity-80" />
          )}

          <div className="absolute left-3 top-3 flex items-center gap-2">
            <span
              className={cn(
                "rounded-full px-2 py-1 text-[11px] font-semibold",
                model.isLive
                  ? "bg-rose-500/90 text-white"
                  : "bg-neutral-800 text-neutral-200"
              )}
            >
              {model.isLive ? "LIVE" : "OFFLINE"}
            </span>
            {model.region ? (
              <span className="rounded-full bg-black/50 px-2 py-1 text-[11px] text-neutral-200">
                {model.region}
              </span>
            ) : null}
          </div>
          {model.streamId ? (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setShowLiveModal(true);
              }}
              className="absolute right-3 top-3 rounded-full bg-black/60 p-2 text-white hover:bg-black/80"
              aria-label="Open live preview"
            >
              <Maximize2 className="h-4 w-4" />
            </button>
          ) : null}

          <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/70 to-transparent">
            <div className="font-semibold text-neutral-100 truncate">
              {model.displayName}
            </div>
            {model.title ? (
              <div className="mt-0.5 text-[11px] text-neutral-300 truncate">{model.title}</div>
            ) : null}
            <div className="mt-1 flex items-center justify-between text-xs text-neutral-300">
              <div className="inline-flex items-center gap-1">
                <Eye className="h-3.5 w-3.5" />
                <span className="tabular-nums" suppressHydrationWarning>
                  {mounted ? model.viewers.toLocaleString("en-US") : "—"}
                </span>
              </div>
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-full bg-neutral-900/60 px-2.5 py-1 hover:bg-neutral-900"
                onClick={handleFollow}
              >
                <Heart className={cn("h-3.5 w-3.5", isFollowing ? "text-rose-500" : "text-rose-400")} />
                Follow
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </Link>
    {showLiveModal && model.streamId ? (
      <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/90 p-4">
        <div className="relative h-[85vh] w-[92vw] max-w-6xl rounded-2xl border border-white/10 bg-black">
          <button
            type="button"
            onClick={() => setShowLiveModal(false)}
            className="absolute right-3 top-3 z-20 rounded-full bg-black/70 p-2 text-white hover:bg-black"
            aria-label="Close live preview"
          >
            <X className="h-5 w-5" />
          </button>
          <div className="h-full w-full">
            <LiveStreamViewer streamId={model.streamId} hostId={model.hostId} />
          </div>
        </div>
      </div>
    ) : null}
    </>
  );
}

