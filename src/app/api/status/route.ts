import { NextResponse } from "next/server";
import { getWarStatus } from "@/lib/status";

export const revalidate = 60;

export async function GET() {
  const status = await getWarStatus();

  return NextResponse.json(status, {
    headers: {
      "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
    },
  });
}
