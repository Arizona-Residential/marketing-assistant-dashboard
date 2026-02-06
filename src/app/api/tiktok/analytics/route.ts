import { NextResponse } from "next/server";
import {
  fetchTikTokUser,
  fetchTikTokVideos,
  getAuthorizedToken,
  getBestTimes,
} from "@/lib/tiktok";
import { listSnapshots } from "@/lib/db";

function safeNum(value: number | undefined) {
  return Number.isFinite(value) ? (value as number) : 0;
}

export async function GET() {
  const token = await getAuthorizedToken();
  if (!token) {
    return NextResponse.json({
      status: "not_connected",
      message: "Connect TikTok to retrieve live analytics.",
    });
  }

  try {
    const [user, videos] = await Promise.all([
      fetchTikTokUser(token.access_token),
      fetchTikTokVideos(token.access_token),
    ]);

    const now = Date.now();
    const weekMs = 1000 * 60 * 60 * 24 * 7;

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

    const views7d = normalized
      .filter((v) => {
        const createdMs = (v.create_time ?? 0) * 1000;
        return createdMs > 0 && now - createdMs <= weekMs;
      })
      .reduce((a, v) => a + v.view_count, 0);

    const engagementRate =
      totalViews > 0
        ? (totalLikes + totalComments + totalShares) / totalViews
        : 0;

    const topPost =
      normalized.sort((a, b) => b.view_count - a.view_count)[0] ?? null;

    const avgViews =
      normalized.length > 0 ? Math.round(totalViews / normalized.length) : 0;

    const recommendations: string[] = [];
    if (engagementRate < 0.04) {
      recommendations.push(
        "Engagement is low. Lead with a stronger hook in the first 2 seconds and add a clear CTA."
      );
    }
    if (views7d < avgViews * 3) {
      recommendations.push(
        "Your last 7 days are lighter than your average. Post 2 short clips that remix your top-performing format."
      );
    }
    if (topPost?.title) {
      recommendations.push(
        `Your top post (“${topPost.title}”) is your template—repeat that structure with a new job/topic.`
      );
    }
    if (recommendations.length === 0) {
      recommendations.push(
        "Performance looks strong. Keep cadence steady and test one new hook format this week."
      );
    }

    const bestTimes = getBestTimes(normalized);
    if (bestTimes.length) {
      const top = bestTimes[0];
      const label = `${String(top.hour).padStart(2, "0")}:00`;
      recommendations.push(
        `Best posting window from your data: around ${label} (highest engagement rate).`
      );
    }

    const snapshots = listSnapshots(7);

    return NextResponse.json({
      status: "connected",
      user,
      metrics: {
        totalVideos: normalized.length,
        totalViews,
        views7d,
        avgViews,
        engagementRate,
        totalLikes,
        totalComments,
        totalShares,
      },
      topPost,
      bestTimes,
      snapshots,
      recommendations,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to fetch TikTok analytics.";
    return NextResponse.json(
      { status: "error", message },
      { status: 500 }
    );
  }
}
