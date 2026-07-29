 "use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Swords, Users } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { subscribeWithRetry } from "@/lib/realtime/subscribeWithRetry";

type Battle = {
  id: string;
  host_a_score: number;
  host_b_score: number;
  status: string;
};

type FeaturedPkBattlesProps = {
  initialData?: Battle[];
};

export function FeaturedPkBattles({ initialData }: FeaturedPkBattlesProps) {
  const supabase = React.useMemo(() => createSupabaseBrowserClient(), []);
  const [battles, setBattles] = React.useState<Battle[]>(initialData ?? []);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => setMounted(true), []);

  // Initial Data Fetch
  React.useEffect(() => {
    if (!supabase) return;
    let active = true;
    (async () => {
      const { data } = await supabase
        .from("pk_sessions")
        .select("id,score_a,score_b,status")
        .limit(12);
      if (!active) return;
      setBattles(
        ((data as any[]) ?? []).map((row) => ({
          id: row.id,
          host_a_score: row.score_a ?? 0,
          host_b_score: row.score_b ?? 0,
          status: row.status ?? "live",
        }))
      );
    })();
    return () => {
      active = false;
    };
  }, [supabase]);

  // Realtime Subscription Fix
  React.useEffect(() => {
    if (!supabase) return;

    // 1. Create a unique channel name to avoid collision during HMR
    const channelName = `featured-pk-${Math.random().toString(36).substring(7)}`;
    const channel = supabase.channel(channelName);

    // 2. Attach listeners FIRST
    channel.on(
      "postgres_changes",
      { event: "*", schema: "public", table: "pk_sessions" },
      (payload) => {
        const b = payload.new as any;
        if (!b || !b.id) return;

        setBattles((prev) => {
          const i = prev.findIndex((x) => x.id === b.id);
          const next = {
            id: b.id,
            host_a_score: b.score_a ?? 0,
            host_b_score: b.score_b ?? 0,
            status: b.status ?? "live",
          };

          if (i === -1) return [next, ...prev].slice(0, 12);
          const copy = [...prev];
          copy[i] = next;
          return copy;
        });
      }
    );

    // 3. Start subscription using the updated utility
    const stop = subscribeWithRetry(channel);

    return () => {
      stop();
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  if (!battles.length) return null;

  return (
    <section className="mb-6">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Swords className="h-4 w-4 text-cyan-400" />
          <h2 className="text-sm font-semibold tracking-tight">
            Featured PK Battles
          </h2>
        </div>
        <Link href="/pk" className="text-xs text-neutral-400 hover:text-white">
          View all
        </Link>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {battles.map((b) => (
          <Link key={b.id} href={`/pk/${b.id}`} className="min-w-[240px]">
            <motion.div
              whileHover={{ y: -2 }}
              transition={{ type: "spring", stiffness: 250, damping: 22 }}
              className="rounded-2xl border border-white/10 bg-neutral-900/30 hover:border-white/20 p-3"
            >
              <div className="flex items-center justify-between">
                <div className="text-xs text-neutral-400">
                  <span className="font-mono uppercase">{b.status}</span>
                </div>
                <div className="inline-flex items-center gap-1 text-xs text-neutral-400">
                  <Users className="h-3.5 w-3.5" />
                  <span suppressHydrationWarning>
                    {mounted ? Math.floor(50 + Math.random() * 1200) : "—"}
                  </span>
                </div>
              </div>
              <div className="mt-3 rounded-xl bg-black/40 p-3">
                <div className="text-sm font-semibold">Match Your Latest Picks</div>
                <div className="mt-1 text-xs text-neutral-400">
                  {(b.host_a_score ?? 0).toLocaleString()} : {(b.host_b_score ?? 0).toLocaleString()}
                </div>
              </div>
              <div className="mt-3 text-xs text-neutral-500">
                Tap to open dual-stream arena →
              </div>
            </motion.div>
          </Link>
        ))}
      </div>
    </section>
  );
}