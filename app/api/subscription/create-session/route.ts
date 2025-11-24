import { NextRequest, NextResponse } from "next/server";
import { generatePrivateKey, privateKeyToAddress } from "viem/accounts";
import { upsertSessionKey, getSessionKey } from "@/lib/persist";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const { userId, accountAddress } = await req.json();

  if (!userId || !accountAddress) {
    return NextResponse.json({ error: "Missing userId/accountAddress" }, { status: 400 });
  }

  // If a pending/installed key exists, reuse it (avoid generating duplicates)
  const existing = getSessionKey(userId);
  if (existing) {
    return NextResponse.json({ sessionKeyAddress: existing.publicKey });
  }

  // Generate a fresh session key + derive public address via viem
  const privateKey = generatePrivateKey();
  const sessionKeyAddress = privateKeyToAddress(privateKey);

  // POC: persist raw private key (unencrypted). TODO: Add encryption
  upsertSessionKey({
    userId,
    accountAddress,
    status: "pending",
    publicKey: sessionKeyAddress,
    privateKey,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  return NextResponse.json({ sessionKeyAddress });
}
