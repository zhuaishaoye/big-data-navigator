const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const DIST = path.join(ROOT, "dist");
const PUBLIC = path.join(ROOT, "public");
const CONTENT = path.join(ROOT, "content");
const ARTICLES = path.join(CONTENT, "articles");
const RESOURCES = path.join(CONTENT, "resources");
const UID = "55e08288f7858ecb3aaf8d2bd233f08b";
const ASSET_BASE = "8a95efdc6bf73434edc800f81d9124e3fc5ca5c5adbe051a4252ad61bf64e5f4";

function writeFile(relativePath, content) {
  const filePath = path.join(DIST, relativePath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
}

function copyFile(source, relativePath) {
  const filePath = path.join(DIST, relativePath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.copyFileSync(source, filePath);
}

function staticArticlePage() {
  return fs.readFileSync(path.join(PUBLIC, "index.html"));
}

fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(DIST, { recursive: true });

const indexHtml = staticArticlePage();
writeFile("index.html", [
  "<!doctype html>",
  '<meta charset="utf-8">',
  '<meta http-equiv="refresh" content="0; url=./knowledge/Welcome/">',
  '<link rel="canonical" href="./knowledge/Welcome/">',
  "<title>大数据领航员</title>"
].join(""));
writeFile("knowledge/Welcome/index.html", indexHtml);
writeFile("knowledge/Welcome.html", indexHtml);
writeFile("knowledge/index.html", indexHtml);
writeFile(".nojekyll", "");

copyFile(path.join(CONTENT, "options.json"), `knowledge/options/${UID}.json`);
copyFile(path.join(CONTENT, "cache.json"), `knowledge/cache/${UID}.json`);
copyFile(path.join(CONTENT, "options.json"), `knowledge/options/${UID}`);
copyFile(path.join(CONTENT, "cache.json"), `knowledge/cache/${UID}`);

const accessRoot = path.join(DIST, "knowledge", "access", UID);
const cache = JSON.parse(fs.readFileSync(path.join(CONTENT, "cache.json"), "utf8"));
const markdownFiles = Object.keys(cache).filter((filePath) => filePath.endsWith(".md"));

for (const filePath of markdownFiles) {
  const normalized = path.posix.normalize(filePath);
  const publicPath = normalized.replace(/\.md$/i, "");
  const source = path.join(ARTICLES, ...normalized.split("/"));
  if (!fs.existsSync(source)) {
    throw new Error(`Missing Markdown source: ${normalized}`);
  }
  const markdown = fs.readFileSync(source);
  const target = path.join(accessRoot, normalized);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, markdown);

  if (normalized !== "Welcome.md") {
    writeFile(
      path.posix.join("knowledge", publicPath, "index.html"),
      indexHtml
    );
  }
}

if (fs.existsSync(RESOURCES)) {
  fs.cpSync(RESOURCES, accessRoot, { recursive: true });
}
copyFile(
  path.join(CONTENT, "网站素材-logo-H.png"),
  `knowledge/access/${UID}/网站素材/logo-H.png`
);
copyFile(
  path.join(ROOT, "assets", "logo-navigator-mark.svg"),
  `knowledge/access/${UID}/网站素材/logo-mark.svg`
);
copyFile(
  path.join(ROOT, "assets", "logo-navigator-mark.svg"),
  `knowledge/access/${UID}/favicon-192x192.svg`
);

fs.cpSync(
  path.join(PUBLIC, "assets", "knowledge-reader"),
  path.join(DIST, "knowledge-reader"),
  { recursive: true }
);

// The reader bundle uses root-relative vendor URLs. Rewrite them for the
// repository subpath used by GitHub Pages while keeping local-root mode intact.
const builtReaderRoot = path.join(DIST, "knowledge-reader", ASSET_BASE);
const builtApp = path.join(builtReaderRoot, "app.js");
const builtCss = path.join(builtReaderRoot, "app.css");
fs.writeFileSync(
  builtApp,
  fs.readFileSync(builtApp, "utf8").replaceAll(
    `"/knowledge-reader/${ASSET_BASE}/`,
    `"../knowledge-reader/${ASSET_BASE}/`
  )
);
fs.writeFileSync(
  builtCss,
  fs.readFileSync(builtCss, "utf8").replaceAll(
    `(/knowledge-reader/${ASSET_BASE}/`,
    "(public/"
  )
);

console.log(`Static site built: ${DIST}`);
console.log(`Markdown routes: ${markdownFiles.length}`);
