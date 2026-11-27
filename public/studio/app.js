import {
  styles,
  platforms,
  sizes,
  thumbnail,
  loadArt,
  loadAvatar,
  layout,
  render,
} from "./render.js";
import { exportSet, videoType } from "./export.js";
const $ = (id) => document.getElementById(id);
const paths = {
  studio: "M4 4h7v7H4z M14 4h6v4h-6z M14 11h6v9h-6z M4 14h7v6H4z",
  grid: "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z",
  folder: "M3 7V5h6l2 2h10v12H3z",
  film: "M4 7h16v13H4z M4 7l-1-4 16-2 1 5z M7 3l3 3 M12 2l3 3",
  help: "M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0 M9 9a3 3 0 0 1 6 0c0 2-3 2-3 5 M12 17h.01",
  panel: "M3 4h18v16H3z M9 4v16",
  lock: "M5 10h14v11H5z M8 10V7a4 4 0 0 1 8 0v3",
  bookmark: "M6 3h12v18l-6-4-6 4z",
  download: "M12 3v12 M7 10l5 5 5-5 M4 16v4h16v-4",
  sliders: "M4 6h8m4 0h4 M4 12h2m4 0h10 M4 18h10m4 0h2 M12 3v6 M8 9v6 M16 15v6",
  link: "M10 14l4-4 M8 16l-1 1a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0 M16 8l1-1a4 4 0 1 1 6 6l-4 4a4 4 0 0 1-6 0",
  type: "M3 7V4h18v3 M12 4v16 M8 20h8",
  import: "M12 3v12 M7 10l5 5 5-5 M3 15v5h18v-5",
  square: "M4 4h16v16H4z",
  layers: "M7 3h14v14H7z M3 7v14h14",
  instagram:
    "M7 3h10a4 4 0 0 1 4 4v10a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V7a4 4 0 0 1 4-4z M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0 M17.5 6.5h.01",
  ratio: "M3 5h18v14H3z M6 10V8h3 M18 14v2h-3",
  eye: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0",
  frame: "M8 3H3v5 M16 3h5v5 M21 16v5h-5 M3 16v5h5",
  left: "M14 6l-6 6 6 6",
  right: "M10 6l6 6-6 6",
  expand: "M14 3h7v7 M21 3l-7 7 M10 21H3v-7 M3 21l7-7",
  close: "M5 5l14 14 M19 5L5 19",
  check: "M4 12l5 5L20 6",
  globe:
    "M22 12A10 10 0 1 1 2 12a10 10 0 0 1 20 0 M2 12h20 M12 2c-6 6-6 14 0 20 6-6 6-14 0-20",
};
function icon(name) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg"),
    p = document.createElementNS(svg.namespaceURI, "path");
  Object.entries({
    viewBox: "0 0 24 24",
    class: "ico",
    fill: "none",
    stroke: "currentColor",
    "stroke-width": "1.65",
    "stroke-linecap": "round",
    "stroke-linejoin": "round",
    "aria-hidden": "true",
  }).forEach(([k, v]) => svg.setAttribute(k, v));
  p.setAttribute("d", paths[name]);
  svg.append(p);
  return svg;
}
document.querySelectorAll("[data-i]").forEach((el) => {
  const s = icon(el.dataset.i);
  if (el.id) s.id = el.id;
  el.replaceWith(s);
});
const defaultState = {
  text: "Good ideas deserve a second life.",
  author: "Studio Notes",
  handle: "@studionotes",
  platform: "Instagram",
  kind: "Post",
  size: "Square",
  style: "cobalt",
  sample: true,
};
let state = { ...defaultState },
  page = 0,
  all = false,
  plan,
  importRun = 0,
  controller,
  job,
  toastTimer;
const canvas = $("canvas"),
  modal = $("modal");
function elt(tag, txt, cls) {
  const e = document.createElement(tag);
  if (txt !== undefined) e.textContent = txt;
  if (cls) e.className = cls;
  return e;
}
function btn(txt, fn, cls = "btn") {
  const b = elt("button", txt, cls);
  b.type = "button";
  b.addEventListener("click", fn);
  return b;
}
function notice(t) {
  $("toast").textContent = t;
  $("toast").hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ($("toast").hidden = true), 3300);
}
function msg(t = "") {
  $("message").textContent = t;
  $("message").hidden = !t;
}
function open(title) {
  if (modal.open) modal.close();
  $("dialogTitle").textContent = title;
  const b = $("dialogBody");
  b.replaceChildren();
  modal.showModal();
  return b;
}
$("close").onclick = () => modal.close();
modal.addEventListener("click", (e) => {
  if (e.target === modal) {
    const r = modal.getBoundingClientRect();
    if (
      e.clientX < r.left ||
      e.clientX > r.right ||
      e.clientY < r.top ||
      e.clientY > r.bottom
    )
      modal.close();
  }
});
modal.addEventListener("close", () => {
  if (job) job.abort();
});
function mode(m) {
  document
    .querySelectorAll("[data-mode]")
    .forEach((b) => b.setAttribute("aria-pressed", b.dataset.mode === m));
  $("linkPanel").hidden = m !== "link";
  $("textPanel").hidden = m !== "text";
  msg();
  if (m === "text") {
    controller?.abort();
    importRun++;
    $("import").disabled = false;
  }
}
function paint() {
  plan = layout(state);
  page = Math.min(page, plan.pages.length - 1);
  render(canvas, state, plan, page);
  canvas.setAttribute(
    "aria-label",
    state.style + " design. " + plan.pages[page].join(" "),
  );
  $("counter").textContent = page + 1 + " / " + plan.pages.length;
  $("dimension").textContent = plan.w + " × " + plan.h + " px";
  $("prev").disabled = page === 0;
  $("next").disabled = page + 1 >= plan.pages.length;
  $("sample").textContent = state.sample
    ? "Sample design"
    : styles.find((s) => s.id === state.style).name;
}
function sync() {
  if (state.avatar)
    loadAvatar(state.avatar).then((ok) => {
      if (ok) paint();
    });
  document
    .querySelectorAll("[data-kind]")
    .forEach((b) =>
      b.setAttribute("aria-pressed", b.dataset.kind === state.kind),
    );
  const pp = Object.keys(platforms).filter((p) => platforms[p][state.kind]);
  if (!pp.includes(state.platform)) state.platform = pp[0];
  $("platform").replaceChildren(...pp.map((p) => new Option(p, p)));
  $("platform").value = state.platform;
  const preset = platforms[state.platform][state.kind];
  if (!preset.includes(state.size)) state.size = preset[0];
  $("size").replaceChildren(
    ...preset.map((k) => new Option(k + " · " + sizes[k].join(" × "), k)),
  );
  $("size").value = state.size;
  const pi = icon(state.platform === "Instagram" ? "instagram" : "globe");
  pi.id = "platformIcon";
  $("platformIcon").replaceWith(pi);
  $("copy").value = state.text;
  $("author").value = state.author;
  $("handle").value = state.handle;
  paint();
  gallery();
}
function gallery() {
  $("cards").replaceChildren();
  let chosen = all ? styles : styles.slice(0, 4);
  if (!all && !chosen.some((s) => s.id === state.style))
    chosen = [...chosen.slice(0, 3), styles.find((s) => s.id === state.style)];
  for (const s of chosen) {
    const b = btn(
      "",
      () => {
        state.style = s.id;
        paint();
        gallery();
      },
      "template",
    );
    b.setAttribute("aria-pressed", s.id === state.style);
    const c = elt("canvas");
    c.setAttribute("aria-hidden", "true");
    thumbnail(c, s);
    b.append(c, elt("strong", s.name), elt("small", s.family));
    if (s.id === state.style) {
      const t = elt("span", undefined, "tick");
      t.append(icon("check"));
      b.append(t);
    }
    $("cards").append(b);
  }
  $("allTemplates").replaceChildren(
    document.createTextNode(all ? "Show featured" : "View all styles"),
    icon("grid"),
  );
}
$("allTemplates").onclick = () => {
  all = !all;
  gallery();
};
document
  .querySelectorAll("[data-mode]")
  .forEach((b) => (b.onclick = () => mode(b.dataset.mode)));
document.querySelectorAll("[data-kind]").forEach(
  (b) =>
    (b.onclick = () => {
      state.kind = b.dataset.kind;
      page = 0;
      sync();
    }),
);
$("platform").onchange = (e) => {
  state.platform = e.target.value;
  page = 0;
  sync();
};
$("size").onchange = (e) => {
  state.size = e.target.value;
  page = 0;
  paint();
};
for (const [id, key] of [
  ["copy", "text"],
  ["author", "author"],
  ["handle", "handle"],
])
  $(id).oninput = (e) => {
    if (key === "text" && state.sample) {
      state.author = "Your account";
      state.handle = "@yourhandle";
      $("author").value = state.author;
      $("handle").value = state.handle;
    }
    state[key] = e.target.value;
    state.sample = false;
    page = 0;
    paint();
  };
$("prev").onclick = () => {
  page--;
  paint();
};
$("next").onclick = () => {
  page++;
  paint();
};
$("expand").onclick = () => {
  const b = open("Design preview"),
    c = elt("canvas", undefined, "largepreview");
  render(c, state, plan, page);
  c.setAttribute("aria-label", canvas.getAttribute("aria-label"));
  b.append(c);
};
$("importForm").onsubmit = async (e) => {
  e.preventDefault();
  let u;
  try {
    u = new URL($("link").value);
  } catch {}
  const match = u?.pathname.match(
    /^\/(?:([A-Za-z0-9_]{1,15})\/status|i\/web\/status)\/(\d{1,20})(?:\/|$)/,
  );
  if (
    !u ||
    ![
      "x.com",
      "www.x.com",
      "twitter.com",
      "www.twitter.com",
      "mobile.twitter.com",
    ].includes(u.hostname) ||
    u.protocol !== "https:" ||
    !match
  ) {
    msg("Enter a public X or Twitter status link.");
    return;
  }
  controller?.abort();
  controller = new AbortController();
  const n = ++importRun;
  $("import").disabled = true;
  msg("Importing public post…");
  try {
    const r = await fetch(
      "/api/tweet?" +
        new URLSearchParams({ handle: match[1] || "i", id: match[2] }),
      { signal: controller.signal },
    );
    if (!r.ok)
      throw Error(
        "This post could not be imported. Check that it is public, or paste its text.",
      );
    const d = await r.json();
    if (typeof d.text !== "string" || !d.text.trim())
      throw Error("No readable post text was returned.");
    if (n !== importRun) return;
    Object.assign(state, {
      text: d.text,
      author: String(d.authorName || ""),
      handle: String(d.handle || ""),
      avatar: d.avatar || "",
      sourceUrl: "https://x.com/" + (match[1] || "i") + "/status/" + match[2],
      sample: false,
    });
    page = 0;
    mode("text");
    sync();
    notice("Post imported");
  } catch (err) {
    if (n === importRun) msg(err.message);
  } finally {
    if (n === importRun) $("import").disabled = false;
  }
};
const key = "tweetstudio.designs.v1";
function read() {
  try {
    const x = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(x)
      ? x.filter(
          (d) =>
            d &&
            typeof d.name === "string" &&
            typeof d.state?.text === "string" &&
            styles.some((s) => s.id === d.state.style) &&
            platforms[d.state.platform]?.[d.state.kind]?.includes(d.state.size),
        )
      : [];
  } catch {
    return [];
  }
}
function write(items) {
  try {
    localStorage.setItem(key, JSON.stringify(items));
    return true;
  } catch {
    notice("Device storage is unavailable or full.");
    return false;
  }
}
$("save").onclick = () => {
  if (!state.text.trim()) {
    notice("Add post text first.");
    return;
  }
  const b = open("Save design");
  b.append(
    elt(
      "p",
      "Saved designs are stored in this browser. Anyone using this browser profile can open them.",
    ),
  );
  const l = elt("label", "Design name"),
    i = elt("input", undefined, "dialoginput");
  l.htmlFor = i.id = "draftName";
  i.value = state.text.slice(0, 55);
  i.maxLength = 80;
  const save = () => {
    const d = read();
    if (d.length >= 40) {
      notice("Remove a saved design before adding another.");
      return;
    }
    if (!i.value.trim()) {
      i.focus();
      return;
    }
    if (
      write([
        { id: crypto.randomUUID(), name: i.value.trim(), state: { ...state } },
        ...d,
      ])
    ) {
      modal.close();
      notice("Design saved on this device");
    }
  };
  b.append(l, i, btn("Save design", save, "btn primary dialogactions"));
  i.onkeydown = (e) => {
    if (e.key === "Enter") save();
  };
  i.focus();
  i.select();
};
function saved() {
  const b = open("Saved designs"),
    list = read();
  if (!list.length)
    b.append(
      elt("p", "Save a design from the studio to find it here on this device."),
    );
  list.forEach((d) => {
    const row = elt("div", undefined, "studioitem"),
      label = elt("div");
    label.append(
      elt("strong", d.name),
      elt("small", d.state.platform + " · " + d.state.kind),
    );
    row.append(
      label,
      btn("Open", () => {
        state = { ...defaultState, ...d.state };
        page = 0;
        mode("text");
        sync();
        modal.close();
      }),
      btn("Remove", () => {
        const box = open("Remove design?");
        box.append(
          elt("p", d.name),
          btn("Remove from this device", () => {
            if (write(read().filter((i) => i.id !== d.id))) saved();
          }),
        );
      }),
    );
    b.append(row);
  });
}
$("saved").onclick = saved;
$("help").onclick = () => {
  const b = open("Studio guide");
  for (const [h, t] of [
    [
      "Bring in one source",
      "Import a public X link or choose Write text to edit the sample and author.",
    ],
    [
      "Choose the output",
      "Post makes graphics. Carousel divides your text into slides. Reel turns your slides into a silent vertical video. For uploaded footage, original X media, or classic templates, use the media composer.",
    ],
    [
      "Export a platform pack",
      "Select one or more platforms in Export. Multiple files download together as a ZIP. LinkedIn carousels export as PDF.",
    ],
    [
      "Your drafts",
      "Edits and rendering stay in this tab. Save design stores a copy in this browser profile. Only public post identifiers go to the import service.",
    ],
  ])
    b.append(elt("h3", h), elt("p", t));
  const a = elt("a", "Open media composer", "btn");
  a.href = "/classic";
  b.append(a);
};
$("export").onclick = () => {
  if (!state.text.trim()) {
    notice("Add post text first.");
    return;
  }
  const b = open("Export " + state.kind.toLowerCase()),
    targets = Object.keys(platforms).filter((p) => platforms[p][state.kind]),
    checks = [];
  const kind = state.kind;
  b.append(
    elt(
      "p",
      kind === "Reel"
        ? "Export a silent, 9:16 video in " +
            (videoType().includes("mp4") ? "MP4" : "WebM when supported") +
            ". Keep this tab visible during recording."
        : "Choose the platforms to include. Multiple files download together as a ZIP.",
    ),
  );
  for (const p of targets) {
    const l = elt("label", undefined, "choice"),
      input = elt("input");
    input.type = "checkbox";
    input.checked = p === state.platform;
    input.value = p;
    checks.push(input);
    const preset = platforms[p][kind],
      size =
        p === state.platform && preset.includes(state.size)
          ? state.size
          : preset[0];
    l.append(
      input,
      document.createTextNode(
        p +
          " · " +
          sizes[size].join(" × ") +
          (p === "LinkedIn" && kind === "Carousel" ? " · PDF" : ""),
      ),
    );
    b.append(l);
  }
  const pack = elt("input");
  pack.type = "checkbox";
  const packRow = elt("label", undefined, "choice");
  packRow.append(
    pack,
    document.createTextNode(
      "Include all supported formats (post, carousel and reel)",
    ),
  );
  b.append(elt("hr"), packRow);
  const status = elt("p"),
    go = btn(
      "Download export",
      async () => {
        const selected = checks.filter((x) => x.checked).map((x) => x.value);
        if (!selected.length) {
          status.textContent = "Choose at least one platform.";
          return;
        }
        go.disabled = true;
        checks.forEach((c) => (c.disabled = true));
        const ctrl = new AbortController();
        job = ctrl;
        try {
          await exportSet(
            { ...state },
            selected,
            ctrl.signal,
            (t) => (status.textContent = t),
            pack.checked,
          );
          job = null;
          modal.close();
          notice("Export downloaded");
        } catch (e) {
          if (!ctrl.signal.aborted) status.textContent = e.message;
        } finally {
          if (job === ctrl) job = null;
          go.disabled = false;
          checks.forEach((c) => (c.disabled = false));
        }
      },
      "btn primary",
    );
  status.setAttribute("role", "status");
  b.append(status, go);
};
const entry = new URLSearchParams(location.search).get("tool");
const presets = {
  "tweet-to-reel": ["Instagram", "Reel", "Vertical"],
  "linkedin-carousel-maker": ["LinkedIn", "Carousel", "Portrait"],
  "pinterest-pin-maker": ["Pinterest", "Post", "Pin"],
  "youtube-shorts-maker": ["YouTube", "Reel", "Vertical"],
};
if (Object.hasOwn(presets, entry))
  [state.platform, state.kind, state.size] = presets[entry];
sync();
loadArt()
  .then(() => {
    paint();
    gallery();
  })
  .catch(() => notice("Some artwork could not load. Reload to retry."));

document.addEventListener("click", (e) => {
  const a = e.target.closest('a[href="/classic"]');
  if (!a || state.sample || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)
    return;
  try {
    sessionStorage.setItem(
      "tweetstudio.composer-input",
      JSON.stringify({
        text: state.text,
        author: state.author,
        handle: state.handle,
        sourceUrl: state.sourceUrl || "",
      }),
    );
    e.preventDefault();
    location.assign("/classic#from-studio");
  } catch {}
});
