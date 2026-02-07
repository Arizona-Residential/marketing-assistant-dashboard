import { NextResponse } from "next/server";
import { countAppUsers, createAppSession, createAppUser, getAppUser } from "@/lib/db";
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
  const displayNameRaw = String((payload as Record<string, unknown>).displayName || "");
  const displayName = displayNameRaw.trim() || username;

  if (!/^[a-z0-9._-]{3,24}$/.test(username)) {
    return NextResponse.json(
      {
        status: "error",
        message: "Username must be 3-24 chars and use letters, numbers, dot, underscore, or dash.",
      },
      { status: 400 }
    );
  }
  if (password.length < 8) {
    return NextResponse.json(
      { status: "error", message: "Password must be at least 8 characters." },
      { status: 400 }
    );
  }
  if (displayName.length > 60) {
    return NextResponse.json(
      { status: "error", message: "Display name is too long." },
      { status: 400 }
    );
  }

  const existing = getAppUser(username);
  if (existing) {
    return NextResponse.json(
      { status: "error", message: "Username already exists." },
      { status: 409 }
    );
  }

  const role = countAppUsers() === 0 ? "owner" : "member";
  createAppUser(username, displayName, hashPassword(password), role);

  const token = createSessionToken();
  const expiresAt = getSessionExpiry();
  createAppSession(token, username, expiresAt);

  const res = NextResponse.json({
    status: "ok",
    user: { username, displayName, role },
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

