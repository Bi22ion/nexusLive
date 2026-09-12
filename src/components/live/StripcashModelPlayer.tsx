"use client";

import * as React from "react";
import Hls from "hls.js";
import { Play, ExternalLink, Radio, X, AlertCircle, Loader2 } from "lucide-react";
import type { StripcashModel } from "@/lib/modelFilters";

interface StripcashModelPlayerProps {
  model: StripcashModel;
  affiliateUrl: string;
  onClose: () => void;
}

type PlayerState = "connecting" | "live" | "error" | "external";

function isHlsUrl(url: string): boolean {
  return url.toLowerCase().includes(".m3u8");
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

export function StripcashModelPlayer({
  model,
  affiliateUrl,
  onClose,
}: StripcashModelPlayerProps) {
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const hlsRef = React.useRef<Hls | null>(null);
  const activeRef = React.useRef(true);
  const [state, setState] = React.useState<PlayerState>("connecting");

  const modelUsername = model.username || model.displayName || model.name || "Model";
  const streamUrl = model.hlsUrl || model.streamUrl || "";

  // Determine the kind of URL we have
  const urlKind = React.useMemo(() => {
    if (!streamUrl) return "none" as const;
    if (isFrameBlockedUrl(streamUrl)) return "external" as const;
    if (isDirectVideoUrl(streamUrl)) return "video" as const;
    return "external" as const;
  }, [streamUrl]);

  React.useEffect(() => {
    activeRef.current = true;

    if (urlKind === "external" || urlKind === "none") {
      setState("external");
      return;
    }

    setState("connecting");
    const video = videoRef.current;
    if (!video || !streamUrl) {
      setState("external");
      return;
    }

    // Cleanup any previous HLS instance
    if (hlsRef.current) {
      try { hlsRef.current.destroy(); } catch { /* noop */ }
      hlsRef.current = null;
    }

    if (isHlsUrl(streamUrl)) {
      if (Hls.isSupported()) {
        const hls = new Hls({ enableWorker: true, lowLatencyMode: true });
        hlsRef.current = hls;
        hls.loadSource(streamUrl);
        hls.attachMedia(video);

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          if (!activeRef.current) return;
          video.play().then(() => setState("live")).catch(() => setState("live"));
        });

        hls.on(Hls.Events.ERROR, (_event, data) => {
          if (!activeRef.current || !data.fatal) return;
          setState("error");
        });
      } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
        video.src = streamUrl;
        video.play().then(() => setState("live")).catch(() => setState("live"));
      } else {
        setState("error");
      }
    } else {
      video.src = streamUrl;
      video.play().then(() => setState("live")).catch(() => setState("live"));
    }

    const onError = () => { if (activeRef.current) setState("error"); };
    video.addEventListener("error", onError);

    return () => {
      activeRef.current = false;
      video.removeEventListener("error", onError);
      if (hlsRef.current) {
        try { hlsRef.current.destroy(); } catch { /* noop */ }
        hlsRef.current = null;
      }
    };
  }, [streamUrl, urlKind]);

  const showVideo = urlKind === "video" && (state === "connecting" || state === "live");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 backdrop-blur-md">
      <div className="relative w-full max-w-4xl bg-neutral-900 border border-purple-500/30 rounded-2xl overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-neutral-950 border-b border-white/10">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-red-600 animate-pulse" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              {modelUsername} — Live Stream
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Player area */}
        <div className="relative aspect-video w-full bg-black">
          {/* HLS / direct video element */}
          {showVideo && (
            <video
              ref={videoRef}
              className="h-full w-full object-cover"
              autoPlay
              playsInline
              muted
              poster={model.previewUrl || model.avatar || model.imageUrl || model.thumbnailUrl}
            />
          )}

          {/* Connecting state */}
          {state === "connecting" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/70 text-neutral-300">
              <Loader2 className="h-7 w-7 animate-spin text-purple-400" />
              <span className="text-xs uppercase tracking-[0.2em] text-neutral-500">
                Connecting to live feed
              </span>
            </div>
          )}

          {/* Error state — stream URL failed */}
          {state === "error" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/80 p-6 text-center">
              <AlertCircle className="h-8 w-8 text-amber-500/70" />
              <div>
                <div className="text-sm font-semibold text-neutral-300">
                  Stream temporarily unavailable
                </div>
                <div className="mt-1 text-xs text-neutral-500 max-w-xs">
                  The live feed couldn&apos;t be loaded. You can still visit the room directly.
                </div>
              </div>
              <a
                href={affiliateUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl bg-purple-600 hover:bg-purple-500 px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-white transition"
              >
                <ExternalLink className="h-4 w-4" />
                Open Live Room
              </a>
            </div>
          )}

          {/* External / launch overlay — no iframe, safe affiliate link */}
          {state === "external" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-gradient-to-b from-neutral-900 via-neutral-950 to-black">
              <div className="flex flex-col items-center gap-4 max-w-sm">
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
                    {modelUsername}
                  </h4>
                  <p className="text-xs text-neutral-400 mt-1">
                    Click below to open the official high-definition live broadcast room.
                  </p>
                </div>

                <a
                  href={affiliateUrl}
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
        </div>

        {/* Footer */}
        <div className="p-4 bg-neutral-950 flex items-center justify-between text-xs text-neutral-400 border-t border-white/10">
          <span>Broadcasting live from network via secure on-site integration</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-white font-semibold transition"
          >
            Close Player
          </button>
        </div>
      </div>
    </div>
  );
}
