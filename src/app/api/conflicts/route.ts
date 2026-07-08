import { NextResponse } from "next/server";
import { getConflictCountries } from "@/lib/conflicts";

export const revalidate = 3600;

export async function GET() {
  const conflicts = await getConflictCountries();

  return NextResponse.json(conflicts, {
    headers: {
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
