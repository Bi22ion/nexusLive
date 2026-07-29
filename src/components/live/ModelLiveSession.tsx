"use client";

import * as React from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { subscribeWithRetry } from "@/lib/realtime/subscribeWithRetry";
import { LiveStreamViewer } from "@/components/live/LiveStreamViewer";
import { LiveHostPanel } from "@/components/market/LiveHostPanel";

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
      () => {
        refreshStream();
      }
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

  const stableViewers = stream
    ? 120 +
      (`${stream.host}-${stream.id}`.split("").reduce((acc, char) => ((acc * 31 + char.charCodeAt(0)) >>> 0), 0) %
        500)
    : 0;

  return (
    <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
      <div className="rounded-2xl border border-white/10 bg-neutral-900/30 p-4 sm:p-6">
        <div className="text-xs text-neutral-400">Model</div>
        <div className="mt-1 text-xl font-semibold">@{hostProfile.username}</div>
        {stream?.title ? <div className="mt-2 text-sm text-neutral-200">{stream.title}</div> : null}
        <div className="mt-4 aspect-video w-full rounded-xl bg-black/70 overflow-hidden">
          {stream ? (
            <div className="relative h-full w-full">
              <LiveStreamViewer streamId={stream.id} hostId={stream.host} className={isPrivate && !privateUnlocked ? "blur-sm" : ""} />
              {isPrivate && !privateUnlocked ? (
                <div className="absolute inset-0 flex items-center justify-center bg-black/60 p-4 text-center">
                  <div>
                    <div className="text-sm font-semibold text-white">Private Room</div>
                    <div className="mt-1 text-xs text-neutral-300">
                      This stream is private. Unlock to view clearly and participate.
                    </div>
                    {isLoggedIn ? (
                      <button
                        type="button"
                        onClick={unlockPrivateRoom}
                        disabled={unlocking}
                        className="mt-3 rounded-full bg-violet-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-60"
                      >
                        {unlocking ? "Unlocking..." : `Unlock for ${privateEntryTokens} tokens`}
                      </button>
                    ) : (
                      <a
                        href={`/login?next=/model/${encodeURIComponent(hostProfile.username)}`}
                        className="mt-3 inline-block rounded-full bg-violet-600 px-4 py-2 text-xs font-bold text-white"
                      >
                        Login to unlock
                      </a>
                    )}
                    {unlockError ? <div className="mt-2 text-xs text-red-400">{unlockError}</div> : null}
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="flex h-full w-full items-center justify-center text-center text-neutral-400">
              <div>
                <div className="text-sm font-semibold text-neutral-200">Host unavailable</div>
                <div className="mt-1 text-xs text-neutral-500">
                  This account is currently offline. Check back later or follow for notifications.
                </div>
              </div>
            </div>
          )}
        </div>
        {stream ? (
          <div className="mt-3 text-xs text-neutral-400">Category: {stream.category} | Viewers: {stableViewers}</div>
        ) : null}
        {stream?.description ? <p className="mt-2 text-sm text-neutral-300">{stream.description}</p> : null}
      </div>

      {stream ? <LiveHostPanel stream={stream} hostProfile={hostProfile} /> : null}
    </div>
  );
}
