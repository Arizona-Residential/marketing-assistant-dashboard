import { NextResponse } from "next/server";
import { deleteAppSession } from "@/lib/db";
import { SESSION_COOKIE, parseCookieValue } from "@/lib/auth";

export async function POST(req: Request) {
  const token = parseCookieValue(req, SESSION_COOKIE);
  if (token) deleteAppSession(token);
  const res = NextResponse.json({ status: "ok" });
  res.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: new URL(req.url).protocol === "https:",
    path: "/",
    maxAge: 0,
  });
  return res;
}

