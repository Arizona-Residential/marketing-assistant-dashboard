import { NextResponse } from "next/server";
import { getAuthorizedToken, fetchTikTokVideos } from "@/lib/tiktok";
import { getSnapshotByDate, saveSnapshot } from "@/lib/db";

function getSnapshotDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function safeNum(value: number | undefined) {
  return Number.isFinite(value) ? (value as number) : 0;
}

export async function POST() {
  const date = getSnapshotDate();
  const existing = getSnapshotByDate(date);
  if (existing) {
    return NextResponse.json({ status: "exists", date });
  }

  const token = await getAuthorizedToken();
  if (!token) {
    return NextResponse.json(
      { status: "not_connected", message: "Connect TikTok to create snapshots." },
      { status: 401 }
    );
  }

  try {
    const videos = await fetchTikTokVideos(token.access_token);
    const normalized = videos.map((v) => ({
      ...v,
      view_count: safeNum(v.view_count),
      like_count: safeNum(v.like_count),
      comment_count: safeNum(v.comment_count),
      share_count: safeNum(v.share_count),
    }));

    const totalViews = normalized.reduce((a, v) => a + v.view_count, 0);
    const totalLikes = normalized.reduce((a, v) => a + v.like_count, 0);
    const totalComments = normalized.reduce((a, v) => a + v.comment_count, 0);
    const totalShares = normalized.reduce((a, v) => a + v.share_count, 0);
    const avgViews =
      normalized.length > 0 ? Math.round(totalViews / normalized.length) : 0;
    const engagementRate =
      totalViews > 0
        ? (totalLikes + totalComments + totalShares) / totalViews
        : 0;

    const now = Date.now();
    const weekMs = 1000 * 60 * 60 * 24 * 7;
    const views7d = normalized
      .filter((v) => {
        const createdMs = (v.create_time ?? 0) * 1000;
        return createdMs > 0 && now - createdMs <= weekMs;
      })
      .reduce((a, v) => a + v.view_count, 0);

    const topPost =
      normalized.sort((a, b) => b.view_count - a.view_count)[0] ?? null;

    saveSnapshot({
      snapshot_date: date,
      total_videos: normalized.length,
      total_views: totalViews,
      views_7d: views7d,
      avg_views: avgViews,
      engagement_rate: engagementRate,
      total_likes: totalLikes,
      total_comments: totalComments,
      total_shares: totalShares,
      top_post_title: topPost?.title ?? null,
      top_post_views: topPost?.view_count ?? null,
      created_at: now,
    });

    return NextResponse.json({ status: "created", date });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to create snapshot.";
    return NextResponse.json({ status: "error", message }, { status: 500 });
  }
}
