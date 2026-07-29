"use client";

import * as React from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { subscribeWithRetry } from "@/lib/realtime/subscribeWithRetry";
import { toast } from "sonner";

type LiveHostPanelProps = {
  stream: {
    id: string;
    host: string;
    category?: string | null;
    media_url?: string | null;
  };
  hostProfile: {
    id: string;
    username: string;
    display_name?: string | null;
    avatar_url?: string | null;
    country_code?: string | null;
  };
};

export function LiveHostPanel({ stream, hostProfile }: LiveHostPanelProps) {
  const supabase = React.useMemo(() => createSupabaseBrowserClient()!, []);
  const [messages, setMessages] = React.useState<any[]>([]);
  const [chatAvailable, setChatAvailable] = React.useState(true);
  const [newMessage, setNewMessage] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [user, setUser] = React.useState<any>(null);
  const [mounted, setMounted] = React.useState(false);
  const viewersCount = React.useMemo(() => {
    const seed = `${stream.host}-${stream.id}`;
    let hash = 0;
    for (let i = 0; i < seed.length; i += 1) {
      hash = (hash * 33 + seed.charCodeAt(i)) >>> 0;
    }
    return 120 + (hash % 560);
  }, [stream.host, stream.id]);

  React.useEffect(() => {
    setMounted(true);
    const fetchUser = async () => {
      const { data } = await supabase.auth.getUser();
      setUser(data.user);
    };

    fetchUser();

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      subscription?.subscription?.unsubscribe();
    };
  }, [supabase]);

  React.useEffect(() => {
    if (!stream?.id) return;

    let active = true;

    const fetchMessages = async () => {
      const { data, error } = await supabase
        .from("live_chat_messages")
        .select(`
          id,
          message,
          created_at,
          sender:profiles!live_chat_messages_sender_id_fkey(
            id,
            username,
            display_name
          )
        `)
        .eq("stream_id", stream.id)
        .order("created_at", { ascending: true })
        .limit(50);

      if (!active) return;
      if (error) {
        // If table doesn't exist yet, keep UI functional without noisy console errors.
        if (error.code === "PGRST205" || String(error.message || "").includes("live_chat_messages")) {
          setChatAvailable(false);
        }
        setMessages([]);
        return;
      }
      setChatAvailable(true);
      setMessages(data ?? []);
    };

    fetchMessages();

    const channel = supabase
      .channel(`live-chat:${stream.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "live_chat_messages",
          filter: `stream_id=eq.${stream.id}`,
        },
        (payload) => {
          setMessages((prev) => [...prev, payload.new]);
        }
      );

    const stop = subscribeWithRetry(channel);

    return () => {
      active = false;
      stop();
      supabase.removeChannel(channel);
    };
  }, [stream?.id, supabase]);

  const sendChat = async () => {
    if (!newMessage.trim()) return;
    if (!user) {
      toast.error("Please log in to send chat messages.");
      return;
    }

    setSending(true);
    try {
      const { error } = await supabase.from("live_chat_messages").insert({
        stream_id: stream.id,
        sender_id: user.id,
        message: newMessage.trim(),
      });

      if (error) {
        console.error("Chat send failed:", error.message ?? error);
        toast.error("Chat is not available yet. Database migration may be pending.");
        return;
      }
      setNewMessage("");
    } catch (err: any) {
      console.error("Chat send failed:", err.message ?? err);
      toast.error("Unable to send chat message.");
    } finally {
      setSending(false);
    }
  };

  const sendGift = async (amount: number) => {
    if (!user) {
      toast.error("Please log in to send gifts.");
      return;
    }

    setSending(true);
    try {
      const { error } = await supabase.rpc("process_gift", {
        p_pk_session_id: null,
        p_from_user_id: user.id,
        p_to_host_id: stream.host,
        p_tokens_amount: amount,
        p_org_id: null,
      });
      if (error) {
        console.error("Gift send failed:", error.message ?? error);
        toast.error(error?.message ?? "Failed to send gift");
        return;
      }
      toast.success(`Gift sent: ${amount} tokens`);
    } catch (err: any) {
      console.error("Gift send failed:", err.message ?? err);
      toast.error(err?.message ?? "Failed to send gift");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6 rounded-3xl border border-white/10 bg-neutral-900/30 p-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-neutral-400">Live Host</p>
          <h2 className="mt-2 text-lg font-semibold text-white">
            {hostProfile.display_name || hostProfile.username}
          </h2>
          <p className="text-sm text-neutral-500">
            {hostProfile.country_code ?? "Worldwide"} • {stream.category ?? "Solo"}
          </p>
        </div>
        <div className="rounded-3xl bg-black/60 px-4 py-3 text-center text-sm text-white/80">
          <div className="text-xs uppercase tracking-[0.3em] text-neutral-500">Viewers</div>
          <div className="mt-2 text-2xl font-black" suppressHydrationWarning>
            {mounted ? viewersCount : "—"}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="rounded-3xl border border-white/10 bg-black/70 p-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold">Send a gift</div>
              <div className="text-xs text-neutral-500">Supports the host directly.</div>
            </div>
            <div className="text-xs text-neutral-400">{user ? "Logged in" : "Guest view"}</div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Rose", amount: 10 },
              { label: "Carnival", amount: 100 },
              { label: "Mega Yacht", amount: 500 },
            ].map((gift) => (
              <button
                key={gift.label}
                type="button"
                disabled={sending}
                onClick={() => sendGift(gift.amount)}
                className="rounded-3xl bg-gradient-to-r from-rose-500 to-fuchsia-500 px-3 py-4 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
              >
                <div className="text-[10px] uppercase tracking-wide">{gift.label}</div>
                <div>{gift.amount} Tokens</div>
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-black/70 p-4">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold">Live Chat</h3>
              <p className="text-xs text-neutral-500">View and send messages while the host is live.</p>
            </div>
            {chatAvailable ? (
              <span className="rounded-full bg-white/10 px-3 py-1 text-[10px] uppercase tracking-[0.24em] text-neutral-400">
                {messages.length} messages
              </span>
            ) : (
              <span className="rounded-full bg-yellow-500/10 px-3 py-1 text-[10px] uppercase tracking-[0.24em] text-yellow-400">
                Chat unavailable
              </span>
            )}
          </div>

          <div className="space-y-3 rounded-3xl bg-neutral-950/80 p-3 max-h-72 overflow-y-auto border border-white/5">
            {!chatAvailable ? (
              <div className="text-sm text-neutral-500">Chat table is not configured yet.</div>
            ) : messages.length === 0 ? (
              <div className="text-sm text-neutral-500">Be the first to say hi.</div>
            ) : (
              messages.map((message) => (
                <div key={message.id} className="space-y-1 rounded-2xl bg-white/5 p-3">
                  <div className="flex items-center justify-between gap-2 text-xs text-neutral-400">
                    <span>{message.sender?.display_name || message.sender?.username || "Guest"}</span>
                    <span>{new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <p className="text-sm text-neutral-100">{message.message}</p>
                </div>
              ))
            )}
          </div>

          <div className="mt-4 flex items-center gap-3">
            <input
              type="text"
              value={newMessage}
              onChange={(event) => setNewMessage(event.target.value)}
              placeholder={user ? "Write a message..." : "Login to type a message"}
              className="flex-1 rounded-3xl border border-white/10 bg-black/80 px-4 py-3 text-sm text-white outline-none placeholder:text-neutral-500"
              disabled={!chatAvailable || !user || sending}
            />
            <button
              type="button"
              disabled={!chatAvailable || !user || !newMessage.trim() || sending}
              onClick={sendChat}
              className="rounded-3xl bg-rose-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-rose-400 disabled:opacity-50"
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
