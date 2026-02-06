import { NextResponse } from "next/server";
import { clearTikTokToken } from "@/lib/db";

export async function POST() {
  clearTikTokToken();
  return NextResponse.json({ status: "disconnected" });
}
