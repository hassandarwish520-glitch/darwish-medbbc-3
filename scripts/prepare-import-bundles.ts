// @ts-nocheck
import fs from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import { parseHtmlQuestions } from "../src/lib/import/html-question-parser";
import { extractQuestionsFromImportedSource } from "../src/lib/ai/question-import";
import { SUBJECT_IMPORT_DOCUMENTS } from "./import-manifest";

type ImportRow = {
  stem: string;
  choices: { key: string; text: string }[];
  answer_key: string;
  explanation: string;
  image_path: string | null;
  image_caption: string | null;
  difficulty: string;
  tags: string[];
  subject: string;
  system: string;
  topic: string;
};

function normalizeExplanation(input: string, educationalObjective?: string | null) {
  const base = (input || "").trim();
  const objective = (educationalObjective || "").trim();
  if (base && objective && !/educational\s*objective\s*:/i.test(base)) {
    return `${base}\n\nEducational objective: ${objective}`;
  }
  if (base) return base;
  if (objective) return `Educational objective: ${objective}`;
  return "No explanation provided.";
}

function uniqueTags(...groups: Array<(string | null | undefined)[]>) {
  return [...new Set(groups.flat().map((item) => (item || "").trim()).filter(Boolean))];
}

function extractAssignedExpression(source: string, varName: string) {
  const startMatch = new RegExp(`const\\s+${varName}\\s*=\\s*`).exec(source);
  if (!startMatch || startMatch.index < 0) return "";
  let i = startMatch.index + startMatch[0].length;
  while (i < source.length && /\s/.test(source[i])) i += 1;
  const opener = source[i];
  const closer = opener === "[" ? "]" : opener === "{" ? "}" : "";
  if (!closer) return "";
  let depth = 0;
  let quote = "";
  let escaped = false;
  for (let j = i; j < source.length; j += 1) {
    const ch = source[j];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === "\\") {
      escaped = true;
      continue;
    }
    if (quote) {
      if (ch === quote) quote = "";
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      quote = ch;
      continue;
    }
    if (ch === opener) depth += 1;
    if (ch === closer) {
      depth -= 1;
      if (depth === 0) return source.slice(i, j + 1);
    }
  }
  return "";
}

function tryEvaluateExpression<T>(expression: string): T | null {
  if (!expression.trim()) return null;
  try {
    return vm.runInNewContext(`(${expression})`, {}, { timeout: 1000 }) as T;
  } catch {
    return null;
  }
}

function parseScriptStructuredData(sourceFileName: string, rawHtml: string, extraTags: string[], subject: string, fallbackDifficulty = "intermediate"): ImportRow[] {
  const rows: ImportRow[] = [];

  if (/Pediatrics_QBank/i.test(sourceFileName)) {
    const expr = extractAssignedExpression(rawHtml, "QUESTIONS");
    const questions = tryEvaluateExpression<Array<Record<string, unknown>>>(expr) || [];
    for (const item of questions) {
      const options = Array.isArray(item.options) ? item.options.filter((v): v is string => typeof v === "string" && v.trim()) : [];
      const correctIndex = typeof item.correct === "number" ? item.correct : 0;
      const stem = typeof item.stem === "string" ? item.stem.trim() : "";
      if (!stem || options.length < 2) continue;
      const choices = options.map((text, index) => ({ key: String.fromCharCode(65 + index), text: text.trim() }));
      rows.push({
        stem,
        choices,
        answer_key: choices[correctIndex]?.key || choices[0]?.key || "A",
        explanation: normalizeExplanation(typeof item.explanation === "string" ? item.explanation.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() : ""),
        image_path: typeof item.image === "string" ? item.image : null,
        image_caption: typeof item.image_caption === "string" ? item.image_caption : null,
        difficulty: fallbackDifficulty,
        tags: uniqueTags(extraTags, Array.isArray(item.tags) ? item.tags.map((tag) => String(tag)) : []),
        subject,
        system: subject,
        topic: typeof item.title === "string" && item.title.trim() ? item.title.trim() : subject,
      });
    }
  }

  if (/GYN_OBS_some_repeated/i.test(sourceFileName)) {
    const expr = extractAssignedExpression(rawHtml, "DATA");
    const data = tryEvaluateExpression<Record<string, unknown>>(expr) || {};
    const sections = Array.isArray(data.sections) ? (data.sections as Array<Record<string, unknown>>) : [];
    for (const section of sections) {
      const title = typeof section.title === "string" ? section.title.trim() : subject;
      const questions = Array.isArray(section.questions) ? (section.questions as Array<Record<string, unknown>>) : [];
      for (const item of questions) {
        const stem = typeof item.q === "string" ? item.q.trim() : "";
        const choiceStrings = Array.isArray(item.choices) ? item.choices.filter((v): v is string => typeof v === "string" && v.trim()) : [];
        if (!stem || choiceStrings.length < 2) continue;
        const choices = choiceStrings.map((text, index) => ({ key: String.fromCharCode(65 + index), text: text.replace(/^\s*[a-f][.)]\s*/i, "").trim() }));
        const answerText = typeof item.a === "string" ? item.a.trim().toLowerCase() : "";
        const answerKey = choices.find((choice) => answerText.startsWith(choice.key.toLowerCase()) || answerText.includes(choice.text.toLowerCase().slice(0, 24)))?.key || choices[0]?.key || "A";
        rows.push({
          stem,
          choices,
          answer_key: answerKey,
          explanation: normalizeExplanation(typeof item.a === "string" ? item.a.trim() : ""),
          image_path: null,
          image_caption: null,
          difficulty: fallbackDifficulty,
          tags: uniqueTags(extraTags, [title]),
          subject,
          system: subject,
          topic: title,
        });
      }
    }
  }

  return rows;
}

async function parseOne(entry: (typeof SUBJECT_IMPORT_DOCUMENTS)[number]) {
  if (!entry.bundleFilePath) {
    return { outputPath: "", sourceFile: entry.sourceFileName, questionCount: 0 };
  }

  const rawHtml = await fs.readFile(entry.localFilePath, "utf8");
  const htmlParsed = parseHtmlQuestions(rawHtml, { count: 1500, difficulty: "intermediate" });
  const parsedFromHtml = htmlParsed.map((q) => ({
    stem: q.stem,
    choices: q.choices,
    answer_key: q.answer_key,
    explanation: normalizeExplanation(q.explanation, q.educational_objective),
    image_path: q.image_path,
    image_caption: q.image_caption,
    difficulty: q.difficulty,
    tags: uniqueTags(q.tags, entry.extraTags, [entry.subject]),
    subject: entry.subject,
    system: entry.subject,
    topic: q.topic || entry.subject,
  }));

  const parsedFromFallback = extractQuestionsFromImportedSource(rawHtml, {
    count: 1500,
    preferredDifficulty: "intermediate",
    rawHtml,
  }).map((q) => ({
    stem: q.stem,
    choices: q.choices,
    answer_key: q.answer_key,
    explanation: normalizeExplanation(q.explanation, q.educational_objective),
    image_path: q.image_path || null,
    image_caption: q.image_caption || null,
    difficulty: q.difficulty,
    tags: uniqueTags(q.tags, entry.extraTags, [entry.subject, q.subject, q.system, q.topic]),
    subject: entry.subject,
    system: entry.subject,
    topic: q.topic || entry.subject,
  }));

  const parsed = parsedFromHtml.length
    ? parsedFromHtml
    : parsedFromFallback.length
      ? parsedFromFallback
      : parseScriptStructuredData(entry.sourceFileName, rawHtml, entry.extraTags, entry.subject);

  const rows: ImportRow[] = parsed.filter((row) => row.stem && row.choices?.length >= 2);
  await fs.mkdir(path.dirname(entry.bundleFilePath), { recursive: true });
  await fs.writeFile(entry.bundleFilePath, JSON.stringify(rows, null, 2), "utf8");

  return {
    outputPath: entry.bundleFilePath,
    sourceFile: entry.sourceFileName,
    questionCount: rows.length,
  };
}

async function main() {
  const summary: Array<{ file: string; output: string; questions: number }> = [];
  const combined: ImportRow[] = [];

  for (const entry of SUBJECT_IMPORT_DOCUMENTS.filter((item) => item.bundleFilePath)) {
    const result = await parseOne(entry);
    const payload = JSON.parse(await fs.readFile(result.outputPath, "utf8")) as ImportRow[];
    combined.push(...payload);
    summary.push({ file: result.sourceFile, output: path.basename(result.outputPath), questions: result.questionCount });
  }

  const outputDir = "/home/user/import_outputs";
  await fs.mkdir(outputDir, { recursive: true });
  await fs.writeFile(path.join(outputDir, "combined_ifom_import_bundle.json"), JSON.stringify(combined, null, 2), "utf8");
  await fs.writeFile(path.join(outputDir, "summary.json"), JSON.stringify(summary, null, 2), "utf8");
  console.log(JSON.stringify({ outputDir, summary, combinedQuestions: combined.length }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
