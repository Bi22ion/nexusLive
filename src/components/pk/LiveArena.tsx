"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Flame, Gem, Crown, Lock } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type PkBattleRow = {
  id: string;
  host_a_id: string;
  host_b_id: string;
  score_a: number;
  score_b: number;
  status: "waiting" | "live" | "ended" | string;
  // optional columns if your schema has them:
  is_private?: boolean | null;
  private_price_tokens?: number | null;
};

const gifts = [
  { id: "fire", label: "Fire", icon: Flame, amount: 10 },
  { id: "diamond", label: "Diamond", icon: Gem, amount: 50 },
  { id: "crown", label: "Crown", icon: Crown, amount: 200 },
] as const;

function clamp01(x: number) {
  return Math.max(0, Math.min(1, x));
}

export function LiveArena({ battleId }: { battleId: string }) {
  const supabase = React.useMemo(() => createSupabaseBrowserClient(), []);
  const [battle, setBattle] = React.useState<PkBattleRow | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [sending, setSending] = React.useState<string | null>(null);
  const [isUnlocked, setIsUnlocked] = React.useState(false);

  React.useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    let active = true;
    (async () => {
      const { data, error } = await supabase
        .from("pk_sessions")
        .select("*")
        .eq("id", battleId)
        .single();
      if (!active) return;
      if (error) {
        setBattle(null);
      } else {
        setBattle(data as unknown as PkBattleRow);
      }
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [battleId, supabase]);

  React.useEffect(() => {
    if (!supabase) return;
    const channel = supabase
      .channel(`pk_sessions:${battleId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "pk_sessions",
          filter: `id=eq.${battleId}`,
        },
        (payload) => {
          setBattle(payload.new as unknown as PkBattleRow);
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [battleId, supabase]);

  const total =
    (battle?.score_a ?? 0) + (battle?.score_b ?? 0);
  const leftPct = total <= 0 ? 0.5 : clamp01((battle?.score_a ?? 0) / total);

  if (!supabase) {
    return (
      <div className="rounded-2xl border border-black/10 dark:border-white/10 p-6">
        <div className="text-sm font-medium">Supabase not configured</div>
        <div className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Ensure `.env.local` has `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-black/10 dark:border-white/10 p-6">
        <div className="text-sm text-zinc-600 dark:text-zinc-400">
          Loading live arena…
        </div>
      </div>
    );
  }

  if (!battle) {
    return (
      <div className="rounded-2xl border border-black/10 dark:border-white/10 p-6">
        <div className="text-sm font-medium">Battle not found</div>
        <div className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Set `battleId` to a real row id from `pk_battles`.
        </div>
      </div>
    );
  }

  const isPrivate = Boolean(battle.is_private);
  const privatePrice = battle.private_price_tokens ?? 100;
  const locked = isPrivate && !isUnlocked;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-black/10 dark:border-white/10 p-4 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-sm font-semibold">PK Battle Arena</div>
            <div className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
              Status: <span className="font-mono">{battle.status}</span>
            </div>
          </div>

          <HostPrivateControls
            battle={battle}
            onLockedChange={(nextLocked) => {
              if (nextLocked) setIsUnlocked(false);
            }}
          />
        </div>

        {/* Progress bar */}
        <div className="mt-4">
          <div className="flex items-center justify-between text-xs text-zinc-600 dark:text-zinc-400">
            <span className="font-medium">Host A</span>
            <span className="tabular-nums">
              {(battle.score_a ?? 0).toLocaleString()} :{" "}
              {(battle.score_b ?? 0).toLocaleString()}
            </span>
            <span className="font-medium">Host B</span>
          </div>
          <div className="mt-2 h-3 w-full rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-violet-500 via-fuchsia-500 to-cyan-400"
              animate={{ width: `${leftPct * 100}%` }}
              transition={{ type: "spring", stiffness: 140, damping: 22 }}
            />
          </div>
        </div>

        {/* Streams */}
        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          <StreamPanel
            title="Host A Stream"
            locked={locked}
            privatePrice={privatePrice}
            onUnlock={() => setIsUnlocked(true)}
          />
          <StreamPanel
            title="Host B Stream"
            locked={locked}
            privatePrice={privatePrice}
            onUnlock={() => setIsUnlocked(true)}
          />
        </div>

        {/* Gift gallery */}
        <div className="mt-5">
          <div className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Gift Gallery
          </div>
          <div className="mt-2 grid grid-cols-3 gap-2 sm:flex sm:flex-wrap">
            {gifts.map((g) => {
              const Icon = g.icon;
              const busy = sending === g.id;
              return (
                <button
                  key={g.id}
                  className="rounded-xl border border-black/10 dark:border-white/10 bg-white/60 dark:bg-black/30 px-3 py-2 text-left hover:bg-black/[0.03] dark:hover:bg-white/[0.06] disabled:opacity-60"
                  disabled={busy}
                  onClick={async () => {
                    setSending(g.id);
                    try {
                      const { data: auth } = await supabase.auth.getUser();
                      const uid = auth.user?.id;
                      if (!uid) {
                        toast.error("Sign in required to send gifts");
                        return;
                      }

                      const { error } = await supabase.rpc(
                        "process_gift",
                        {
                          p_pk_session_id: battle.id,
                          p_from_user_id: uid,
                          p_to_host_id: battle.host_a_id, // default: send to Host A; wire UI target later
                          p_tokens_amount: g.amount,
                        }
                      );

                      if (error) throw error;
                      toast.success(`Sent ${g.label}`);
                    } catch (e: any) {
                      toast.error("Gift failed", {
                        description: e?.message ?? "Unknown error",
                      });
                    } finally {
                      setSending(null);
                    }
                  }}
                  type="button"
                >
                  <div className="flex items-center gap-2">
                    <div className="rounded-lg bg-gradient-to-r from-violet-500 to-cyan-400 p-2 text-white">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold">{g.label}</div>
                      <div className="text-xs text-zinc-600 dark:text-zinc-400">
                        {g.amount} tokens
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <MobileChatPlaceholder />
    </div>
  );
}

function StreamPanel({
  title,
  locked,
  privatePrice,
  onUnlock,
}: {
  title: string;
  locked: boolean;
  privatePrice: number;
  onUnlock: () => void;
}) {
  return (
    <div className="rounded-xl bg-zinc-100 dark:bg-zinc-900/60 p-3 sm:p-4">
      <div className="text-xs text-zinc-600 dark:text-zinc-400">{title}</div>
      <div className="relative mt-2 aspect-video w-full rounded-lg bg-black/80 overflow-hidden">
        {/* Video placeholder */}
        <div className="absolute inset-0" />

        {/* “Audio persistence” structure: keep audio element outside overlay */}
        {/* <audio autoPlay /> */}

        {locked ? (
          <>
            <div className="absolute inset-0 backdrop-blur-xl bg-black/35" />
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-4 text-center">
              <div className="inline-flex items-center gap-2 rounded-full bg-black/60 px-3 py-1 text-xs text-white">
                <Lock className="h-3.5 w-3.5" />
                Private Session
              </div>
              <div className="text-sm font-semibold text-white">
                Join for {privatePrice} tokens
              </div>
              <button
                className="rounded-full bg-gradient-to-r from-violet-500 to-cyan-400 px-5 py-2 text-sm font-semibold text-white"
                onClick={onUnlock}
                type="button"
              >
                Unlock with Tokens
              </button>
              <div className="text-xs text-white/70">
                Audio stays on while video is obscured.
              </div>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

function HostPrivateControls({
  battle,
  onLockedChange,
}: {
  battle: PkBattleRow;
  onLockedChange: (locked: boolean) => void;
}) {
  const supabase = React.useMemo(() => createSupabaseBrowserClient(), []);
  const [working, setWorking] = React.useState(false);

  return (
    <button
      className="rounded-full bg-gradient-to-r from-violet-500 to-cyan-400 px-3 py-2 text-xs sm:text-sm font-semibold text-white disabled:opacity-60"
      disabled={working}
      onClick={async () => {
        if (!supabase) return toast.error("Missing Supabase env vars");
        setWorking(true);
        try {
          const next = !Boolean(battle.is_private);
          const { error } = await supabase
            .from("pk_battles")
            .update({ is_private: next })
            .eq("id", battle.id);
          if (error) throw error;
          toast.success(next ? "Private Shift enabled" : "Private Shift disabled");
          onLockedChange(next);
        } catch (e: any) {
          toast.error("Failed to toggle Private Shift", {
            description: e?.message ?? "Check RLS / column names",
          });
        } finally {
          setWorking(false);
        }
      }}
      type="button"
      title="Host-only control (RLS should enforce)"
    >
      {battle.is_private ? "Go Public" : "Go Private"}
    </button>
  );
}

function MobileChatPlaceholder() {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <button
        className="sm:hidden fixed bottom-4 right-4 z-40 rounded-full bg-gradient-to-r from-violet-500 to-cyan-400 px-4 py-3 text-sm font-semibold text-white shadow-lg"
        onClick={() => setOpen(true)}
        type="button"
      >
        Open Chat
      </button>
      {open ? (
        <div className="sm:hidden fixed inset-0 z-50 bg-black/50">
          <div className="absolute inset-x-0 bottom-0 rounded-t-3xl bg-white dark:bg-zinc-950 border-t border-black/10 dark:border-white/10 p-4">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold">Chat</div>
              <button
                className="text-sm text-zinc-600 dark:text-zinc-400"
                onClick={() => setOpen(false)}
                type="button"
              >
                Close
              </button>
            </div>
            <div className="mt-3 h-56 rounded-2xl border border-black/10 dark:border-white/10 bg-zinc-50 dark:bg-black/30 p-3 text-sm text-zinc-600 dark:text-zinc-400">
              Chat module placeholder (wire Supabase Realtime messages next).
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

