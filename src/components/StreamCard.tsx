"use client";

import * as React from "react";
import Link from "next/link";
import { Eye, ShieldCheck, Lock } from "lucide-react";

type StreamCardProps = {
  stream: {
    id: string;
    title?: string | null;
    category?: string | null;
    thumbnail_url?: string | null;
    media_url?: string | null;
    is_private?: boolean | null;
    private_entry_tokens?: number | null;
    host?: string;
    profiles?: {
      username?: string | null;
      display_name?: string | null;
      avatar_url?: string | null;
      is_online?: boolean | null;
    } | null;
  };
};

export function StreamCard({ stream }: StreamCardProps) {
  const profile = stream.profiles;
  const username = profile?.username || "model";
  const displayName = profile?.display_name || username;
  const avatarUrl = profile?.avatar_url || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500&auto=format&fit=crop&q=60";
  const thumbnailUrl = stream.thumbnail_url || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800&auto=format&fit=crop&q=80";

  // Stable pseudo-random viewer count for realism
  const viewerCount = React.useMemo(() => {
    let hash = 0;
    const seed = stream.id + username;
    for (let i = 0; i < seed.length; i++) {
      hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
    }
    return 140 + (hash % 700);
  }, [stream.id, username]);

  return (
    <Link
      href={`/model/${encodeURIComponent(username)}`}
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-neutral-900/60 transition-all duration-300 hover:-translate-y-1 hover:border-violet-500/50 hover:shadow-xl hover:shadow-violet-500/10"
    >
      {/* Thumbnail Container */}
      <div className="relative aspect-video w-full overflow-hidden bg-neutral-950">
        <img
          src={thumbnailUrl}
          alt={stream.title || displayName}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          loading="lazy"
        />

        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-transparent to-black/40 opacity-80" />

        {/* Top Badges */}
        <div className="absolute left-3 top-3 flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-red-600 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white shadow-md shadow-red-600/30">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
            Live
          </span>
          {stream.category && (
            <span className="rounded-full bg-black/60 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-neutral-200 backdrop-blur-md">
              {stream.category}
            </span>
          )}
        </div>

        {/* Viewer Count & Private Badge */}
        <div className="absolute right-3 top-3 flex items-center gap-1.5">
          {stream.is_private && (
            <span className="flex items-center gap-1 rounded-full bg-violet-600/90 px-2.5 py-1 text-[10px] font-bold text-white backdrop-blur-md">
              <Lock className="h-3 w-3" />
              VIP
            </span>
          )}
          <span className="flex items-center gap-1 rounded-full bg-black/60 px-2.5 py-1 text-[10px] font-semibold text-neutral-200 backdrop-blur-md">
            <Eye className="h-3.5 w-3.5 text-neutral-400" />
            <span className="tabular-nums">{viewerCount.toLocaleString()}</span>
          </span>
        </div>
      </div>

      {/* Model & Stream Info */}
      <div className="flex flex-1 gap-3 p-4">
        <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full border border-white/10 bg-neutral-800">
          <img src={avatarUrl} alt={displayName} className="h-full w-full object-cover" />
          {profile?.is_online && (
            <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-neutral-900 bg-emerald-500" />
          )}
        </div>

        <div className="flex flex-1 flex-col justify-center min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-sm font-bold text-white group-hover:text-violet-400 transition-colors">
              {displayName}
            </span>
            <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-violet-400" />
          </div>
          <p className="truncate text-xs font-medium text-neutral-400 mt-0.5">
            {stream.title || `Live interactive session with @${username}`}
          </p>
        </div>
      </div>
    </Link>
  );
}
