This is a Next.js app that serves the AI Marketing Assistant dashboard at `/dashboard.html`.

## Getting Started

First, install dependencies and run the development server:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). You’ll be redirected to the dashboard.

The dashboard HTML lives at `public/dashboard.html`.

## TikTok OAuth Scaffolding

To enable TikTok login and analytics, copy the example env file and fill in your keys:

```bash
cp .env.local.example .env.local
```

Then update these values in `.env.local`:

- `TIKTOK_CLIENT_KEY`
- `TIKTOK_CLIENT_SECRET`
- `TIKTOK_REDIRECT_URI` (default: `http://localhost:3000/api/tiktok/callback`)
- `TIKTOK_SCOPES` (default: `user.info.basic,user.info.profile,video.list`)

OAuth endpoints are scaffolded here:

- `GET /api/tiktok/connect` (starts OAuth)
- `GET /api/tiktok/callback` (handles callback)
- `GET /api/tiktok/analytics` (placeholder analytics)
- `POST /api/tiktok/snapshot` (stores a daily snapshot if missing)

## Token Storage

Tokens are stored in a local SQLite file at `data/assistant.db` using Node.js' built-in `node:sqlite` module.
This module is still marked experimental in Node.js, but it works out of the box with Node 24+.

## Daily Snapshots + Best Time Recommendations

- The dashboard calls `POST /api/tiktok/snapshot` once per session to store a daily rollup.
- `GET /api/tiktok/analytics` returns recent snapshots and a best-time-to-post recommendation.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
