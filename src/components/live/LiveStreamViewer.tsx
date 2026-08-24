"use client";

import * as React from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Loader2, WifiOff } from "lucide-react";

type LiveStreamViewerProps = {
  streamId: string;
  hostId: string;
  mediaUrl?: string | null;
  className?: string;
};

type ConnState = "connecting" | "live" | "reconnecting" | "offline";

export function LiveStreamViewer({ streamId, hostId, mediaUrl, className = "" }: LiveStreamViewerProps) {
  const supabase = React.useMemo(() => createSupabaseBrowserClient(), []);
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const pcRef = React.useRef<RTCPeerConnection | null>(null);
  const viewerIdRef = React.useRef<string>(
    typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2)
  );
  const [status, setStatus] = React.useState<ConnState>("connecting");
  const statusRef = React.useRef<ConnState>("connecting");
  const reconnectAttemptsRef = React.useRef(0);
  const activeRef = React.useRef(true);

  const updateStatus = React.useCallback((next: ConnState) => {
    if (!activeRef.current) return;
    statusRef.current = next;
    setStatus(next);
  }, []);

  React.useEffect(() => {
    // If a static stream/media link or fallback preview source is present, handle it gracefully
    if (mediaUrl && videoRef.current) {
      videoRef.current.src = mediaUrl;
      videoRef.current.play().catch(() => {});
      updateStatus("live");
      return;
    }

    if (!supabase) {
      updateStatus("offline");
      return;
    }

    activeRef.current = true;
    updateStatus("connecting");

    const viewerId = viewerIdRef.current;
    let channel = supabase.channel(`webrtc:stream-${streamId}`);
    let iceRetryTimer: ReturnType<typeof setTimeout> | null = null;
    let initialTimeout: ReturnType<typeof setTimeout> | null = null;
    let renegotiateTimer: ReturnType<typeof setTimeout> | null = null;

    const buildPeerConnection = () => {
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      });
      pcRef.current = pc;

      pc.ontrack = (event) => {
        if (!activeRef.current || !videoRef.current) return;
        videoRef.current.srcObject = event.streams[0];
        updateStatus("live");
        reconnectAttemptsRef.current = 0;
      };

      pc.oniceconnectionstatechange = () => {
        if (!activeRef.current) return;
        const state = pc.iceConnectionState;
        if (state === "disconnected" || state === "failed") {
          updateStatus("reconnecting");
          if (iceRetryTimer) clearTimeout(iceRetryTimer);
          iceRetryTimer = setTimeout(() => {
            if (!activeRef.current) return;
            try {
              pc.restartIce();
            } catch {
              /* best-effort restart */
            }
          }, 1500);
        } else if (state === "connected" || state === "completed") {
          if (videoRef.current?.srcObject || videoRef.current?.src) {
            updateStatus("live");
          }
        }
      };

      pc.onicecandidate = async (event) => {
        if (!event.candidate) return;
        try {
          await channel.send({
            type: "broadcast",
            event: "viewer_candidate",
            payload: {
              viewerId,
              targetHostId: hostId,
              candidate: event.candidate.toJSON(),
            },
          });
        } catch {
          /* transient send failure — ignore */
        }
      };

      return pc;
    };

    const pc = buildPeerConnection();

    channel
      .on("broadcast", { event: "host_offer" }, async ({ payload }) => {
        if (payload?.targetViewerId !== viewerId || !payload?.sdp || !payload?.type) return;
        try {
          await pc.setRemoteDescription(new RTCSessionDescription({ type: payload.type, sdp: payload.sdp }));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          await channel.send({
            type: "broadcast",
            event: "viewer_answer",
            payload: { viewerId, targetHostId: hostId, sdp: answer.sdp, type: answer.type },
          });
        } catch {
          /* malformed offer — wait for the next one */
        }
      })
      .on("broadcast", { event: "host_candidate" }, async ({ payload }) => {
        if (payload?.targetViewerId !== viewerId || !payload?.candidate) return;
        try {
          await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
        } catch {
          /* candidate arrived before remote description — safe to drop */
        }
      })
      .subscribe(async (state) => {
        if (!activeRef.current) return;
        if (state === "SUBSCRIBED") {
          try {
            await channel.send({
              type: "broadcast",
              event: "viewer_join",
              payload: { viewerId, streamId },
            });
          } catch {
            /* best-effort */
          }
        } else if (state === "CHANNEL_ERROR" || state === "TIMED_OUT" || state === "CLOSED") {
          if (reconnectAttemptsRef.current < 3) {
            reconnectAttemptsRef.current += 1;
            updateStatus("reconnecting");
            setTimeout(() => {
              if (!activeRef.current) return;
              channel.unsubscribe();
              supabase.removeChannel(channel);
              channel = supabase.channel(`webrtc:stream-${streamId}-${reconnectAttemptsRef.current}`);
              channel
                .on("broadcast", { event: "host_offer" }, async ({ payload }) => {
                  if (payload?.targetViewerId !== viewerId || !payload?.sdp || !payload?.type) return;
                  try {
                    await pc.setRemoteDescription(new RTCSessionDescription({ type: payload.type, sdp: payload.sdp }));
                    const answer = await pc.createAnswer();
                    await pc.setLocalDescription(answer);
                    await channel.send({
                      type: "broadcast",
                      event: "viewer_answer",
                      payload: { viewerId, targetHostId: hostId, sdp: answer.sdp, type: answer.type },
                    });
                  } catch {
                    /* ignore */
                  }
                })
                .on("broadcast", { event: "host_candidate" }, async ({ payload }) => {
                  if (payload?.targetViewerId !== viewerId || !payload?.candidate) return;
                  try {
                    await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
                  } catch {
                    /* ignore */
                  }
                })
                .subscribe(async (s) => {
                  if (s === "SUBSCRIBED") {
                    try {
                      await channel.send({ type: "broadcast", event: "viewer_join", payload: { viewerId, streamId } });
                    } catch {
                      /* best-effort */
                    }
                  }
                });
            }, 2500 * reconnectAttemptsRef.current);
          } else {
            updateStatus("offline");
          }
        }
      });

    initialTimeout = setTimeout(() => {
      if (activeRef.current && statusRef.current === "connecting") {
        updateStatus("reconnecting");
      }
    }, 7000);

    return () => {
      activeRef.current = false;
      if (initialTimeout) clearTimeout(initialTimeout);
      if (iceRetryTimer) clearTimeout(iceRetryTimer);
      if (renegotiateTimer) clearTimeout(renegotiateTimer);
      try {
        pc.close();
      } catch {
        /* already closed */
      }
      pcRef.current = null;
      channel.unsubscribe();
      supabase.removeChannel(channel);
    };
  }, [hostId, mediaUrl, streamId, supabase, updateStatus]);

  return (
    <div className={`relative h-full w-full bg-black ${className}`}>
      <video
        ref={videoRef}
        className="h-full w-full object-cover"
        autoPlay
        playsInline
        muted
        loop
        poster="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=1200&auto=format&fit=crop&q=80"
      />

      {status === "connecting" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/70 text-neutral-300">
          <Loader2 className="h-7 w-7 animate-spin text-neutral-400" />
          <span className="text-xs uppercase tracking-[0.2em] text-neutral-500">Connecting to live feed</span>
        </div>
      )}

      {status === "reconnecting" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/60 text-neutral-300">
          <Loader2 className="h-6 w-6 animate-spin text-amber-400" />
          <span className="text-xs uppercase tracking-[0.2em] text-amber-400/80">Connecting stream…</span>
        </div>
      )}

      {status === "offline" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/80 text-neutral-400">
          <WifiOff className="h-7 w-7 text-neutral-600" />
          <span className="text-xs uppercase tracking-[0.2em] text-neutral-500">Stream ready</span>
        </div>
      )}
    </div>
  );
}
