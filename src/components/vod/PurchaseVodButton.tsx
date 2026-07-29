"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

export function PurchaseVodButton({ vodId, priceTokens }: { vodId: string; priceTokens: number }) {
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const onPurchase = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/vod/purchase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vodId }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || "Purchase failed");
      }

      router.refresh();
    } catch (err: any) {
      setError(err?.message || "Purchase failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={onPurchase}
        disabled={loading}
        className="rounded-full bg-gradient-to-r from-violet-600 to-cyan-500 px-5 py-2 text-sm font-bold text-white disabled:opacity-60"
      >
        {loading ? "Processing..." : `Unlock replay for ${priceTokens} tokens`}
      </button>
      {error ? <div className="text-xs text-red-400">{error}</div> : null}
    </div>
  );
}

