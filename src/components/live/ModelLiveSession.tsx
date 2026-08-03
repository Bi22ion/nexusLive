"use client";

import * as React from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { subscribeWithRetry } from "@/lib/realtime/subscribeWithRetry";
import { LiveStreamViewer } from "@/components/live/LiveStreamViewer";
import { LiveHostPanel } from "@/components/market/LiveHostPanel";
import { Lock, Eye } from "lucide-react";

type StreamRecord = {
  id: string;
  host: string;
  category?: string | null;
  title?: string | null;
  description?: string | null;
  media_url?: string | null;
  is_private?: boolean | null;
  private_entry_tokens?: number | null;
};

type HostProfile = {
  id: string;
  username: string;
  display_name?: string | null;
  avatar_url?: string | null;
  country_code?: string | null;
};

function stableHash(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return hash;
}

export function ModelLiveSession({
  hostId,
  hostProfile,
  initialStream,
}: {
  hostId: string;
  hostProfile: HostProfile;
  initialStream: StreamRecord | null;
}) {
  const supabase = React.useMemo(() => createSupabaseBrowserClient(), []);
  const [stream, setStream] = React.useState<StreamRecord | null>(initialStream);
  const [isLoggedIn, setIsLoggedIn] = React.useState(false);
  const [privateUnlocked, setPrivateUnlocked] = React.useState(false);
  const [unlocking, setUnlocking] = React.useState(false);
  const [unlockError, setUnlockError] = React.useState<string | null>(null);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => setMounted(true), []);

  const refreshStream = React.useCallback(async () => {
    if (!supabase) return;
    const { data } = await supabase
      .from("program_schedule")
      .select("id, host, category, title, description, media_url, is_private, private_entry_tokens")
      .eq("host", hostId)
      .eq("status", "live")
      .maybeSingle();
    setStream(data ?? null);
  }, [hostId, supabase]);

  React.useEffect(() => {
    if (!supabase) return;
    let active = true;
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (active) setIsLoggedIn(!!data.user);
    })();
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsLoggedIn(!!session?.user);
    });
    return () => {
      active = false;
      subscription?.subscription?.unsubscribe();
    };
  }, [supabase]);

  React.useEffect(() => {
    if (!supabase) return;
    const channel = supabase.channel(`model-live-sync-${hostId}`);
    channel.on(
      "postgres_changes",
      { event: "*", schema: "public", table: "program_schedule", filter: `host=eq.${hostId}` },
      () => refreshStream()
    );
    const stop = subscribeWithRetry(channel);
    return () => {
      stop();
      supabase.removeChannel(channel);
    };
  }, [hostId, refreshStream, supabase]);

  React.useEffect(() => {
    if (!supabase || !stream?.id || !isLoggedIn) {
      setPrivateUnlocked(false);
      return;
    }
    (async () => {
      const { data } = await supabase.auth.getUser();
      const uid = data.user?.id;
      if (!uid) {
        setPrivateUnlocked(false);
        return;
      }
      const { data: access } = await supabase
        .from("stream_private_access")
        .select("stream_id")
        .eq("user_id", uid)
        .eq("stream_id", stream.id)
        .maybeSingle();
      setPrivateUnlocked(!!access);
    })();
  }, [isLoggedIn, stream?.id, supabase]);

  const isPrivate = Boolean(stream?.is_private);
  const privateEntryTokens = stream?.private_entry_tokens ?? 100;
  const locked = isPrivate && !privateUnlocked;

  const stableViewers = stream
    ? 120 + (stableHash(`${stream.host}-${stream.id}`) % 500)
    : 0;

  const unlockPrivateRoom = async () => {
    if (!stream?.id) return;
    setUnlockError(null);
    setUnlocking(true);
    try {
      const response = await fetch("/api/live/private/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ streamId: stream.id }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to unlock private room");
      }
      setPrivateUnlocked(true);
    } catch (err: any) {
      setUnlockError(err?.message || "Unlock failed");
    } finally {
      setUnlocking(false);
    }
  };

  return (
    <div className="grid gap-5 xl:grid-cols-[2fr_1fr]">
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-neutral-900/40 shadow-2xl shadow-black/40">
        <div className="relative aspect-video w-full bg-black">
          {stream ? (
            <div className="relative h-full w-full">
              <LiveStreamViewer
                streamId={stream.id}
                hostId={stream.host}
                className={locked ? "scale-105 blur-2xl brightness-50" : ""}
              />

              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/30" />

              <div className="absolute left-4 top-4 flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-red-600 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white shadow-lg shadow-red-600/30">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
                  Live
                </span>
                {stream.category && (
                  <span className="rounded-full bg-black/60 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-neutral-200 backdrop-blur-sm">
                    {stream.category}
                  </span>
                )}
              </div>

              <div className="absolute right-4 top-4 flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1.5 text-xs font-semibold text-neutral-200 backdrop-blur-sm">
                <Eye className="h-3.5 w-3.5 text-neutral-400" />
                <span className="tabular-nums" suppressHydrationWarning>
                  {mounted ? stableViewers.toLocaleString() : "—"}
                </span>
              </div>

              <div className="absolute bottom-0 left-0 right-0 p-5">
                <div className="text-[11px] font-medium uppercase tracking-[0.25em] text-neutral-400">
                  @{hostProfile.username}
                </div>
                {stream.title && (
                  <h2 className="mt-1 text-lg font-bold text-white">{stream.title}</h2>
                )}
              </div>

              {locked && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                  <div className="w-full max-w-xs rounded-2xl border border-white/10 bg-neutral-950/80 p-6 text-center shadow-2xl">
                    <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-violet-600/20">
                      <Lock className="h-6 w-6 text-violet-400" />
                    </div>
                    <div className="text-sm font-bold text-white">Private Room</div>
                    <div className="mt-1.5 text-xs leading-relaxed text-neutral-400">
                      This stream is private. Unlock to view clearly and participate.
                    </div>
                    {isLoggedIn ? (
                      <button
                        type="button"
                        onClick={unlockPrivateRoom}
                        disabled={unlocking}
                        className="mt-4 w-full rounded-xl bg-violet-600 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-white transition-all hover:bg-violet-500 disabled:opacity-60"
                      >
                        {unlocking ? "Unlocking…" : `Unlock for ${privateEntryTokens} tokens`}
                      </button>
                    ) : (
                      <a
                        href={`/login?next=/model/${encodeURIComponent(hostProfile.username)}`}
                        className="mt-4 inline-block w-full rounded-xl bg-violet-600 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-white transition-all hover:bg-violet-500"
                      >
                        Login to unlock
                      </a>
                    )}
                    {unlockError && <div className="mt-2 text-xs text-red-400">{unlockError}</div>}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex h-full w-full items-center justify-center text-center">
              <div>
                <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-neutral-800">
                  <Eye className="h-6 w-6 text-neutral-600" />
                </div>
                <div className="text-sm font-semibold text-neutral-300">Host is offline</div>
                <div className="mt-1 text-xs text-neutral-500">
                  This account is not broadcasting right now. Check back later.
                </div>
              </div>
            </div>
          )}
        </div>

        {stream?.description && (
          <p className="px-5 py-4 text-sm leading-relaxed text-neutral-300">{stream.description}</p>
        )}
      </div>

      {stream && <LiveHostPanel stream={stream} hostProfile={hostProfile} />}
    </div>
  );
}
