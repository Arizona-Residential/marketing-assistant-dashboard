import { getTikTokToken, saveTikTokToken, type TikTokTokenRow } from "@/lib/db";

const AUTH_BASE = "https://www.tiktok.com/v2/auth/authorize/";
const TOKEN_ENDPOINT = "https://open.tiktokapis.com/v2/oauth/token/";
const USER_INFO_ENDPOINT = "https://open.tiktokapis.com/v2/user/info/";
const VIDEO_LIST_ENDPOINT = "https://open.tiktokapis.com/v2/video/list/";

export type TikTokUser = {
  open_id?: string;
  union_id?: string;
  avatar_url?: string;
  display_name?: string;
  profile_deep_link?: string;
};

export type TikTokVideo = {
  id?: string;
  title?: string;
  create_time?: number;
  view_count?: number;
  like_count?: number;
  comment_count?: number;
  share_count?: number;
  cover_image_url?: string;
  share_url?: string;
};

function requireEnv() {
  const clientKey = process.env.TIKTOK_CLIENT_KEY;
  const clientSecret = process.env.TIKTOK_CLIENT_SECRET;
  const redirectUri = process.env.TIKTOK_REDIRECT_URI;
  const scope =
    process.env.TIKTOK_SCOPES ?? "user.info.basic,user.info.profile,video.list";

  if (!clientKey || !clientSecret || !redirectUri) {
    throw new Error(
      "TikTok OAuth is not configured. Add TIKTOK_CLIENT_KEY, TIKTOK_CLIENT_SECRET, and TIKTOK_REDIRECT_URI to .env.local."
    );
  }

  return { clientKey, clientSecret, redirectUri, scope };
}

export function buildAuthUrl(state: string) {
  const { clientKey, redirectUri, scope } = requireEnv();
  const url = new URL(AUTH_BASE);
  url.searchParams.set("client_key", clientKey);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", scope);
  url.searchParams.set("state", state);
  return url.toString();
}

function parseTokenResponse(payload: any) {
  if (!payload) {
    throw new Error("Empty TikTok token response.");
  }
  if (payload.error || payload.message) {
    throw new Error(
      payload.error_description || payload.message || "TikTok token error."
    );
  }
  const data = payload.data ?? payload;
  if (!data.access_token || !data.refresh_token || !data.expires_in) {
    throw new Error("TikTok token response missing fields.");
  }
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_in: data.expires_in,
    scope: data.scope,
    open_id: data.open_id,
  };
}

export async function exchangeCodeForToken(code: string) {
  const { clientKey, clientSecret, redirectUri } = requireEnv();
  const body = new URLSearchParams({
    client_key: clientKey,
    client_secret: clientSecret,
    code,
    grant_type: "authorization_code",
    redirect_uri: redirectUri,
  });

  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      payload?.error_description ||
        payload?.message ||
        "TikTok token request failed."
    );
  }

  const token = parseTokenResponse(payload);
  saveTikTokToken({
    access_token: token.access_token,
    refresh_token: token.refresh_token,
    expires_at: Date.now() + token.expires_in * 1000,
    scope: token.scope ?? null,
    open_id: token.open_id ?? null,
  });

  return token;
}

async function refreshTokenIfNeeded(token: TikTokTokenRow) {
  const needsRefresh = Date.now() > token.expires_at - 60_000;
  if (!needsRefresh) return token;

  const { clientKey, clientSecret } = requireEnv();
  const body = new URLSearchParams({
    client_key: clientKey,
    client_secret: clientSecret,
    refresh_token: token.refresh_token,
    grant_type: "refresh_token",
  });

  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      payload?.error_description ||
        payload?.message ||
        "TikTok token refresh failed."
    );
  }
  const refreshed = parseTokenResponse(payload);
  const next: TikTokTokenRow = {
    access_token: refreshed.access_token,
    refresh_token: refreshed.refresh_token ?? token.refresh_token,
    expires_at: Date.now() + refreshed.expires_in * 1000,
    scope: refreshed.scope ?? token.scope,
    open_id: refreshed.open_id ?? token.open_id,
  };
  saveTikTokToken(next);
  return next;
}

export async function getAuthorizedToken() {
  const token = getTikTokToken();
  if (!token) return null;
  return refreshTokenIfNeeded(token);
}

export async function fetchTikTokUser(accessToken: string) {
  const url = new URL(USER_INFO_ENDPOINT);
  url.searchParams.set(
    "fields",
    "open_id,union_id,avatar_url,display_name,profile_deep_link"
  );

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      payload?.error?.message || payload?.message || "TikTok user fetch failed."
    );
  }
  return (payload.data?.user ?? payload.user ?? {}) as TikTokUser;
}

export async function fetchTikTokVideos(accessToken: string) {
  const url = new URL(VIDEO_LIST_ENDPOINT);
  url.searchParams.set(
    "fields",
    "id,title,create_time,view_count,like_count,comment_count,share_count,cover_image_url,share_url"
  );

  const res = await fetch(url.toString(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ cursor: 0, max_count: 20 }),
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      payload?.error?.message ||
        payload?.message ||
        "TikTok video list fetch failed."
    );
  }
  return (payload.data?.videos ?? payload.videos ?? []) as TikTokVideo[];
}

export function getBestTimes(videos: TikTokVideo[]) {
  const buckets = new Map<number, { views: number; engagements: number; count: number }>();
  videos.forEach((v) => {
    const views = Number.isFinite(v.view_count) ? (v.view_count as number) : 0;
    const likes = Number.isFinite(v.like_count) ? (v.like_count as number) : 0;
    const comments = Number.isFinite(v.comment_count) ? (v.comment_count as number) : 0;
    const shares = Number.isFinite(v.share_count) ? (v.share_count as number) : 0;
    if (!v.create_time) return;
    if (views <= 0) return;
    const hour = new Date(v.create_time * 1000).getHours();
    const entry = buckets.get(hour) ?? { views: 0, engagements: 0, count: 0 };
    entry.views += views;
    entry.engagements += likes + comments + shares;
    entry.count += 1;
    buckets.set(hour, entry);
  });

  const scored = Array.from(buckets.entries()).map(([hour, data]) => {
    const rate = data.views > 0 ? data.engagements / data.views : 0;
    return { hour, rate, count: data.count, views: data.views };
  });

  return scored
    .sort((a, b) => b.rate - a.rate)
    .slice(0, 3)
    .map((entry) => ({
      hour: entry.hour,
      engagementRate: entry.rate,
      posts: entry.count,
      views: entry.views,
    }));
}
