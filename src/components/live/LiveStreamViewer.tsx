"use client";

import * as React from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Loader2, WifiOff, Play, ExternalLink, Radio } from "lucide-react";

type LiveStreamViewerProps = {
  streamId: string;
  hostId: string;
  mediaUrl?: string | null;
  className?: string;
  modelUsername?: string;
};

type ConnState = "connecting" | "live" | "reconnecting" | "offline" | "external";

export function LiveStreamViewer({
  streamId,
  hostId,
  mediaUrl,
  className = "",
  modelUsername,
}: LiveStreamViewerProps) {
  const supabase = React.useMemo(() => createSupabaseBrowserClient(), []);
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const pcRef = React.useRef<RTCPeerConnection | null>(null);
  const viewerIdRef = React.useRef<string>(
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2)
  );

  const [status, setStatus] = React.useState<ConnState>("connecting");
  const statusRef = React.useRef<ConnState>("connecting");
  const reconnectAttemptsRef = React.useRef(0);
  const activeRef = React.useRef(true);

  // Check if mediaUrl is an external web page or tracking link that cannot be embedded directly
  const isExternalStream = React.useMemo(() => {
    if (!mediaUrl) return false;
    const url = mediaUrl.toLowerCase();
    return (
      url.includes("stripchat") ||
      url.includes("whitetrafsa") ||
      url.includes("crakrevenue") ||
      url.includes("go.") ||
      (!url.endsWith(".mp4") &&
        !url.endsWith(".m3u8") &&
        !url.endsWith(".webm") &&
        (url.startsWith("http://") || url.startsWith("https://")))
    );
  }, [mediaUrl]);

  const updateStatus = React.useCallback((next: ConnState) => {
    if (!activeRef.current) return;
    statusRef.current = next;
    setStatus(next);
  }, []);

  React.useEffect(() => {
    activeRef.current = true;

    // Handle external network links via safe launch overlay
    if (isExternalStream) {
      updateStatus("external");
      return;
    }

    // Handle direct playable video files (.mp4, .m3u8, etc.)
    if (mediaUrl && videoRef.current) {
      videoRef.current.src = mediaUrl;
      videoRef.current
        .play()
        .then(() => updateStatus("live"))
        .catch(() => updateStatus("live"));
      return;
    }

    // Handle custom WebRTC stream connection via Supabase
    if (!supabase) {
      updateStatus("offline");
      return;
    }

    updateStatus("connecting");

    const viewerId = viewerIdRef.current;
    let channel = supabase.channel(`webrtc:stream-${streamId}`);
    let iceRetryTimer: ReturnType<typeof setTimeout> | null = null;
    let initialTimeout: ReturnType<typeof setTimeout> | null = null;

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
              /* best effort */
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
          /* ignore transient send error */
        }
      };

      return pc;
    };

    const pc = buildPeerConnection();

    channel
      .on("broadcast", { event: "host_offer" }, async ({ payload }) => {
        if (
          payload?.targetViewerId !== viewerId ||
          !payload?.sdp ||
          !payload?.type
        )
          return;
        try {
          await pc.setRemoteDescription(
            new RTCSessionDescription({ type: payload.type, sdp: payload.sdp })
          );
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          await channel.send({
            type: "broadcast",
            event: "viewer_answer",
            payload: {
              viewerId,
              targetHostId: hostId,
              sdp: answer.sdp,
              type: answer.type,
            },
          });
        } catch {
          /* ignore malformed offer */
        }
      })
      .on("broadcast", { event: "host_candidate" }, async ({ payload }) => {
        if (payload?.targetViewerId !== viewerId || !payload?.candidate) return;
        try {
          await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
        } catch {
          /* candidate dropped safely */
        }
      })
      .subscribe(async (s) => {
        if (!activeRef.current) return;
        if (s === "SUBSCRIBED") {
          try {
            await channel.send({
              type: "broadcast",
              event: "viewer_join",
              payload: { viewerId, streamId },
            });
          } catch {
            /* best effort */
          }
        } else if (
          s === "CHANNEL_ERROR" ||
          s === "TIMED_OUT" ||
          s === "CLOSED"
        ) {
          if (reconnectAttemptsRef.current < 3) {
            reconnectAttemptsRef.current += 1;
            updateStatus("reconnecting");
            setTimeout(() => {
              if (!activeRef.current) return;
              channel.unsubscribe();
              supabase.removeChannel(channel);
              channel = supabase.channel(
                `webrtc:stream-${streamId}-${reconnectAttemptsRef.current}`
              );
              channel
                .on("broadcast", { event: "host_offer" }, async ({ payload }) => {
                  if (
                    payload?.targetViewerId !== viewerId ||
                    !payload?.sdp ||
                    !payload?.type
                  )
                    return;
                  try {
                    await pc.setRemoteDescription(
                      new RTCSessionDescription({
                        type: payload.type,
                        sdp: payload.sdp,
                      })
                    );
                    const answer = await pc.createAnswer();
                    await pc.setLocalDescription(answer);
                    await channel.send({
                      type: "broadcast",
                      event: "viewer_answer",
                      payload: {
                        viewerId,
                        targetHostId: hostId,
                        sdp: answer.sdp,
                        type: answer.type,
                      },
                    });
                  } catch {
                    /* ignore */
                  }
                })
                .on(
                  "broadcast",
                  { event: "host_candidate" },
                  async ({ payload }) => {
                    if (
                      payload?.targetViewerId !== viewerId ||
                      !payload?.candidate
                    )
                      return;
                    try {
                      await pc.addIceCandidate(
                        new RTCIceCandidate(payload.candidate)
                      );
                    } catch {
                      /* ignore */
                    }
                  }
                )
                .subscribe(async (st) => {
                  if (st === "SUBSCRIBED") {
                    try {
                      await channel.send({
                        type: "broadcast",
                        event: "viewer_join",
                        payload: { viewerId, streamId },
                      });
                    } catch {
                      /* best effort */
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
      try {
        pc.close();
      } catch {
        /* best effort */
      }
      pcRef.current = null;
      channel.unsubscribe();
      supabase.removeChannel(channel);
    };
  }, [hostId, isExternalStream, mediaUrl, streamId, supabase, updateStatus]);

  const displayName = modelUsername || streamId || "Broadcaster";

  return (
    <div className={`relative h-full w-full bg-neutral-950 overflow-hidden ${className}`}>
      {/* Native Video Stream Player */}
      {!isExternalStream && (
        <video
          ref={videoRef}
          className="h-full w-full object-cover"
          autoPlay
          playsInline
          muted
          loop
          poster="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=1200&auto=format&fit=crop&q=80"
        />
      )}

      {/* External Broadcast Launcher Overlay (Fixes X-Frame-Options / 404s) */}
      {status === "external" && mediaUrl && (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-gradient-to-b from-neutral-900 via-neutral-950 to-black">
          <div className="relative z-10 flex flex-col items-center gap-4 max-w-sm">
            <div className="relative">
              <div className="h-16 w-16 rounded-full bg-purple-600/20 border border-purple-500/40 flex items-center justify-center text-purple-400 shadow-xl">
                <Play className="h-8 w-8 fill-current ml-1" />
              </div>
              <span className="absolute top-0 right-0 h-3 w-3 rounded-full bg-red-500 animate-ping" />
              <span className="absolute top-0 right-0 h-3 w-3 rounded-full bg-red-500" />
            </div>

            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-red-500/10 border border-red-500/20 text-[10px] font-bold text-red-400 uppercase tracking-wider mb-2">
                <Radio className="h-3 w-3 animate-pulse" /> Live Now
              </div>
              <h4 className="text-base font-bold text-white capitalize">
                {displayName}
              </h4>
              <p className="text-xs text-neutral-400 mt-1">
                Click below to open the official high-definition live broadcast room.
              </p>
            </div>

            <a
              href={mediaUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 w-full rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs uppercase tracking-widest shadow-lg shadow-purple-600/30 transition transform hover:scale-105 active:scale-95"
            >
              <span>Watch Live Stream</span>
              <ExternalLink className="h-4 w-4" />
            </a>
          </div>
        </div>
      )}

      {/* Connection States */}
      {status === "connecting" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/70 text-neutral-300">
          <Loader2 className="h-7 w-7 animate-spin text-neutral-400" />
          <span className="text-xs uppercase tracking-[0.2em] text-neutral-500">
            Connecting to live feed
          </span>
        </div>
      )}

      {status === "reconnecting" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/60 text-neutral-300">
          <Loader2 className="h-6 w-6 animate-spin text-amber-400" />
          <span className="text-xs uppercase tracking-[0.2em] text-amber-400/80">
            Connecting stream…
          </span>
        </div>
      )}

      {status === "offline" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/80 text-neutral-400">
          <WifiOff className="h-7 w-7 text-neutral-600" />
          <span className="text-xs uppercase tracking-[0.2em] text-neutral-500">
            Stream offline
          </span>
        </div>
      )}
    </div>
  );
}
