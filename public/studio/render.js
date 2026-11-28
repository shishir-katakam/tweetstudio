import { safeZone } from "./zones.js";
import { extraStyles, drawTheme } from "./themes.js";
export const styles = [
  {
    id: "cobalt",
    name: "Cobalt Wave",
    family: "Contour",
    art: "cobalt",
    color: "#fff",
    base: "#193ace",
    title: "Ideas in motion.",
  },
  {
    id: "optical",
    name: "Mono Grid",
    family: "Brutalist",
    art: "optical",
    color: "#fff",
    base: "#0f1114",
    title: "Less, but better.",
  },
  {
    id: "sorbet",
    name: "Soft Signal",
    family: "Gradient",
    art: "sorbet",
    color: "#372b3b",
    base: "#ead8de",
    title: "Soft signal.",
  },
  {
    id: "arch",
    name: "Paper Form",
    family: "Editorial",
    art: "arch",
    color: "#622f22",
    base: "#eee3ca",
    title: "Form & feeling.",
  },
  {
    id: "ink",
    name: "Evening Edition",
    family: "Editorial",
    color: "#ffdd8c",
    base: "#202a3a",
    title: "The evening edit.",
  },
  {
    id: "mint",
    name: "Field Study",
    family: "Grid",
    color: "#173c30",
    base: "#c9ecda",
    title: "Notes from the field.",
  },
  {
    id: "neon",
    name: "Acid Type",
    family: "Poster",
    color: "#202721",
    base: "#c9ff42",
    title: "Loud by design.",
  },
  {
    id: "rose",
    name: "Rose Index",
    family: "Editorial",
    color: "#5a142a",
    base: "#ffbdcd",
    title: "In full bloom.",
  },
  ...extraStyles,
];
export const platforms = {
  Instagram: {
    Post: ["Square", "Portrait", "Story"],
    Carousel: ["Square", "Portrait"],
    Reel: ["Vertical"],
  },
  Facebook: {
    Post: ["Square", "Landscape", "Portrait", "Story"],
    Carousel: ["Square", "Portrait"],
    Reel: ["Vertical"],
  },
  LinkedIn: {
    Post: ["Square", "Landscape", "Portrait"],
    Carousel: ["Portrait", "Square"],
    Reel: ["Vertical"],
  },
  Pinterest: {
    Post: ["Pin", "Square"],
    Carousel: ["Pin", "Square"],
    Reel: ["Vertical"],
  },
  X: {
    Post: ["Landscape", "Square"],
    Carousel: ["Square", "Landscape"],
    Reel: ["Vertical"],
  },
  Threads: {
    Post: ["Portrait", "Square"],
    Carousel: ["Portrait", "Square"],
    Reel: ["Vertical"],
  },
  TikTok: {
    Post: ["Vertical", "Square"],
    Carousel: ["Vertical", "Square"],
    Reel: ["Vertical"],
  },
  YouTube: { Reel: ["Vertical"] },
};
export const sizes = {
  Square: [1080, 1080],
  Portrait: [1080, 1350],
  Story: [1080, 1920],
  Vertical: [1080, 1920],
  Landscape: [1600, 900],
  Pin: [1000, 1500],
};
const images = new Map();
let avatarKey = "",
  avatarPending = null,
  avatarImage = null;
export function loadAvatar(raw) {
  if (raw === avatarKey) return avatarPending || Promise.resolve(false);
  avatarKey = raw;
  avatarImage = null;
  if (
    typeof raw !== "string" ||
    !/^data:image\/(?:jpeg|png|webp|avif|gif);base64,/.test(raw)
  )
    return Promise.resolve(false);
  const image = new Image();
  image.src = raw;
  avatarPending = image
    .decode()
    .then(() => {
      if (avatarKey !== raw) return false;
      avatarImage = image;
      return true;
    })
    .catch(() => false);
  return avatarPending;
}
export async function loadArt() {
  await Promise.all(
    styles
      .filter((s) => s.art)
      .map(async (s) => {
        const im = new Image();
        im.src = "/studio/" + s.art + ".webp";
        await im.decode();
        images.set(s.art, im);
      }),
  );
}
const serif = (s) => ["arch", "sorbet", "ink", "rose"].includes(s.id);
function font(style, px) {
  const family=style.fontFamily||(serif(style)?"Georgia,serif":"Arial,sans-serif");
  return (style.weight||(serif(style)?500:700))+" "+px+"px "+family;

}
const styleIds=new Set(extraStyles.map(s=>s.id));
function background(c, s, w, h) {
  c.fillStyle = s.base;
  c.fillRect(0, 0, w, h);
  if (styleIds.has(s.id)) { c.save(); drawTheme(c,s,w,h); c.restore(); return; }
  if (images.has(s.art)) {
    c.drawImage(images.get(s.art), 0, 0, w, h);
    return;
  }
  c.save();
  c.strokeStyle = s.color;
  c.globalAlpha = 0.24;
  c.lineWidth = Math.max(1, w / 430);
  if (s.id === "mint") {
    for (let n = 0; n < w + h; n += w / 16) {
      c.beginPath();
      c.moveTo(n, 0);
      c.lineTo(n, h);
      c.moveTo(0, n);
      c.lineTo(w, n);
      c.stroke();
    }
  } else {
    for (let n = 1; n < 17; n++) {
      c.beginPath();
      c.arc(w * 1.07, h * 1.05, (n * w) / 28, 0, Math.PI * 2);
      c.stroke();
    }
  }
  c.restore();
}
function star(c, x, y, r, color) {
  c.save();
  c.translate(x, y);
  c.strokeStyle = color;
  c.lineWidth = r * 0.28;
  for (let i = 0; i < 8; i++) {
    c.rotate(Math.PI / 4);
    c.beginPath();
    c.moveTo(0, r * 0.28);
    c.lineTo(0, r);
    c.stroke();
  }
  c.restore();
}
export function thumbnail(canvas, s) {
  const w = 520,
    h = 222;
  canvas.width = w;
  canvas.height = h;
  const c = canvas.getContext("2d");
  background(c, s, w, h);
  c.fillStyle = s.color;
  c.font = "bold 10px monospace";
  c.fillText("STUDIO NOTES", 23, 30);
  c.font = font(s, 47);
  const words = s.title.split(" ");
  const split = Math.ceil(words.length / 2);
  c.fillText(words.slice(0, split).join(" "), 22, 105);
  c.fillText(words.slice(split).join(" "), 22, 151);
  c.font = "11px monospace";
  c.fillText("01 / 01", 23, h - 15);
}

export function dimensions(size,quality) {
  const [w,h]=sizes[size]||sizes.Square;
  const edge=({"4k":3840,"2160p":3840,"3840":3840,"2k":2560,"1440p":2560,"2560":2560})[String(quality).toLowerCase()];
  if(!edge)return [w,h];
  const scale=edge/Math.max(w,h);
  return [Math.round(w*scale/2)*2,Math.round(h*scale/2)*2];
}
export function durationFor(state,key) {
  const n=Number(state.durations?.[key]??state.slideDurations?.[key]??state.seconds??state.slideSeconds??3);
  return Number.isFinite(n)?Math.max(.5,Math.min(60,n)):3;
}
const measurement=document.createElement("canvas").getContext("2d");
const graphemes=typeof Intl.Segmenter==="function"?new Intl.Segmenter(undefined,{granularity:"grapheme"}):null;
const sentences=typeof Intl.Segmenter==="function"?new Intl.Segmenter(undefined,{granularity:"sentence"}):null;
const marker=/^\s*(?:[-*+•●◦▪▫‣⁃‒–—✓✔▸►]|\(?\d{1,3}[.)]|\d{1,3}\/)(?=\s|$)\s*/u;
function pointBlocks(raw,kind){
  const lines=raw.trim().replace(/\r\n?/g,"\n").split("\n");
  if(lines.some(line=>marker.test(line))){
    const blocks=[];let current=[];
    for(const line of lines){
      if(marker.test(line)&&current.length){blocks.push(current.join(" "));current=[];}
      if(line.trim())current.push(line.trim());
    }
    if(current.length)blocks.push(current.join(" "));
    return blocks;
  }
  return raw.trim().split(/\n\s*\n/).filter(Boolean).flatMap(para=>{
    if(kind==="Post"&&para.length<520)return [para];
    if(sentences)return Array.from(sentences.segment(para),s=>s.segment.trim()).filter(Boolean);
    return para.split(/(?<=[.!?。！？])\s+/u);
  });
}
export function wrap(text,width){
  const out=[];
  for(const para of text.split(/\r?\n/)){
    let line="";
    for(const word of para.trim().split(/\s+/u).filter(Boolean)){
      const candidate=line?line+" "+word:word;
      if(measurement.measureText(candidate).width<=width){line=candidate;continue;}
      if(line){out.push(line);line="";}
      if(measurement.measureText(word).width<=width){line=word;continue;}
      const chars=graphemes?Array.from(graphemes.segment(word),s=>s.segment):Array.from(word);
      for(const ch of chars){
        if(line&&measurement.measureText(line+ch).width>width){out.push(line);line="";}
        line+=ch;
      }
    }
    out.push(line);
  }
  return out;
}
function slideKey(text,occurrences){
  let hash=2166136261;
  for(let i=0;i<text.length;i++)hash=Math.imul(hash^text.charCodeAt(i),16777619);
  const key=(hash>>>0).toString(36)+"-"+text.length,n=occurrences.get(key)||0;
  occurrences.set(key,n+1);return key+"-"+n;
}
function rectangles(w,h,zone,media){
  const unit=Math.min(w,h);
  const safe={x:w*zone.left,y:h*zone.top,w:w*(1-zone.left-zone.right),h:h*(1-zone.top-zone.bottom)};
  const headerH=Math.min(unit*.072,safe.h*.11),footerH=Math.min(unit*.052,safe.h*.085);
  const gap=Math.min(unit*.035,safe.h*.05);
  const body={x:safe.x,y:safe.y+headerH+gap,w:safe.w,h:safe.h-headerH-footerH-2*gap};
  const textRect={...body};let mediaRect=null;
  const nw=Number(media?.width||media?.element?.videoWidth||media?.element?.naturalWidth);
  const nh=Number(media?.height||media?.element?.videoHeight||media?.element?.naturalHeight);
  if(media?.element&&nw>0&&nh>0){
    const aspect=nw/nh,side=body.w/body.h>1.55||(body.w/body.h>=.82&&aspect<.9);
    const maxW=side?body.w*.42:body.w,maxH=side?body.h:body.h*.47;
    const mw=Math.min(maxW,maxH*aspect),mh=mw/aspect;
    if(side){
      mediaRect={x:body.x+body.w-mw,y:body.y+(body.h-mh)/2,w:mw,h:mh};
      textRect.w=body.w-mw-gap;
    }else{
      mediaRect={x:body.x+(body.w-mw)/2,y:body.y+body.h-mh,w:mw,h:mh};
      textRect.h=body.h-mh-gap;
    }
  }
  return {safe,headerH,footerH,textRect,mediaRect};
}
function fitBlock(text,rect,style,ceiling){
  // Prefer slightly smaller type to arbitrary breaks in ordinary words.
  // Scripts without word spaces and exceptionally long tokens can still wrap.
  const words=[...new Set(text.split(/\s+/u))].filter(word=>word.length<=40&&!/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Thai}]/u.test(word));
  let lo=1,hi=Math.max(1,Math.floor(Math.min(ceiling,rect.h/1.13))),best;
  while(lo<=hi){
    const px=Math.floor((lo+hi)/2),step=px*1.13;
    measurement.font=font(style,px);
    if(words.some(word=>measurement.measureText(word).width>rect.w)){hi=px-1;continue;}
    const lines=wrap(text,rect.w);
    if(step*lines.length<=rect.h){best={px,step,lines};lo=px+1;}
    else hi=px-1;
  }
  if(best)return best;
  measurement.font=font(style,1);
  return {px:1,step:1.13,lines:wrap(text,rect.w)};
}
export function layout(state,size=state.size,kind=state.kind,platform=state.platform){
  const [w,h]=sizes[size]||sizes.Square,style=styles.find(s=>s.id===state.style)||styles[0];
  const zone=safeZone(platform,kind,size),rects=rectangles(w,h,zone,state.attachment);
  const blocks=pointBlocks(state.text?.trim()||"Your post starts here.",kind);
  const occurrences=new Map(),pages=[],metrics=[];
  for(const text of blocks){
    const ceiling=Math.min(w,h)*(text.length<65?.12:text.length<160?.088:.066);
    const {lines,px,step}=fitBlock(text,rects.textRect,style,ceiling);
    pages.push(lines);metrics.push({key:slideKey(text,occurrences),px,step});
  }
  return {w,h,size,kind,platform,style,zone,pages,metrics,...rects};
}
function drawGuide(c,plan){
  const {safe,w,h}=plan;
  c.save();c.fillStyle="rgba(18,25,55,.31)";
  c.beginPath();c.rect(0,0,w,h);c.rect(safe.x,safe.y,safe.w,safe.h);c.fill("evenodd");
  c.strokeStyle="#fff";c.lineWidth=Math.max(2,w/430);c.setLineDash([w*.012,w*.008]);
  c.strokeRect(safe.x,safe.y,safe.w,safe.h);c.restore();
}
export function render(canvas,state,plan=layout(state),index=0,fade=1,output=null,guide=false){
  const {w,h,safe,headerH,footerH,mediaRect,textRect,style,pages}=plan;
  const ow=output?.[0]||output?.w||output?.width||w,oh=output?.[1]||output?.h||output?.height||h;
  if(canvas.width!==ow)canvas.width=ow;
  if(canvas.height!==oh)canvas.height=oh;
  const c=canvas.getContext("2d");
  c.save();c.setTransform(ow/w,0,0,oh/h,0,0);background(c,style,w,h);
  const i=Math.max(0,Math.min(index,pages.length-1));
  c.fillStyle=style.color;c.strokeStyle=style.color;c.globalAlpha=fade;
  c.textAlign="left";c.textBaseline="middle";
  const r=headerH*.39,ay=safe.y+headerH*.5,ax=safe.x+r;
  c.beginPath();c.arc(ax,ay,r,0,Math.PI*2);c.fill();
  if(state.avatar&&state.avatar===avatarKey&&avatarImage){
    c.save();c.clip();c.drawImage(avatarImage,safe.x,ay-r,r*2,r*2);c.restore();
  }else star(c,ax,ay,r*.67,style.base);
  const nameX=safe.x+r*2.6,nameW=safe.w-r*2.6;
  c.font="bold "+headerH*.37+"px Arial";c.fillText(state.author||"Studio Notes",nameX,ay-headerH*.16,nameW);
  c.font=headerH*.29+"px Arial";c.fillText(state.handle||"@studionotes",nameX,ay+headerH*.21,nameW);
  const {px,step}=plan.metrics[i],lines=pages[i];
  c.font=font(style,px);c.textBaseline="top";
  const start=textRect.y+(textRect.h-step*lines.length)/2;
  lines.forEach((line,n)=>c.fillText(line,textRect.x,start+n*step,textRect.w));
  if(mediaRect&&state.attachment?.element){
    const e=state.attachment.element;
    if(typeof e.readyState!=="number"||e.readyState>=2)c.drawImage(e,mediaRect.x,mediaRect.y,mediaRect.w,mediaRect.h);
  }
  const fy=safe.y+safe.h-footerH;
  c.globalAlpha=.76*fade;c.lineWidth=Math.min(w,h)*.0015;c.beginPath();c.moveTo(safe.x,fy);c.lineTo(safe.x+safe.w,fy);c.stroke();
  c.textBaseline="middle";c.font="bold "+footerH*.39+"px monospace";
  c.fillText((state.author||"Studio Notes").toUpperCase(),safe.x,fy+footerH*.58,safe.w*.65);
  c.textAlign="right";c.fillText(String(i+1).padStart(2,"0")+" / "+String(pages.length).padStart(2,"0"),safe.x+safe.w,fy+footerH*.58,safe.w*.29);
  c.globalAlpha=1;if(guide)drawGuide(c,plan);c.restore();
}
