import { NextResponse } from "next/server";
import { getAuthorizedToken } from "@/lib/tiktok";
import { getUserSettings, saveUserSettings } from "@/lib/db";

export async function GET() {
  const token = await getAuthorizedToken();
  const openId = token?.open_id;
  if (!openId) {
    return NextResponse.json(
      { status: "not_connected", message: "Connect TikTok to sync settings." },
      { status: 401 }
    );
  }

  const row = getUserSettings(openId);
  return NextResponse.json({
    status: "ok",
    data: row?.data ? JSON.parse(row.data) : null,
    updatedAt: row?.updated_at ?? null,
  });
}

export async function POST(request: Request) {
  const token = await getAuthorizedToken();
  const openId = token?.open_id;
  if (!openId) {
    return NextResponse.json(
      { status: "not_connected", message: "Connect TikTok to sync settings." },
      { status: 401 }
    );
  }

  const payload = await request.json().catch(() => null);
  if (!payload || typeof payload !== "object") {
    return NextResponse.json(
      { status: "error", message: "Invalid payload." },
      { status: 400 }
    );
  }

  saveUserSettings(openId, JSON.stringify(payload));
  return NextResponse.json({ status: "ok" });
}
