const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const CONTENT_ROOT = path.join(ROOT, "content");
const ARTICLES_ROOT = path.join(CONTENT_ROOT, "articles");
const RESOURCES_ROOT = path.join(CONTENT_ROOT, "resources");
const CACHE_FILE = path.join(CONTENT_ROOT, "cache.json");
const MANIFEST_FILE = path.join(CONTENT_ROOT, "sync-manifest.json");

const SOURCE_ORIGIN = process.env.SOURCE_ORIGIN || "https://pro.ss-data.cc";
const UID = "55e08288f7858ecb3aaf8d2bd233f08b";
const CONCURRENCY = Math.max(1, Math.min(12, Number(process.env.SYNC_CONCURRENCY) || 8));
const ATTEMPTS = Math.max(1, Number(process.env.SYNC_ATTEMPTS) || 4);
const RESUME = process.env.SYNC_RESUME === "1" || process.argv.includes("--resume");
const LOCAL_ONLY_PATHS = new Set(["网站素材/logo-mark.svg", "favicon-192x192.svg"]);
const EMBEDDED_ASSETS = [
  {
    sourceUrl: "https://img.ss-data.cc/safe_image/20250702102744.webp",
    relativePath: "assets/external/doris-learning-roadmap.webp",
    markdownPath: "【技术与工具】/Doris/00-Doris学习路线图.md"
  }
];
const BRAND_REPLACEMENTS = [
  ["DATA全栈知识库", "大数据领航员"],
  ["拾穗知识库", "大数据领航员"],
  ["拾穗数据工作室（微信：shisuidata）", "大数据领航员"],
  ["拾穗数据工作室", "大数据领航员"],
  ["拾穗数据", "大数据领航员"]
];

function rebrand(value) {
  return BRAND_REPLACEMENTS.reduce(
    (result, [from, to]) => result.split(from).join(to),
    value
  );
}

function safeTarget(root, relativePath) {
  const normalized = path.posix.normalize(relativePath);
  if (
    normalized === "." ||
    normalized.startsWith("../") ||
    normalized === ".." ||
    normalized.includes("\0")
  ) {
    throw new Error(`Unsafe source path: ${relativePath}`);
  }

  const target = path.resolve(root, ...normalized.split("/"));
  const resolvedRoot = path.resolve(root);
  if (!target.startsWith(resolvedRoot + path.sep)) {
    throw new Error(`Source path escapes root: ${relativePath}`);
  }
  return target;
}

function encodedAccessUrl(relativePath) {
  const encodedPath = relativePath
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `${SOURCE_ORIGIN}/knowledge/access/${UID}/${encodedPath}`;
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function download(relativePath) {
  const url = encodedAccessUrl(relativePath);
  let lastError;

  for (let attempt = 1; attempt <= ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(url, {
        redirect: "follow",
        headers: {
          accept: "text/markdown,text/plain,application/octet-stream;q=0.8,*/*;q=0.5",
          "user-agent": "BigDataNavigator-ContentSync/1.0"
        },
        signal: AbortSignal.timeout(45000)
      });

      if (response.status === 429 || response.status >= 500) {
        throw new Error(`HTTP ${response.status}`);
      }
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
      }

      return {
        body: Buffer.from(await response.arrayBuffer()),
        contentType: response.headers.get("content-type") || "",
        obsStatus: response.headers.get("obs-status") || "",
        url
      };
    } catch (error) {
      lastError = error;
      if (attempt < ATTEMPTS) {
        await sleep(300 * 2 ** (attempt - 1));
      }
    }
  }

  throw new Error(`${relativePath}: ${lastError?.message || "download failed"}`);
}

async function downloadUrl(url) {
  const response = await fetch(url, {
    redirect: "follow",
    headers: {
      accept: "image/avif,image/webp,image/png,image/jpeg,*/*;q=0.5",
      "user-agent": "BigDataNavigator-ContentSync/1.0"
    },
    signal: AbortSignal.timeout(45000)
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText}`);
  }
  return {
    body: Buffer.from(await response.arrayBuffer()),
    contentType: response.headers.get("content-type") || ""
  };
}

function validateMarkdown(relativePath, result) {
  const text = result.body.toString("utf8");
  if (!result.contentType.toLowerCase().includes("text/markdown")) {
    throw new Error(`${relativePath}: unexpected content type "${result.contentType}"`);
  }
  if (result.body.length === 0) {
    throw new Error(`${relativePath}: empty Markdown file`);
  }
  if (/^\s*<!doctype html/i.test(text) || /^\s*<html[\s>]/i.test(text)) {
    throw new Error(`${relativePath}: received an HTML document instead of Markdown`);
  }
  if (!text.includes("---") && !text.includes('class="lab-paywall"')) {
    throw new Error(`${relativePath}: response does not look like article Markdown`);
  }
  return rebrand(text);
}

function resourceBody(relativePath, body) {
  if (/\.(?:css|html|js|json|svg|txt)$/i.test(relativePath)) {
    return Buffer.from(rebrand(body.toString("utf8")));
  }
  return body;
}

async function runPool(items, worker) {
  let cursor = 0;
  let completed = 0;

  async function runWorker() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      await worker(items[index], index);
      completed += 1;
      if (completed % 100 === 0 || completed === items.length) {
        process.stdout.write(`Synced ${completed}/${items.length}\n`);
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, runWorker));
}

async function main() {
  const cache = JSON.parse(fs.readFileSync(CACHE_FILE, "utf8"));
  const allPaths = Object.keys(cache);
  const paths = allPaths.filter((relativePath) => !LOCAL_ONLY_PATHS.has(relativePath));
  const markdownPaths = paths.filter((relativePath) => relativePath.endsWith(".md"));
  const resourcePaths = paths.filter((relativePath) => !relativePath.endsWith(".md"));
  const records = [];

  fs.mkdirSync(ARTICLES_ROOT, { recursive: true });
  fs.mkdirSync(RESOURCES_ROOT, { recursive: true });

  console.log(`Source: ${SOURCE_ORIGIN}${RESUME ? " (resume mode)" : ""}`);
  console.log(`Downloading ${markdownPaths.length} Markdown files and ${resourcePaths.length} resources...`);

  await runPool([...markdownPaths, ...resourcePaths], async (relativePath) => {
    try {
      const isMarkdown = relativePath.endsWith(".md");
      const root = isMarkdown ? ARTICLES_ROOT : RESOURCES_ROOT;
      const target = safeTarget(root, relativePath);
      let result;
      let body;

      if (RESUME && fs.existsSync(target) && fs.statSync(target).size > 0) {
        const existingBody = fs.readFileSync(target);
        if (isMarkdown) {
          result = {
            body: existingBody,
            contentType: "text/markdown; charset=utf-8",
            obsStatus: "resumed"
          };
          body = Buffer.from(validateMarkdown(relativePath, result));
        } else {
          result = {
            body: existingBody,
            contentType: "application/octet-stream",
            obsStatus: "resumed"
          };
          body = resourceBody(relativePath, existingBody);
        }
      } else {
        result = await download(relativePath);
        body = isMarkdown
          ? Buffer.from(validateMarkdown(relativePath, result))
          : resourceBody(relativePath, result.body);
      }

      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, body);
      records.push({
        path: relativePath,
        bytes: body.length,
        contentType: result.contentType,
        obsStatus: result.obsStatus,
        status: "ok"
      });
    } catch (error) {
      records.push({
        path: relativePath,
        bytes: 0,
        status: "failed",
        error: error.message
      });
    }
  });

  for (const asset of EMBEDDED_ASSETS) {
    try {
      const target = safeTarget(RESOURCES_ROOT, asset.relativePath);
      let body;
      if (RESUME && fs.existsSync(target) && fs.statSync(target).size > 0) {
        body = fs.readFileSync(target);
      } else {
        const result = await downloadUrl(asset.sourceUrl);
        if (!result.contentType.startsWith("image/")) {
          throw new Error(`unexpected content type "${result.contentType}"`);
        }
        body = result.body;
      }

      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, body);

      const articlePath = safeTarget(ARTICLES_ROOT, asset.markdownPath);
      if (fs.existsSync(articlePath)) {
        const source = fs.readFileSync(articlePath, "utf8");
        fs.writeFileSync(
          articlePath,
          source.split(asset.sourceUrl).join(asset.relativePath)
        );
      }

      records.push({
        path: asset.relativePath,
        bytes: body.length,
        contentType: "image/webp",
        obsStatus: RESUME ? "resumed" : "active",
        status: "ok",
        sourceUrl: asset.sourceUrl
      });
    } catch (error) {
      records.push({
        path: asset.relativePath,
        bytes: 0,
        status: "failed",
        error: error.message,
        sourceUrl: asset.sourceUrl
      });
    }
  }

  const failed = records.filter((record) => record.status === "failed");
  const markdownRecords = records.filter((record) => record.path.endsWith(".md") && record.status === "ok");
  const resourceRecords = records.filter((record) => !record.path.endsWith(".md") && record.status === "ok");
  const welcomeSource = path.join(ARTICLES_ROOT, "Welcome.md");
  if (fs.existsSync(welcomeSource)) {
    fs.copyFileSync(welcomeSource, path.join(CONTENT_ROOT, "Welcome.md"));
  }

  const manifest = {
    sourceOrigin: SOURCE_ORIGIN,
    syncedAt: new Date().toISOString(),
    concurrency: CONCURRENCY,
    expected: {
      markdown: markdownPaths.length,
      resources: resourcePaths.length,
      embeddedAssets: EMBEDDED_ASSETS.length,
      total: paths.length + EMBEDDED_ASSETS.length
    },
    localOnly: [...LOCAL_ONLY_PATHS],
    resumeMode: RESUME,
    downloaded: {
      markdown: markdownRecords.length,
      resources: resourceRecords.length,
      total: markdownRecords.length + resourceRecords.length,
      bytes: records.reduce((sum, record) => sum + record.bytes, 0)
    },
    failed,
    records
  };
  fs.writeFileSync(MANIFEST_FILE, `${JSON.stringify(manifest, null, 2)}\n`);

  if (failed.length > 0) {
    console.error(`Sync finished with ${failed.length} failure(s). See ${MANIFEST_FILE}`);
    for (const failure of failed.slice(0, 20)) {
      console.error(`- ${failure.path}: ${failure.error}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log(`Sync complete: ${manifest.downloaded.total} files, ${manifest.downloaded.bytes} bytes.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
