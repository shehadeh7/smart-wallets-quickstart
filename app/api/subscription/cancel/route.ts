import { NextRequest, NextResponse } from "next/server";
import { cancelSubscription, deleteSessionKey, setSessionKeyStatus } from "@/lib/persist";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const { userId, txHash } = await req.json();
  if (!userId) {
    return NextResponse.json({ error: "Missing userId" }, { status: 400 });
  }

  cancelSubscription(userId);
  setSessionKeyStatus(userId, "revoked");
  // Optional: deleteSessionKey(userId) if you prefer full removal
  deleteSessionKey(userId);

  return NextResponse.json({ ok: true, txHash });
}

