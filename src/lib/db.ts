import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";

const DB_PATH = path.join(process.cwd(), "data", "assistant.db");

let db: DatabaseSync | null = null;

export type TikTokTokenRow = {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  scope: string | null;
  open_id: string | null;
};

function getDb() {
  if (!db) {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    db = new DatabaseSync(DB_PATH);
    db.exec(`
      CREATE TABLE IF NOT EXISTS tiktok_tokens (
        id INTEGER PRIMARY KEY,
        access_token TEXT NOT NULL,
        refresh_token TEXT NOT NULL,
        expires_at INTEGER NOT NULL,
        scope TEXT,
        open_id TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      ) STRICT
    `);
    db.exec(`
      CREATE TABLE IF NOT EXISTS tiktok_snapshots (
        snapshot_date TEXT PRIMARY KEY,
        total_videos INTEGER NOT NULL,
        total_views INTEGER NOT NULL,
        views_7d INTEGER NOT NULL,
        avg_views INTEGER NOT NULL,
        engagement_rate REAL NOT NULL,
        total_likes INTEGER NOT NULL,
        total_comments INTEGER NOT NULL,
        total_shares INTEGER NOT NULL,
        top_post_title TEXT,
        top_post_views INTEGER,
        created_at INTEGER NOT NULL
      ) STRICT
    `);
    db.exec(`
      CREATE TABLE IF NOT EXISTS user_settings (
        open_id TEXT PRIMARY KEY,
        data TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      ) STRICT
    `);
  }
  return db;
}

export function getTikTokToken(): TikTokTokenRow | null {
  const row = getDb()
    .prepare(
      "SELECT access_token, refresh_token, expires_at, scope, open_id FROM tiktok_tokens WHERE id = 1"
    )
    .get() as TikTokTokenRow | undefined;
  return row ?? null;
}

export function saveTikTokToken(token: TikTokTokenRow) {
  const db = getDb();
  const now = Date.now();
  const existing = db
    .prepare("SELECT id FROM tiktok_tokens WHERE id = 1")
    .get() as { id: number } | undefined;

  if (existing) {
    db.prepare(
      `
        UPDATE tiktok_tokens
        SET access_token = ?,
            refresh_token = ?,
            expires_at = ?,
            scope = ?,
            open_id = ?,
            updated_at = ?
        WHERE id = 1
      `
    ).run(
      token.access_token,
      token.refresh_token,
      token.expires_at,
      token.scope,
      token.open_id,
      now
    );
    return;
  }

  db.prepare(
    `
      INSERT INTO tiktok_tokens
        (id, access_token, refresh_token, expires_at, scope, open_id, created_at, updated_at)
      VALUES (1, ?, ?, ?, ?, ?, ?, ?)
    `
  ).run(
    token.access_token,
    token.refresh_token,
    token.expires_at,
    token.scope,
    token.open_id,
    now,
    now
  );
}

export function clearTikTokToken() {
  const db = getDb();
  db.prepare("DELETE FROM tiktok_tokens WHERE id = 1").run();
}

export type TikTokSnapshotRow = {
  snapshot_date: string;
  total_videos: number;
  total_views: number;
  views_7d: number;
  avg_views: number;
  engagement_rate: number;
  total_likes: number;
  total_comments: number;
  total_shares: number;
  top_post_title: string | null;
  top_post_views: number | null;
  created_at: number;
};

export function getSnapshotByDate(date: string) {
  return getDb()
    .prepare("SELECT * FROM tiktok_snapshots WHERE snapshot_date = ?")
    .get(date) as TikTokSnapshotRow | undefined;
}

export function saveSnapshot(row: TikTokSnapshotRow) {
  const db = getDb();
  db.prepare(
    `
      INSERT INTO tiktok_snapshots
        (snapshot_date, total_videos, total_views, views_7d, avg_views, engagement_rate,
         total_likes, total_comments, total_shares, top_post_title, top_post_views, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
  ).run(
    row.snapshot_date,
    row.total_videos,
    row.total_views,
    row.views_7d,
    row.avg_views,
    row.engagement_rate,
    row.total_likes,
    row.total_comments,
    row.total_shares,
    row.top_post_title,
    row.top_post_views,
    row.created_at
  );
}

export function listSnapshots(limit = 7) {
  return getDb()
    .prepare(
      "SELECT * FROM tiktok_snapshots ORDER BY snapshot_date DESC LIMIT ?"
    )
    .all(limit) as TikTokSnapshotRow[];
}

export function getUserSettings(openId: string) {
  return getDb()
    .prepare("SELECT data, updated_at FROM user_settings WHERE open_id = ?")
    .get(openId) as { data: string; updated_at: number } | undefined;
}

export function saveUserSettings(openId: string, data: string) {
  const db = getDb();
  const now = Date.now();
  const existing = db
    .prepare("SELECT open_id FROM user_settings WHERE open_id = ?")
    .get(openId) as { open_id: string } | undefined;

  if (existing) {
    db.prepare(
      "UPDATE user_settings SET data = ?, updated_at = ? WHERE open_id = ?"
    ).run(data, now, openId);
    return;
  }

  db.prepare(
    "INSERT INTO user_settings (open_id, data, updated_at) VALUES (?, ?, ?)"
  ).run(openId, data, now);
}
