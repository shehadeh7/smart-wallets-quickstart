import { NextRequest, NextResponse } from "next/server";
import { setSubscriptionStatus } from "@/lib/persist";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const { userId, paused } = await req.json();
  if (!userId || typeof paused !== "boolean") {
    return NextResponse.json({ error: "Missing userId/paused" }, { status: 400 });
  }

  setSubscriptionStatus(userId, paused ? "paused" : "active");
  return NextResponse.json({ ok: true });
}
