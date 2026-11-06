const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const SOURCE_ORIGIN = process.env.SOURCE_ORIGIN || "https://pro.ss-data.cc";
const ASSET_BASE = "8a95efdc6bf73434edc800f81d9124e3fc5ca5c5adbe051a4252ad61bf64e5f4";
const READER_ROOT = path.join(ROOT, "public", "assets", "knowledge-reader", ASSET_BASE);
const SOURCE_ROOT = `${SOURCE_ORIGIN}/knowledge-reader/${ASSET_BASE}/`;

const MATHJAX_FONTS = [
  "MathJax_AMS-Regular.woff",
  "MathJax_Calligraphic-Bold.woff",
  "MathJax_Calligraphic-Regular.woff",
  "MathJax_Fraktur-Bold.woff",
  "MathJax_Fraktur-Regular.woff",
  "MathJax_Main-Bold.woff",
  "MathJax_Main-Italic.woff",
  "MathJax_Main-Regular.woff",
  "MathJax_Math-BoldItalic.woff",
  "MathJax_Math-Italic.woff",
  "MathJax_SansSerif-Bold.woff",
  "MathJax_SansSerif-Italic.woff",
  "MathJax_SansSerif-Regular.woff",
  "MathJax_Script-Regular.woff",
  "MathJax_Size1-Regular.woff",
  "MathJax_Size2-Regular.woff",
  "MathJax_Size3-Regular.woff",
  "MathJax_Size4-Regular.woff",
  "MathJax_Typewriter-Regular.woff",
  "MathJax_Vector-Bold.woff",
  "MathJax_Vector-Regular.woff",
  "MathJax_Zero.woff"
];

const READER_ASSETS = [
  "worker.js",
  "sim.js",
  "lib/prism.min.js",
  "lib/pixi.min.js",
  "lib/mermaid.min.js",
  "lib/mathjax/tex-chtml-full.js",
  "lib/codemirror/modes.min.js",
  "lib/pdfjs/pdf.min.mjs",
  "lib/pdfjs/pdf.viewer.min.mjs",
  "lib/pdfjs/pdf.worker.min.mjs",
  ...MATHJAX_FONTS.map((font) => `lib/mathjax/output/chtml/fonts/woff-v2/${font}`)
];

async function download(relativePath) {
  const response = await fetch(SOURCE_ROOT + relativePath, {
    headers: {
      "user-agent": "BigDataNavigator-ReaderAssets/1.0"
    },
    signal: AbortSignal.timeout(45000)
  });
  if (!response.ok) {
    throw new Error(`${relativePath}: HTTP ${response.status}`);
  }

  const body = Buffer.from(await response.arrayBuffer());
  if (body.length === 0) {
    throw new Error(`${relativePath}: empty response`);
  }
  if (/\.(?:js|mjs)$/i.test(relativePath)) {
    const text = body.toString("utf8", 0, Math.min(body.length, 200));
    if (/^\s*<!doctype html/i.test(text) || /^\s*<html[\s>]/i.test(text)) {
      throw new Error(`${relativePath}: received HTML instead of JavaScript`);
    }
  }

  const target = path.join(READER_ROOT, ...relativePath.split("/"));
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, body);
  return body.length;
}

async function main() {
  let totalBytes = 0;
  for (const relativePath of READER_ASSETS) {
    totalBytes += await download(relativePath);
    console.log(`Synced ${relativePath}`);
  }
  console.log(`Reader assets complete: ${READER_ASSETS.length} files, ${totalBytes} bytes.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
