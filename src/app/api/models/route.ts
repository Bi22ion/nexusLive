import { NextRequest, NextResponse } from "next/server";

const STRIPCASH_API_BASE =
  process.env.STRIPCASH_API_BASE || "https://go.whitetrafsa.com/api";
const STRIPCASH_USER_ID = process.env.STRIPCASH_USER_ID;
const STRIPCASH_API_KEY = process.env.STRIPCASH_API_KEY;
const STRIPCASH_DOMAIN = process.env.STRIPCASH_DOMAIN || "nexuslive-eight.vercel.app";

export async function GET(req: NextRequest) {
  try {
    if (!STRIPCASH_USER_ID) {
      return NextResponse.json(
        { error: "STRIPCASH_USER_ID is missing" },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(req.url);

    // Build upstream query params, forwarding all filters the client sends
    const params = new URLSearchParams();
    params.set("userId", STRIPCASH_USER_ID);

    if (STRIPCASH_DOMAIN) {
      params.set("domain", STRIPCASH_DOMAIN);
    }

    // Pass through any filter params from the client
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

    // Build headers — API key sent server-side to avoid CORS and keep key private
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
      throw new Error(`Stripcash API returned ${res.status}`);
    }

    const data = await res.json();
    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
