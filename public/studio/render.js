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
];
export const platforms = {
  Instagram: {
    Post: ["Square", "Portrait", "Story"],
    Carousel: ["Square", "Portrait"],
    Reel: ["Vertical"],
  },
  Facebook: {
    Post: ["Square", "Landscape", "Portrait"],
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
  return (
    (serif(style) ? "500 " : "700 ") +
    px +
    "px " +
    (serif(style) ? "Georgia,serif" : "Arial,sans-serif")
  );
}
function background(c, s, w, h) {
  c.fillStyle = s.base;
  c.fillRect(0, 0, w, h);
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
const measure = document.createElement("canvas").getContext("2d");
export function wrap(text, width) {
  const out = [];
  for (const para of text.split(/\r?\n/)) {
    let line = "";
    for (const word of para.trim().split(/\s+/).filter(Boolean)) {
      const candidate = line ? line + " " + word : word;
      if (measure.measureText(candidate).width <= width) {
        line = candidate;
        continue;
      }
      if (line) {
        out.push(line);
        line = "";
      }
      for (const ch of word) {
        if (line && measure.measureText(line + ch).width > width) {
          out.push(line);
          line = "";
        }
        line += ch;
      }
    }
    out.push(line);
  }
  return out;
}
export function layout(state, size = state.size, kind = state.kind) {
  const [w, h] = sizes[size],
    style = styles.find((s) => s.id === state.style) || styles[0];
  const src = state.text.trim() || "Your post starts here.";
  let segments = [src];
  if (kind === "Carousel" || kind === "Reel") {
    const blocks = src.split(/\n\s*\n|(?<=[.!?。！？])\s+/u).filter(Boolean);
    if (blocks.length > 1) segments = blocks;
    else {
      const words = src.split(/\s+/);
      if (words.length > 3) {
        const cut = Math.ceil(words.length / 2);
        segments = [words.slice(0, cut).join(" "), words.slice(cut).join(" ")];
      }
    }
  }
  const base = Math.min(w, h),
    pad = w * 0.085,
    available = h * 0.65;
  let px = base * (src.length < 60 ? 0.125 : src.length < 155 ? 0.089 : 0.058);
  if (kind === "Carousel") px = Math.max(px, base * 0.082);
  const pages = [],
    step = px * 1.08,
    max = Math.max(1, Math.floor(available / step));
  measure.font = font(style, px);
  for (const block of segments) {
    const lines = wrap(block, w - pad * 2);
    for (let i = 0; i < lines.length; i += max)
      pages.push(lines.slice(i, i + max));
  }
  return { pages, px, step, pad, w, h, style };
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
export function render(
  canvas,
  state,
  plan = layout(state),
  index = 0,
  fade = 1,
) {
  const { w, h, pad, style, px, step, pages } = plan;
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  const c = canvas.getContext("2d");
  background(c, style, w, h);
  c.save();
  c.fillStyle = style.color;
  c.globalAlpha = fade;
  c.textAlign = "left";
  c.textBaseline = "middle";
  const unit = Math.min(w, h),
    r = unit * 0.031,
    ay = h * 0.105;
  c.beginPath();
  c.arc(pad + r, ay, r, 0, Math.PI * 2);
  c.fill();
  if (state.avatar && state.avatar === avatarKey && avatarImage) {
    c.save();
    c.clip();
    c.drawImage(avatarImage, pad, ay - r, 2 * r, 2 * r);
    c.restore();
  } else star(c, pad + r, ay, r * 0.67, style.base);
  c.font = "bold " + unit * 0.025 + "px Arial";
  c.fillText(
    state.author || "Studio Notes",
    pad + 2.5 * r,
    ay - unit * 0.014,
    w * 0.61,
  );
  c.font = unit * 0.021 + "px Arial";
  c.fillText(
    state.handle || "@studionotes",
    pad + 2.5 * r,
    ay + unit * 0.017,
    w * 0.61,
  );
  const lines = pages[index] || pages[0];
  c.font = font(style, px);
  c.textBaseline = "top";
  const start = Math.max(h * 0.205, (h - step * lines.length) * 0.48);
  lines.forEach((line, n) =>
    c.fillText(line, pad, start + step * n, w - 2 * pad),
  );
  c.globalAlpha = 0.68 * fade;
  c.strokeStyle = style.color;
  c.lineWidth = unit * 0.0015;
  c.beginPath();
  c.moveTo(pad, h * 0.88);
  c.lineTo(w - pad, h * 0.88);
  c.stroke();
  c.fillStyle = style.color;
  c.textBaseline = "middle";
  c.font = "bold " + unit * 0.019 + "px monospace";
  c.fillText(
    (state.author || "Studio Notes").toUpperCase(),
    pad,
    h * 0.924,
    w * 0.61,
  );
  c.textAlign = "right";
  c.fillText(
    String(index + 1).padStart(2, "0") +
      " / " +
      String(pages.length).padStart(2, "0"),
    w - pad,
    h * 0.924,
  );
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
