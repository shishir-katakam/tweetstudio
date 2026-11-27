import { layout, render, platforms } from "./render.js";
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
export async function zip(files) {
  const entries = [],
    directory = [];
  let offset = 0,
    centralSize = 0;
  for (const f of files) {
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
async function slidePdf(canvas, state, plan, signal) {
  const chunks = [],
    offsets = [0];
  let pos = 0;
  function append(data) {
    const b = typeof data === "string" ? utf.encode(data) : data;
    chunks.push(b);
    pos += b.length;
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
    render(canvas, state, plan, i);
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
        plan.w +
        " /Height " +
        plan.h +
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
export function videoType() {
  return typeof MediaRecorder === "undefined"
    ? ""
    : [
        "video/mp4;codecs=avc1.42001E",
        "video/mp4",
        "video/webm;codecs=vp9",
        "video/webm",
      ].find((t) => MediaRecorder.isTypeSupported(t)) || "";
}
async function video(canvas, state, plan, signal, progress) {
  const mime = videoType();
  if (!mime || !canvas.captureStream)
    throw Error(
      "This browser cannot record a reel. Try a current desktop browser or export images.",
    );
  render(canvas, state, plan);
  const stream = canvas.captureStream(24);
  let recorder, timer;
  try {
    recorder = new MediaRecorder(stream, {
      mimeType: mime,
      videoBitsPerSecond: 4200000,
    });
    const chunks = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size) chunks.push(e.data);
    };
    const done = new Promise((ok, no) => {
      recorder.onstop = ok;
      recorder.onerror = () =>
        no(Error("Video encoding failed. Try another browser."));
    });
    const stop = () => {
      if (recorder.state !== "inactive") recorder.stop();
    };
    signal.addEventListener("abort", stop, { once: true });
    try {
      signal.throwIfAborted();
      recorder.start(500);
      const start = performance.now(),
        duration = plan.pages.length * 2600;
      timer = setInterval(() => {
        const t = performance.now() - start;
        if (t >= duration) {
          stop();
          return;
        }
        const frame = Math.min(plan.pages.length - 1, Math.floor(t / 2600));
        render(
          canvas,
          state,
          plan,
          frame,
          0.74 + 0.26 * Math.min(1, (t % 2600) / 300),
        );
        progress(
          "Recording reel · " + Math.ceil((duration - t) / 1000) + "s left",
        );
      }, 1000 / 24);
      await done;
      signal.throwIfAborted();
      if (!chunks.length)
        throw Error("The video encoder returned an empty file.");
      return new Blob(chunks, { type: mime });
    } finally {
      signal.removeEventListener("abort", stop);
      stop();
    }
  } finally {
    clearInterval(timer);
    stream.getTracks().forEach((t) => t.stop());
  }
}
async function collect(state, targets, signal, progress) {
  const files = [],
    canvas = document.createElement("canvas"),
    cache = new Map();
  let bytes = 0;
  for (const p of targets) {
    const available = platforms[p][state.kind];
    if (!available) continue;
    const size =
        p === state.platform && available.includes(state.size)
          ? state.size
          : available[0],
      plan = layout(state, size, state.kind);
    const prefix =
      p.toLowerCase() + "-" + state.kind.toLowerCase() + "-" + state.style;
    const pdf = p === "LinkedIn" && state.kind === "Carousel",
      key = size + "-" + pdf;
    if (!cache.has(key)) {
      const parts = [];
      progress("Rendering " + p + "…");
      if (state.kind === "Reel") {
        const b = await video(canvas, state, plan, signal, progress);
        parts.push({
          suffix: b.type.includes("mp4") ? ".mp4" : ".webm",
          blob: b,
        });
      } else if (pdf) {
        parts.push({
          suffix: ".pdf",
          blob: await slidePdf(canvas, state, plan, signal),
        });
      } else
        for (let i = 0; i < plan.pages.length; i++) {
          signal.throwIfAborted();
          render(canvas, state, plan, i);
          parts.push({
            suffix:
              (plan.pages.length > 1
                ? "-" + String(i + 1).padStart(2, "0")
                : "") + ".png",
            blob: await raster(canvas),
          });
        }
      cache.set(key, parts);
    }
    for (const a of cache.get(key)) {
      bytes += a.blob.size;
      if (bytes > 200 * 1024 * 1024)
        throw Error(
          "This pack exceeds 200 MB. Export fewer platforms at once.",
        );
      files.push({ name: prefix + a.suffix, blob: a.blob });
    }
  }
  signal.throwIfAborted();
  if (!files.length) throw Error("Choose a platform.");
  return files;
}
export async function exportSet(
  state,
  targets,
  signal,
  progress,
  allFormats = false,
) {
  const files = [];
  for (const kind of allFormats ? ["Post", "Carousel", "Reel"] : [state.kind]) {
    const supported = targets.filter((p) => platforms[p][kind]);
    if (!supported.length) continue;
    files.push(
      ...(await collect({ ...state, kind }, supported, signal, progress)),
    );
    if (files.reduce((n, f) => n + f.blob.size, 0) > 200 * 1024 * 1024)
      throw Error("This pack exceeds 200 MB. Export fewer platforms at once.");
  }
  signal.throwIfAborted();
  if (files.length === 1) download(files[0].blob, files[0].name);
  else {
    progress("Packing " + files.length + " files…");
    const blob = await zip(files);
    signal.throwIfAborted();
    download(
      blob,
      "tweet-studio-" +
        (allFormats ? "creator-pack" : state.kind.toLowerCase()) +
        ".zip",
    );
  }
}
