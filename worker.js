const HOUR = 60 * 60;
const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'public, max-age=3600, s-maxage=3600',
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,POST,OPTIONS',
  'access-control-allow-headers': 'content-type',
  'x-content-type-options': 'nosniff'
};

function json(data, status=200, extra={}) {
  return new Response(JSON.stringify(data), {status, headers:{...JSON_HEADERS,...extra}});
}

async function sha256(text) {
  const bytes = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(hash)].map(b=>b.toString(16).padStart(2,'0')).join('');
}

function todayKey() {
  return new Date().toISOString().slice(0,10);
}

async function visitorId(request, env) {
  const cookie = request.headers.get('cookie') || '';
  const m = cookie.match(/(?:^|;\\s*)ts_vid=([^;]+)/);
  if (m?.[1]) return {id: decodeURIComponent(m[1]), isNew:false};
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const ua = request.headers.get('User-Agent') || '';
  const salt = env.VISITOR_SALT || 'tweetstudio-public-stats';
  const id = await sha256(`${salt}|${ip}|${ua}`);
  return {id, isNew:true};
}

async function increment(db, key, amount=1) {
  await db.prepare('INSERT INTO counters(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=value+excluded.value').bind(key, amount).run();
}

async function handleEvent(request, env) {
  let body;
  try { body = await request.json(); } catch { return json({error:'Invalid JSON'},400); }
  const name = String(body?.name || '');
  const allowed = new Set(['pageview','generation_completed','theme_downloaded','download_all','media_downloaded','original_media_downloaded']);
  if (!allowed.has(name)) return json({ok:true});

  const v = await visitorId(request, env);
  const now = Date.now();
  if (v.isNew) {
    await dbInsertVisitor(env.DB, v.id, now);
  }
  await increment(env.DB, 'pageviews', name === 'pageview' ? 1 : 0);
  if (name === 'generation_completed') {
    await increment(env.DB, 'posts_transformed', 1);
    const designs = Math.max(0, Math.min(1000, Number(body?.designs || body?.slides || 0)));
    if (designs) await increment(env.DB, 'designs_generated', designs);
  } else if (name === 'theme_downloaded' || name === 'download_all' || name === 'media_downloaded' || name === 'original_media_downloaded') {
    await increment(env.DB, 'downloads', 1);
  }
  await env.DB.prepare("INSERT INTO meta(key,value) VALUES('updated_at',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").bind(new Date(now).toISOString()).run().catch(async()=>{
    await env.DB.prepare("INSERT INTO meta(key,value) VALUES('updated_at',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").bind(new Date(now).toISOString()).run();
  });
  const headers = v.isNew ? {'Set-Cookie':`ts_vid=${encodeURIComponent(v.id)}; Max-Age=31536000; Path=/; SameSite=Lax; Secure`} : {};
  return json({ok:true},200,headers);
}
async function dbInsertVisitor(db,id,now){
  await db.prepare('INSERT OR IGNORE INTO visitors(visitor_id,first_seen) VALUES(?,?)').bind(id,now).run();
}

async function summary(env) {
  const rows = await env.DB.prepare('SELECT key,value FROM counters').all();
  const m = Object.fromEntries((rows.results||[]).map(r=>[r.key,Number(r.value||0)]));
  const count = await env.DB.prepare('SELECT COUNT(*) AS n FROM visitors').first();
  const updated = await env.DB.prepare("SELECT value FROM meta WHERE key='updated_at'").first();
  return {
    visitors:Number(count?.n||0),
    postsTransformed:Number(m.posts_transformed||0),
    designsGenerated:Number(m.designs_generated||0),
    downloads:Number(m.downloads||0),
    updatedAt:updated?.value||null
  };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return new Response(null,{status:204,headers:JSON_HEADERS});
    if (url.pathname.endsWith('/event') && request.method === 'POST') return handleEvent(request,env);
    if (url.pathname.endsWith('/summary') && request.method === 'GET') return json(await summary(env));
    return json({error:'Not found'},404);
  }
};
