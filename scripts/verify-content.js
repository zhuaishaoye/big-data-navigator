const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const CONTENT_ROOT = path.join(ROOT, "content");
const CACHE_FILE = path.join(CONTENT_ROOT, "cache.json");
const ARTICLES_ROOT = path.join(CONTENT_ROOT, "articles");
const RESOURCES_ROOT = path.join(CONTENT_ROOT, "resources");
const MANIFEST_FILE = path.join(CONTENT_ROOT, "sync-manifest.json");
const LOCAL_ONLY_PATHS = new Set(["网站素材/logo-mark.svg", "favicon-192x192.svg"]);
const LOCAL_ASSETS = new Map([
  ["网站素材/logo-mark.svg", path.join(ROOT, "assets", "logo-navigator-mark.svg")],
  ["favicon-192x192.svg", path.join(ROOT, "assets", "logo-navigator-mark.svg")]
]);
const LEGACY_BRANDS = ["DATA全栈知识库", "拾穗知识库", "拾穗数据工作室", "拾穗数据"];
const EMBEDDED_ASSETS = ["assets/external/doris-learning-roadmap.webp"];

function targetFor(root, relativePath) {
  return path.join(root, ...path.posix.normalize(relativePath).split("/"));
}

function main() {
  const cache = JSON.parse(fs.readFileSync(CACHE_FILE, "utf8"));
  const paths = Object.keys(cache);
  const markdownPaths = paths.filter((relativePath) => relativePath.endsWith(".md"));
  const resourcePaths = paths.filter((relativePath) => !relativePath.endsWith(".md"));
  const failures = [];
  let markdownBytes = 0;
  let fullArticles = 0;
  let paywallArticles = 0;

  for (const relativePath of markdownPaths) {
    const filePath = targetFor(ARTICLES_ROOT, relativePath);
    if (!fs.existsSync(filePath)) {
      failures.push(`Missing Markdown: ${relativePath}`);
      continue;
    }

    const body = fs.readFileSync(filePath);
    markdownBytes += body.length;
    if (body.length === 0) {
      failures.push(`Empty Markdown: ${relativePath}`);
    }

    const text = body.toString("utf8");
    if (/^\s*<!doctype html/i.test(text) || /^\s*<html[\s>]/i.test(text)) {
      failures.push(`HTML error document: ${relativePath}`);
    }
    if (text.includes('class="lab-paywall"')) {
      paywallArticles += 1;
    } else if (text.includes("---")) {
      fullArticles += 1;
    } else {
      failures.push(`Unexpected Markdown response: ${relativePath}`);
    }
    if (LEGACY_BRANDS.some((brand) => text.includes(brand))) {
      failures.push(`Legacy brand remains in Markdown: ${relativePath}`);
    }
    if (/!\[[^\]]*\]\(https?:\/\//i.test(text)) {
      failures.push(`Remote image remains in Markdown: ${relativePath}`);
    }
  }

  for (const relativePath of resourcePaths) {
    if (LOCAL_ONLY_PATHS.has(relativePath)) {
      const localAsset = LOCAL_ASSETS.get(relativePath);
      if (!localAsset || !fs.existsSync(localAsset) || fs.statSync(localAsset).size === 0) {
        failures.push(`Missing local resource: ${relativePath}`);
      }
      continue;
    }
    const filePath = targetFor(RESOURCES_ROOT, relativePath);
    if (!fs.existsSync(filePath) || fs.statSync(filePath).size === 0) {
      failures.push(`Missing or empty resource: ${relativePath}`);
      continue;
    }
    if (/\.(?:css|html|js|json|svg|txt)$/i.test(relativePath)) {
      const text = fs.readFileSync(filePath, "utf8");
      if (LEGACY_BRANDS.some((brand) => text.includes(brand))) {
        failures.push(`Legacy brand remains in resource: ${relativePath}`);
      }
    }
  }

  for (const relativePath of EMBEDDED_ASSETS) {
    const filePath = targetFor(RESOURCES_ROOT, relativePath);
    if (!fs.existsSync(filePath) || fs.statSync(filePath).size === 0) {
      failures.push(`Missing embedded asset: ${relativePath}`);
    }
  }

  let manifest = null;
  if (fs.existsSync(MANIFEST_FILE)) {
    manifest = JSON.parse(fs.readFileSync(MANIFEST_FILE, "utf8"));
    for (const failure of manifest.failed || []) {
      failures.push(`Sync failed: ${failure.path}: ${failure.error}`);
    }
  } else {
    failures.push("Missing sync-manifest.json");
  }

  const report = {
    checkedAt: new Date().toISOString(),
    expectedMarkdown: markdownPaths.length,
    checkedMarkdown: markdownPaths.length - failures.filter((item) => item.startsWith("Missing Markdown")).length,
    expectedResources: resourcePaths.length,
    localOnlyResources: LOCAL_ONLY_PATHS.size,
    fullArticles,
    paywallArticles,
    markdownBytes,
    failures
  };
  fs.writeFileSync(
    path.join(CONTENT_ROOT, "verification-report.json"),
    `${JSON.stringify(report, null, 2)}\n`
  );

  console.log(JSON.stringify(report, null, 2));
  if (failures.length > 0) process.exitCode = 1;
}

main();
