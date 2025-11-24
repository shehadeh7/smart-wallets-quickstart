import { NextRequest, NextResponse } from "next/server";
import { getSessionKey } from "@/lib/persist";


/**
 * Returns the persisted session key info for the given user.
 * NOTE: Private keys are NOT returned (POC only, and should be encrypted & never exposed).
 */
export async function POST(req: NextRequest) {
  try {
    const { userId } = await req.json();

    if (!userId) {
      return NextResponse.json({ error: "Missing userId" }, { status: 400 });
    }

    const sess = getSessionKey(userId);
    if (!sess) {
      return NextResponse.json({ error: "No session key for user" }, { status: 404 });
    }

    // Keep validationEntityId aligned with your install-data route (VALIDATION_ENTITY_ID = 2)
    return NextResponse.json({
      sessionKeyAddress: sess.publicKey,       // EOA derived via viem privateKeyToAddress()
      validationEntityId: 2,                   // must match SingleSignerValidationModule install
      accountAddress: sess.accountAddress,     // optional: useful for client-side checks
      status: sess.status,                     // "pending" | "installed" | "revoked"
      updatedAt: sess.updatedAt,               // optional metadata
    });
  } catch (error: any) {
    console.error("session-key route error:", error);
    return NextResponse.json(
      { error: "Unexpected error", details: error?.message ?? String(error) },
      { status: 500 }
    );
  }
}
