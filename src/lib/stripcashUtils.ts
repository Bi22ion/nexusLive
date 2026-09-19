import type { StripcashModel } from "@/lib/modelFilters";

const STRIPCASH_API_BASE = process.env.STRIPCASH_API_BASE || "https://go.whitetrafsa.com/api";
const STRIPCASH_USER_ID =
  process.env.STRIPCASH_USER_ID ||
  "724d1086ec244c5a6586e3464ef86a997f4282651cb73c47223c7a31f3d122cb";
const STRIPCASH_API_KEY = process.env.STRIPCASH_API_KEY;
const STRIPCASH_DOMAIN = process.env.STRIPCASH_DOMAIN || "nexuslive-eight.vercel.app";

export interface StripcashRequestOptions {
  limit?: string;
  offset?: string;
  [key: string]: string | undefined;
}

function getStripcashHeaders() {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (STRIPCASH_API_KEY) {
    headers.Authorization = `Bearer ${STRIPCASH_API_KEY}`;
    headers["X-Api-Key"] = STRIPCASH_API_KEY;
  }
  if (STRIPCASH_DOMAIN) {
    headers.Origin = `https://${STRIPCASH_DOMAIN}`;
    headers.Referer = `https://${STRIPCASH_DOMAIN}/`;
  }
  return headers;
}

/** Fetches the live Stripcash feed server-side so credentials never reach the browser. */
export async function fetchStripcashModels(options: StripcashRequestOptions = {}) {
  const params = new URLSearchParams({ userId: STRIPCASH_USER_ID });
  if (STRIPCASH_DOMAIN) params.set("domain", STRIPCASH_DOMAIN);
  for (const [key, value] of Object.entries(options)) {
    if (value) params.set(key, value);
  }

  const response = await fetch(`${STRIPCASH_API_BASE}/models/online?${params}`, {
    headers: getStripcashHeaders(),
    next: { revalidate: 60 },
  });
  if (!response.ok) throw new Error(`Stripcash API returned ${response.status}`);
  return extractModelsArray(await response.json());
}

/** Fetches available feed attributes for category controls when supported by the API. */
export async function fetchStripcashAttributes() {
  const params = new URLSearchParams({ userId: STRIPCASH_USER_ID });
  const response = await fetch(`${STRIPCASH_API_BASE}/models/attributes?${params}`, {
    headers: getStripcashHeaders(),
    next: { revalidate: 300 },
  });
  if (!response.ok) throw new Error(`Stripcash attributes API returned ${response.status}`);
  return response.json() as Promise<Record<string, unknown>>;
}

export function getStripcashRequestOptions(searchParams: URLSearchParams): StripcashRequestOptions {
  const allowed = ["filter", "value", "category", "limit", "offset", "ageRange", "ethnicity", "bodyType", "tags", "gender", "isVr", "isMobile", "isLovense", "isNew", "isHd", "sortBy"];
  return Object.fromEntries(allowed.map((key) => [key, searchParams.get(key) || undefined]));
}


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
    process.env.STRIPCASH_USER_ID ||
    "724d1086ec244c5a6586e3464ef86a997f4282651cb73c47223c7a31f3d122cb";

  const username = model.username || model.displayName || model.name || "";
  const url = new URL(trackingBase);
  url.searchParams.set("userid", userId);
  if (username) {
    url.searchParams.set("login", username);
  }

  return url.toString();
}
