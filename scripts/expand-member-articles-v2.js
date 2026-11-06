const fs = require("node:fs");
const path = require("node:path");
const { buildArticle, analyzeMarkdown } = require("./member-content-engine");

const ROOT = path.resolve(__dirname, "..");
const ARTICLES = path.join(ROOT, "content", "articles");
const CACHE_FILE = path.join(ROOT, "content", "cache.json");
const REPORT_FILE = path.join(ROOT, "content", "expanded-member-titles.json");

function target(relativePath) {
  return path.join(ARTICLES, ...relativePath.split("/"));
}

function main() {
  const report = JSON.parse(fs.readFileSync(REPORT_FILE, "utf8"));
  const cache = JSON.parse(fs.readFileSync(CACHE_FILE, "utf8"));
  const unique = new Map();
  for (const article of report.articles || []) {
    if (article.path && !unique.has(article.path)) {
      unique.set(article.path, article);
    }
  }

  const replaced = [];
  for (const [relativePath, previous] of unique) {
    const filePath = target(relativePath);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Missing member article: ${relativePath}`);
    }
    const existing = fs.readFileSync(filePath, "utf8");
    const article = buildArticle(relativePath, previous.title, existing);
    fs.writeFileSync(filePath, article.markdown);
    cache[relativePath] = analyzeMarkdown(article.markdown);
    replaced.push({
      path: relativePath,
      title: article.title,
      category: article.category,
      type: article.kind,
      characters: article.characters
    });
  }

  fs.writeFileSync(CACHE_FILE, `${JSON.stringify(cache, null, 2)}\n`);
  fs.writeFileSync(REPORT_FILE, `${JSON.stringify({
    generatedAt: new Date().toISOString(),
    generator: "topic-specific-v2",
    count: replaced.length,
    articles: replaced
  }, null, 2)}\n`);

  const totalCharacters = replaced.reduce((sum, article) => sum + article.characters, 0);
  const kindCounts = replaced.reduce((result, article) => {
    result[article.type] = (result[article.type] || 0) + 1;
    return result;
  }, {});
  console.log(JSON.stringify({
    replaced: replaced.length,
    totalCharacters,
    averageCharacters: Math.round(totalCharacters / Math.max(replaced.length, 1)),
    kindCounts
  }, null, 2));
}

main();
