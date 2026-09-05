const http = require('http');
const fs = require('fs');
const path = require('path');
const urlMod = require('url');
const os = require('os');
const crypto = require('crypto');
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
      url:m.type==='video'||m.type==='gif' ? (m.thumbnail_url||m.url) : m.url,
      videoUrl:m.type==='video'||m.type==='gif' ? (m.url||m.transcode_url||m.formats?.find?.(f=>f.container==='mp4')?.url||'') : '',
      width:m.width,
      height:m.height,
      duration:m.duration,
      type:m.type||'photo'
    })).filter(m=>m.url);
  }else{
    const photos=Array.isArray(mediaObj.photos)?mediaObj.photos:[];
    const videos=Array.isArray(mediaObj.videos)?mediaObj.videos:[];
    const external=mediaObj.external?[mediaObj.external]:[];
    media=[
      ...photos.map(p=>({url:p.url,width:p.width,height:p.height,type:p.type||'photo'})),
      ...videos.map(v=>({url:v.thumbnail_url||v.url,videoUrl:v.url||v.transcode_url||v.formats?.find?.(f=>f.container==='mp4')?.url||'',width:v.width,height:v.height,duration:v.duration,type:v.type||'video'})),
      ...external.map(v=>({url:v.thumbnail_url||v.url,videoUrl:v.url||'',width:v.width,height:v.height,duration:v.duration,type:v.type||'video'}))
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
    // Proxy media with HTTP Range support. Browsers use byte ranges for smooth
    // video playback/seeking; buffering the entire remote video first causes
    // stalls, especially when several Reel previews are visible.
    const headers={'User-Agent':'Mozilla/5.0'};
    if(req.headers.range) headers.Range=req.headers.range;
    const r=await fetch(src,{headers,redirect:'follow'});
    if(!r.ok && r.status!==206) return send(res,502,'Asset unavailable');
    const type=r.headers.get('content-type')||'application/octet-stream';
    const outHeaders={
      'Content-Type':type,
      'Cache-Control':'public, max-age=3600, immutable',
      'Accept-Ranges':r.headers.get('accept-ranges')||'bytes',
      'Access-Control-Allow-Origin':'*'
    };
    for(const name of ['content-length','content-range','etag','last-modified']){
      const value=r.headers.get(name); if(value) outHeaders[name.split('-').map((x,i)=>i?x[0].toUpperCase()+x.slice(1):x).join('-')]=value;
    }
    res.writeHead(r.status===206?206:200,outHeaders);
    if(req.method==='HEAD' || !r.body){res.end();return;}
    const {Readable}=require('stream');
    Readable.fromWeb(r.body).pipe(res);
  }catch(err){
    if(!res.headersSent) return send(res,502,'Asset unavailable');
    try{res.destroy(err)}catch{}
  }
}

async function streamCachedReel(res, key, filename){
  const file=path.join(REEL_CACHE_DIR,`${key}.mp4`);
  const stat=await fs.promises.stat(file);
  res.writeHead(200,{'Content-Type':'video/mp4','Content-Length':String(stat.size),'Content-Disposition':`attachment; filename="${filename}"`,'Cache-Control':'private, max-age=300','X-Content-Type-Options':'nosniff'});
  fs.createReadStream(file).pipe(res);
}

async function cacheRemoteVideo(sourceUrl){
  await ensureReelCacheDir();
  const key=hashKey('source:'+sourceUrl);
  const file=path.join(REEL_CACHE_DIR,`${key}.src`);
  try{
    const st=await fs.promises.stat(file);
    if(Date.now()-st.mtimeMs < REEL_CACHE_MAX_AGE && st.size>0) return file;
  }catch{}
  const r=await fetch(sourceUrl,{headers:{'User-Agent':'Mozilla/5.0'},redirect:'follow'});
  if(!r.ok) throw new Error(`Video source returned HTTP ${r.status}.`);
  const buf=Buffer.from(await r.arrayBuffer());
  if(!buf.length) throw new Error('The remote video was empty.');
  await fs.promises.writeFile(file,buf);
  return file;
}

async function handleReelSourceCache(req,res,parsed){
  const src=String(parsed.query.url||'');
  if(!/^https?:\/\//i.test(src)) return send(res,400,'Invalid source video URL');
  try{ const file=await cacheRemoteVideo(src); return send(res,200,JSON.stringify({ready:true,size:(await fs.promises.stat(file)).size}),'application/json'); }
  catch(err){ return send(res,502,`Video source could not be cached: ${err.message}`); }
}

async function handleReelDownload(req,res,parsed){
  const key=String(parsed.query.key||'').replace(/[^a-f0-9]/gi,'');
  if(key.length!==64) return send(res,400,'Invalid Reel download key');
  const file=path.join(REEL_CACHE_DIR,`${key}.mp4`);
  try{
    const st=await fs.promises.stat(file);
    if(Date.now()-st.mtimeMs > REEL_CACHE_MAX_AGE) return send(res,410,'Reel cache expired.');
    const design=String(parsed.query.design||'reel').replace(/[^a-z0-9_-]/gi,'')||'reel';
    await streamCachedReel(res,key,`tweetstudio-reel-${design}.mp4`);
  }catch{ send(res,404,'Reel is not ready.'); }
}

async function handleReelExport(req,res){
  if(req.method!=='POST') return send(res,405,'Method not allowed');
  try{
    const chunks=[]; for await (const chunk of req) chunks.push(chunk);
    const body=JSON.parse(Buffer.concat(chunks).toString('utf8')||'{}');
    const sourceUrl=String(body.sourceUrl||'');
    const overlayPng=String(body.overlayPng||'');
    const videoW=Math.round(Number(body.videoW)||760);
    const videoH=Math.round(Number(body.videoH)||600);
    const videoX=Math.round(Number(body.videoX)||64);
    const videoY=Math.round(Number(body.videoY)||700);
    const warmOnly=String(req.headers['x-reel-warm']||'')==='1';
    if(!/^https?:\/\//i.test(sourceUrl)) return send(res,400,'Invalid source video URL');
    if(!/^data:image\/png;base64,/i.test(overlayPng)) return send(res,400,'Invalid Reel overlay image');
    await ensureReelCacheDir();
    const key=hashKey([sourceUrl,overlayPng.slice(0,80),videoW,videoH,videoX,videoY,FFMPEG_ENCODER].join('|'));
    const outPath=path.join(REEL_CACHE_DIR,`${key}.mp4`);
    try{
      const st=await fs.promises.stat(outPath);
      if(Date.now()-st.mtimeMs < REEL_CACHE_MAX_AGE && st.size>0){
        return send(res,200,JSON.stringify({ready:true,downloadUrl:`/api/reel-download?key=${key}&design=${encodeURIComponent(String(body.designId||'reel'))}`}),'application/json');
      }
    }catch{}

    const sourcePath=await cacheRemoteVideo(sourceUrl);
    const overlayPath=path.join(REEL_CACHE_DIR,`${key}.png`);
    const m=overlayPng.match(/^data:image\/png;base64,(.*)$/i);
    await fs.promises.writeFile(overlayPath,Buffer.from(m[1],'base64'));

    const vfit=`[0:v]scale=${videoW}:${videoH}:force_original_aspect_ratio=decrease,pad=${videoW}:${videoH}:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1[vfit];[vfit][1:v]overlay=0:0:eof_action=endall:shortest=1[v]`;
    let videoArgs=[];
    if(FFMPEG_ENCODER==='h264_nvenc') videoArgs=['-c:v','h264_nvenc','-preset','p1','-tune','ll','-rc','constqp','-qp','28'];
    else if(FFMPEG_ENCODER==='h264_qsv') videoArgs=['-c:v','h264_qsv','-preset','veryfast','-global_quality','28'];
    else if(FFMPEG_ENCODER==='h264_amf') videoArgs=['-c:v','h264_amf','-quality','speed','-rc','cqp','-qp_i','28','-qp_p','28'];
    else videoArgs=['-c:v','libx264','-preset','ultrafast','-crf','28','-tune','zerolatency'];
    const args=[
      '-hide_banner','-loglevel','error','-threads','0',
      '-i',sourcePath,
      '-loop','1','-framerate','30','-i',overlayPath,
      '-filter_complex',vfit,
      '-map','[v]','-map','0:a?',...videoArgs,
      '-pix_fmt','yuv420p','-c:a','aac','-b:a','96k','-movflags','+faststart','-shortest','-f','mp4',outPath
    ];
    await new Promise((resolve,reject)=>{
      const child=spawn(FFMPEG_BIN,args,{stdio:['ignore','ignore','pipe']}); let err='';
      child.stderr.on('data',d=>err+=d.toString());
      child.on('error',e=>{ if(e.code==='ENOENT') reject(new Error('FFmpeg is unavailable.')); else reject(e); });
      child.on('close',code=>code===0?resolve():reject(new Error(err.trim()||`ffmpeg exited with code ${code}`)));
    });
    try{await fs.promises.unlink(overlayPath)}catch{}
    const st=await fs.promises.stat(outPath);
    if(!st.size) throw new Error('The Reel export was empty.');
    const downloadUrl=`/api/reel-download?key=${key}&design=${encodeURIComponent(String(body.designId||'reel'))}`;
    return send(res,200,JSON.stringify({ready:true,size:st.size,downloadUrl,warmed:warmOnly}),'application/json');
  }catch(err){ return send(res,500,`Reel export failed: ${err.message}`); }
}

const server=http.createServer(async(req,res)=>{
  const parsed=urlMod.parse(req.url,true);
  if(parsed.pathname==='/api/tweet') return handleTweet(req,res,parsed);
  if(parsed.pathname==='/api/asset') return handleAsset(req,res,parsed);
  if(parsed.pathname==='/api/reel-source-cache') return handleReelSourceCache(req,res,parsed);
  if(parsed.pathname==='/api/reel-download') return handleReelDownload(req,res,parsed);
  if(parsed.pathname==='/api/reel-export') return handleReelExport(req,res);
  if(parsed.pathname==='/robots.txt'){
    const base=(process.env.SITE_URL||`http://${req.headers.host||'localhost:'+DEFAULT_PORT}`).replace(/\/$/,'');
    const body=`User-agent: *\nAllow: /\nDisallow: /api/\nSitemap: ${base}/sitemap.xml\n`;
    return send(res,200,body,'text/plain; charset=utf-8');
  }
  if(parsed.pathname==='/sitemap.xml'){
    const base=(process.env.SITE_URL||`http://${req.headers.host||'localhost:'+DEFAULT_PORT}`).replace(/\/$/,'');
    const urls=['/','/tweet-to-instagram','/x-to-instagram','/tweet-to-reel']; const body=`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map(u=>`<url><loc>${base}${u}</loc></url>`).join('')}</urlset>`;
    return send(res,200,body,'application/xml; charset=utf-8');
  }
  if(req.method!=='GET') return send(res,405,'Method not allowed');
  let p=safePath(parsed.pathname||'/');
  if(!p.startsWith(ROOT)) return send(res,403,'Forbidden');
  if(path.extname(p)==='' && fs.existsSync(p+'.html')) p=p+'.html';
  fs.stat(p,(err,st)=>{
    if(err || !st.isFile()) p=path.join(ROOT,'index.html');
    const ext=path.extname(p).toLowerCase();
    const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg'};
    fs.readFile(p,(e,data)=>{
      if(e) return send(res,500,'Server error');
      if(ext==='.html'){
        const proto=(req.headers['x-forwarded-proto']||'http').split(',')[0].trim();
        const host=req.headers.host||`localhost:${DEFAULT_PORT}`;
        const origin=(process.env.SITE_URL||`${proto}://${host}`).replace(/\/$/,'');
        data=Buffer.from(data.toString().replaceAll('__SITE_ORIGIN__',origin));
      }
      send(res,200,data,types[ext]||'application/octet-stream', ext==='.html'?{}:{'Cache-Control':'public, max-age=86400'});
    });
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
