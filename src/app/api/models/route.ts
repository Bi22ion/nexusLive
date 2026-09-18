import { NextRequest, NextResponse } from "next/server";
import { fetchStripcashModels, getStripcashRequestOptions } from "@/lib/stripcashUtils";


export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const models = await fetchStripcashModels(getStripcashRequestOptions(searchParams));

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
