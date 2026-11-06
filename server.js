const http = require("node:http");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const PORT = Number(process.env.PORT) || 4180;
const HOST = process.env.HOST || "0.0.0.0";
const UID = "55e08288f7858ecb3aaf8d2bd233f08b";
const ASSET_BASE = "8a95efdc6bf73434edc800f81d9124e3fc5ca5c5adbe051a4252ad61bf64e5f4";
const ROOT = __dirname;
const PUBLIC_ROOT = path.join(ROOT, "public");
const CONTENT_ROOT = path.join(ROOT, "content");
const ARTICLES_ROOT = path.join(CONTENT_ROOT, "articles");
const RESOURCES_ROOT = path.join(CONTENT_ROOT, "resources");
const READER_ROOT = path.join(PUBLIC_ROOT, "assets", "knowledge-reader", ASSET_BASE);

const CONTENT_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".gif": "image/gif",
  ".html": "text/html; charset=utf-8",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".mp3": "audio/mpeg",
  ".mp4": "video/mp4",
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".woff2": "font/woff2"
};

function send(res, status, body, headers = {}) {
  res.writeHead(status, {
    "Cache-Control": "no-cache",
    "X-Content-Type-Options": "nosniff",
    ...headers
  });
  res.end(body);
}

function sendFile(res, filePath, extraHeaders = {}) {
  fs.readFile(filePath, (error, body) => {
    if (error) {
      send(res, 404, "Not found", { "Content-Type": "text/plain; charset=utf-8" });
      return;
    }

    const contentType = CONTENT_TYPES[path.extname(filePath).toLowerCase()] || "application/octet-stream";
    send(res, 200, body, {
      "Content-Type": contentType,
      ...extraHeaders
    });
  });
}

function sendIndex(res) {
  sendFile(res, path.join(PUBLIC_ROOT, "index.html"), {
    "Content-Type": "text/html; charset=utf-8"
  });
}

function safeFilePath(root, relativePath) {
  const filePath = path.resolve(root, relativePath);
  const normalizedRoot = path.resolve(root);
  if (filePath !== normalizedRoot && !filePath.startsWith(normalizedRoot + path.sep)) {
    return null;
  }
  return filePath;
}

function handleAccess(res, rawFilePath) {
  if (!rawFilePath || rawFilePath.includes("\0")) {
    send(res, 400, "Bad request", { "Content-Type": "text/plain; charset=utf-8" });
    return;
  }

  let filePath;
  try {
    filePath = decodeURIComponent(rawFilePath);
  } catch {
    send(res, 400, "Bad request", { "Content-Type": "text/plain; charset=utf-8" });
    return;
  }

  const extraHeaders = { "obs-status": "active" };
  const normalized = path.posix.normalize(filePath);
  if (normalized.startsWith("../") || normalized === ".." || normalized.includes("\0")) {
    send(res, 400, "Bad request", { "Content-Type": "text/plain; charset=utf-8" });
    return;
  }

  if (normalized.endsWith(".md")) {
    const articlePath = safeFilePath(ARTICLES_ROOT, normalized);
    if (!articlePath) {
      send(res, 404, "Not found", { "Content-Type": "text/plain; charset=utf-8" });
      return;
    }
    sendFile(res, articlePath, {
      ...extraHeaders,
      "Content-Type": CONTENT_TYPES[".md"]
    });
    return;
  }

  if (normalized === "网站素材/logo-mark.svg") {
    sendFile(res, path.join(ROOT, "assets", "logo-navigator-mark.svg"), {
      ...extraHeaders,
      "Content-Type": CONTENT_TYPES[".svg"]
    });
    return;
  }

  if (normalized === "favicon-192x192.svg") {
    sendFile(res, path.join(ROOT, "assets", "logo-navigator-mark.svg"), {
      ...extraHeaders,
      "Content-Type": CONTENT_TYPES[".svg"]
    });
    return;
  }

  if (normalized === "网站素材/logo-H.png") {
    sendFile(res, path.join(CONTENT_ROOT, "网站素材-logo-H.png"), {
      ...extraHeaders,
      "Content-Type": CONTENT_TYPES[".png"]
    });
    return;
  }

  const resourcePath = safeFilePath(RESOURCES_ROOT, normalized);
  if (resourcePath && fs.existsSync(resourcePath) && fs.statSync(resourcePath).isFile()) {
    sendFile(res, resourcePath, extraHeaders);
    return;
  }

  const publicAsset = safeFilePath(PUBLIC_ROOT, normalized);
  if (publicAsset && fs.existsSync(publicAsset) && fs.statSync(publicAsset).isFile()) {
    sendFile(res, publicAsset, extraHeaders);
    return;
  }

  send(res, 404, "Not found", {
    ...extraHeaders,
    "Content-Type": "text/plain; charset=utf-8"
  });
}

const server = http.createServer((req, res) => {
  if (req.method !== "GET" && req.method !== "HEAD") {
    send(res, 405, "Method not allowed", { "Content-Type": "text/plain; charset=utf-8" });
    return;
  }

  let pathname;
  try {
    pathname = new URL(req.url, "http://localhost").pathname;
  } catch {
    send(res, 400, "Bad request", { "Content-Type": "text/plain; charset=utf-8" });
    return;
  }

  if (pathname === "/") {
    res.writeHead(302, { Location: "/knowledge/Welcome" });
    res.end();
    return;
  }

  if (pathname === "/knowledge" || pathname === "/knowledge/" || pathname === "/knowledge/Welcome") {
    sendIndex(res);
    return;
  }

  if (pathname === `/knowledge/options/${UID}`) {
    sendFile(res, path.join(CONTENT_ROOT, "options.json"), {
      "Content-Type": CONTENT_TYPES[".json"],
      "obs-status": "200"
    });
    return;
  }

  if (pathname === `/knowledge/options/${UID}.json`) {
    sendFile(res, path.join(CONTENT_ROOT, "options.json"), {
      "Content-Type": CONTENT_TYPES[".json"],
      "obs-status": "200"
    });
    return;
  }

  if (pathname === `/knowledge/cache/${UID}`) {
    sendFile(res, path.join(CONTENT_ROOT, "cache.json"), {
      "Content-Type": CONTENT_TYPES[".json"],
      "obs-status": "200"
    });
    return;
  }

  if (pathname === `/knowledge/cache/${UID}.json`) {
    sendFile(res, path.join(CONTENT_ROOT, "cache.json"), {
      "Content-Type": CONTENT_TYPES[".json"],
      "obs-status": "200"
    });
    return;
  }

  const accessPrefix = `/knowledge/access/${UID}/`;
  if (pathname.startsWith(accessPrefix)) {
    handleAccess(res, pathname.slice(accessPrefix.length));
    return;
  }

  const readerPrefix = `/knowledge-reader/${ASSET_BASE}/`;
  if (pathname.startsWith(readerPrefix)) {
    let relativePath;
    try {
      relativePath = decodeURIComponent(pathname.slice(readerPrefix.length));
    } catch {
      send(res, 400, "Bad request", { "Content-Type": "text/plain; charset=utf-8" });
      return;
    }
    const filePath = safeFilePath(READER_ROOT, relativePath);
    if (!filePath) {
      send(res, 404, "Not found", { "Content-Type": "text/plain; charset=utf-8" });
      return;
    }
    sendFile(res, filePath);
    return;
  }

  if (pathname.startsWith("/knowledge/")) {
    sendIndex(res);
    return;
  }

  send(res, 404, "Not found", { "Content-Type": "text/plain; charset=utf-8" });
});

server.listen(PORT, HOST, () => {
  console.log(`大数据领航员已启动: http://localhost:${PORT}/knowledge/Welcome`);

  if (HOST === "0.0.0.0") {
    const lanAddresses = Object.values(os.networkInterfaces())
      .flat()
      .filter((address) => address && address.family === "IPv4" && !address.internal)
      .map((address) => `http://${address.address}:${PORT}/knowledge/Welcome`);

    for (const address of lanAddresses) {
      console.log(`局域网访问: ${address}`);
    }
  }
});
