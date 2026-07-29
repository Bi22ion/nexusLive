"use client";

import * as React from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type LiveStreamViewerProps = {
  streamId: string;
  hostId: string;
  className?: string;
};

export function LiveStreamViewer({ streamId, hostId, className = "" }: LiveStreamViewerProps) {
  const supabase = React.useMemo(() => createSupabaseBrowserClient(), []);
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const pcRef = React.useRef<RTCPeerConnection | null>(null);
  const viewerIdRef = React.useRef<string>(crypto.randomUUID());
  const [status, setStatus] = React.useState<"connecting" | "live" | "failed">("connecting");
  const statusRef = React.useRef<"connecting" | "live" | "failed">("connecting");

  React.useEffect(() => {
    if (!supabase) {
      setStatus("failed");
      return;
    }
    setStatus("connecting");
    statusRef.current = "connecting";

    let active = true;
    const viewerId = viewerIdRef.current;
    const channel = supabase.channel(`webrtc:stream-${streamId}`);
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });
    pcRef.current = pc;

    pc.ontrack = (event) => {
      if (!active || !videoRef.current) return;
      videoRef.current.srcObject = event.streams[0];
      setStatus("live");
      statusRef.current = "live";
    };

    pc.onicecandidate = async (event) => {
      if (!event.candidate) return;
      await channel.send({
        type: "broadcast",
        event: "viewer_candidate",
        payload: {
          viewerId,
          targetHostId: hostId,
          candidate: event.candidate.toJSON(),
        },
      });
    };

    channel
      .on("broadcast", { event: "host_offer" }, async ({ payload }) => {
        if (payload?.targetViewerId !== viewerId || !payload?.sdp || !payload?.type) return;
        await pc.setRemoteDescription(new RTCSessionDescription({ type: payload.type, sdp: payload.sdp }));
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
      })
      .on("broadcast", { event: "host_candidate" }, async ({ payload }) => {
        if (payload?.targetViewerId !== viewerId || !payload?.candidate) return;
        await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
      })
      .subscribe(async (state) => {
        if (state === "SUBSCRIBED") {
          await channel.send({
            type: "broadcast",
            event: "viewer_join",
            payload: { viewerId, streamId },
          });
        }
      });

    const timeout = setTimeout(() => {
      if (active && statusRef.current !== "live") {
        setStatus("failed");
        statusRef.current = "failed";
      }
    }, 12000);

    return () => {
      active = false;
      clearTimeout(timeout);
      pc.close();
      pcRef.current = null;
      channel.unsubscribe();
      supabase.removeChannel(channel);
    };
  }, [hostId, streamId, supabase]);

  return (
    <div className={`relative h-full w-full ${className}`}>
      <video ref={videoRef} className="h-full w-full object-cover" autoPlay playsInline controls muted />
      {status !== "live" ? (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-sm text-neutral-300">
          {status === "connecting" ? "Connecting to live camera..." : "Live feed unavailable right now."}
        </div>
      ) : null}
    </div>
  );
}
