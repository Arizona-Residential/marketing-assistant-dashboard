import { NextResponse } from "next/server";
import { createAppSession, getAppUser } from "@/lib/db";
import {
  SESSION_COOKIE,
  createSessionToken,
  getSessionExpiry,
  hashPassword,
  normalizeUsername,
} from "@/lib/auth";

export async function POST(req: Request) {
  const payload = await req.json().catch(() => null);
  if (!payload || typeof payload !== "object") {
    return NextResponse.json(
      { status: "error", message: "Invalid payload." },
      { status: 400 }
    );
  }

  const username = normalizeUsername((payload as Record<string, unknown>).username as string);
  const password = String((payload as Record<string, unknown>).password || "");
  if (!username || !password) {
    return NextResponse.json(
      { status: "error", message: "Username and password are required." },
      { status: 400 }
    );
  }

  const user = getAppUser(username);
  if (!user || user.password_hash !== hashPassword(password)) {
    return NextResponse.json(
      { status: "error", message: "Invalid credentials." },
      { status: 401 }
    );
  }

  const token = createSessionToken();
  const expiresAt = getSessionExpiry();
  createAppSession(token, username, expiresAt);

  const res = NextResponse.json({
    status: "ok",
    user: { username: user.username, displayName: user.display_name, role: user.role },
  });
  const secure = new URL(req.url).protocol === "https:";
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: 14 * 24 * 60 * 60,
  });
  return res;
}

