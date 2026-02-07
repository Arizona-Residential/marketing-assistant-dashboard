import crypto from "node:crypto";
import { getAppSession } from "@/lib/db";

export const SESSION_COOKIE = "arm_session";
const SESSION_DAYS = 14;

export function normalizeUsername(value: string) {
  return String(value || "").trim().toLowerCase();
}

export function hashPassword(password: string) {
  return crypto.createHash("sha256").update(password).digest("hex");
}

export function createSessionToken() {
  return crypto.randomUUID();
}

export function getSessionExpiry() {
  return Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000;
}

export function parseCookieValue(req: Request, key: string) {
  const cookieHeader = req.headers.get("cookie") || "";
  const parts = cookieHeader.split(";").map((x) => x.trim());
  for (const p of parts) {
    if (!p.startsWith(`${key}=`)) continue;
    return decodeURIComponent(p.slice(key.length + 1));
  }
  return null;
}

export function getSessionFromRequest(req: Request) {
  const token = parseCookieValue(req, SESSION_COOKIE);
  if (!token) return null;
  return getAppSession(token);
}

