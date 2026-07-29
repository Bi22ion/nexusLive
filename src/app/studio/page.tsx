"use client";

import * as React from "react";
import { createBrowserClient } from "@supabase/ssr";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { 
  Camera, 
  Settings, 
  Zap, 
  Users, 
  Heart, 
  MessageSquare, 
  Gift, 
  Swords,
  UserPlus,
  Lock,
  Mic,
  LogOut
} from "lucide-react";

export default function CreatorStudio() {
  const [isLive, setIsLive] = React.useState(false);
  const [showCategoryModal, setShowCategoryModal] = React.useState(false);
  const [selectedCategory, setSelectedCategory] = React.useState("solo");
  const [customCategory, setCustomCategory] = React.useState(""); 
  const [streamTitle, setStreamTitle] = React.useState("");
  const [streamDescription, setStreamDescription] = React.useState("");
  const [isPKMode, setIsPKMode] = React.useState(false);
  const [diamonds, setDiamonds] = React.useState(0);
  const [activeStreamId, setActiveStreamId] = React.useState<string | null>(null);
  const [hostUserId, setHostUserId] = React.useState<string | null>(null);
  const [studioMessages, setStudioMessages] = React.useState<any[]>([]);
  const [chatInput, setChatInput] = React.useState("");
  const [chatAvailable, setChatAvailable] = React.useState(true);
  const [sendingChat, setSendingChat] = React.useState(false);
  const [privateModeEnabled, setPrivateModeEnabled] = React.useState(false);
  const [privateEntryTokens, setPrivateEntryTokens] = React.useState(100);
  const [speechSupported, setSpeechSupported] = React.useState(false);
  const [listening, setListening] = React.useState(false);
  const [showSettingsModal, setShowSettingsModal] = React.useState(false);
  const [isHostAccount, setIsHostAccount] = React.useState(true);
  const [profileUsername, setProfileUsername] = React.useState("");
  const [profileDisplayName, setProfileDisplayName] = React.useState("");
  const [profileAvatarUrl, setProfileAvatarUrl] = React.useState("");
  const [profileCountry, setProfileCountry] = React.useState("");
  const [profileCity, setProfileCity] = React.useState("");
  const [savingProfile, setSavingProfile] = React.useState(false);
  const speechRecognitionRef = React.useRef<any>(null);
  const floatingMessages = React.useMemo(() => studioMessages.slice(-6), [studioMessages]);
  
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const localStreamRef = React.useRef<MediaStream | null>(null);
  const hostChannelRef = React.useRef<RealtimeChannel | null>(null);
  const peerConnectionsRef = React.useRef<Map<string, RTCPeerConnection>>(new Map());

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // 1. INITIALIZE CAMERA PREVIEW
  React.useEffect(() => {
    let active = true;
    (async () => {
      const { data: authData } = await supabase.auth.getUser();
      const user = authData.user;
      if (!user || !active) return;
      const role = String(user.user_metadata?.user_role || "");
      setIsHostAccount(role === "host" || role === "creator");

      const { data: profile } = await supabase
        .from("profiles")
        .select("username, display_name, avatar_url")
        .eq("id", user.id)
        .maybeSingle();
      if (!active) return;
      setProfileUsername(profile?.username ?? "");
      setProfileDisplayName(profile?.display_name ?? "");
      setProfileAvatarUrl(profile?.avatar_url ?? "");
      setProfileCountry(String(user.user_metadata?.country || ""));
      setProfileCity(String(user.user_metadata?.city || ""));
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      const role = String(session?.user?.user_metadata?.user_role || "");
      setIsHostAccount(role === "host" || role === "creator");
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [supabase]);

  React.useEffect(() => {
    const SpeechRecognitionCtor =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) return;
    setSpeechSupported(true);
    const recognition = new SpeechRecognitionCtor();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.onresult = (event: any) => {
      const transcript = event.results?.[0]?.[0]?.transcript || "";
      if (transcript) {
        setChatInput((prev) => `${prev} ${transcript}`.trim());
      }
    };
    recognition.onend = () => setListening(false);
    speechRecognitionRef.current = recognition;
    return () => {
      recognition.onresult = null;
      recognition.onend = null;
      speechRecognitionRef.current = null;
    };
  }, []);

  React.useEffect(() => {
    async function enableCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { width: 1280, height: 720 },
          audio: true 
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        localStreamRef.current = stream;
      } catch (err) {
        console.error("Camera access denied:", err);
      }
    }
    enableCamera();

    return () => {
      if (videoRef.current?.srcObject) {
        const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
        tracks.forEach(track => track.stop());
      }
      localStreamRef.current = null;
    };
  }, []);

  const closeHostRealtime = React.useCallback(() => {
    peerConnectionsRef.current.forEach((pc) => pc.close());
    peerConnectionsRef.current.clear();
    if (hostChannelRef.current) {
      hostChannelRef.current.unsubscribe();
      supabase.removeChannel(hostChannelRef.current);
      hostChannelRef.current = null;
    }
  }, [supabase]);

  const setupHostRealtime = React.useCallback(
    async (streamId: string, currentHostId: string) => {
      closeHostRealtime();
      const channel = supabase.channel(`webrtc:stream-${streamId}`);
      hostChannelRef.current = channel;

      channel
        .on("broadcast", { event: "viewer_join" }, async ({ payload }) => {
          const viewerId = payload?.viewerId as string | undefined;
          if (!viewerId || !localStreamRef.current || peerConnectionsRef.current.has(viewerId)) return;

          const pc = new RTCPeerConnection({
            iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
          });
          peerConnectionsRef.current.set(viewerId, pc);

          localStreamRef.current.getTracks().forEach((track) => {
            pc.addTrack(track, localStreamRef.current as MediaStream);
          });

          pc.onicecandidate = async (event) => {
            if (!event.candidate) return;
            await channel.send({
              type: "broadcast",
              event: "host_candidate",
              payload: {
                hostId: currentHostId,
                targetViewerId: viewerId,
                candidate: event.candidate.toJSON(),
              },
            });
          };

          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          await channel.send({
            type: "broadcast",
            event: "host_offer",
            payload: {
              hostId: currentHostId,
              targetViewerId: viewerId,
              streamId,
              sdp: offer.sdp,
              type: offer.type,
            },
          });
        })
        .on("broadcast", { event: "viewer_answer" }, async ({ payload }) => {
          if (payload?.targetHostId !== currentHostId) return;
          const viewerId = payload?.viewerId as string | undefined;
          const pc = viewerId ? peerConnectionsRef.current.get(viewerId) : undefined;
          if (!pc || !payload?.sdp || !payload?.type) return;
          await pc.setRemoteDescription(new RTCSessionDescription({ type: payload.type, sdp: payload.sdp }));
        })
        .on("broadcast", { event: "viewer_candidate" }, async ({ payload }) => {
          if (payload?.targetHostId !== currentHostId) return;
          const viewerId = payload?.viewerId as string | undefined;
          const pc = viewerId ? peerConnectionsRef.current.get(viewerId) : undefined;
          if (!pc || !payload?.candidate) return;
          await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
        })
        .subscribe();
    },
    [closeHostRealtime, supabase]
  );

  // 2. BROADCAST LOGIC (Fixed Conflict & Reference Errors)
  const startBroadcast = async () => {
    try {
      if (!isHostAccount) {
        alert("Your current account is not a host account. Please sign in with a host account to stream.");
        return;
      }
      // Destructure user safely to avoid reference errors
      const { data: authData, error: authError } = await supabase.auth.getUser();

      if (authError || !authData.user) {
        alert("Authentication failed. Please log in again.");
        return;
      }

      const user = authData.user;
      setHostUserId(user.id);

      // Ensure profile exists
      const { data: existingProfile } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", user.id)
        .single();

      if (!existingProfile) {
        // Create profile if it doesn't exist
        const { error: profileError } = await supabase
          .from("profiles")
          .insert({
            id: user.id,
            username: user.email?.split('@')[0] || `user_${user.id.slice(0, 8)}`,
            display_name: user.email?.split('@')[0] || `User ${user.id.slice(0, 8)}`,
            role: user.user_metadata?.user_role === "creator" ? "host" : (user.user_metadata?.user_role || "host"),
          });

        if (profileError) {
          console.error("Profile creation failed:", profileError);
          alert("Failed to create user profile. Please try again.");
          return;
        }
      }

      const normalizedCategory = selectedCategory === "others" ? customCategory.trim() : selectedCategory;
      if (!normalizedCategory) {
        alert("Please select a stream category.");
        return;
      }
      if (!streamTitle.trim()) {
        alert("Please enter a stream title.");
        return;
      }

      const streamData = {
        host: user.id,
        status: "live",
        category: normalizedCategory.toLowerCase(),
        is_pk: isPKMode,
        is_private: privateModeEnabled,
        private_entry_tokens: privateEntryTokens,
        title: streamTitle.trim(),
        description: streamDescription.trim() || null,
        started_at: new Date().toISOString(),
        media_url: "webrtc://live",
      };

      // Avoid relying on DB unique constraints; update existing stream if present.
      const { data: existingStream, error: existingStreamError } = await supabase
        .from("program_schedule")
        .select("id")
        .eq("host", user.id)
        .limit(1)
        .maybeSingle();

      if (existingStreamError) {
        throw existingStreamError;
      }

      const tryWriteStream = async (payload: Record<string, any>) => {
        if (existingStream) {
          return supabase
            .from("program_schedule")
            .update(payload)
            .eq("id", existingStream.id)
            .select("id")
            .single();
        }
        return supabase.from("program_schedule").insert(payload).select("id").single();
      };

      let { data: persistedStream, error } = await tryWriteStream(streamData);

      // Backward-compatible fallback for older DB schemas missing new columns.
      if (error?.code === "PGRST204") {
        const { description: _description, ...fallbackNoDescription } = streamData;
        ({ data: persistedStream, error } = await tryWriteStream(fallbackNoDescription));
      }

      if (error?.code === "PGRST204") {
        const { description: _description, title: _title, ...fallbackMinimal } = streamData;
        ({ data: persistedStream, error } = await tryWriteStream(fallbackMinimal));
      }

      if (error) throw error;
      if (!persistedStream?.id) {
        throw new Error("Unable to create live stream session.");
      }

      await setupHostRealtime(persistedStream.id, user.id);
      setActiveStreamId(persistedStream.id);

      setIsLive(true);
      setShowCategoryModal(false);
    } catch (err: any) {
      console.error("Failed to start broadcast:", err);
      alert(`Database Error: ${err.message}`);
    }
  };

  const togglePrivateMode = async () => {
    const nextValue = !privateModeEnabled;
    setPrivateModeEnabled(nextValue);
    if (!activeStreamId) return;
    await supabase
      .from("program_schedule")
      .update({ is_private: nextValue, private_entry_tokens: privateEntryTokens })
      .eq("id", activeStreamId);
  };

  React.useEffect(() => {
    if (!activeStreamId) return;
    supabase
      .from("program_schedule")
      .update({ private_entry_tokens: privateEntryTokens })
      .eq("id", activeStreamId);
  }, [activeStreamId, privateEntryTokens, supabase]);

  React.useEffect(() => {
    if (!isLive || !activeStreamId || !videoRef.current) return;
    let stopped = false;
    const canvas = document.createElement("canvas");
    canvas.width = 320;
    canvas.height = 180;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const pushSnapshot = async () => {
      if (stopped || !videoRef.current) return;
      try {
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        const coverImage = canvas.toDataURL("image/jpeg", 0.7);
        await supabase.from("program_schedule").update({ cover_image: coverImage }).eq("id", activeStreamId);
      } catch {
        // best-effort snapshot updates
      }
    };

    pushSnapshot();
    const interval = setInterval(pushSnapshot, 9000);
    return () => {
      stopped = true;
      clearInterval(interval);
    };
  }, [isLive, activeStreamId, supabase]);

  const startSpeechToText = () => {
    if (!speechRecognitionRef.current || listening) return;
    setListening(true);
    speechRecognitionRef.current.start();
  };

  const saveStudioProfile = async () => {
    setSavingProfile(true);
    try {
      const { data: authData } = await supabase.auth.getUser();
      const user = authData.user;
      if (!user) throw new Error("Please login again.");

      const { error: profileError } = await supabase.from("profiles").upsert({
        id: user.id,
        username: profileUsername.trim() || user.email?.split("@")[0] || `user_${user.id.slice(0, 8)}`,
        display_name: profileDisplayName.trim() || profileUsername.trim() || user.email?.split("@")[0] || "Host",
        avatar_url: profileAvatarUrl.trim() || null,
        role: "host",
      });
      if (profileError) throw profileError;

      const { error: authError } = await supabase.auth.updateUser({
        data: {
          country: profileCountry.trim() || null,
          city: profileCity.trim() || null,
          user_role: "host",
        },
      });
      if (authError) throw authError;
      setShowSettingsModal(false);
    } catch (err: any) {
      alert(`Failed to save profile: ${err?.message || "Unknown error"}`);
    } finally {
      setSavingProfile(false);
    }
  };

  const endBroadcast = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const nowIso = new Date().toISOString();
      const streamIdToArchive = activeStreamId;
      const archiveTitle = streamTitle.trim() || "Live Replay";
      const archiveDescription = streamDescription.trim() || "Auto-recorded from live studio session.";

      // Mark stream as ended instead of deleting so recording jobs can reference it.
      await supabase
        .from("program_schedule")
        .update({ status: "ended", ended_at: nowIso })
        .eq("host", user.id)
        .eq("status", "live");

      // Create recording pipeline jobs and VOD placeholders (best effort).
      if (streamIdToArchive) {
        const { error: recordingJobError } = await supabase.from("recording_jobs").insert({
          host_id: user.id,
          stream_id: streamIdToArchive,
          status: "queued",
          input_url: "webrtc://live",
        });
        if (recordingJobError) {
          console.warn("Recording job not created:", recordingJobError.message);
        }

        const { error: vodError } = await supabase.from("vod_assets").insert({
          host_id: user.id,
          source_stream_id: streamIdToArchive,
          title: archiveTitle,
          description: archiveDescription,
          status: "processing",
          visibility: "paid",
          price_tokens: 50,
          recorded_on: new Date().toISOString().slice(0, 10),
        });
        if (vodError) {
          console.warn("VOD placeholder not created:", vodError.message);
        }
      }

      closeHostRealtime();
      setActiveStreamId(null);
      setStudioMessages([]);
      setChatInput("");
      setIsLive(false);
    } catch (err) {
      console.error("End broadcast failed:", err);
    }
  };

  React.useEffect(() => {
    if (!activeStreamId) return;
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
        .eq("stream_id", activeStreamId)
        .order("created_at", { ascending: true })
        .limit(30);

      if (!active) return;
      if (error) {
        if (error.code === "PGRST205" || String(error.message || "").includes("live_chat_messages")) {
          setChatAvailable(false);
        }
        setStudioMessages([]);
        return;
      }

      setChatAvailable(true);
      setStudioMessages(data ?? []);
    };

    fetchMessages();

    const channel = supabase
      .channel(`studio-live-chat:${activeStreamId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "live_chat_messages", filter: `stream_id=eq.${activeStreamId}` },
        (payload) => {
          setStudioMessages((prev) => [...prev, payload.new].slice(-30));
        }
      );

    channel.subscribe();

    return () => {
      active = false;
      channel.unsubscribe();
      supabase.removeChannel(channel);
    };
  }, [activeStreamId, supabase]);

  const sendStudioChat = async () => {
    if (!activeStreamId || !hostUserId || !chatInput.trim()) return;

    setSendingChat(true);
    try {
      const { error } = await supabase.from("live_chat_messages").insert({
        stream_id: activeStreamId,
        sender_id: hostUserId,
        message: chatInput.trim(),
      });
      if (error) {
        throw error;
      }
      setChatInput("");
    } catch (err) {
      console.error("Studio chat send failed:", err);
    } finally {
      setSendingChat(false);
    }
  };

  React.useEffect(() => {
    return () => {
      closeHostRealtime();
    };
  }, [closeHostRealtime]);

  return (
    <div className="flex h-screen bg-black text-white overflow-hidden font-sans">
      <div className="flex-1 flex flex-col relative">
        
        {/* Header UI */}
        <div className="absolute top-0 left-0 right-0 z-20 p-6 flex justify-between items-start bg-gradient-to-b from-black/80 to-transparent">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-2xl bg-red-600 flex items-center justify-center shadow-lg shadow-red-600/20">
              <Camera className="text-white h-6 w-6" />
            </div>
            <div>
              <h1 className="text-sm font-black uppercase italic tracking-tighter">Studio</h1>
              <div className="flex items-center gap-2 mt-1">
                <span className={`h-2 w-2 rounded-full ${isLive ? 'bg-red-600 animate-pulse' : 'bg-neutral-600'}`} />
                <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">
                  {isLive ? 'Live' : 'Ready'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="bg-neutral-900/80 backdrop-blur-md border border-white/5 px-4 py-2 rounded-xl flex items-center gap-3">
              <Zap className="h-4 w-4 text-yellow-500 fill-yellow-500" />
              <span className="text-xs font-black tabular-nums">{diamonds}</span>
            </div>
            <button
              type="button"
              onClick={() => setShowSettingsModal(true)}
              className="p-3 bg-neutral-900/80 border border-white/5 rounded-xl hover:bg-neutral-800 transition-colors"
            >
              <Settings className="h-5 w-5 text-neutral-400" />
            </button>
          </div>
        </div>

        {/* Video Canvas */}
        <div className="flex-1 bg-neutral-950 relative overflow-hidden">
          <video 
            ref={videoRef} 
            autoPlay 
            muted 
            playsInline 
            className="w-full h-full object-cover"
          />
          
          {!isLive && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm">
              <button 
                onClick={() => setShowCategoryModal(true)}
                className="group relative px-12 py-5 bg-red-600 rounded-full overflow-hidden transition-all hover:scale-105 active:scale-95 shadow-2xl shadow-red-600/40"
              >
                <span className="relative text-lg font-black uppercase italic tracking-tighter flex items-center gap-3">
                  <Zap className="h-6 w-6 fill-white" /> Go Live
                </span>
              </button>
            </div>
          )}

          {isLive && (
            <div className="absolute bottom-32 left-8 z-30 flex flex-col gap-3">
              <div className="bg-black/60 backdrop-blur-xl border border-white/10 p-5 rounded-3xl w-64 shadow-2xl">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Swords className="h-4 w-4 text-red-500" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-white">Battle Mode</span>
                  </div>
                  <span className="text-[9px] bg-red-600 px-2 py-0.5 rounded-full font-bold uppercase animate-pulse">Active</span>
                </div>
                
                <div className="space-y-2">
                  <button className="w-full py-3.5 rounded-xl bg-red-600 text-[10px] font-black uppercase flex items-center justify-center gap-2 hover:bg-red-500 transition-all text-white shadow-lg">
                    <UserPlus className="h-3.5 w-3.5" /> Challenge Creator
                  </button>
                  <button className="w-full py-3.5 rounded-xl bg-white/5 border border-white/10 text-[10px] font-black uppercase flex items-center justify-center gap-2 hover:bg-white/10 transition-colors text-white">
                    <Users className="h-3.5 w-3.5" /> Find Opponent
                  </button>
                </div>
              </div>
              <div className="bg-black/60 backdrop-blur-xl border border-white/10 p-5 rounded-3xl w-64 shadow-2xl">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Lock className="h-4 w-4 text-violet-400" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-white">Private Room</span>
                  </div>
                  <button
                    type="button"
                    onClick={togglePrivateMode}
                    className={`h-6 w-12 rounded-full transition-colors relative ${privateModeEnabled ? "bg-violet-600" : "bg-neutral-700"}`}
                  >
                    <div className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-all ${privateModeEnabled ? "left-7" : "left-1"}`} />
                  </button>
                </div>
                <label className="text-[10px] text-white/60 uppercase">Entry tokens</label>
                <input
                  type="number"
                  min={10}
                  step={10}
                  value={privateEntryTokens}
                  onChange={(event) => setPrivateEntryTokens(Math.max(10, Number(event.target.value || 0)))}
                  className="mt-2 w-full rounded-xl border border-white/10 bg-black/70 px-3 py-2 text-xs text-white outline-none"
                />
              </div>
            </div>
          )}

          {isLive && chatAvailable && floatingMessages.length > 0 && (
            <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
              {floatingMessages.map((message, idx) => (
                <div
                  key={`${message.id}-${idx}`}
                  className="absolute left-6 rounded-full bg-black/60 px-3 py-1 text-xs text-white/90 backdrop-blur-sm animate-[studioMsgFloat_8s_linear_forwards]"
                  style={{ bottom: `${18 + idx * 7}%`, animationDelay: `${idx * 0.4}s` }}
                >
                  <span className="mr-1 font-bold text-red-400">
                    {message.sender?.display_name || message.sender?.username || "Viewer"}:
                  </span>
                  {message.message}
                </div>
              ))}
            </div>
          )}

          {isLive && (
            <div className="absolute right-6 bottom-28 z-30 w-[340px] rounded-2xl border border-white/10 bg-black/55 p-3 backdrop-blur-xl">
              <div className="mb-2 flex items-center justify-between">
                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-white/80">Live Chat</div>
                <div className="text-[10px] text-white/50">{chatAvailable ? "Active" : "Unavailable"}</div>
              </div>
              <div className="h-40 overflow-y-auto space-y-2 pr-1">
                {!chatAvailable ? (
                  <div className="text-xs text-yellow-400">Configure `live_chat_messages` table to enable chat.</div>
                ) : studioMessages.length === 0 ? (
                  <div className="text-xs text-white/50">Messages from viewers will appear here.</div>
                ) : (
                  studioMessages.map((message) => (
                    <div key={message.id} className="text-xs leading-5 text-white/90">
                      <span className="font-bold text-red-400 mr-1">
                        {message.sender?.display_name || message.sender?.username || "Viewer"}:
                      </span>
                      {message.message}
                    </div>
                  ))
                )}
              </div>
              <div className="mt-2 flex items-center gap-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(event) => setChatInput(event.target.value)}
                  placeholder={chatAvailable ? "Reply to viewers..." : "Chat unavailable"}
                  className="flex-1 rounded-xl border border-white/10 bg-black/70 px-3 py-2 text-xs text-white outline-none"
                  disabled={!chatAvailable || sendingChat}
                />
                <button
                  type="button"
                  onClick={sendStudioChat}
                  disabled={!chatAvailable || !chatInput.trim() || sendingChat}
                  className="rounded-xl bg-red-600 px-3 py-2 text-[10px] font-bold uppercase text-white disabled:opacity-50"
                >
                  Send
                </button>
                {speechSupported ? (
                  <button
                    type="button"
                    onClick={startSpeechToText}
                    disabled={listening || !chatAvailable}
                    className="rounded-xl bg-violet-600 px-3 py-2 text-[10px] font-bold uppercase text-white disabled:opacity-50"
                  >
                    <Mic className="h-3 w-3" />
                  </button>
                ) : null}
              </div>
            </div>
          )}
        </div>

        <style jsx global>{`
          @keyframes studioMsgFloat {
            0% {
              transform: translateY(0);
              opacity: 0;
            }
            10% {
              opacity: 1;
            }
            85% {
              opacity: 1;
            }
            100% {
              transform: translateY(-120px);
              opacity: 0;
            }
          }
        `}</style>

        {/* Controls Bar */}
        <div className="h-24 bg-black border-t border-white/5 flex items-center justify-between px-8">
          <div className="flex items-center gap-8">
            <div className="flex flex-col">
              <span className="text-[10px] font-black text-neutral-500 uppercase tracking-widest mb-1 text-white/50">Viewers</span>
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-white" />
                <span className="text-xl font-black tabular-nums tracking-tighter">0</span>
              </div>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] font-black text-neutral-500 uppercase tracking-widest mb-1 text-white/50">Hearts</span>
              <div className="flex items-center gap-2">
                <Heart className="h-4 w-4 text-pink-600 fill-pink-600" />
                <span className="text-xl font-black tabular-nums tracking-tighter">0</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {isLive && (
              <button 
                onClick={endBroadcast}
                className="px-8 py-3 bg-neutral-900 border border-white/10 rounded-2xl text-[10px] font-black uppercase text-red-500 hover:bg-red-600 hover:text-white transition-all"
              >
                Stop Stream
              </button>
            )}
            <div className="flex gap-2">
              <button className="h-12 w-12 rounded-2xl bg-neutral-900 flex items-center justify-center border border-white/5 hover:border-white/20 transition-all">
                <MessageSquare className="h-5 w-5 text-neutral-400" />
              </button>
              <button className="h-12 w-12 rounded-2xl bg-neutral-900 flex items-center justify-center border border-white/5 hover:border-white/20 transition-all">
                <Gift className="h-5 w-5 text-neutral-400" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Settings Modal */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-black/90 backdrop-blur-xl" onClick={() => setShowSettingsModal(false)} />
          <div className="relative w-full max-w-xl rounded-[36px] border border-white/10 bg-neutral-950 p-8">
            <h2 className="text-2xl font-black uppercase italic tracking-tighter">Studio Account Settings</h2>
            <p className="mt-1 text-xs text-neutral-500">Configure your host identity and location metadata.</p>

            <div className="mt-6 space-y-4">
              <input
                type="text"
                value={profileUsername}
                onChange={(e) => setProfileUsername(e.target.value)}
                placeholder="Username"
                className="w-full rounded-2xl border border-white/10 bg-neutral-900 px-4 py-3 text-sm text-white outline-none"
              />
              <input
                type="text"
                value={profileDisplayName}
                onChange={(e) => setProfileDisplayName(e.target.value)}
                placeholder="Display name"
                className="w-full rounded-2xl border border-white/10 bg-neutral-900 px-4 py-3 text-sm text-white outline-none"
              />
              <input
                type="url"
                value={profileAvatarUrl}
                onChange={(e) => setProfileAvatarUrl(e.target.value)}
                placeholder="Avatar URL"
                className="w-full rounded-2xl border border-white/10 bg-neutral-900 px-4 py-3 text-sm text-white outline-none"
              />
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  value={profileCountry}
                  onChange={(e) => setProfileCountry(e.target.value)}
                  placeholder="Country"
                  className="w-full rounded-2xl border border-white/10 bg-neutral-900 px-4 py-3 text-sm text-white outline-none"
                />
                <input
                  type="text"
                  value={profileCity}
                  onChange={(e) => setProfileCity(e.target.value)}
                  placeholder="City"
                  className="w-full rounded-2xl border border-white/10 bg-neutral-900 px-4 py-3 text-sm text-white outline-none"
                />
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setShowSettingsModal(false)}
                className="flex-1 rounded-2xl bg-neutral-800 px-4 py-3 text-xs font-bold uppercase text-neutral-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveStudioProfile}
                disabled={savingProfile}
                className="flex-1 rounded-2xl bg-violet-600 px-4 py-3 text-xs font-black uppercase text-white disabled:opacity-60"
              >
                {savingProfile ? "Saving..." : "Save Settings"}
              </button>
              <button
                type="button"
                onClick={async () => {
                  await supabase.auth.signOut();
                  window.location.href = "/login";
                }}
                className="rounded-2xl border border-red-500/40 px-4 py-3 text-xs font-bold uppercase text-red-400"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {showCategoryModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-black/90 backdrop-blur-2xl" onClick={() => setShowCategoryModal(false)} />
          <div className="relative w-full max-w-lg bg-neutral-950 border border-white/10 rounded-[40px] p-8 shadow-2xl text-white">
            <h2 className="text-2xl font-black uppercase italic tracking-tighter mb-8">Stream Settings</h2>
            
            <div className="space-y-6">
              <div>
                <label className="text-[10px] font-black uppercase text-neutral-500 tracking-[0.2em] block mb-4">Category</label>
                <div className="grid grid-cols-2 gap-3">
                  {["Solo", "Couple", "BDSM", "VR Cams", "Others"].map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(cat.toLowerCase())}
                      className={`p-4 rounded-2xl text-xs font-bold uppercase transition-all border ${
                        selectedCategory === cat.toLowerCase() 
                        ? 'bg-red-600 border-red-600 text-white' 
                        : 'bg-neutral-900 border-white/5 text-neutral-400 hover:border-white/20'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-neutral-500 tracking-[0.2em] block mb-3">Stream title</label>
                <input
                  type="text"
                  placeholder="What are you streaming?"
                  value={streamTitle}
                  onChange={(e) => setStreamTitle(e.target.value)}
                  className="w-full bg-neutral-900 border border-white/10 rounded-2xl p-4 text-xs font-bold uppercase text-white outline-none focus:border-red-600"
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-neutral-500 tracking-[0.2em] block mb-3">Description</label>
                <textarea
                  placeholder="Tell viewers what to expect..."
                  value={streamDescription}
                  onChange={(e) => setStreamDescription(e.target.value)}
                  className="w-full min-h-24 bg-neutral-900 border border-white/10 rounded-2xl p-4 text-xs font-bold text-white outline-none focus:border-red-600"
                />
              </div>

              {selectedCategory === "others" && (
                <input 
                  type="text"
                  placeholder="Custom category name..."
                  value={customCategory}
                  onChange={(e) => setCustomCategory(e.target.value)}
                  className="w-full bg-neutral-900 border border-white/10 rounded-2xl p-4 text-xs font-bold uppercase text-white outline-none focus:border-red-600"
                />
              )}

              <div className="flex items-center justify-between p-5 rounded-2xl bg-neutral-900/50 border border-white/5">
                <div>
                  <div className="text-xs font-bold text-white uppercase italic tracking-tight">Enable PK Battle Mode</div>
                  <div className="text-[10px] text-neutral-500 uppercase">Allow dual-stream matches</div>
                </div>
                <button 
                  onClick={() => setIsPKMode(!isPKMode)}
                  className={`w-12 h-6 rounded-full transition-colors relative ${isPKMode ? 'bg-red-600' : 'bg-neutral-800'}`}
                >
                  <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${isPKMode ? 'left-7' : 'left-1'}`} />
                </button>
              </div>

              <div className="flex gap-4 pt-4">
                <button 
                  onClick={() => setShowCategoryModal(false)}
                  className="flex-1 p-4 rounded-2xl bg-neutral-800 text-xs font-bold uppercase text-neutral-400 hover:bg-neutral-700 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={startBroadcast}
                  className="flex-1 p-4 rounded-2xl bg-red-600 text-xs font-black italic uppercase text-white shadow-lg shadow-red-600/40"
                >
                  Start Stream
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}