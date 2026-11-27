const http = require("http");
const fs = require("fs");
const path = require("path");
const { Readable, Transform } = require("node:stream");
const { pipeline } = require("node:stream/promises");
const ROOT = path.join(__dirname, "public");
const DEFAULT_PORT = Number(process.env.PORT || 4173);
const MAX_PORT_ATTEMPTS = 100;

function send(
  res,
  status,
  body,
  type = "text/plain; charset=utf-8",
  extraHeaders = {},
) {
  res.writeHead(status, {
    "Content-Type": type,
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    ...extraHeaders,
  });
  res.end(body);
}
const ORIGIN = "https://tweet.endiidishishir.qzz.io";
const MEDIA_HOSTS = new Set([
  "pbs.twimg.com",
  "video.twimg.com",
  "abs.twimg.com",
]);
const MAX_MEDIA = 96 * 1024 * 1024;
const IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
]);
const importCache = new Map();
const pending = new Map();
let activeMedia = 0;
function mediaUrl(raw) {
  try {
    const u = new URL(raw);
    if (
      u.protocol === "https:" &&
      MEDIA_HOSTS.has(u.hostname) &&
      !u.port &&
      !u.username &&
      !u.password
    )
      return u;
  } catch {}
  return null;
}
async function boundedBytes(response, limit) {
  if (
    !response.body ||
    Number(response.headers.get("content-length")) > limit
  ) {
    await response.body?.cancel();
    throw Error("Response exceeds limit");
  }
  const parts = [];
  let bytes = 0;
  for await (const chunk of response.body) {
    bytes += chunk.length;
    if (bytes > limit) throw Error("Response exceeds limit");
    parts.push(chunk);
  }
  return Buffer.concat(parts, bytes);
}
async function avatarImage(raw) {
  const url = mediaUrl(raw);
  if (!url) return "";
  try {
    const r = await fetch(url, {
      redirect: "error",
      signal: AbortSignal.timeout(4000),
    });
    const type = r.headers.get("content-type")?.split(";")[0];
    if (!r.ok || !IMAGE_TYPES.has(type)) {
      await r.body?.cancel();
      return "";
    }
    const b = await boundedBytes(r, 256 * 1024);
    return "data:" + type + ";base64," + b.toString("base64");
  } catch {
    return "";
  }
}
async function lookup(q) {
  const headers = {
    "User-Agent": "TweetStudio/2.0 (+template-renderer)",
    Accept: "application/json",
  };

  // FxTwitter's current API is v2. It returns the post in `status` and
  // always includes a `code` field, even when the HTTP status is 200.
  // Keep the legacy endpoint as a compatibility fallback.
  const endpoints = [
    `https://api.fxtwitter.com/2/status/${encodeURIComponent(q.id)}`,
    `https://api.fxtwitter.com/${encodeURIComponent(q.handle)}/status/${encodeURIComponent(q.id)}`,
  ];

  let payload = null;

  for (const api of endpoints) {
    try {
      const r = await fetch(api, {
        headers,
        redirect: "error",
        signal: AbortSignal.timeout(5000),
      });
      const text = (await boundedBytes(r, 1024 * 1024)).toString("utf8");
      let j = null;
      try {
        j = JSON.parse(text);
      } catch {}
      const code = Number(j?.code ?? r.status);
      const root = j?.status || j?.tweet || null;
      if (r.ok && code >= 200 && code < 300 && root) {
        payload = { j, root };
        break;
      }
    } catch {}
  }

  if (!payload) {
    throw Error("Public post unavailable");
  }

  const { j, root } = payload;
  const a = root.author || j.author || {};
  const name = a.name || a.display_name || q.handle;
  const handle = String(a.screen_name || a.username || q.handle).replace(
    /^@/,
    "",
  );
  const avatar = (a.avatar_url || a.avatar || "").replace(
    "_normal",
    "_400x400",
  );

  const mediaObj = root.media || {};
  const chooseVideoUrl = (m = {}) => {
    let formats = Array.isArray(m.formats) ? m.formats : [];
    if (formats && !Array.isArray(formats) && typeof formats === "object")
      formats = Object.values(formats);
    const mp4 = formats.filter(
      (f) => f && String(f.container || "").toLowerCase() === "mp4" && f.url,
    );
    // Prefer the best available resolution, but avoid unnecessarily huge
    // bitrate variants. Reel output is 1080x1920, so a <=6 Mbps source is
    // normally more than enough and downloads substantially faster.
    mp4.sort((a, b) => {
      const ar = (Number(a.width) || 0) * (Number(a.height) || 0),
        br = (Number(b.width) || 0) * (Number(b.height) || 0);
      if (ar !== br) return br - ar;
      const ab = Number(a.bitrate) || 0,
        bb = Number(b.bitrate) || 0;
      const at = ab > 6000000 ? ab - 6000000 : 0,
        bt = bb > 6000000 ? bb - 6000000 : 0;
      return at - bt || ab - bb;
    });
    const legacyVariants = Array.isArray(m.video_info?.variants)
      ? m.video_info.variants
      : [];
    const legacyMp4 = legacyVariants.filter(
      (v) => v?.url && /\.mp4(?:$|[?#])/i.test(v.url),
    );
    legacyMp4.sort(
      (a, b) => (Number(b.bitrate) || 0) - (Number(a.bitrate) || 0),
    );
    return String(
      mp4[0]?.url ||
        legacyMp4[0]?.url ||
        m.url ||
        m.transcode_url ||
        m.media_url_https ||
        "",
    ).trim();
  };
  const normalizeMedia = (m) => {
    if (!m) return null;
    const type = String(m.type || "").toLowerCase();
    const isVideo =
      type === "video" || type === "gif" || type === "animated_gif";
    const videoUrl = isVideo ? chooseVideoUrl(m) : "";
    const url = String(
      m.thumbnail_url || (isVideo ? videoUrl : m.url) || "",
    ).trim();
    if (!url && !videoUrl) return null;
    return {
      url: url || videoUrl,
      videoUrl,
      width: Number(m.width || m.original_info?.width || 0) || undefined,
      height: Number(m.height || m.original_info?.height || 0) || undefined,
      duration: Number(m.duration || 0) || undefined,
      type: isVideo ? "video" : type || "photo",
    };
  };

  // FxTwitter v2 exposes videos in `media.videos`, while `media.all` is a
  // convenience collection whose shape has changed across API revisions.
  // Prefer the dedicated video array so we never mistake a thumbnail/photo
  // URL for the playable MP4. Keep `all` as a fallback for older responses.
  const videos = Array.isArray(mediaObj.videos) ? mediaObj.videos : [];
  const photos = Array.isArray(mediaObj.photos) ? mediaObj.photos : [];
  const allMedia = Array.isArray(mediaObj.all) ? mediaObj.all : [];
  const external = mediaObj.external ? [mediaObj.external] : [];
  // Compatibility with older/alternate FxTwitter payloads.
  const legacyEntities = Array.isArray(root.extended_entities?.media)
    ? root.extended_entities.media
    : [];
  const legacyEntities2 = Array.isArray(root.entities?.media)
    ? root.entities.media
    : [];
  const normalizedVideos = videos
    .map(normalizeMedia)
    .filter((m) => m?.videoUrl);
  const normalizedAll = allMedia.map(normalizeMedia).filter(Boolean);
  const normalizedPhotos = photos.map(normalizeMedia).filter(Boolean);
  const normalizedExternal = external
    .map(normalizeMedia)
    .filter((m) => m?.videoUrl);
  const normalizedLegacy = legacyEntities
    .concat(legacyEntities2)
    .map(normalizeMedia)
    .filter((m) => m?.videoUrl);

  // Keep one canonical media array, with real playable video URLs first.
  // This makes the Reel composer resilient to FxTwitter response variants.
  const media = [
    ...normalizedVideos,
    ...normalizedExternal,
    ...normalizedLegacy,
    ...normalizedAll,
    ...normalizedPhotos,
  ].filter(
    (m, i, a) =>
      m &&
      (m.videoUrl || m.url) &&
      i === a.findIndex((x) => x.videoUrl === m.videoUrl && x.url === m.url),
  );
  const avatarData = await avatarImage(avatar);
  const out = {
    url: root.url || `https://x.com/${q.handle}/status/${q.id}`,
    authorName: name,
    handle: "@" + handle,
    avatar: avatarData || mediaUrl(avatar)?.href || "",
    text: root.text || root.raw_text?.text || "",
    media: media
      .filter((m) => mediaUrl(m.url) && (!m.videoUrl || mediaUrl(m.videoUrl)))
      .slice(0, 16),
  };
  if (typeof out.text !== "string" || !out.text.trim())
    throw Error("No readable text");
  return JSON.stringify(out);
}
async function handleTweet(res, params) {
  const id = params.get("id"),
    handle = params.get("handle");
  if (
    !/^\d{1,20}$/.test(id || "") ||
    !/^[A-Za-z0-9_]{1,15}$/.test(handle || "")
  )
    return send(
      res,
      400,
      '{"error":"Invalid public post identifier."}',
      "application/json",
    );
  let item = importCache.get(id);
  if (!item || item.expires < Date.now()) {
    if (!pending.has(id)) {
      if (pending.size >= 24)
        return send(
          res,
          503,
          '{"error":"The importer is busy. Try again shortly."}',
          "application/json",
          { "Retry-After": "5" },
        );
      pending.set(
        id,
        lookup({ id, handle })
          .then((body) => {
            if (importCache.size >= 48)
              importCache.delete(importCache.keys().next().value);
            const data = { body, expires: Date.now() + 60000 };
            importCache.set(id, data);
            return data;
          })
          .finally(() => pending.delete(id)),
      );
    }
    try {
      item = await pending.get(id);
    } catch {
      return send(
        res,
        502,
        '{"error":"Public post unavailable. Try pasting the text."}',
        "application/json",
      );
    }
  }
  return send(res, 200, item.body, "application/json", {
    "Cache-Control": "public, max-age=30, s-maxage=60",
  });
}
async function handleAsset(req, res, params) {
  const src = mediaUrl(params.get("url"));
  if (!src) return send(res, 400, "Use a public X media URL.");
  if (activeMedia >= 12)
    return send(
      res,
      503,
      "Media service busy. Try again shortly.",
      "text/plain",
      { "Retry-After": "5" },
    );
  const headers = {};
  if (req.headers.range) {
    if (!/^bytes=(?:\d+-\d*|-\d+)$/.test(req.headers.range))
      return send(res, 416, "Unsupported range");
    headers.Range = req.headers.range;
  }
  activeMedia++;
  const cancel = new AbortController();
  res.once("close", () => cancel.abort());
  try {
    const r = await fetch(src, {
      headers,
      redirect: "error",
      signal: AbortSignal.any([cancel.signal, AbortSignal.timeout(30000)]),
    });
    const type = r.headers.get("content-type")?.split(";")[0],
      length = r.headers.get("content-length");
    if (
      !r.ok ||
      !(IMAGE_TYPES.has(type) || type === "video/mp4") ||
      Number(length) > MAX_MEDIA
    ) {
      await r.body?.cancel();
      return send(res, 502, "Media unavailable.");
    }
    const h = {
      "Content-Type": type,
      "Cache-Control": "public, max-age=600, s-maxage=3600",
      "Accept-Ranges": "bytes",
    };
    if (length) h["Content-Length"] = length;
    if (r.headers.has("content-range"))
      h["Content-Range"] = r.headers.get("content-range");
    res.writeHead(r.status, h);
    if (req.method === "HEAD") {
      await r.body?.cancel();
      res.end();
      return;
    }
    let bytes = 0;
    const limit = new Transform({
      transform(chunk, enc, next) {
        bytes += chunk.length;
        next(bytes > MAX_MEDIA ? Error("Media limit reached") : null, chunk);
      },
    });
    await pipeline(Readable.fromWeb(r.body), limit, res);
  } catch {
    if (!res.headersSent && !res.destroyed)
      send(res, 502, "Media unavailable.");
    else res.destroy();
  } finally {
    activeMedia--;
  }
}
const pages = [
  "/",
  "/tweet-to-instagram",
  "/x-to-instagram",
  "/tweet-to-reel",
  "/linkedin-carousel-maker",
  "/pinterest-pin-maker",
  "/youtube-shorts-maker",
];
const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".webmanifest": "application/manifest+json",
  ".txt": "text/plain; charset=utf-8",
};
const security =
  "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'";
async function route(req, res) {
  const u = new URL(req.url, ORIGIN),
    p = decodeURIComponent(u.pathname);
  const classic = p === "/classic" || p === "/classic.html";
  const guide = pages.slice(1).some((k) => p === k || p === k + ".html");
  let csp = security;
  if (classic)
    csp =
      "default-src 'self'; script-src 'self' https://esm.unpkg.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob: https://pbs.twimg.com https://video.twimg.com https://abs.twimg.com; media-src 'self' blob: https://video.twimg.com; worker-src 'self' blob:; connect-src 'self' blob: https://esm.unpkg.com; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'";
  else if (guide)
    csp = csp.replace("style-src 'self'", "style-src 'self' 'unsafe-inline'");
  res.setHeader("Content-Security-Policy", csp);
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()",
  );
  if (req.method !== "GET" && req.method !== "HEAD")
    return send(res, 405, "Method not allowed", "text/plain", {
      Allow: "GET, HEAD",
    });
  if (p === "/api/tweet") return handleTweet(res, u.searchParams);
  if (p === "/api/asset") return handleAsset(req, res, u.searchParams);
  if (p.startsWith("/api/")) return send(res, 404, "Not found");
  if (p === "/robots.txt")
    return send(
      res,
      200,
      "User-agent: *\nAllow: /\nDisallow: /api/\nSitemap: " +
        ORIGIN +
        "/sitemap.xml\n",
      "text/plain",
      { "Cache-Control": "public, max-age=3600" },
    );
  if (p === "/sitemap.xml")
    return send(
      res,
      200,
      '<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' +
        pages.map((k) => "<url><loc>" + ORIGIN + k + "</loc></url>").join("") +
        "</urlset>",
      "application/xml",
      { "Cache-Control": "public, max-age=3600" },
    );
  if (p.includes("\0") || p.split("/").some((k) => k.startsWith(".")))
    return send(res, 404, "Not found");
  let file = path.resolve(ROOT, "." + (p === "/" ? "/index.html" : p));
  if (!file.startsWith(ROOT + path.sep)) return send(res, 404, "Not found");
  if (!path.extname(file)) file += ".html";
  const ext = path.extname(file),
    type = types[ext];
  if (!type) return send(res, 404, "Not found");
  let stat;
  try {
    stat = await fs.promises.stat(file);
  } catch {
    return send(res, 404, "Not found");
  }
  if (!stat.isFile()) return send(res, 404, "Not found");
  const etag =
    '"' +
    stat.size.toString(16) +
    "-" +
    Math.floor(stat.mtimeMs).toString(16) +
    '"';
  const headers = {
    "Content-Type": type,
    ETag: etag,
    "Cache-Control":
      ext === ".html"
        ? "public, max-age=0, s-maxage=60, stale-while-revalidate=120"
        : "public, max-age=300, s-maxage=3600",
  };
  if (req.headers["if-none-match"] === etag) {
    res.writeHead(304, headers);
    return res.end();
  }
  res.writeHead(200, headers);
  if (req.method === "HEAD") return res.end();
  await pipeline(fs.createReadStream(file), res);
}
const server = http.createServer((req, res) =>
  route(req, res).catch(() => {
    if (!res.headersSent && !res.destroyed)
      send(res, 400, "Request could not be completed");
    else res.destroy();
  }),
);
server.headersTimeout = 15000;
server.requestTimeout = 30000;
server.listen(DEFAULT_PORT, () =>
  console.log("Tweet Studio listening on port " + DEFAULT_PORT),
);
