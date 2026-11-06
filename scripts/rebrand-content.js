const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const replacements = [
  ["DATA全栈知识库", "大数据领航员"],
  ["拾穗知识库", "大数据领航员"],
  ["拾穗数据工作室（微信：shisuidata）", "大数据领航员"],
  ["拾穗数据工作室", "大数据领航员"],
  ["拾穗数据", "大数据领航员"]
];

function replaceText(value) {
  return replacements.reduce(
    (result, [from, to]) => result.split(from).join(to),
    value
  );
}

function replaceDeep(value) {
  if (typeof value === "string") return replaceText(value);
  if (Array.isArray(value)) return value.map(replaceDeep);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [replaceText(key), replaceDeep(item)])
    );
  }
  return value;
}

function rewriteJson(relativePath) {
  const filePath = path.join(ROOT, relativePath);
  const source = JSON.parse(fs.readFileSync(filePath, "utf8"));
  fs.writeFileSync(filePath, JSON.stringify(replaceDeep(source)));
}

for (const relativePath of ["content/options.json", "content/cache.json"]) {
  rewriteJson(relativePath);
}

for (const relativePath of [
  "content/Welcome.md",
  "content/publish.css",
  "content/publish.js",
  "public/index.html",
  "server.js",
  "README.md",
  "package.json"
]) {
  const filePath = path.join(ROOT, relativePath);
  const source = fs.readFileSync(filePath, "utf8");
  const next = replaceText(source);
  if (next !== source) fs.writeFileSync(filePath, next);
}

console.log("Brand metadata updated.");
