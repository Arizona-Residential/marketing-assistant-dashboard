import { NextResponse } from "next/server";
import { exchangeCodeForToken } from "@/lib/tiktok";

export async function GET(request: Request) {
  const baseUrl = new URL(request.url);
  const dashboardUrl = (status: string, message?: string) => {
    const url = new URL("/dashboard.html", baseUrl);
    url.searchParams.set("tiktok", status);
    if (message) url.searchParams.set("message", message);
    return url.toString();
  };
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");
  const errorDesc = searchParams.get("error_description");

  if (error) {
    return NextResponse.redirect(
      dashboardUrl("error", errorDesc || error)
    );
  }

  const cookieState = request.headers
    .get("cookie")
    ?.match(/tiktok_oauth_state=([^;]+)/)?.[1];

  if (!state || !cookieState || state !== cookieState) {
    return NextResponse.redirect(
      dashboardUrl("error", "Invalid OAuth state")
    );
  }

  if (!code) {
    return NextResponse.redirect(
      dashboardUrl("error", "Missing authorization code")
    );
  }

  try {
    await exchangeCodeForToken(code);
  } catch (err) {
    const message = err instanceof Error ? err.message : "OAuth failed.";
    return NextResponse.redirect(
      dashboardUrl("error", message)
    );
  }

  const res = NextResponse.redirect(dashboardUrl("connected"));
  res.cookies.set("tiktok_oauth_state", "", { maxAge: 0 });
  return res;
}
