import { NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";

export async function GET(req: Request) {
  const session = getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ status: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json({
    status: "ok",
    user: {
      username: session.username,
      displayName: session.display_name,
      role: session.role,
      expiresAt: session.expires_at,
    },
  });
}

