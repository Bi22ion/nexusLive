"use client";

import type { RealtimeChannel } from "@supabase/supabase-js";

const MAX_RETRIES = 4;
const BASE_DELAY_MS = 2000;
const MAX_DELAY_MS = 15000;

/**
 * Subscribe to a Supabase Realtime channel with bounded, silent retry.
 *
 * - Listeners (.on()) must already be attached before calling this.
 * - On SUBSCRIBED the retry counter resets.
 * - On CHANNEL_ERROR / TIMED_OUT / CLOSED we back off and retry up to
 *   MAX_RETRIES times, then give up quietly instead of looping forever.
 * - No console warnings are emitted on transient failures, so the UI
 *   stays clean even when the realtime server hiccups.
 *
 * Returns a cleanup function that stops retries and unsubscribes.
 */
export function subscribeWithRetry(channel: RealtimeChannel, maxRetries = MAX_RETRIES) {
  let retryCount = 0;
  let stopped = false;
  let timeout: ReturnType<typeof setTimeout> | null = null;
  let subscribed = false;

  const attemptSubscribe = () => {
    if (stopped || subscribed) return;

    channel.subscribe((status) => {
      if (stopped) return;

      if (status === "SUBSCRIBED") {
        subscribed = true;
        retryCount = 0;
        return;
      }

      if (
        status === "CHANNEL_ERROR" ||
        status === "TIMED_OUT" ||
        status === "CLOSED"
      ) {
        subscribed = false;
        if (retryCount < maxRetries) {
          retryCount += 1;
          const delay = Math.min(MAX_DELAY_MS, BASE_DELAY_MS * Math.pow(2, retryCount - 1));
          timeout = setTimeout(attemptSubscribe, delay);
        }
      }
    });
  };

  attemptSubscribe();

  return () => {
    stopped = true;
    if (timeout) clearTimeout(timeout);
    channel.unsubscribe();
  };
}
