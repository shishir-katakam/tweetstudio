# TweetStudio — 8K Default

Updated from v30 so **8K (7680×7680)** is the default export resolution everywhere.

Theme exports: 1080 / 4K / 8K / 16K, with 8K selected by default.

Post-media square exports: 1080 / 4K / 8K / 16K, with 8K selected by default.

16K remains available as an optional maximum-resolution export.

## Public stats

See `PUBLIC_STATS_SETUP.md`. The public stats panel uses a Cloudflare Worker + D1 backend and refreshes every hour. It tracks unique first-party visitors, successful posts transformed, rendered designs, and downloads without storing tweet text or IP addresses.

## Reel Composer

TweetStudio now includes a dedicated 9:16 Reel Composer. It reserves the upper Reels header area, right-side interaction controls, and lower profile/caption area, while using the central safe region for the post text and video. When a fetched X post contains video, the app can load the direct video through the local asset proxy; users can also upload a local video. The composer supports a 1080×1920 frame download and browser-side Reel recording where the browser supports MediaRecorder. The video is contained rather than cropped.


## v70 Reel export
Reel export now uses Mediabunny/WebCodecs in the browser for MP4 encoding, with hardware acceleration preferred. It no longer relies on server-side FFmpeg for Reel export. The exporter processes decoded frames with controlled timestamps instead of MediaRecorder's real-time clock.
