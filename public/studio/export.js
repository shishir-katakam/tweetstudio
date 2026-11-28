import { dimensions, durationFor, layout, render, platforms } from "./render.js";
import { openAttachment, releaseAttachment } from "./media.js";
const utf = new TextEncoder();
export function download(blob, name) {
  const u = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = u;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(u), 90000);
}
function raster(canvas, type = "image/png") {
  return new Promise((ok, no) =>
    canvas.toBlob(
      (b) =>
        b ? ok(b) : no(Error("Your browser could not render this image.")),
      type,
      0.94,
    ),
  );
}
const table = Uint32Array.from({ length: 256 }, (_, i) => {
  let n = i;
  for (let k = 0; k < 8; k++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1;
  return n >>> 0;
});
function crc(bytes) {
  let n = 0xffffffff;
  for (const b of bytes) n = table[(n ^ b) & 255] ^ (n >>> 8);
  return (n ^ 0xffffffff) >>> 0;
}
function header(size) {
  const bytes = new Uint8Array(size);
  return { bytes, v: new DataView(bytes.buffer) };
}
export async function zip(files, signal) {
  const entries = [],
    directory = [];
  let offset = 0,
    centralSize = 0;
  for (const f of files) {
    signal?.throwIfAborted();
    const name = utf.encode(f.name),
      data = new Uint8Array(await f.blob.arrayBuffer()),
      sum = crc(data);
    const l = header(30);
    l.v.setUint32(0, 0x04034b50, true);
    l.v.setUint16(4, 20, true);
    l.v.setUint32(14, sum, true);
    l.v.setUint32(18, data.length, true);
    l.v.setUint32(22, data.length, true);
    l.v.setUint16(26, name.length, true);
    entries.push(l.bytes, name, f.blob);
    const d = header(46);
    d.v.setUint32(0, 0x02014b50, true);
    d.v.setUint16(4, 20, true);
    d.v.setUint16(6, 20, true);
    d.v.setUint32(16, sum, true);
    d.v.setUint32(20, data.length, true);
    d.v.setUint32(24, data.length, true);
    d.v.setUint16(28, name.length, true);
    d.v.setUint32(42, offset, true);
    directory.push(d.bytes, name);
    centralSize += 46 + name.length;
    offset += 30 + name.length + data.length;
  }
  const e = header(22);
  e.v.setUint32(0, 0x06054b50, true);
  e.v.setUint16(8, files.length, true);
  e.v.setUint16(10, files.length, true);
  e.v.setUint32(12, centralSize, true);
  e.v.setUint32(16, offset, true);
  return new Blob([...entries, ...directory, e.bytes], {
    type: "application/zip",
  });
}
async function slidePdf(canvas, state, plan, signal, output) {
  const chunks = [],
    offsets = [0];
  let pos = 0;
  function append(data) {
    const b = typeof data === "string" ? utf.encode(data) : data;
    chunks.push(b);
    pos += b.length;
    if (pos > packLimit) throw tooLarge();
  }
  function obj(n, ...body) {
    offsets[n] = pos;
    append(n + " 0 obj\n");
    body.forEach(append);
    append("\nendobj\n");
  }
  append("%PDF-1.4\n");
  obj(1, "<< /Type /Catalog /Pages 2 0 R >>");
  obj(
    2,
    "<< /Type /Pages /Count " +
      plan.pages.length +
      " /Kids [" +
      plan.pages.map((_, i) => 3 + i * 3 + " 0 R").join(" ") +
      "] >>",
  );
  for (let i = 0; i < plan.pages.length; i++) {
    signal.throwIfAborted();
    render(canvas, state, plan, i, 1, output);
    const jpg = new Uint8Array(
        await (await raster(canvas, "image/jpeg")).arrayBuffer(),
      ),
      n = 3 + 3 * i;
    const draw = "q " + plan.w + " 0 0 " + plan.h + " 0 0 cm /Im Do Q";
    obj(
      n,
      "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 " +
        plan.w +
        " " +
        plan.h +
        "] /Resources << /XObject << /Im " +
        (n + 1) +
        " 0 R >> >> /Contents " +
        (n + 2) +
        " 0 R >>",
    );
    obj(
      n + 1,
      "<< /Type /XObject /Subtype /Image /Width " +
        canvas.width +
        " /Height " +
        canvas.height +
        " /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length " +
        jpg.length +
        " >>\nstream\n",
      jpg,
      "\nendstream",
    );
    obj(
      n + 2,
      "<< /Length " + draw.length + " >>\nstream\n" + draw + "\nendstream",
    );
  }
  const xref = pos;
  append("xref\n0 " + offsets.length + "\n0000000000 65535 f \n");
  for (const n of offsets.slice(1))
    append(String(n).padStart(10, "0") + " 00000 n \n");
  append(
    "trailer\n<< /Size " +
      offsets.length +
      " /Root 1 0 R >>\nstartxref\n" +
      xref +
      "\n%%EOF",
  );
  return new Blob(chunks, { type: "application/pdf" });
}
const packLimit = 200*1024*1024;
const tooLarge=()=>Error("This pack exceeds 200 MB. Export fewer platforms or reduce the resolution.");
export function videoType() {
  if (typeof MediaRecorder==="undefined") return "";
  return ["video/mp4","video/webm;codecs=vp9","video/webm;codecs=vp8","video/webm"].find(t=>MediaRecorder.isTypeSupported(t)) || "";
}
function readyToPlay(task,signal) {
  return new Promise((ok,no)=>{
    const finish=(fn,value)=>{clearTimeout(timer);signal.removeEventListener("abort",cancel);fn(value);};
    const cancel=()=>finish(no,signal.reason);
    const timer=setTimeout(()=>finish(no,Error("Keep the tab active and allow media playback to record the reel.")),12000);
    signal.addEventListener("abort",cancel,{once:true});
    Promise.resolve(task).then(v=>finish(ok,v),e=>finish(no,e));
    if(signal.aborted)cancel();
  });
}
async function video(canvas,state,plan,signal,progress,output,audio) {
  const mime=videoType();
  if(!mime || !canvas.captureStream) throw Error("This browser cannot record a reel. Try a current desktop browser or export images.");
  let runtime=0;
  const ends=plan.metrics.map(m=>runtime+=1000*durationFor(state,m.key));
  let asset,stream,recorder,source,mix,timer,cancel;
  try {
    signal.throwIfAborted();
    if(state.attachment?.type==="video"){
      asset=await openAttachment(state.attachment.file,signal);
      state={...state,attachment:asset};
      asset.element.loop=true;
      if(audio){
        mix=audio.createMediaStreamDestination();
        source=audio.createMediaElementSource(asset.element);
        source.connect(mix);
        asset.element.muted=false;
      }
    }
    render(canvas,state,plan,0,1,output);
    stream=canvas.captureStream(24);
    if(mix)for(const t of mix.stream.getAudioTracks())stream.addTrack(t);
    recorder=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:Math.max(5000000,canvas.width*canvas.height*3),...(mix?{audioBitsPerSecond:128000}:{})});
    if(asset)await readyToPlay(asset.element.play(),signal);
    signal.throwIfAborted();
    const chunks=[];
    await new Promise((ok,no)=>{
      let total=0,frame=0,last=-1;
      recorder.onerror=()=>no(Error("Video encoding failed. Try a lower resolution or another browser."));
      recorder.ondataavailable=e=>{
        total+=e.data.size;
        if(total>packLimit){no(tooLarge());return;}
        if(e.data.size)chunks.push(e.data);
      };
      recorder.onstop=ok;
      cancel=()=>no(signal.reason);
      signal.addEventListener("abort",cancel,{once:true});
      recorder.start(500);
      const start=performance.now();
      function tick(){
        try{
          const t=performance.now()-start;
          if(t>=runtime){clearInterval(timer);if(recorder.state!=="inactive")recorder.stop();return;}
          while(frame+1<ends.length && t>=ends[frame])frame++;
          const age=t-(frame?ends[frame-1]:0);
          render(canvas,state,plan,frame,.74+.26*Math.min(1,age/300),output);
          const left=Math.ceil((runtime-t)/1000);
          if(last!==left){last=left;progress("Recording reel · "+left+"s left");}
        }catch(e){no(e);}
      }
      timer=setInterval(tick,1000/24);tick();
    });
    signal.throwIfAborted();
    if(!chunks.length)throw Error("The video encoder returned an empty file.");
    return new Blob(chunks,{type:recorder.mimeType||mime});
  } finally {
    clearInterval(timer);
    if(cancel)signal.removeEventListener("abort",cancel);
    if(recorder){
      recorder.ondataavailable=recorder.onerror=recorder.onstop=null;
      if(recorder.state!=="inactive")recorder.stop();
    }
    stream?.getTracks().forEach(t=>t.stop());
    mix?.stream.getTracks().forEach(t=>t.stop());
    source?.disconnect();mix?.disconnect();releaseAttachment(asset);
  }
}
export async function exportSet(state,targets,signal,progress,allFormats=false){
  const files=[],seen=new Set(),canvas=document.createElement("canvas");
  const kinds=allFormats?["Post","Carousel","Reel"]:[state.kind];
  let still,audio,bytes=0;
  function add(name,blob){bytes+=blob.size;if(bytes>packLimit)throw tooLarge();files.push({name,blob});}
  try{
    signal.throwIfAborted();
    if(state.attachment?.type==="video"){
      if(state.includeAudio && kinds.includes("Reel") && targets.some(p=>platforms[p]?.Reel)){
        const Audio=window.AudioContext||window.webkitAudioContext;
        if(!Audio)throw Error("This browser cannot include source audio. Turn audio off or try another browser.");
        audio=new Audio();
        await readyToPlay(audio.resume(),signal);
        if(audio.state!=="running")throw Error("Allow audio playback in this tab to include source audio.");
      }
      if(kinds.some(k=>k!=="Reel"))still=await openAttachment(state.attachment.file,signal);
    }
    for(const kind of kinds)for(const platform of targets){
      signal.throwIfAborted();
      const available=platforms[platform]?.[kind];
      if(!available?.length)continue;
      const size=platform===state.platform && available.includes(state.size)?state.size:available[0];
      const quality=state.quality||"Standard", key=[platform,kind,size,quality,state.style].join("|");
      if(seen.has(key))continue;
      seen.add(key);
      const variant={...state,kind,platform,size,attachment:still||state.attachment};
      const plan=layout(variant,size,kind,platform),output=dimensions(size,quality);
      const prefix=[platform,kind,state.style].join("-").toLowerCase();
      progress("Rendering "+platform+"…");
      if(kind==="Reel"){
        const blob=await video(canvas,variant,plan,signal,progress,output,audio);
        add(prefix+(blob.type.includes("mp4")?".mp4":".webm"),blob);
      }else if(platform==="LinkedIn" && kind==="Carousel"){
        add(prefix+".pdf",await slidePdf(canvas,variant,plan,signal,output));
      }else for(let i=0;i<plan.pages.length;i++){
        signal.throwIfAborted();
        render(canvas,variant,plan,i,1,output);
        add(prefix+(plan.pages.length>1?"-"+String(i+1).padStart(2,"0"):"")+".png",await raster(canvas));
      }
    }
    signal.throwIfAborted();
    if(!files.length)throw Error("Choose a platform that supports this format.");
    if(files.length===1)download(files[0].blob,files[0].name);
    else{
      progress("Packing "+files.length+" files…");
      const blob=await zip(files,signal);
      signal.throwIfAborted();
      download(blob,"tweet-studio-"+(allFormats?"creator-pack":state.kind.toLowerCase())+".zip");
    }
  }finally{
    releaseAttachment(still);
    canvas.width=canvas.height=1;
    if(audio && audio.state!=="closed")await audio.close().catch(()=>{});
  }
}
