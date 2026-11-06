const fs = require("node:fs");
const path = require("node:path");
const { topicProfile } = require("./member-content-engine");
const { matchSpecialized, familyGroup } = require("./title-deep-dive");

const ROOT = path.resolve(__dirname, "..");
const ARTICLES = path.join(ROOT, "content", "articles");
const REPORT_FILE = path.join(ROOT, "content", "expanded-member-titles.json");

function normalize(value) {
  return value
    .replace(/`[^`]+`/g, "CODE")
    .replace(/\d+(?:\.\d+)?/g, "N")
    .replace(/[\s|>#*_\-:：，。；、,.!?！？()（）]/g, "")
    .toLowerCase();
}

function summarize(map, total, label) {
  const repeated = [...map.entries()].filter(([, count]) => count > 1).sort((a, b) => b[1] - a[1]);
  const repeatedItems = repeated.reduce((sum, [, count]) => sum + count, 0);
  return {
    label,
    total,
    unique: map.size,
    repeatedGroups: repeated.length,
    repeatedItems,
    repeatedShare: Number((repeatedItems / Math.max(total, 1)).toFixed(4)),
    topRepeated: repeated.slice(0, 5).map(([key, count]) => ({ count, sample: key.slice(0, 90) }))
  };
}

function normalizeCode(value) {
  return value
    .replace(/--.*$/gm, "")
    .replace(/#.*$/gm, "")
    .replace(/(['"`])(?:\\.|(?!\1).)*\1/g, "STR")
    .replace(/\b(19|20)\d{2}-\d{2}-\d{2}\b/g, "DATE")
    .replace(/\b\d+(?:\.\d+)?\b/g, "N")
    .replace(/\s+/g, " ")
    .trim();
}

function countFenceProblems(markdown, articlePath) {
  const languageCounts = {};
  const problems = [];
  const fences = [...markdown.matchAll(/^```([^\n]*)\n([\s\S]*?)^```\s*$/gm)];
  for (const match of fences) {
    const language = match[1].trim().toLowerCase() || "plain";
    languageCounts[language] = (languageCounts[language] || 0) + 1;
    const firstLine = match[2]
      .split("\n")
      .map((line) => line.trim())
      .find((line) => line && !line.startsWith("--") && !line.startsWith("#"));
    if (!firstLine) continue;

    const looksSql = /^(WITH|SELECT|CREATE|INSERT|MERGE|UPDATE|DELETE|EXPLAIN)\b/i.test(firstLine);
    const looksPython = /^(from\s+\S+\s+import|import\s+\S+|def\s+\w+|class\s+\w+|@\w+)/.test(firstLine);
    if (["python", "py"].includes(language) && looksSql) {
      problems.push({ path: articlePath, language, firstLine: firstLine.slice(0, 100), expected: "sql" });
    }
    if (["sql"].includes(language) && looksPython) {
      problems.push({ path: articlePath, language, firstLine: firstLine.slice(0, 100), expected: "python" });
    }
  }
  return { fences, languageCounts, problems };
}

function average(values) {
  return Number((values.reduce((sum, value) => sum + value, 0) / Math.max(values.length, 1)).toFixed(2));
}

function main() {
  const report = JSON.parse(fs.readFileSync(REPORT_FILE, "utf8"));
  const articles = report.articles || [];
  const docs = articles.map((article) => ({
    ...article,
    markdown: fs.readFileSync(path.join(ARTICLES, ...article.path.split("/")), "utf8")
      .replace(/^---[\s\S]*?---\n/, "")
  }));

  const paragraphMap = new Map();
  const headingMap = new Map();
  const codeMap = new Map();
  const structuralCodeMap = new Map();
  let paragraphTotal = 0;
  let headingTotal = 0;
  let codeTotal = 0;
  const kindCounts = {};
  const guideCounts = {};
  const familyCounts = {};
  const specialtyCounts = {};
  const languageCounts = {};
  const fenceProblems = [];
  const caseCounts = [];
  const tableCounts = [];
  const codeCounts = [];

  for (const doc of docs) {
    const profile = topicProfile(doc.path, doc.title);
    kindCounts[doc.type] = (kindCounts[doc.type] || 0) + 1;
    const guideKey = profile.guide?.key || "none";
    guideCounts[guideKey] = (guideCounts[guideKey] || 0) + 1;
    const family = familyGroup(profile);
    familyCounts[family] = (familyCounts[family] || 0) + 1;
    const specialty = matchSpecialized(profile)?.key || `family:${family}`;
    specialtyCounts[specialty] = (specialtyCounts[specialty] || 0) + 1;
    caseCounts.push((doc.markdown.match(/^### (?:(?:深度案例|案例)\s*\d+[：:]|\d+\.\s+)/gm) || []).length);
    tableCounts.push((doc.markdown.match(/^\|\s*---/gm) || []).length);

    const paragraphs = doc.markdown
      .split(/\n\s*\n/)
      .map((item) => item.trim())
      .filter((item) => item.length > 40 && !item.startsWith("```"));
    for (const paragraph of paragraphs) {
      const key = normalize(paragraph);
      if (key.length < 30) continue;
      paragraphTotal += 1;
      paragraphMap.set(key, (paragraphMap.get(key) || 0) + 1);
    }

    let inFence = false;
    for (const line of doc.markdown.split("\n")) {
      if (/^```/.test(line.trim())) {
        inFence = !inFence;
      } else if (!inFence && /^#{2,3} /.test(line)) {
        headingTotal += 1;
        headingMap.set(line.trim(), (headingMap.get(line.trim()) || 0) + 1);
      }
    }

    const fenceAudit = countFenceProblems(doc.markdown, doc.path);
    for (const [language, count] of Object.entries(fenceAudit.languageCounts)) {
      languageCounts[language] = (languageCounts[language] || 0) + count;
    }
    fenceProblems.push(...fenceAudit.problems);
    codeCounts.push(fenceAudit.fences.length);

    const blocks = [...doc.markdown.matchAll(/```[\w-]*\n([\s\S]*?)```/g)].map((match) => match[1].trim());
    for (const block of blocks) {
      const key = block.replace(/\b(19|20)\d{2}-\d{2}-\d{2}\b/g, "DATE");
      const structuralKey = normalizeCode(block);
      codeTotal += 1;
      codeMap.set(key, (codeMap.get(key) || 0) + 1);
      structuralCodeMap.set(structuralKey, (structuralCodeMap.get(structuralKey) || 0) + 1);
    }
  }

  const chunkSets = docs.map((doc) => new Set(normalize(doc.markdown).match(/.{40,60}/g) || []));
  let pairCount = 0;
  let sum = 0;
  let max = 0;
  let maxPair = null;
  let over30 = 0;
  let over35 = 0;
  let over50 = 0;
  let distinctPairCount = 0;
  let distinctSum = 0;
  let distinctMax = 0;
  let distinctMaxPair = null;
  let distinctOver30 = 0;
  let distinctOver35 = 0;
  let distinctOver50 = 0;
  for (let left = 0; left < chunkSets.length; left += 1) {
    for (let right = left + 1; right < chunkSets.length; right += 1) {
      const first = chunkSets[left];
      const second = chunkSets[right];
      if (!first.size || !second.size) continue;
      const [small, large] = first.size < second.size ? [first, second] : [second, first];
      let intersection = 0;
      for (const chunk of small) {
        if (large.has(chunk)) intersection += 1;
      }
      const jaccard = intersection / (small.size + large.size - intersection);
      pairCount += 1;
      sum += jaccard;
      if (jaccard > max) {
        max = jaccard;
        maxPair = {
          jaccard: Number(jaccard.toFixed(4)),
          left: { title: docs[left].title, path: docs[left].path },
          right: { title: docs[right].title, path: docs[right].path }
        };
      }
      if (jaccard >= 0.3) over30 += 1;
      if (jaccard >= 0.35) over35 += 1;
      if (jaccard >= 0.5) over50 += 1;

      if (docs[left].title.trim() !== docs[right].title.trim()) {
        distinctPairCount += 1;
        distinctSum += jaccard;
        if (jaccard > distinctMax) {
          distinctMax = jaccard;
          distinctMaxPair = {
            jaccard: Number(jaccard.toFixed(4)),
            left: { title: docs[left].title, path: docs[left].path },
            right: { title: docs[right].title, path: docs[right].path }
          };
        }
        if (jaccard >= 0.3) distinctOver30 += 1;
        if (jaccard >= 0.35) distinctOver35 += 1;
        if (jaccard >= 0.5) distinctOver50 += 1;
      }
    }
  }

  const lengths = docs.map((doc) => doc.markdown.length).sort((a, b) => a - b);
  const titleCounts = docs.reduce((result, doc) => {
    const key = doc.title.trim();
    result[key] = (result[key] || 0) + 1;
    return result;
  }, {});
  const duplicateTitleGroups = Object.entries(titleCounts).filter(([, count]) => count > 1);
  const result = {
    articles: docs.length,
    characters: {
      total: lengths.reduce((sum, value) => sum + value, 0),
      average: Math.round(lengths.reduce((sum, value) => sum + value, 0) / Math.max(lengths.length, 1)),
      p10: lengths[Math.floor(lengths.length * 0.1)] || 0,
      median: lengths[Math.floor(lengths.length * 0.5)] || 0,
      p90: lengths[Math.floor(lengths.length * 0.9)] || 0
    },
    paragraphs: summarize(paragraphMap, paragraphTotal, "paragraphs"),
    headings: summarize(headingMap, headingTotal, "headings"),
    codeBlocks: summarize(codeMap, codeTotal, "codeBlocks"),
    structuralCodeBlocks: summarize(structuralCodeMap, codeTotal, "structuralCodeBlocks"),
    contentSignals: {
      kinds: kindCounts,
      guides: guideCounts,
      families: familyCounts,
      specialties: specialtyCounts,
      specializedDeepDives: docs.filter((doc) => matchSpecialized(topicProfile(doc.path, doc.title))).length,
      averageCases: average(caseCounts),
      articlesUnderThreeCases: caseCounts.filter((count) => count < 3).length,
      articlesUnderFiveCases: caseCounts.filter((count) => count < 5).length,
      caseCountDistribution: caseCounts.reduce((result, count) => {
        result[count] = (result[count] || 0) + 1;
        return result;
      }, {}),
      averageTables: average(tableCounts),
      articlesUnderTwoTables: tableCounts.filter((count) => count < 2).length,
      averageCodeBlocks: average(codeCounts),
      articlesUnderTwoCodeBlocks: codeCounts.filter((count) => count < 2).length,
      articlesUnderFiveThousandCharacters: lengths.filter((length) => length < 5000).length,
      codeLanguages: languageCounts,
      fenceProblems: fenceProblems.length,
      fenceProblemSamples: fenceProblems.slice(0, 12)
    },
    duplicateTitles: {
      groups: duplicateTitleGroups.length,
      articles: duplicateTitleGroups.reduce((sum, [, count]) => sum + count, 0),
      extraFiles: duplicateTitleGroups.reduce((sum, [, count]) => sum + count - 1, 0)
    },
    similarity: {
      pairs: pairCount,
      meanJaccard: Number((sum / Math.max(pairCount, 1)).toFixed(4)),
      maxJaccard: Number(max.toFixed(4)),
      maxPair,
      pairsOver30Percent: over30,
      pairsOver35Percent: over35,
      pairsOver50Percent: over50
    },
    distinctTitleSimilarity: {
      pairs: distinctPairCount,
      meanJaccard: Number((distinctSum / Math.max(distinctPairCount, 1)).toFixed(4)),
      maxJaccard: Number(distinctMax.toFixed(4)),
      maxPair: distinctMaxPair,
      pairsOver30Percent: distinctOver30,
      pairsOver35Percent: distinctOver35,
      pairsOver50Percent: distinctOver50
    }
  };

  const output = path.join(ROOT, "content", "member-content-audit.json");
  fs.writeFileSync(output, `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify(result, null, 2));
}

main();
