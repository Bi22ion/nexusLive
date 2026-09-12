"use client";

import * as React from "react";
import Hls from "hls.js";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Loader2, WifiOff, Play, ExternalLink, Radio, AlertCircle } from "lucide-react";

type LiveStreamViewerProps = {
  streamId: string;
  hostId: string;
  mediaUrl?: string | null;
  className?: string;
  modelUsername?: string;
};

type ConnState = "connecting" | "live" | "reconnecting" | "offline" | "external" | "error";

function isHlsUrl(url: string): boolean {
  return url.toLowerCase().endsWith(".m3u8");
}

function isDirectVideoUrl(url: string): boolean {
  const lower = url.toLowerCase();
  return (
    lower.endsWith(".mp4") ||
    lower.endsWith(".webm") ||
    lower.endsWith(".ogg") ||
    lower.endsWith(".mov") ||
    isHlsUrl(lower)
  );
}

function isFrameBlockedUrl(url: string): boolean {
  const lower = url.toLowerCase();
  return (
    lower.includes("stripchat") ||
    lower.includes("whitetrafsa") ||
    lower.includes("crakrevenue") ||
    lower.includes("frtayb") ||
    lower.includes("go.") ||
    (lower.startsWith("http") && !isDirectVideoUrl(lower))
  );
}

export function LiveStreamViewer({
  streamId,
  hostId,
  mediaUrl,
  className = "",
  modelUsername,
}: LiveStreamViewerProps) {
  const supabase = React.useMemo(() => createSupabaseBrowserClient(), []);
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const hlsRef = React.useRef<Hls | null>(null);
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

  const streamKind = React.useMemo(() => {
    if (!mediaUrl) return "webrtc" as const;
    if (isFrameBlockedUrl(mediaUrl)) return "external" as const;
    if (isHlsUrl(mediaUrl)) return "hls" as const;
    if (isDirectVideoUrl(mediaUrl)) return "direct" as const;
    return "external" as const;
  }, [mediaUrl]);

  const updateStatus = React.useCallback((next: ConnState) => {
    if (!activeRef.current) return;
    statusRef.current = next;
    setStatus(next);
  }, []);

  const cleanupHls = React.useCallback(() => {
    if (hlsRef.current) {
      try {
        hlsRef.current.destroy();
      } catch {
        /* best effort */
      }
      hlsRef.current = null;
    }
  }, []);

  const handleVideoError = React.useCallback(() => {
    if (!activeRef.current) return;
    cleanupHls();
    updateStatus("error");
  }, [activeRef, cleanupHls, updateStatus]);

  // Attach HLS.js or native src to the video element for playable URLs
  const attachVideoSource = React.useCallback(
    (url: string) => {
      const video = videoRef.current;
      if (!video) return;

      cleanupHls();

      if (isHlsUrl(url)) {
        if (Hls.isSupported()) {
          const hls = new Hls({ enableWorker: true, lowLatencyMode: true });
          hlsRef.current = hls;
          hls.loadSource(url);
          hls.attachMedia(video);

          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            video.play().then(() => updateStatus("live")).catch(() => updateStatus("live"));
          });

          hls.on(Hls.Events.ERROR, (_event, data) => {
            if (!activeRef.current) return;
            if (data.fatal) {
              switch (data.type) {
                case Hls.ErrorTypes.NETWORK_ERROR:
                  if (reconnectAttemptsRef.current < 2) {
                    reconnectAttemptsRef.current += 1;
                    updateStatus("reconnecting");
                    try {
                      hls.startLoad();
                    } catch {
                      handleVideoError();
                    }
                  } else {
                    handleVideoError();
                  }
                  break;
                case Hls.ErrorTypes.MEDIA_ERROR:
                  try {
                    hls.recoverMediaError();
                  } catch {
                    handleVideoError();
                  }
                  break;
                default:
                  handleVideoError();
                  break;
              }
            }
          });
        } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
          video.src = url;
          video.play().then(() => updateStatus("live")).catch(() => updateStatus("live"));
        } else {
          handleVideoError();
        }
      } else {
        video.src = url;
        video.play().then(() => updateStatus("live")).catch(() => updateStatus("live"));
      }
    },
    [cleanupHls, handleVideoError, updateStatus]
  );

  React.useEffect(() => {
    activeRef.current = true;
    reconnectAttemptsRef.current = 0;

    // External / frame-blocked URLs: show launch overlay, never use iframe
    if (streamKind === "external") {
      updateStatus("external");
      return;
    }

    // HLS or direct video: attach to <video> with error handling
    if (streamKind === "hls" || streamKind === "direct") {
      updateStatus("connecting");
      if (mediaUrl) {
        // Defer to next tick so the <video> element is mounted
        requestAnimationFrame(() => attachVideoSource(mediaUrl));
      }
      return;
    }

    // WebRTC path: no mediaUrl, connect via Supabase realtime
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
      cleanupHls();
      try {
        pc.close();
      } catch {
        /* best effort */
      }
      pcRef.current = null;
      channel.unsubscribe();
      supabase.removeChannel(channel);
    };
  }, [
    attachVideoSource,
    cleanupHls,
    handleVideoError,
    hostId,
    mediaUrl,
    streamId,
    streamKind,
    supabase,
    updateStatus,
  ]);

  const displayName = modelUsername || streamId || "Broadcaster";
  const showVideoElement = streamKind === "hls" || streamKind === "direct" || streamKind === "webrtc";

  return (
    <div className={`relative h-full w-full bg-neutral-950 overflow-hidden ${className}`}>
      {/* Native / HLS.js Video Stream Player */}
      {showVideoElement && (
        <video
          ref={videoRef}
          className="h-full w-full object-cover"
          autoPlay
          playsInline
          muted
          loop
          onError={handleVideoError}
          poster="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=1200&auto=format&fit=crop&q=80"
        />
      )}

      {/* External Broadcast Launcher Overlay (X-Frame-Options / 404 safe) */}
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

      {/* External overlay for WebRTC path with no media URL and no host offer */}
      {status === "external" && !mediaUrl && (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-gradient-to-b from-neutral-900 via-neutral-950 to-black">
          <div className="flex flex-col items-center gap-4 max-w-sm">
            <div className="h-16 w-16 rounded-full bg-red-600/20 border border-red-500/40 flex items-center justify-center text-red-400 shadow-xl">
              <Radio className="h-8 w-8 animate-pulse" />
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-red-500/10 border border-red-500/20 text-[10px] font-bold text-red-400 uppercase tracking-wider mb-2">
                <Radio className="h-3 w-3 animate-pulse" /> Live
              </div>
              <h4 className="text-base font-bold text-white capitalize">
                {displayName}
              </h4>
              <p className="text-xs text-neutral-400 mt-1">
                This broadcast is hosted on an external platform.
              </p>
            </div>
            <a
              href={`https://stripchat.com/${displayName}?tourId=${process.env.NEXT_PUBLIC_STRIPCASH_USER_ID || ""}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 w-full rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs uppercase tracking-widest shadow-lg shadow-red-600/30 transition transform hover:scale-105 active:scale-95"
            >
              <span>Open Live Room</span>
              <ExternalLink className="h-4 w-4" />
            </a>
          </div>
        </div>
      )}

      {/* Connecting State */}
      {status === "connecting" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/70 text-neutral-300">
          <Loader2 className="h-7 w-7 animate-spin text-neutral-400" />
          <span className="text-xs uppercase tracking-[0.2em] text-neutral-500">
            Connecting to live feed
          </span>
        </div>
      )}

      {/* Reconnecting State */}
      {status === "reconnecting" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/60 text-neutral-300">
          <Loader2 className="h-6 w-6 animate-spin text-amber-400" />
          <span className="text-xs uppercase tracking-[0.2em] text-amber-400/80">
            Connecting stream…
          </span>
        </div>
      )}

      {/* Error State — stream URL failed to load (404, format issue, etc.) */}
      {status === "error" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/80 text-neutral-400 p-6 text-center">
          <AlertCircle className="h-7 w-7 text-amber-500/70" />
          <div>
            <div className="text-sm font-semibold text-neutral-300">
              Stream unavailable
            </div>
            <div className="mt-1 text-xs text-neutral-500 max-w-xs">
              The live feed could not be loaded. The broadcaster may have gone offline or the stream URL is no longer valid.
            </div>
          </div>
          {mediaUrl && (
            <a
              href={mediaUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-flex items-center gap-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 px-4 py-2 text-xs font-bold uppercase tracking-wider text-neutral-200 transition"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Try external link
            </a>
          )}
        </div>
      )}

      {/* Offline State */}
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
