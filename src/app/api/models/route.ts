import { NextRequest, NextResponse } from "next/server";

const STRIPCASH_API_BASE =
  process.env.STRIPCASH_API_BASE || "https://go.whitetrafsa.com/api";
const STRIPCASH_USER_ID = process.env.STRIPCASH_USER_ID;

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

    const res = await fetch(upstreamUrl, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      next: { revalidate: 60 },
    });

    if (!res.ok) {
      throw new Error(`Stripcash API returned ${res.status}`);
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
