const imageTypes = new Set(["image/jpeg","image/png","image/webp","image/avif","image/gif","image/bmp"]);
const videoTypes = new Set(["video/mp4","video/webm","video/quicktime","video/ogg","video/x-m4v"]);
export function releaseAttachment(asset) {
  if (!asset) return;
  if (asset.type === "video") {
    asset.element.pause();
    asset.element.removeAttribute("src");
    asset.element.load();
  }
  URL.revokeObjectURL(asset.url);
}
export async function openAttachment(file, signal) {
  signal?.throwIfAborted();
  if (!(file instanceof Blob) || !file.size || file.size > 100*1024*1024)
    throw Error("Choose a nonempty image or video up to 100 MB.");
  const mime=file.type.toLowerCase().split(";")[0];
  const type=imageTypes.has(mime) ? "image" : videoTypes.has(mime) ? "video" : "";
  if (!type) throw Error("Choose a JPG, PNG, WebP, AVIF, GIF, BMP, MP4, MOV, Ogg or WebM file.");
  const element=document.createElement(type === "video" ? "video" : "img");
  const asset={file,element,type,url:URL.createObjectURL(file),name:file.name || "Attachment"};
  if (type === "video") {
    element.playsInline=true; element.muted=true; element.preload="auto";
  }
  try {
    await new Promise((ok,no)=>{
      const ready=type==="video" ? "loadeddata":"load";
      const finish=(fn,v)=>{
        clearTimeout(timer);
        element.removeEventListener(ready,loaded);
        element.removeEventListener("error",failed);
        signal?.removeEventListener("abort",cancel);
        fn(v);
      };
      const loaded=()=>finish(ok);
      const failed=()=>finish(no,Error("Your browser could not decode this media. Try a different format."));
      const cancel=()=>finish(no,signal.reason);
      const timer=setTimeout(failed,20000);
      element.addEventListener(ready,loaded,{once:true});
      element.addEventListener("error",failed,{once:true});
      signal?.addEventListener("abort",cancel,{once:true});
      element.src=asset.url;
    });
    asset.width=element.videoWidth || element.naturalWidth;
    asset.height=element.videoHeight || element.naturalHeight;
    if (!asset.width || !asset.height || asset.width*asset.height>80000000) throw Error("Use media with visible dimensions under 80 megapixels.");
    return asset;
  } catch(error) {releaseAttachment(asset);throw error;}
}
export async function draftMedia(id, op, file) {
  if (!id || !["get","put","delete"].includes(op)) throw Error("Invalid draft media operation.");
  if (op==="put" && !(file instanceof Blob)) throw Error("No file to save.");
  const db=await new Promise((ok,no)=>{
    const req=indexedDB.open("tweet-studio-draft-media",1);
    req.onupgradeneeded=()=>req.result.createObjectStore("attachments");
    req.onsuccess=()=>ok(req.result);
    req.onerror=()=>no(req.error);
  });
  try {
    return await new Promise((ok,no)=>{
      const tx=db.transaction("attachments",op==="get"?"readonly":"readwrite");
      const store=tx.objectStore("attachments");
      const req=op==="put"?store.put(file,id):store[op](id);
      tx.oncomplete=()=>ok(op==="get"?req.result??null:undefined);
      tx.onabort=tx.onerror=()=>no(tx.error||Error("Draft storage is unavailable."));
    });
  } finally {db.close();}
}
