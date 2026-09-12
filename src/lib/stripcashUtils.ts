import type { StripcashModel } from "@/lib/modelFilters";

/**
 * Safely extracts an array of models from any API response shape.
 * Handles: bare array, {models: [...]}, {result: [...]}, {data: [...]},
 * {response: [...]}, or any object whose property is an array.
 */
export function extractModelsArray(data: unknown): StripcashModel[] {
  if (Array.isArray(data)) return data as StripcashModel[];

  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    const keys = ["models", "result", "data", "results", "items", "response", "list"];
    for (const key of keys) {
      if (Array.isArray(obj[key])) return obj[key] as StripcashModel[];
    }
    // Last resort: search all top-level values for an array
    for (const val of Object.values(obj)) {
      if (Array.isArray(val)) return val as StripcashModel[];
    }
  }

  return [];
}

/**
 * Builds an affiliate tracking URL for a Stripcash model room.
 * Uses the official tracking base with userid param and appends the
 * model username so affiliate tracking works seamlessly.
 */
export function buildAffiliateUrl(model: StripcashModel): string {
  const trackingBase =
    process.env.NEXT_PUBLIC_STRIPCASH_TRACKING_URL ||
    "https://go.whitetrafsa.com";
  const userId =
    process.env.NEXT_PUBLIC_STRIPCASH_USER_ID ||
    "724d1086ec244c5a65863464ef86a3464ef86a3464ef86a3464ef86a3464ef86a";

  const username = model.username || model.displayName || model.name || "";
  const url = new URL(trackingBase);
  url.searchParams.set("userid", userId);
  if (username) {
    url.searchParams.set("login", username);
  }

  return url.toString();
}
