import { NextRequest, NextResponse } from "next/server";
import {
  upsertSubscription,
  setSessionKeyStatus,
  getSessionKey,
} from "@/lib/persist";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const { userId, txHash, sessionKey, accountAddress } = await req.json();
  if (!userId || !sessionKey || !accountAddress) {
    return NextResponse.json({ error: "Missing userId/sessionKey/accountAddress" }, { status: 400 });
  }

  const sess = getSessionKey(userId);
  if (!sess || sess.publicKey.toLowerCase() !== sessionKey.toLowerCase()) {
    return NextResponse.json({ error: "Unknown session key" }, { status: 404 });
  }

  // Persist an ACTIVE subscription now that installation succeeded.
  upsertSubscription({
    userId,
    accountAddress,
    status: "active",
    sessionKey,
    updatedAt: new Date().toISOString(),
  });

  // Mark the session key as installed
  setSessionKeyStatus(userId, "installed");

  return NextResponse.json({ ok: true, txHash });
}
