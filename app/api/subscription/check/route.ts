import { NextRequest, NextResponse } from "next/server";
import { getSubscription } from "@/lib/persist";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const { userId } = await req.json();

  if (!userId) {
    return NextResponse.json({ error: "Missing userId" }, { status: 400 });
  }

  const sub = getSubscription(userId);
  return NextResponse.json({
    hasSubscription: !!sub,
    isActive: sub?.status === "active",
    isPaused: sub?.status === "paused",
    sessionKey: sub?.sessionKey,
  });
}
