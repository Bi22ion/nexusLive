"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Image as ImageIcon,
  Sparkles,
  Heart,
  History,
  BadgePercent,
  Globe,
  PlusCircle,
  Video,
  Ticket,
  Shield,
  Tag,
  User,
  Users,
  PlayCircle,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type CountMap = Record<string, number>;

const NAV = [
  { href: "/", label: "Home", icon: Home, key: "home" },
  { href: "/gallery", label: "Gallery", icon: ImageIcon, key: "gallery" },
  { href: "/recommended", label: "Recommended", icon: Sparkles, key: "recommended" },
  { href: "/favorites", label: "Favorites", icon: Heart, key: "favorites" },
  { href: "/history", label: "History", icon: History, key: "history" },
  { href: "/recordings", label: "Replay Rooms", icon: PlayCircle, key: "recordings" },
] as const;

const SPECIALS = [
  { href: "/category/ukrainian", label: "Ukrainian", icon: Globe, key: "ukrainian" },
  { href: "/category/new", label: "New Models", icon: PlusCircle, key: "new_models" },
  { href: "/category/vr", label: "VR Cams", icon: Video, key: "vr" },
  { href: "/category/bdsm", label: "BDSM", icon: Shield, key: "bdsm" },
  { href: "/category/tickets", label: "Ticket Shows", icon: Ticket, key: "ticket" },
] as const;

const FILTERS = [
  {
    title: "AGE",
    items: ["Teen 18+", "Young 22+", "MILF", "Mature", "Granny"],
    icon: User,
  },
  {
    title: "ETHNICITY",
    items: ["Arab", "Asian", "Ebony", "Indian", "Latina", "Mixed", "White"],
    icon: Users,
  },
  {
    title: "BODY TYPE",
    items: ["Skinny", "Athletic", "Medium", "Curvy", "BBW"],
    icon: BadgePercent,
  },
  {
    title: "POPULAR TAGS",
    items: [
      "Interactive Toy",
      "Mobile",
      "Big Tits",
      "Outdoor",
      "Anal",
      "Blowjob",
      "Foot Fetish",
    ],
    icon: Tag,
  },
] as const;

function formatCount(n?: number) {
  const x = n ?? 0;
  if (x >= 1000) return `${(x / 1000).toFixed(1)}k`;
  return `${x}`;
}

export function Sidebar() {
  const pathname = usePathname();
  const supabase = React.useMemo(() => createSupabaseBrowserClient(), []);
  const [isLoggedIn, setIsLoggedIn] = React.useState(false);
  
  // FIXED: Start with empty state to prevent Hydration Mismatch
  const [counts, setCounts] = React.useState<CountMap>({});

  const fetchLiveCount = React.useCallback(async () => {
    if (!supabase) return;

    try {
      // Logic adjusted to check for status only to avoid column errors
      const { count, error } = await supabase
        .from("program_schedule")
        .select("*", { count: "exact", head: true })
        .eq("status", "live");

      if (!error && count !== null) {
        setCounts((prev) => ({ ...prev, home: count }));
      }
    } catch (err) {
      console.error("Sidebar count fetch failed:", err);
    }
  }, [supabase]);

  React.useEffect(() => {
    // FIXED: Seed random counts only on the client side
    setCounts(seedCounts());

    if (!supabase) return;
    fetchLiveCount();

    const channel = supabase.channel(`sidebar-sync-${Math.random().toString(36).substring(7)}`);
    channel
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "program_schedule" },
        () => fetchLiveCount()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, fetchLiveCount]);

  React.useEffect(() => {
    if (!supabase) return;
    let active = true;
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (active) {
        setIsLoggedIn(!!data.user);
      }
    })();
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsLoggedIn(!!session?.user);
    });
    return () => {
      active = false;
      subscription?.subscription?.unsubscribe();
    };
  }, [supabase]);

  return (
    <div className="flex h-full flex-col bg-black border-r border-white/5 overflow-hidden">
      <div className="flex-1 overflow-y-auto px-3 py-4 custom-scrollbar">
        <SidebarSection title="Menu">
          {NAV.map((item) => (
            <SidebarRow
              key={item.key}
              href={item.href}
              label={item.label}
              icon={item.icon}
              active={pathname === item.href}
              count={counts[item.key]}
            />
          ))}
        </SidebarSection>

        <SidebarSection title="Specials">
          {SPECIALS.map((item) => (
            <SidebarRow
              key={item.key}
              href={item.href}
              label={item.label}
              icon={item.icon}
              active={pathname === item.href}
              count={counts[item.key]}
            />
          ))}
        </SidebarSection>

        {FILTERS.map((group) => (
          <SidebarSection key={group.title} title={group.title}>
            {group.items.map((label) => {
              const filterHref = `/?filter=${encodeURIComponent(group.title)}&value=${encodeURIComponent(label)}`;
              return (
                <SidebarRow
                  key={label}
                  href={filterHref}
                  label={label}
                  icon={group.icon}
                  active={pathname + (typeof window !== 'undefined' ? window.location.search : '') === filterHref}
                  count={counts[`${group.title}:${label}`]}
                  dense
                />
              );
            })}
          </SidebarSection>
        ))}

        <div className="mt-4 rounded-2xl border border-white/10 bg-neutral-900/40 p-3">
          <div className="text-[10px] text-neutral-500 uppercase font-bold tracking-tighter leading-tight">
            Live updates active
          </div>
          <div className="mt-1 text-[9px] text-neutral-600 italic">
            Connected to synchronization engine.
          </div>
        </div>
      </div>

      <div className="p-4 bg-black border-t border-white/5">
        <Link
          href={isLoggedIn ? "/studio" : "/login?mode=signup&next=/studio"}
          className="group flex items-center gap-3 rounded-2xl bg-red-600/10 p-4 transition-all hover:bg-red-600/20 border border-red-600/5"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-600 text-white shadow-lg shadow-red-600/40">
            <Video className="h-5 w-5" />
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-black uppercase italic tracking-tighter text-white leading-none">
              Go Live
            </span>
            <span className="text-[10px] font-medium text-red-500/80 uppercase mt-1">
              Creator Studio
            </span>
          </div>
        </Link>
      </div>
    </div>
  );
}

function SidebarSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <div className="mb-2 px-3 text-[10px] font-black uppercase tracking-[0.2em] text-neutral-600">
        {title}
      </div>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function SidebarRow({
  href,
  label,
  icon: Icon,
  count,
  dense,
  active,
}: {
  href: string;
  label: string;
  icon: any;
  count?: number;
  dense?: boolean;
  active?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group flex items-center justify-between rounded-xl px-3 py-2.5 transition-all",
        active 
          ? "bg-white/5 text-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]" 
          : "text-neutral-400 hover:bg-neutral-900 hover:text-neutral-200",
        dense && "py-1.5"
      )}
    >
      <div className="flex items-center gap-3 min-w-0">
        <Icon 
          className={cn(
            "h-5 w-5 transition-colors flex-shrink-0", 
            active ? "text-red-600" : "text-neutral-500 group-hover:text-neutral-300"
          )} 
        />
        <span className={cn(
          "text-xs font-bold uppercase tracking-tight truncate", 
          active ? "text-white" : "text-neutral-400"
        )}>
          {label}
        </span>
      </div>
      {count !== undefined && count > 0 && (
        <span className={cn(
          "text-[10px] font-bold tabular-nums",
          active ? "text-red-500" : "text-neutral-600 group-hover:text-neutral-400"
        )}>
          {formatCount(count)}
        </span>
      )}
    </Link>
  );
}

function seedCounts(): CountMap {
  const rand = (min: number, max: number) =>
    Math.floor(min + Math.random() * (max - min + 1));
  
  const map: CountMap = {
    home: 0,
    gallery: rand(100, 800),
    recommended: rand(80, 500),
    favorites: rand(0, 200),
    history: rand(0, 40),
    recordings: rand(20, 220),
    ukrainian: rand(40, 300),
    new_models: rand(20, 250),
    vr: rand(5, 60),
    bdsm: rand(30, 220),
    ticket: rand(10, 120),
  };

  FILTERS.forEach(group => {
    group.items.forEach(item => {
      map[`${group.title}:${item}`] = rand(5, 700);
    });
  });

  return map;
}