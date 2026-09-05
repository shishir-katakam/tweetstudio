# TweetStudio Public Stats

This adds a privacy-conscious public usage counter backed by Cloudflare Worker + D1.
The public stats UI refreshes every hour. The underlying counters are updated on each tracked event, so the displayed numbers are exact for the events collected by this tracker.

## Metrics

- Visitors: unique first-party visitor IDs collected by this tracker.
- Posts transformed: successful generation jobs.
- Designs generated: total rendered slides across successful jobs.
- Downloads: theme, download-all, and media downloads.

No tweet text, pasted text, X URL, media URL, or IP address is stored. The visitor identifier is a one-way SHA-256 hash and is stored only as an opaque identifier.

## Deploy the D1 database

1. Install Wrangler: `npm install -g wrangler`
2. Login: `wrangler login`
3. Create the database: `wrangler d1 create tweetstudio-stats`
4. Copy the returned database ID into `wrangler.toml`.
5. Run: `wrangler d1 execute tweetstudio-stats --remote --file=schema.sql`
6. Deploy the worker: `wrangler deploy`

## Route it

Your Cloudflare zone should route `/api/stats/*` to the Worker. The example route is in `wrangler.toml`.

If the site is served from a Vercel hostname, edit `public/stats-config.js` and set:

`window.TWEETSTUDIO_STATS_ENDPOINT = 'https://YOUR-CLOUDFLARE-DOMAIN/api/stats';`

If the site is served from the Cloudflare domain itself, the default `/api/stats` is enough.

## Hourly refresh

The browser refreshes the public stats every 60 minutes. The summary endpoint is also cacheable for one hour. There is no scheduled job and no fabricated or rounded data.
