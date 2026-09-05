/* Optional public stats endpoint. Leave relative when the Cloudflare Worker
   is routed on the same domain. For a Vercel-only domain, set this to the
   full URL of your Cloudflare Worker stats endpoint. */
window.TWEETSTUDIO_STATS_ENDPOINT = window.TWEETSTUDIO_STATS_ENDPOINT || '/api/stats';
