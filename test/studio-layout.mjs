import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import test from 'node:test';

// Use native text metrics when installed. Geometry tests also run in plain Node.
const require = createRequire(import.meta.url);
let nativeCanvas;
const candidates = ['@napi-rs/canvas'];
if (process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES) {
  candidates.push(join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES, '@napi-rs/canvas'));
}
for (const name of candidates) {
  try {
    nativeCanvas = require(name);
    break;
  } catch (error) {
    if (error.code !== 'MODULE_NOT_FOUND') throw error;
  }
}
function canvas(width = 1, height = 1) {
  if (nativeCanvas) return nativeCanvas.createCanvas(width, height);
  const metrics = {
    font: '16px sans-serif',
    measureText(text) {
      const px = Number(this.font.match(/([\d.]+)px/)[1]);
      return { width: Array.from(text).length * px * 0.55 };
    },
  };
  return { width, height, getContext: () => metrics };
}
globalThis.document = {
  createElement(tag) {
    assert.equal(tag, 'canvas');
    return canvas();
  },
};
const { layout, render, platforms, sizes, dimensions, durationFor } = await import('../public/studio/render.js');

// Regression fixture transcribed from the user's two screenshots.
const heading = 'DeepSeek V5 beat Opus 5.5 :';
const points = [
  'First major pretraining run planned on Huawei Ascend chips',
  'DeepSeek V5 is reportedly the first major Chinese frontier model being pretrained from scratch on Huawei Ascend 950 chips instead of Nvidia GPUs.',
  'Powering with RSI',
  'Supply-chain sources say the plan includes a massive new cluster in Inner Mongolia (160,000+ Ascend chips) with Huawei engineers embedded inside DeepSeek.',
];
const state = {
  author: 'Md Ismail Sojal', handle: '@0xSojalSec',
  text: heading + '\n\n' + points.map((point) => '- ' + point).join('\n'),
  style: 'cobalt', platform: 'Instagram', kind: 'Post', size: 'Square',
};
function pageTexts(plan) {
  return plan.pages.map((lines) => lines.join(' ').trim().replace(/^[-–•]\s*/, '').replace(/\s+/g, ' '));
}
const image = canvas(320, 240);
const attached = { ...state, attachment: { type: 'image', element: image, width: 320, height: 240 } };
function insideSafeZone(rect, plan) {
  const { w, h, zone } = plan;
  const tolerance = 1;
  assert.ok(rect.w > 0 && rect.h > 0);
  assert.ok(rect.x >= w * zone.left - tolerance);
  assert.ok(rect.y >= h * zone.top - tolerance);
  assert.ok(rect.x + rect.w <= w * (1 - zone.right) + tolerance);
  assert.ok(rect.y + rect.h <= h * (1 - zone.bottom) + tolerance);
}

test('the two screenshots produce a heading and four complete bullet slides', () => {
  assert.deepEqual(pageTexts(layout(state)), [heading, ...points]);
});

test('every supported format keeps bullets intact and within its safe area', () => {
  for (const [platform, kinds] of Object.entries(platforms)) {
    for (const [kind, formats] of Object.entries(kinds)) {
      for (const size of formats) {
        const plan = layout({ ...state, platform, kind, size });
        const format = [platform, kind, size].join(' ');
        assert.deepEqual(pageTexts(plan), [heading, ...points], format);
        insideSafeZone(plan.textRect, plan);
        for (const [index, lines] of plan.pages.entries()) {
          const { step, px } = plan.metrics[index];
          assert.ok((lines.length - 1) * step + px <= plan.textRect.h + 1,
            'Text clipped in ' + format + ', slide ' + (index + 1));
        }
      }
    }
  }
});

test('an attachment gets a separate media area and preserves all the text', () => {
  for (const size of Object.keys(sizes)) {
    const plain = layout({ ...state, size });
    const plan = layout({ ...attached, size });
    assert.equal(plain.mediaRect, null);
    assert.notDeepEqual(plan.textRect, plain.textRect);
    insideSafeZone(plan.textRect, plan);
    insideSafeZone(plan.mediaRect, plan);
    const a = plan.textRect, b = plan.mediaRect;
    assert.ok(a.x + a.w <= b.x + 1 || b.x + b.w <= a.x + 1 || a.y + a.h <= b.y + 1 || b.y + b.h <= a.y + 1,
      'Overlapping media and text in ' + size);
    assert.deepEqual(pageTexts(plan), [heading, ...points]);
  }
});

test('the same vertical reel is positioned for each destination’s controls', () => {
  const reel = { ...state, kind: 'Reel', size: 'Vertical' };
  const instagram = layout({ ...reel, platform: 'Instagram' });
  const youtube = layout({ ...reel, platform: 'YouTube' });
  assert.notDeepEqual(instagram.textRect, youtube.textRect);
  assert.deepEqual(pageTexts(instagram), pageTexts(youtube));
});

test('editing another bullet preserves the original bullet’s custom timing', () => {
  const reel = { ...state, kind: 'Reel', size: 'Vertical', seconds: 2.5 };
  const { metrics } = layout(reel);
  const timed = { ...reel, durations: { [metrics[2].key]: 5.5 } };
  assert.equal(durationFor(timed, metrics[1].key), 2.5);
  const updated = layout({ ...timed, text: timed.text.replace(points[0], 'Updated first point.') });
  assert.equal(durationFor(timed, updated.metrics[2].key), 5.5);
});

test('4K uses a 3840-pixel long edge and preserves each aspect ratio', () => {
  for (const [size, [w, h]] of Object.entries(sizes)) {
    const [width, height] = dimensions(size, '4k');
    assert.equal(Math.max(width, height), 3840, size);
    assert.ok(Math.abs(width - height * w / h) <= 2, size);
  }
});

test('4K landscape and vertical frames actually contain the attached image', {
  skip: !nativeCanvas && 'Native canvas is optional for pixel checks',
}, () => {
  const sample = image.getContext('2d');
  sample.fillStyle = '#ff00ff';
  sample.fillRect(0, 0, image.width, image.height);
  for (const size of ['Landscape', 'Vertical']) {
    const variant = { ...attached, size };
    const out = canvas();
    const plan = layout(variant);
    const wanted = dimensions(size, '4k');
    render(out, variant, plan, 0, 1, wanted);
    assert.deepEqual([out.width, out.height], wanted);
    const { x, y, w, h } = plan.mediaRect;
    const cx = Math.floor((x + w / 2) * out.width / plan.w);
    const cy = Math.floor((y + h / 2) * out.height / plan.h);
    const pixel = out.getContext('2d').getImageData(cx, cy, 1, 1).data;
    assert.ok(pixel[0] > 240 && pixel[1] < 15 && pixel[2] > 240, 'Attachment missing from ' + size);
  }
});
