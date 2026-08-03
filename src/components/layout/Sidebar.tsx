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
  PlayCircle,
  Globe,
  PlusCircle,
  Video,
  Ticket,
  Shield,
  User,
  Users,
  BadgePercent,
  Tag,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { subscribeWithRetry } from "@/lib/realtime/subscribeWithRetry";

const NAV = [
  { href: "/", label: "Home", icon: Home },
  { href: "/gallery", label: "Gallery", icon: ImageIcon },
  { href: "/recommended", label: "Recommended", icon: Sparkles },
  { href: "/favorites", label: "Favorites", icon: Heart },
  { href: "/history", label: "History", icon: History },
  { href: "/recordings", label: "Replay Rooms", icon: PlayCircle },
] as const;

const SPECIALS = [
  { href: "/category/ukrainian", label: "Ukrainian", icon: Globe },
  { href: "/category/new", label: "New Models", icon: PlusCircle },
  { href: "/category/vr", label: "VR Cams", icon: Video },
  { href: "/category/bdsm", label: "BDSM", icon: Shield },
  { href: "/category/tickets", label: "Ticket Shows", icon: Ticket },
] as const;

const FILTERS = [
  { title: "Age", icon: User, items: ["Teen 18+", "Young 22+", "MILF", "Mature"] },
  { title: "Ethnicity", icon: Users, items: ["Asian", "Ebony", "Latina", "White"] },
  { title: "Body Type", icon: BadgePercent, items: ["Skinny", "Athletic", "Curvy", "BBW"] },
  { title: "Tags", icon: Tag, items: ["Interactive Toy", "Mobile", "Outdoor"] },
] as const;

function formatCount(n?: number) {
  const x = n ?? 0;
  if (x >= 1000) return `${(x / 1000).toFixed(1)}k`;
  return `${x}`;
}

export function Sidebar() {
  const pathname = usePathname();
  const supabase = React.useMemo(() => createSupabaseBrowserClient(), []);
  const [liveCount, setLiveCount] = React.useState(0);
  const [isLoggedIn, setIsLoggedIn] = React.useState(false);

  React.useEffect(() => {
    if (!supabase) return;

    const fetchLiveCount = async () => {
      const { count, error } = await supabase
        .from("program_schedule")
        .select("*", { count: "exact", head: true })
        .eq("status", "live");

      if (!error && count !== null) {
        setLiveCount(count);
      }
    };

    fetchLiveCount();

    const channel = supabase.channel(`sidebar-live-count`);
    channel.on(
      "postgres_changes",
      { event: "*", schema: "public", table: "program_schedule" },
      () => fetchLiveCount()
    );

    const stop = subscribeWithRetry(channel);

    return () => {
      stop();
      supabase.removeChannel(channel);
    };
  }, [supabase]);

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

  return (
    <div className="flex h-full flex-col bg-black">
      <div className="flex-1 overflow-y-auto px-2.5 py-4">
        <SidebarSection title="Menu">
          {NAV.map((item) => (
            <SidebarRow
              key={item.href}
              href={item.href}
              label={item.label}
              icon={item.icon}
              active={pathname === item.href}
              count={item.href === "/" ? liveCount : undefined}
            />
          ))}
        </SidebarSection>

        <SidebarSection title="Specials">
          {SPECIALS.map((item) => (
            <SidebarRow
              key={item.href}
              href={item.href}
              label={item.label}
              icon={item.icon}
              active={pathname === item.href}
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
                  dense
                />
              );
            })}
          </SidebarSection>
        ))}
      </div>

      <div className="border-t border-white/5 p-3">
        <Link
          href={isLoggedIn ? "/studio" : "/login?mode=signup&next=/studio"}
          className="group flex items-center gap-3 rounded-xl bg-red-600/10 p-3 transition-all hover:bg-red-600/20"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-600 text-white shadow-lg shadow-red-600/30 transition-transform group-hover:scale-105">
            <Video className="h-4.5 w-4.5" />
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-bold uppercase italic tracking-tight text-white">Go Live</span>
            <span className="text-[10px] uppercase tracking-wider text-red-400/80">Creator Studio</span>
          </div>
        </Link>
      </div>
    </div>
  );
}

function SidebarSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <div className="mb-1.5 px-3 text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-600">
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
        "group flex items-center justify-between rounded-lg px-3 transition-colors",
        active ? "bg-white/[0.06] text-white" : "text-neutral-400 hover:bg-white/[0.03] hover:text-neutral-200",
        dense ? "py-1.5" : "py-2"
      )}
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <Icon
          className={cn(
            "h-4 w-4 shrink-0 transition-colors",
            active ? "text-red-500" : "text-neutral-500 group-hover:text-neutral-300"
          )}
        />
        <span className={cn(
          "truncate text-xs font-medium",
          active ? "text-white" : "text-neutral-400"
        )}>
          {label}
        </span>
      </div>
      {count !== undefined && count > 0 && (
        <span className={cn(
          "text-[10px] font-bold tabular-nums",
          active ? "text-red-400" : "text-neutral-600 group-hover:text-neutral-400"
        )}>
          {formatCount(count)}
        </span>
      )}
    </Link>
  );
}
