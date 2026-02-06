import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { buildAuthUrl } from "@/lib/tiktok";

export async function GET() {
  const state = randomUUID();
  let authUrl: string;

  try {
    authUrl = buildAuthUrl(state);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "TikTok OAuth not configured.";
    return NextResponse.redirect(
      `/dashboard.html?tiktok=missing-config&message=${encodeURIComponent(
        message
      )}`
    );
  }

  const res = NextResponse.redirect(authUrl);
  res.cookies.set("tiktok_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    maxAge: 60 * 10,
  });
  return res;
}
