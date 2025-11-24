import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { userId } = await req.json();

  const key = global.sessionKeys.get(userId);
  if (!key) {
    return NextResponse.json({ error: "No session key" }, { status: 404 });
  }

  return NextResponse.json({
    sessionKeyAddress: key.publicKey,
    validationEntityId: 2,
  });
}
