import { NextRequest, NextResponse } from "next/server";

const STRIPCASH_API_BASE =
  process.env.STRIPCASH_API_BASE || "https://go.whitetrafsa.com/api";
const STRIPCASH_USER_ID =
  process.env.STRIPCASH_USER_ID ||
  "724d1086ec244c5a65863464ef86a3464ef86a3464ef86a3464ef86a3464ef86a";
const STRIPCASH_API_KEY = process.env.STRIPCASH_API_KEY;
const STRIPCASH_DOMAIN =
  process.env.STRIPCASH_DOMAIN || "nexuslive-eight.vercel.app";

/** Safely extract an array from any API response shape. */
function extractModelsArray(data: unknown): unknown[] {
  if (Array.isArray(data)) return data;

  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    const keys = ["models", "result", "data", "results", "items", "response", "list"];
    for (const key of keys) {
      if (Array.isArray(obj[key])) return obj[key] as unknown[];
    }
    for (const val of Object.values(obj)) {
      if (Array.isArray(val)) return val as unknown[];
    }
  }

  return [];
}

export async function GET(req: NextRequest) {
  try {
    if (!STRIPCASH_USER_ID) {
      return NextResponse.json(
        { error: "STRIPCASH_USER_ID is missing" },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(req.url);

    const params = new URLSearchParams();
    params.set("userId", STRIPCASH_USER_ID);

    if (STRIPCASH_DOMAIN) {
      params.set("domain", STRIPCASH_DOMAIN);
    }

    const filterKeys = [
      "filter",
      "value",
      "category",
      "limit",
      "offset",
      "ageRange",
      "ethnicity",
      "bodyType",
      "tags",
      "gender",
      "isVr",
      "isMobile",
      "isLovense",
      "isNew",
      "isHd",
      "sortBy",
    ];

    for (const key of filterKeys) {
      const val = searchParams.get(key);
      if (val) params.set(key, val);
    }

    const upstreamUrl = `${STRIPCASH_API_BASE}/models/online?${params.toString()}`;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (STRIPCASH_API_KEY) {
      headers["Authorization"] = `Bearer ${STRIPCASH_API_KEY}`;
      headers["X-Api-Key"] = STRIPCASH_API_KEY;
    }

    if (STRIPCASH_DOMAIN) {
      headers["Origin"] = `https://${STRIPCASH_DOMAIN}`;
      headers["Referer"] = `https://${STRIPCASH_DOMAIN}/`;
    }

    const res = await fetch(upstreamUrl, {
      method: "GET",
      headers,
      next: { revalidate: 60 },
    });

    if (!res.ok) {
      return NextResponse.json(
        { models: [], error: `Stripcash API returned ${res.status}` },
        {
          status: 200,
          headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60" },
        }
      );
    }

    const data = await res.json();
    const models = extractModelsArray(data);

    return NextResponse.json(
      { models },
      {
        headers: {
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
        },
      }
    );
  } catch (error: any) {
    return NextResponse.json(
      { models: [], error: error.message },
      {
        status: 200,
        headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60" },
      }
    );
  }
}
