"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { useRouter } from "next/navigation";
import { Menu, Search, Sparkles, X } from "lucide-react";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { WalletHeader } from "@/components/wallet/WalletHeader";
import { Sidebar } from "@/components/layout/Sidebar";
import { Footer } from "@/components/layout/Footer";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [isFinding, setIsFinding] = React.useState(false);
  const supabase = React.useMemo(() => createSupabaseBrowserClient(), []);
  const [isLoggedIn, setIsLoggedIn] = React.useState(false);

  React.useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

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

  const handleFindMostWatched = async () => {
    if (!supabase) return;
    setIsFinding(true);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("username")
        .eq("role", "host")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error || !data) {
        toast.info("No active streams found right now.");
        return;
      }

      router.push(`/model/${data.username}`);
    } catch {
      toast.error("Could not find a stream.");
    } finally {
      setIsFinding(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    router.push(`/gallery?q=${encodeURIComponent(searchQuery.trim())}`);
    setSearchQuery("");
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-neutral-950/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-[1600px] items-center gap-3 px-3 sm:px-4">
          <button
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-neutral-300 transition-colors hover:bg-white/[0.06] sm:hidden"
            onClick={() => setSidebarOpen(true)}
            type="button"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>

          <Link href="/" className="flex items-center gap-2">
            <span className="text-lg font-black uppercase italic tracking-tighter text-white">
              Nexus<span className="text-red-500">Live</span>
            </span>
          </Link>

          <div className="flex-1" />

          {/* Search */}
          <form onSubmit={handleSearch} className="relative hidden max-w-md flex-1 md:block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search creators…"
              className="h-10 w-full rounded-full border border-white/[0.06] bg-neutral-900/60 pl-9 pr-28 text-sm outline-none transition-colors placeholder:text-neutral-600 focus:border-red-500/40"
            />
            <button
              type="button"
              disabled={isFinding}
              onClick={handleFindMostWatched}
              className="absolute right-1.5 top-1/2 inline-flex -translate-y-1/2 items-center gap-1.5 rounded-full bg-gradient-to-r from-violet-600 to-cyan-500 px-3 py-1.5 text-xs font-semibold text-white transition-transform hover:scale-105 disabled:opacity-50"
            >
              <Sparkles className="h-3.5 w-3.5" />
              {isFinding ? "Finding…" : "Top Stream"}
            </button>
          </form>

          <div className="flex items-center gap-2">
            <WalletHeader />
            {!isLoggedIn && (
              <div className="hidden items-center gap-2 sm:flex">
                <Link
                  href="/login"
                  className="rounded-full px-3.5 py-2 text-sm font-medium text-neutral-300 transition-colors hover:bg-white/[0.06] hover:text-white"
                >
                  Login
                </Link>
                <Link
                  href="/login?mode=signup"
                  className="rounded-full bg-gradient-to-r from-violet-600 to-cyan-500 px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                >
                  Sign up
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-[1600px]">
        {/* Desktop sidebar */}
        <aside className="hidden w-56 shrink-0 border-r border-white/[0.06] lg:block">
          <div className="sticky top-14 h-[calc(100vh-3.5rem)]">
            <Sidebar />
          </div>
        </aside>

        {/* Mobile sidebar drawer */}
        <AnimatePresence>
          {sidebarOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-40 bg-black/80 backdrop-blur-sm lg:hidden"
                onClick={() => setSidebarOpen(false)}
              />
              <motion.aside
                initial={{ x: "-100%" }}
                animate={{ x: 0 }}
                exit={{ x: "-100%" }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                className="fixed left-0 top-0 z-50 h-full w-72 border-r border-white/10 bg-neutral-950 lg:hidden"
              >
                <button
                  className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-lg text-neutral-400 hover:bg-white/5"
                  onClick={() => setSidebarOpen(false)}
                  type="button"
                  aria-label="Close menu"
                >
                  <X className="h-5 w-5" />
                </button>
                <Sidebar />
              </motion.aside>
            </>
          )}
        </AnimatePresence>

        <main className="min-w-0 flex-1 px-3 py-4 sm:px-5 sm:py-6">
          {children}
          <Footer />
        </main>
      </div>
    </div>
  );
}
