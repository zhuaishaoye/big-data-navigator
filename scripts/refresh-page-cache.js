const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const ROOT = path.resolve(__dirname, "..");
const CONTENT_ROOT = path.join(ROOT, "content");
const ARTICLES_ROOT = path.join(CONTENT_ROOT, "articles");
const CACHE_FILE = path.join(CONTENT_ROOT, "cache.json");
const NAVIGATION_PREFIX = "content/articles/【知识导航】/";

function relativeArticlePath(filePath) {
  return path.relative(ARTICLES_ROOT, filePath).split(path.sep).join("/");
}

function changedManualPages() {
  const output = execFileSync(
    "git",
    ["diff", "--name-only", "-z", "--", "content/articles"],
    { cwd: ROOT }
  );
  return output
    .toString("utf8")
    .split("\0")
    .filter(Boolean)
    .filter(
      (filePath) =>
        filePath === "content/articles/Welcome.md" ||
        filePath.startsWith(NAVIGATION_PREFIX)
    );
}

function parseTitle(frontmatterLines) {
  const line = frontmatterLines.find((item) => item.startsWith("title:"));
  if (!line) return "";
  const raw = line.replace(/^title:\s*/, "").trim();
  if (raw.startsWith('"')) {
    try {
      return JSON.parse(raw);
    } catch {
      return raw.replace(/^"|"$/g, "");
    }
  }
  if (raw.startsWith("'") && raw.endsWith("'")) {
    return raw.slice(1, -1).replaceAll("''", "'");
  }
  return raw;
}

function parseWikiLinks(line, lineIndex, lineOffset) {
  const links = [];
  const pattern = /\[\[([^\]\n]+)\]\]/g;
  let match;
  while ((match = pattern.exec(line)) !== null) {
    if (match.index > 0 && line[match.index - 1] === "!") continue;
    const [target, label] = match[1].split("|", 2);
    const link = target.split("#", 1)[0].trim();
    if (!link) continue;
    links.push({
      displayText: (label || target).trim(),
      link,
      pos: [
        lineIndex,
        match.index,
        lineOffset + match.index,
        lineIndex,
        pattern.lastIndex,
        lineOffset + pattern.lastIndex
      ]
    });
  }
  return links;
}

function analyzeMarkdown(markdown) {
  const lines = markdown.split("\n");
  const headings = [];
  const links = [];
  const listItems = [];
  const lineOffsets = [];
  let offset = 0;
  let inFence = false;

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex];
    lineOffsets[lineIndex] = offset;

    if (/^```/.test(line.trim())) inFence = !inFence;
    if (!inFence) {
      const headingMatch = line.match(/^(#{1,6})\s+(.+?)\s*$/);
      if (headingMatch) {
        headings.push({
          heading: headingMatch[2],
          level: headingMatch[1].length,
          pos: [
            lineIndex,
            0,
            offset,
            lineIndex,
            line.length,
            offset + line.length
          ]
        });
      }

      links.push(...parseWikiLinks(line, lineIndex, offset));

      if (/^\s*[-*+]\s+/.test(line)) {
        listItems.push({
          parent: -lineIndex,
          pos: [
            lineIndex,
            0,
            offset,
            lineIndex,
            line.length,
            offset + line.length
          ]
        });
      }
    }

    offset += line.length + 1;
  }

  const closingLineIndex = lines.findIndex(
    (line, lineIndex) => lineIndex > 0 && line === "---"
  );
  const frontmatterEnd =
    (lineOffsets[closingLineIndex] || 0) + (lines[closingLineIndex] || "").length;
  const frontmatterLines =
    closingLineIndex > 0 ? lines.slice(1, closingLineIndex) : [];

  return {
    title: parseTitle(frontmatterLines),
    frontmatterPos: [0, 0, 0, closingLineIndex, 3, frontmatterEnd],
    headings,
    links,
    listItems
  };
}

const cache = JSON.parse(fs.readFileSync(CACHE_FILE, "utf8"));
const pages = changedManualPages();

for (const changedPath of pages) {
  const relativePath = relativeArticlePath(
    path.join(ROOT, ...changedPath.split("/"))
  );
  const markdownPath = path.join(ARTICLES_ROOT, ...relativePath.split("/"));
  const parsed = analyzeMarkdown(fs.readFileSync(markdownPath, "utf8"));
  if (!cache[relativePath]) {
    throw new Error(`Missing cache entry: ${relativePath}`);
  }
  cache[relativePath] = {
    ...cache[relativePath],
    frontmatter: {
      ...cache[relativePath].frontmatter,
      title: parsed.title
    },
    frontmatterPos: parsed.frontmatterPos,
    headings: parsed.headings,
    links: parsed.links,
    listItems: parsed.listItems
  };
}

fs.writeFileSync(CACHE_FILE, `${JSON.stringify(cache, null, 2)}\n`);
console.log(JSON.stringify({ refreshed: pages.length, pages }, null, 2));
