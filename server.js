const http = require('http');
const fs = require('fs');
const path = require('path');
const urlMod = require('url');

const ROOT = path.join(__dirname, 'public');
const DEFAULT_PORT = Number(process.env.PORT || 4173);
const MAX_PORT_ATTEMPTS = 100;

function send(res, status, body, type='text/plain; charset=utf-8', extraHeaders={}) {
  res.writeHead(status, {'Content-Type':type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin',...extraHeaders});
  res.end(body);
}
function safePath(p){
  const clean = path.normalize(p).replace(/^([.][.][/\\])+/, '');
  return path.join(ROOT, clean === '/' ? 'index.html' : clean);
}
async function fetchJson(url){
  const r=await fetch(url,{headers:{'User-Agent':'TweetStudio/1.1 (template renderer)'}});
  const text=await r.text();
  let data; try{data=JSON.parse(text)}catch{data=null}
  return {r,data};
}
function originalMediaUrl(src){
  if(!src) return src;
  try{
    const u=new URL(src);
    // X/Twitter's pbs.twimg.com media endpoint supports `name=orig`.
    // FxTwitter may return a resized `large`/`medium` variant; always request
    // the original source for the media downloader when possible.
    if(/(^|\.)pbs\.twimg\.com$/i.test(u.hostname) && /\/(media|ext_tw_video)\//i.test(u.pathname)){
      u.searchParams.set('name','orig');
    }
    return u.toString();
  }catch{return src}
}

async function remoteDataUrl(src){
  if(!src) return '';
  if(src.startsWith('data:')) return src;
  try{
    const r=await fetch(src,{headers:{'User-Agent':'Mozilla/5.0'}});
    if(!r.ok) return '';
    const type=r.headers.get('content-type')||'image/jpeg';
    const buf=Buffer.from(await r.arrayBuffer());
    return `data:${type};base64,${buf.toString('base64')}`;
  }catch{return ''}
}
async function handleTweet(req,res,parsed){
  const q=parsed.query;
  if(!q.handle || !q.id) return send(res,400,JSON.stringify({error:'Missing handle or status id.'}),'application/json');

  const headers={
    'User-Agent':'TweetStudio/2.0 (+template-renderer)',
    'Accept':'application/json'
  };

  // FxTwitter's current API is v2. It returns the post in `status` and
  // always includes a `code` field, even when the HTTP status is 200.
  // Keep the legacy endpoint as a compatibility fallback.
  const endpoints=[
    `https://api.fxtwitter.com/2/status/${encodeURIComponent(q.id)}`,
    `https://api.fxtwitter.com/${encodeURIComponent(q.handle)}/status/${encodeURIComponent(q.id)}`
  ];

  let payload=null;
  let lastProblem='The public post could not be retrieved.';

  for(const api of endpoints){
    try{
      const r=await fetch(api,{headers,redirect:'follow'});
      const text=await r.text();
      let j=null;
      try{j=JSON.parse(text)}catch{}
      const code=Number(j?.code ?? r.status);
      const root=j?.status || j?.tweet || null;
      if(r.ok && code>=200 && code<300 && root){
        payload={j,root};
        break;
      }
      if(j?.message) lastProblem=j.message;
    }catch(err){
      lastProblem='Unable to reach the public X post data service.';
    }
  }

  if(!payload){
    return send(res,502,JSON.stringify({error:`Could not retrieve this public X post. ${lastProblem}`}),'application/json');
  }

  const {j,root}=payload;
  const a=root.author || j.author || {};
  const name=a.name || a.display_name || q.handle;
  const handle=String(a.screen_name || a.username || q.handle).replace(/^@/,'');
  const avatar=(a.avatar_url || a.avatar || '').replace('_normal','_400x400');

  const mediaObj=root.media || {};
  const allMedia=Array.isArray(mediaObj.all) ? mediaObj.all : [];
  let media=[];
  if(allMedia.length){
    media=allMedia.map(m=>({
      url:originalMediaUrl(m.type==='video'||m.type==='gif' ? (m.thumbnail_url||m.url) : m.url),
      width:m.width,
      height:m.height,
      type:m.type||'photo'
    })).filter(m=>m.url);
  }else{
    const photos=Array.isArray(mediaObj.photos)?mediaObj.photos:[];
    const videos=Array.isArray(mediaObj.videos)?mediaObj.videos:[];
    const external=mediaObj.external?[mediaObj.external]:[];
    media=[
      ...photos.map(p=>({url:originalMediaUrl(p.url),width:p.width,height:p.height,type:p.type||'photo'})),
      ...videos.map(v=>({url:originalMediaUrl(v.thumbnail_url||v.url),width:v.width,height:v.height,type:v.type||'video'})),
      ...external.map(v=>({url:originalMediaUrl(v.thumbnail_url||v.url),width:v.width,height:v.height,type:v.type||'video'}))
    ].filter(m=>m.url);
  }

  const avatarData=await remoteDataUrl(avatar);
  const out={
    url:root.url||`https://x.com/${q.handle}/status/${q.id}`,
    authorName:name,
    handle:'@'+handle,
    avatar:avatarData||avatar||'',
    text:root.text||root.raw_text?.text||'',
    media
  };
  if(!out.text.trim()) return send(res,502,JSON.stringify({error:'The post was retrieved but contains no readable public text.'}),'application/json');
  send(res,200,JSON.stringify(out),'application/json');
}
async function handleAsset(req,res,parsed){
  const src=parsed.query.url;
  if(!src || !/^https?:\/\//i.test(src)) return send(res,400,'Invalid asset URL');
  try{
    const r=await fetch(src,{headers:{'User-Agent':'Mozilla/5.0'}});
    if(!r.ok) return send(res,502,'Asset unavailable');
    const type=r.headers.get('content-type')||'application/octet-stream';
    res.writeHead(200,{'Content-Type':type,'Cache-Control':'public, max-age=3600'});
    res.end(Buffer.from(await r.arrayBuffer()));
  }catch{return send(res,502,'Asset unavailable')}
}
const server=http.createServer(async(req,res)=>{
  const parsed=urlMod.parse(req.url,true);
  if(parsed.pathname==='/api/tweet') return handleTweet(req,res,parsed);
  if(parsed.pathname==='/api/asset') return handleAsset(req,res,parsed);
  if(parsed.pathname==='/robots.txt'){
    const base=(process.env.SITE_URL||`http://${req.headers.host||'localhost:'+DEFAULT_PORT}`).replace(/\/$/,'');
    const body=`User-agent: *\nAllow: /\nDisallow: /api/\nSitemap: ${base}/sitemap.xml\n`;
    return send(res,200,body,'text/plain; charset=utf-8');
  }
  if(parsed.pathname==='/sitemap.xml'){
    const base=(process.env.SITE_URL||`http://${req.headers.host||'localhost:'+DEFAULT_PORT}`).replace(/\/$/,'');
    const body=`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${base}/</loc></url></urlset>`;
    return send(res,200,body,'application/xml; charset=utf-8');
  }
  if(req.method!=='GET') return send(res,405,'Method not allowed');
  let p=safePath(parsed.pathname||'/');
  if(!p.startsWith(ROOT)) return send(res,403,'Forbidden');
  fs.stat(p,(err,st)=>{
    if(err || !st.isFile()) p=path.join(ROOT,'index.html');
    const ext=path.extname(p).toLowerCase();
    const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg'};
    fs.readFile(p,(e,data)=>e?send(res,500,'Server error'):send(res,200,data,types[ext]||'application/octet-stream', ext==='.html'?{}:{'Cache-Control':'public, max-age=86400'}));
  });
});
function startServer(startPort, attempts = 0) {
  const port = startPort + attempts;
  const onError = (err) => {
    server.off('error', onError);
    if (err && err.code === 'EADDRINUSE' && attempts < MAX_PORT_ATTEMPTS) {
      console.log(`Port ${port} is already in use. Trying ${port + 1}...`);
      setImmediate(() => startServer(startPort, attempts + 1));
      return;
    }
    console.error('Unable to start TweetStudio:', err);
    process.exitCode = 1;
  };
  server.once('error', onError);
  server.listen(port, () => {
    console.log(`TweetStudio running at http://localhost:${port}`);
    if (port !== startPort) {
      console.log(`The default port ${startPort} was busy, so TweetStudio automatically selected ${port}.`);
    }
  });
}

startServer(DEFAULT_PORT);
