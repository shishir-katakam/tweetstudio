# TweetStudio analytics

TweetStudio now includes Vercel Web Analytics plus privacy-conscious custom events.

Tracked events:
- generation_started
- generation_completed
- generation_failed
- theme_downloaded
- download_all
- media_previewed
- media_downloaded
- original_media_downloaded
- url_mode_used
- text_mode_used

No tweet text, pasted text, X URL, or media URL is sent as custom event data.

Enable Web Analytics for the Vercel project. Vercel Web Analytics provides page-view/visitor reporting, and custom events are available on Pro/Enterprise plans. On supported plans, events appear in the Analytics dashboard under Events.
