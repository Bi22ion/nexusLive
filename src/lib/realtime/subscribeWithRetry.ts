 "use client";

import type { RealtimeChannel } from "@supabase/supabase-js";

/**
 * Manages the subscription lifecycle and retry logic for a Supabase Realtime channel.
 * Pass in a channel that already has its .on() listeners attached.
 */
export function subscribeWithRetry(
  channel: RealtimeChannel,
  maxRetries = 5
) {
  let retryCount = 0;
  let stopped = false;
  let timeout: ReturnType<typeof setTimeout> | null = null;

  const attemptSubscribe = () => {
    if (stopped) return;

    // We subscribe to the channel. Since listeners were added in Sidebar.tsx
    // before calling this, the "postgres_changes callbacks" error is avoided.
    channel.subscribe((status) => {
      if (stopped) return;

      if (status === "SUBSCRIBED") {
        console.log(`✅ Realtime Subscribed: ${channel.topic}`);
        retryCount = 0; // Reset retries on success
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
        if (retryCount < maxRetries) {
          retryCount++;
          // Exponential backoff: 1s, 2s, 4s, 8s... up to 10s
          const delay = Math.min(10000, Math.pow(2, retryCount) * 1000);
          
          console.warn(
            `⚠️ Realtime status: ${status} (${channel.topic}). Retrying in ${delay}ms...`
          );
          
          timeout = setTimeout(attemptSubscribe, delay);
        } else {
          console.error("❌ Max realtime retries reached.");
        }
      }
    });
  };

  // Start the first attempt
  attemptSubscribe();

  // Return a cleanup function
  return () => {
    stopped = true;
    if (timeout) clearTimeout(timeout);
    channel.unsubscribe();
  };
}