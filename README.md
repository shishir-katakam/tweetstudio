TweetStudio v27 — Original Media Quality Fix

This build keeps the v26 Instagram-safe 1080×1080 media export and improves source fidelity.

Media quality fixes:
• X/Twitter pbs.twimg.com media URLs are upgraded to `name=orig` when available instead of using resized `large`/`medium` variants.
• The complete source image is still contained inside the 1080×1080 square with no cropping or stretching.
• High-quality browser image resizing is used when supported.
• PNG export remains lossless; explicit JPEG export uses maximum quality.
• Original media download remains available separately.

Run: node server.js
