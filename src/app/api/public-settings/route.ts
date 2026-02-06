import { NextResponse } from "next/server";
import { getUserSettings, saveUserSettings } from "@/lib/db";

const PUBLIC_OPEN_ID = "public";

export async function GET() {
  const row = getUserSettings(PUBLIC_OPEN_ID);
  if (!row) {
    return NextResponse.json({ status: "empty" }, { status: 200 });
  }
  try {
    const data = JSON.parse(row.data);
    return NextResponse.json(
      { status: "ok", data, updated_at: row.updated_at },
      { status: 200 }
    );
  } catch {
    return NextResponse.json(
      { status: "error", message: "Invalid settings data." },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const payload = await req.json();
    saveUserSettings(PUBLIC_OPEN_ID, JSON.stringify(payload));
    return NextResponse.json({ status: "ok" }, { status: 200 });
  } catch (err) {
    return NextResponse.json(
      { status: "error", message: "Failed to save public settings." },
      { status: 400 }
    );
  }
}
