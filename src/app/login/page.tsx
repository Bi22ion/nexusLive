"use client";

export const dynamic = "force-dynamic";

import * as React from "react";
import { Suspense } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useRouter, useSearchParams } from "next/navigation";

function AuthPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = React.useMemo(() => createSupabaseBrowserClient(), []);

  const mode = searchParams.get("mode");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [isSignUp, setIsSignUp] = React.useState(mode === "signup");
  const [loading, setLoading] = React.useState(false);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (!supabase) {
      alert("Unable to initialize Supabase client.");
      setLoading(false);
      return;
    }

    if (isSignUp) {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          // EVERYONE who signs up is a host by default
          data: { user_role: "host" },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        alert(error.message);
        setLoading(false);
      } else {
        alert("Verification email sent! Once confirmed, you'll have access to your Studio.");
        setLoading(false);
      }
    } else {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        alert(error.message);
        setLoading(false);
      } else {
        // Force redirect to Studio for all logged-in members
        router.push("/studio");
        router.refresh();
      }
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-black p-6">
      <div className="w-full max-w-md space-y-8 rounded-3xl border border-white/10 bg-neutral-900/40 p-10 backdrop-blur-2xl">
        <div className="text-center">
          <h1 className="text-4xl font-black tracking-tighter text-white uppercase italic">Nexus Studio</h1>
          <p className="mt-2 text-sm text-neutral-400">
            {isSignUp ? "Register as a Broadcaster" : "Log in to your Command Center"}
          </p>
        </div>

        <form onSubmit={handleAuth} className="space-y-4">
          <input
            type="email"
            placeholder="Studio Email"
            className="w-full rounded-xl bg-black border border-white/10 p-4 text-white outline-none focus:ring-1 focus:ring-red-500 transition-all"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Password"
            className="w-full rounded-xl bg-black border border-white/10 p-4 text-white outline-none focus:ring-1 focus:ring-red-500 transition-all"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          
          <button 
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-red-600 p-4 font-black uppercase italic tracking-widest text-white transition-all hover:bg-red-500 disabled:opacity-50"
          >
            {loading ? "CONNECTING..." : isSignUp ? "START CREATING" : "ENTER STUDIO"}
          </button>
        </form>

        <button 
          type="button"
          onClick={() => setIsSignUp(!isSignUp)}
          className="w-full text-center text-xs text-neutral-500 hover:text-white transition-colors"
        >
          {isSignUp ? "Already a broadcaster? Sign in" : "New creator? Create your studio account"}
        </button>
      </div>
    </div>
  );
}

export default function AuthPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-black"><div className="text-white">Loading...</div></div>}>
      <AuthPageContent />
    </Suspense>
  );
}
