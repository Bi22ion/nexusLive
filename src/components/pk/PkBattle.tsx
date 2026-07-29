"use client";

import * as React from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { PkSession } from "@/lib/pk/types";
import { PkProgressBar } from "@/components/pk/PkProgressBar";

type HeartbeatState = {
  hostASeenAt: number | null;
  hostBSeenAt: number | null;
  isGraceActive: boolean;
  graceSecondsRemaining: number;
};

const HEARTBEAT_INTERVAL_MS = 2000;
const HEARTBEAT_STALE_MS = 7000;
const GRACE_PERIOD_SECONDS = 12;

function nowMs() {
  return Date.now();
}

function formatMmSs(totalSeconds: number) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const mm = Math.floor(s / 60)
    .toString()
    .padStart(2, "0");
  const ss = (s % 60).toString().padStart(2, "0");
  return `${mm}:${ss}`;
}

export function PkBattle({
  sessionId,
  viewerHostId,
}: {
  sessionId: string;
  viewerHostId?: string; // if viewer is one of the hosts, we emit heartbeat
}) {
  const supabase = React.useMemo(() => createSupabaseBrowserClient(), []);

  const [session, setSession] = React.useState<PkSession | null>(null);
  const [optimisticScores, setOptimisticScores] = React.useState<{
    a: number;
    b: number;
  } | null>(null);
  const [isPrivateLocked, setIsPrivateLocked] = React.useState(false);
  const [isUnlocked, setIsUnlocked] = React.useState(false);
  const [hb, setHb] = React.useState<HeartbeatState>({
    hostASeenAt: null,
    hostBSeenAt: null,
    isGraceActive: false,
    graceSecondsRemaining: 0,
  });

  const [serverNowOffsetMs, setServerNowOffsetMs] = React.useState<number>(0);
  const [pausedAtClientMs, setPausedAtClientMs] = React.useState<number | null>(
    null
  );
  const [pausedAccumulatedMs, setPausedAccumulatedMs] = React.useState<number>(0);

  // Initial load
  React.useEffect(() => {
    if (!supabase) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("pk_sessions")
        .select(
          "id,status,starts_at,duration_seconds,paused_reason,host_a_id,host_b_id,score_a,score_b"
        )
        .eq("id", sessionId)
        .single();
      if (!cancelled && !error) {
        const s = data as unknown as PkSession;
        setSession(s);
        setOptimisticScores({ a: s.score_a ?? 0, b: s.score_b ?? 0 });
      }

      // Cheap server time sync using PostgREST response date header isn't exposed,
      // so we approximate with client now. (Good enough for UI timers.)
      if (!cancelled) setServerNowOffsetMs(0);

      const { data: hbData } = await supabase
        .from("pk_heartbeats")
        .select("session_id,host_id,last_seen_at")
        .eq("session_id", sessionId);

      if (!cancelled && hbData && data) {
        const a = hbData.find((x) => x.host_id === (data as any).host_a_id);
        const b = hbData.find((x) => x.host_id === (data as any).host_b_id);
        setHb((prev) => ({
          ...prev,
          hostASeenAt: a ? new Date(a.last_seen_at).getTime() : null,
          hostBSeenAt: b ? new Date(b.last_seen_at).getTime() : null,
        }));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sessionId, supabase]);

  // Realtime subscription: PK session state
  React.useEffect(() => {
    if (!supabase) return;
    const channel = supabase
      .channel(`pk_sessions:${sessionId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pk_sessions", filter: `id=eq.${sessionId}` },
        (payload) => {
          const next = payload.new as unknown as PkSession;
          setSession(next);
          setOptimisticScores({ a: next.score_a ?? 0, b: next.score_b ?? 0 });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId, supabase]);

  // Realtime "PK updates" channel (instant UI updates, no refresh)
  React.useEffect(() => {
    if (!supabase) return;
    const channel = supabase
      .channel("pk-updates")
      .on("broadcast", { event: "gift" }, (payload) => {
        const { pk_session_id, to_host_id, tokens_amount } = (payload as any)
          ?.payload ?? {};
        if (!pk_session_id || pk_session_id !== sessionId) return;
        if (!session) return;

        setOptimisticScores((prev) => {
          const base = prev ?? { a: session.score_a ?? 0, b: session.score_b ?? 0 };
          if (to_host_id === session.host_a_id) return { ...base, a: base.a + (tokens_amount ?? 0) };
          if (to_host_id === session.host_b_id) return { ...base, b: base.b + (tokens_amount ?? 0) };
          return base;
        });
      })
      .on("broadcast", { event: "private_lock" }, (payload) => {
        const { pk_session_id, locked } = (payload as any)?.payload ?? {};
        if (pk_session_id !== sessionId) return;
        setIsPrivateLocked(Boolean(locked));
        if (locked) setIsUnlocked(false);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session, sessionId, supabase]);

  // Realtime subscription: heartbeats
  React.useEffect(() => {
    if (!supabase) return;
    const channel = supabase
      .channel(`pk_heartbeats:${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "pk_heartbeats",
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          const hostId = (payload.new as any)?.host_id as string | undefined;
          const lastSeen = (payload.new as any)?.last_seen_at as string | undefined;
          if (!hostId || !lastSeen) return;

          setHb((prev) => {
            if (!session) return prev;
            const ms = new Date(lastSeen).getTime();
            if (hostId === session.host_a_id)
              return { ...prev, hostASeenAt: ms };
            if (hostId === session.host_b_id)
              return { ...prev, hostBSeenAt: ms };
            return prev;
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId, session, supabase]);

  // Host heartbeat emitter (anti-cheat)
  React.useEffect(() => {
    if (!supabase) return;
    if (!session || !viewerHostId) return;
    if (viewerHostId !== session.host_a_id && viewerHostId !== session.host_b_id)
      return;

    const t = setInterval(async () => {
      await supabase.from("pk_heartbeats").upsert({
        session_id: session.id,
        host_id: viewerHostId,
        last_seen_at: new Date().toISOString(),
      });
    }, HEARTBEAT_INTERVAL_MS);

    return () => clearInterval(t);
  }, [session, supabase, viewerHostId]);

  // Grace period detection (client-side UI; authoritative pause should be enforced server-side later)
  React.useEffect(() => {
    if (!session) return;
    const tick = setInterval(() => {
      const n = nowMs();
      const aStale =
        hb.hostASeenAt !== null ? n - hb.hostASeenAt > HEARTBEAT_STALE_MS : true;
      const bStale =
        hb.hostBSeenAt !== null ? n - hb.hostBSeenAt > HEARTBEAT_STALE_MS : true;
      const shouldGrace = aStale || bStale;

      setHb((prev) => {
        if (!shouldGrace) return { ...prev, isGraceActive: false, graceSecondsRemaining: 0 };
        if (prev.isGraceActive) {
          return {
            ...prev,
            graceSecondsRemaining: Math.max(0, prev.graceSecondsRemaining - 1),
          };
        }
        return {
          ...prev,
          isGraceActive: true,
          graceSecondsRemaining: GRACE_PERIOD_SECONDS,
        };
      });
    }, 1000);

    return () => clearInterval(tick);
  }, [hb.hostASeenAt, hb.hostBSeenAt, session]);

  // Pause timer bookkeeping (UI-only for now)
  React.useEffect(() => {
    if (!session) return;
    if (session.status === "paused") {
      setPausedAtClientMs((x) => x ?? nowMs());
      return;
    }
    if (pausedAtClientMs !== null) {
      setPausedAccumulatedMs((acc) => acc + (nowMs() - pausedAtClientMs));
      setPausedAtClientMs(null);
    }
  }, [pausedAtClientMs, session]);

  const timerSecondsRemaining = React.useMemo(() => {
    if (!session) return null;
    const startMs = new Date(session.starts_at).getTime();
    const durationMs = session.duration_seconds * 1000;
    const baseNow = nowMs() + serverNowOffsetMs;
    const pausedMs = pausedAccumulatedMs + (pausedAtClientMs ? baseNow - pausedAtClientMs : 0);
    const elapsed = Math.max(0, baseNow - startMs - pausedMs);
    const remaining = Math.max(0, durationMs - elapsed);
    return remaining / 1000;
  }, [pausedAccumulatedMs, pausedAtClientMs, serverNowOffsetMs, session]);

  if (!session) {
    if (!supabase) {
      return (
        <div className="w-full max-w-5xl rounded-2xl border border-black/10 dark:border-white/10 p-6">
          <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
            PK Battle (demo)
          </div>
          <div className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Add your Supabase env vars to enable realtime PK state.
          </div>
          <div className="mt-4 rounded-xl bg-zinc-50 dark:bg-zinc-900/50 border border-black/5 dark:border-white/10 p-4 text-xs font-mono whitespace-pre-wrap">
            NEXT_PUBLIC_SUPABASE_URL=...
            {"\n"}NEXT_PUBLIC_SUPABASE_ANON_KEY=...
          </div>
        </div>
      );
    }
    return (
      <div className="w-full max-w-5xl rounded-2xl border border-black/10 dark:border-white/10 p-6">
        <div className="text-sm text-zinc-600 dark:text-zinc-400">Loading PK session…</div>
      </div>
    );
  }

  const leftLabel = "Host A";
  const rightLabel = "Host B";
  const leftScore = optimisticScores?.a ?? (session.score_a ?? 0);
  const rightScore = optimisticScores?.b ?? (session.score_b ?? 0);
  const timerText =
    timerSecondsRemaining === null ? "--:--" : formatMmSs(timerSecondsRemaining);

  const graceBanner =
    hb.isGraceActive && session.status !== "ended"
      ? `Connection issue detected — grace period ${hb.graceSecondsRemaining}s`
      : null;

  return (
    <div className="w-full max-w-5xl rounded-2xl border border-black/10 dark:border-white/10 p-6 space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
            PK Battle
          </div>
          <div className="text-xs text-zinc-600 dark:text-zinc-400">
            Session: <span className="font-mono">{session.id}</span>
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs text-zinc-600 dark:text-zinc-400">Timer</div>
          <div className="text-2xl font-semibold tabular-nums">{timerText}</div>
        </div>
      </div>

      <PkProgressBar
        leftLabel={leftLabel}
        rightLabel={rightLabel}
        leftScore={leftScore}
        rightScore={rightScore}
      />

      {graceBanner ? (
        <div className="rounded-xl border border-amber-400/40 bg-amber-50 text-amber-950 dark:bg-amber-950/20 dark:text-amber-200 dark:border-amber-500/30 px-4 py-3 text-sm">
          {graceBanner}
        </div>
      ) : null}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-xl bg-zinc-100 dark:bg-zinc-900/60 p-4">
          <div className="text-xs text-zinc-600 dark:text-zinc-400">Left stream</div>
          <div className="relative mt-2 aspect-video w-full rounded-lg bg-black/80 overflow-hidden">
            <div className={isPrivateLocked && !isUnlocked ? "absolute inset-0 backdrop-blur-md bg-black/30" : ""} />
            {isPrivateLocked && !isUnlocked ? (
              <div className="absolute inset-0 flex items-center justify-center">
                <button
                  className="rounded-full bg-gradient-to-r from-violet-600 to-cyan-400 px-5 py-2 text-sm font-semibold text-white"
                  onClick={() => setIsUnlocked(true)}
                >
                  Unlock with Tokens
                </button>
              </div>
            ) : null}
          </div>
          <div className="mt-3 text-xs text-zinc-600 dark:text-zinc-400">
            Placeholder: integrate WebRTC provider (Agora/Daily) here.
          </div>
        </div>
        <div className="rounded-xl bg-zinc-100 dark:bg-zinc-900/60 p-4">
          <div className="text-xs text-zinc-600 dark:text-zinc-400">Right stream</div>
          <div className="relative mt-2 aspect-video w-full rounded-lg bg-black/80 overflow-hidden">
            <div className={isPrivateLocked && !isUnlocked ? "absolute inset-0 backdrop-blur-md bg-black/30" : ""} />
            {isPrivateLocked && !isUnlocked ? (
              <div className="absolute inset-0 flex items-center justify-center">
                <button
                  className="rounded-full bg-gradient-to-r from-violet-600 to-cyan-400 px-5 py-2 text-sm font-semibold text-white"
                  onClick={() => setIsUnlocked(true)}
                >
                  Unlock with Tokens
                </button>
              </div>
            ) : null}
          </div>
          <div className="mt-3 text-xs text-zinc-600 dark:text-zinc-400">
            Placeholder: integrate WebRTC provider (Agora/Daily) here.
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="text-xs text-zinc-600 dark:text-zinc-400">
          Demo controls (broadcast-based): send a gift or toggle private lock.
        </div>
        <div className="flex gap-2">
          <button
            className="rounded-full border border-black/10 dark:border-white/10 px-4 py-2 text-sm hover:bg-black/[0.03] dark:hover:bg-white/[0.06]"
            onClick={async () => {
              if (!supabase || !session) return;
              // Demo: broadcast gift without billing. Real path should call Edge Function then broadcast.
              await supabase.channel("pk-updates").send({
                type: "broadcast",
                event: "gift",
                payload: {
                  pk_session_id: sessionId,
                  to_host_id: session.host_a_id,
                  tokens_amount: 10,
                },
              });
            }}
          >
            Send Gift +10 (Left)
          </button>
          <button
            className="rounded-full bg-gradient-to-r from-violet-600 to-cyan-400 px-4 py-2 text-sm font-semibold text-white"
            onClick={async () => {
              if (!supabase) return;
              const next = !isPrivateLocked;
              setIsPrivateLocked(next);
              setIsUnlocked(false);
              await supabase.channel("pk-updates").send({
                type: "broadcast",
                event: "private_lock",
                payload: { pk_session_id: sessionId, locked: next },
              });
            }}
          >
            {isPrivateLocked ? "Disable Private" : "Enable Private"}
          </button>
        </div>
      </div>

      <div className="text-xs text-zinc-500 dark:text-zinc-500">
        Note: heartbeat grace/pause is currently **UI-level**. Next step is an
        Edge Function or DB cron to mark `pk_sessions.status = paused` when a host
        heartbeat goes stale, so all clients are authoritative.
      </div>
    </div>
  );
}

