"use client";

import * as React from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { subscribeWithRetry } from "@/lib/realtime/subscribeWithRetry";
import { toast } from "sonner";
import { Send, Gift, Eye, MapPin } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

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

const GIFTS = [
  { id: "rose", label: "Rose", emoji: "🌹", amount: 10, gradient: "from-rose-500 to-pink-500" },
  { id: "fire", label: "Fire", emoji: "🔥", amount: 50, gradient: "from-orange-500 to-red-500" },
  { id: "diamond", label: "Diamond", emoji: "💎", amount: 100, gradient: "from-cyan-400 to-blue-500" },
  { id: "crown", label: "Crown", emoji: "👑", amount: 500, gradient: "from-amber-400 to-yellow-500" },
] as const;

function stableHash(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 33 + seed.charCodeAt(i)) >>> 0;
  }
  return hash;
}

export function LiveHostPanel({ stream, hostProfile }: LiveHostPanelProps) {
  const supabase = React.useMemo(() => createSupabaseBrowserClient()!, []);
  const [messages, setMessages] = React.useState<any[]>([]);
  const [chatAvailable, setChatAvailable] = React.useState(true);
  const [newMessage, setNewMessage] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [giftSending, setGiftSending] = React.useState<string | null>(null);
  const [user, setUser] = React.useState<any>(null);
  const [mounted, setMounted] = React.useState(false);
  const chatScrollRef = React.useRef<HTMLDivElement>(null);

  const viewersCount = React.useMemo(
    () => 120 + (stableHash(`${stream.host}-${stream.id}`) % 560),
    [stream.host, stream.id]
  );

  React.useEffect(() => setMounted(true), []);

  React.useEffect(() => {
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
          id, message, created_at,
          sender:profiles!live_chat_messages_sender_id_fkey(id, username, display_name)
        `)
        .eq("stream_id", stream.id)
        .order("created_at", { ascending: true })
        .limit(60);

      if (!active) return;
      if (error) {
        setChatAvailable(false);
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
        { event: "INSERT", schema: "public", table: "live_chat_messages", filter: `stream_id=eq.${stream.id}` },
        (payload) => {
          setMessages((prev) => [...prev.slice(-59), payload.new]);
        }
      );

    const stop = subscribeWithRetry(channel);

    return () => {
      active = false;
      stop();
      supabase.removeChannel(channel);
    };
  }, [stream?.id, supabase]);

  React.useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages]);

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
        toast.error("Unable to send message right now.");
        return;
      }
      setNewMessage("");
    } catch {
      toast.error("Unable to send chat message.");
    } finally {
      setSending(false);
    }
  };

  const sendGift = async (gift: (typeof GIFTS)[number]) => {
    if (!user) {
      toast.error("Please log in to send gifts.");
      return;
    }
    setGiftSending(gift.id);
    try {
      const { error } = await supabase.rpc("process_gift", {
        p_pk_session_id: null,
        p_from_user_id: user.id,
        p_to_host_id: stream.host,
        p_tokens_amount: gift.amount,
        p_org_id: null,
      });
      if (error) {
        toast.error(error?.message ?? "Failed to send gift");
        return;
      }
      toast.success(`${gift.emoji} ${gift.label} sent!`, {
        description: `${gift.amount} tokens to ${hostProfile.display_name || hostProfile.username}`,
      });
    } catch {
      toast.error("Failed to send gift");
    } finally {
      setGiftSending(null);
    }
  };

  return (
    <div className="flex flex-col rounded-2xl border border-white/10 bg-neutral-900/40 shadow-2xl shadow-black/40">
      {/* Host header */}
      <div className="flex items-center gap-3 border-b border-white/5 p-4">
        <div className="relative">
          {hostProfile.avatar_url ? (
            <img
              src={hostProfile.avatar_url}
              alt={hostProfile.username}
              className="h-11 w-11 rounded-full object-cover ring-2 ring-white/10"
            />
          ) : (
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-violet-600 to-cyan-500 text-sm font-bold uppercase text-white">
              {(hostProfile.display_name || hostProfile.username || "?").charAt(0)}
            </div>
          )}
          <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-neutral-900 bg-emerald-400" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-bold text-white">
            {hostProfile.display_name || hostProfile.username}
          </h2>
          <div className="mt-0.5 flex items-center gap-2 text-[11px] text-neutral-400">
            {hostProfile.country_code && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {hostProfile.country_code}
              </span>
            )}
            <span className="inline-flex items-center gap-1">
              <Eye className="h-3 w-3" />
              <span className="tabular-nums" suppressHydrationWarning>
                {mounted ? viewersCount : "—"}
              </span>
            </span>
          </div>
        </div>
      </div>

      {/* Gift bar */}
      <div className="border-b border-white/5 p-4">
        <div className="mb-2.5 flex items-center gap-2">
          <Gift className="h-3.5 w-3.5 text-rose-400" />
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-400">Send a tip</span>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {GIFTS.map((gift) => (
            <button
              key={gift.id}
              type="button"
              disabled={giftSending !== null}
              onClick={() => sendGift(gift)}
              className="group flex flex-col items-center gap-1 rounded-xl border border-white/5 bg-white/[0.02] p-2 transition-all hover:border-white/10 hover:bg-white/[0.04] disabled:opacity-50"
            >
              <span className="text-lg transition-transform group-hover:scale-110">{gift.emoji}</span>
              <span className="text-[9px] font-semibold uppercase tracking-wide text-neutral-300">{gift.label}</span>
              <span className="text-[9px] font-bold tabular-nums text-neutral-500">{gift.amount}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Chat */}
      <div className="flex flex-1 flex-col p-4">
        <div className="mb-2.5 flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-400">Live Chat</span>
          {!chatAvailable ? (
            <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[9px] uppercase tracking-wider text-amber-400">
              Unavailable
            </span>
          ) : (
            <span className="text-[9px] text-neutral-600">{messages.length} msgs</span>
          )}
        </div>

        <div
          ref={chatScrollRef}
          className="flex-1 space-y-2 overflow-y-auto rounded-xl bg-black/40 p-3"
          style={{ maxHeight: "320px", minHeight: "200px" }}
        >
          {!chatAvailable ? (
            <div className="flex h-full items-center justify-center text-center text-xs text-neutral-600">
              Chat is not available right now.
            </div>
          ) : messages.length === 0 ? (
            <div className="flex h-full items-center justify-center text-center text-xs text-neutral-600">
              Be the first to say hi 👋
            </div>
          ) : (
            <AnimatePresence initial={false}>
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-start gap-2"
                >
                  <span className="shrink-0 text-xs font-bold text-violet-400">
                    {msg.sender?.display_name || msg.sender?.username || "Guest"}
                  </span>
                  <span className="text-xs leading-relaxed text-neutral-200">{msg.message}</span>
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </div>

        <div className="mt-3 flex items-center gap-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendChat();
              }
            }}
            placeholder={user ? "Say something…" : "Login to chat"}
            className="flex-1 rounded-xl border border-white/10 bg-black/50 px-3.5 py-2.5 text-sm text-white outline-none transition-colors placeholder:text-neutral-600 focus:border-violet-500/50"
            disabled={!chatAvailable || !user || sending}
          />
          <button
            type="button"
            disabled={!chatAvailable || !user || !newMessage.trim() || sending}
            onClick={sendChat}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-600 text-white transition-all hover:bg-violet-500 disabled:opacity-40"
            aria-label="Send message"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
