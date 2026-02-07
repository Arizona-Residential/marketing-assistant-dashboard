import { NextResponse } from "next/server";
import { getSessionFromRequest, hashPassword } from "@/lib/auth";
import { updateAppUserPassword } from "@/lib/db";

export async function POST(req: Request) {
  const session = getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json(
      { status: "error", message: "Unauthorized." },
      { status: 401 }
    );
  }

  const payload = await req.json().catch(() => null);
  if (!payload || typeof payload !== "object") {
    return NextResponse.json(
      { status: "error", message: "Invalid payload." },
      { status: 400 }
    );
  }

  const password = String((payload as Record<string, unknown>).password || "");
  if (password.length < 8) {
    return NextResponse.json(
      { status: "error", message: "Password must be at least 8 characters." },
      { status: 400 }
    );
  }

  updateAppUserPassword(session.username, hashPassword(password));
  return NextResponse.json({ status: "ok" });
}

