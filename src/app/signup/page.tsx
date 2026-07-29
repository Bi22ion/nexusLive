"use client";

export const dynamic = "force-dynamic";

import * as React from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function SignUpPage() {
  // Use Next.js router to send users to the dashboard after they join
  const router = useRouter();
  
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [username, setUsername] = React.useState("");
  const [displayName, setDisplayName] = React.useState("");
  const [role, setRole] = React.useState<"viewer" | "host">("viewer");
  const [loading, setLoading] = React.useState(false);
  
  const supabase = createSupabaseBrowserClient();

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (!supabase) {
      alert("Unable to initialize Supabase client.");
      setLoading(false);
      return;
    }

    // Attempt to create the user account
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          user_role: role,
          username: username.trim() || email.split("@"),
          display_name: displayName.trim() || username.trim() || email.split("@"),
        },
        // We no longer need emailRedirectTo because we aren't sending a confirmation email
      },
    });

    if (error) {
      alert(error.message);
      setLoading(false);
    } else if (data.user) {
      // Since confirmation is OFF, the user is created and logged in instantly.
      // We send them straight to the dashboard.
      setLoading(false);
      router.push("/dashboard"); 
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-black p-4">
      <div className="w-full max-w-md space-y-8 rounded-3xl border border-white/10 bg-neutral-900 p-8 shadow-2xl">
        <div className="text-center">
          <h2 className="text-3xl font-black italic text-white uppercase tracking-tighter">
            NexusLive Join
          </h2>
          <p className="text-neutral-500 text-xs mt-2 uppercase tracking-widest">
            Create your account to start
          </p>
        </div>

        <form onSubmit={handleSignUp} className="space-y-6">
          {/* Role Selection */}
          <div className="grid grid-cols-2 gap-4">
            <button 
              type="button" 
              onClick={() => setRole("viewer")} 
              className={`p-4 rounded-xl border-2 transition-all font-bold uppercase text-xs tracking-widest ${
                role === "viewer" ? "border-violet-500 bg-violet-500/10 text-white" : "border-white/5 bg-black/20 text-neutral-500"
              }`}
            >
              VIEWER
            </button>
            <button 
              type="button" 
              onClick={() => setRole("host")} 
              className={`p-4 rounded-xl border-2 transition-all font-bold uppercase text-xs tracking-widest ${
                role === "host" ? "border-red-500 bg-red-500/10 text-white" : "border-white/5 bg-black/20 text-neutral-500"
              }`}
            >
              HOST
            </button>
          </div>

          {/* Input Fields */}
          <div className="space-y-4">
            <input 
              type="text" 
              placeholder="Username" 
              className="w-full rounded-xl bg-black border border-white/10 p-3 text-white focus:border-violet-500 outline-none transition-colors" 
              value={username} 
              onChange={(e) => setUsername(e.target.value)} 
            />
            <input 
              type="text" 
              placeholder="Display name" 
              className="w-full rounded-xl bg-black border border-white/10 p-3 text-white focus:border-violet-500 outline-none transition-colors" 
              value={displayName} 
              onChange={(e) => setDisplayName(e.target.value)} 
            />
            <input 
              type="email" 
              placeholder="Email" 
              className="w-full rounded-xl bg-black border border-white/10 p-3 text-white focus:border-violet-500 outline-none transition-colors" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              required 
            />
            <input 
              type="password" 
              placeholder="Password" 
              className="w-full rounded-xl bg-black border border-white/10 p-3 text-white focus:border-violet-500 outline-none transition-colors" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              required 
            />
          </div>

          {/* Submit Button */}
          <button 
            type="submit" 
            disabled={loading} 
            className="w-full rounded-full bg-violet-600 py-4 font-black text-white uppercase tracking-widest text-xs hover:bg-violet-500 transition-all active:scale-[0.98] disabled:opacity-50"
          >
            {loading ? "CREATING..." : "JOIN NOW"}
          </button>
        </form>
      </div>
    </div>
  );
}
