import { detectIfomSubject, detectTopic } from "./ifom";
import { normalizeText } from "./source-text";

export type PipelineSection = {
  title: string;
  content: string;
  order: number;
};

export type PipelineEntity = {
  label: string;
  type: "subject" | "topic" | "keyword";
  score: number;
};

export type PipelineStepState = {
  upload: "done";
  text_extraction: "done";
  medical_content_cleaning: "done";
  section_detection: "done";
  medical_entity_extraction: "done";
  knowledge_chunks: number;
  question_generation: "ready";
  flashcard_generation: "ready";
  rag_index: "ready";
};

const STOP = new Set([
  "the",
  "and",
  "for",
  "with",
  "that",
  "this",
  "from",
  "have",
  "been",
  "into",
  "your",
  "their",
  "than",
  "then",
  "were",
  "which",
  "patient",
  "patients",
  "clinical",
  "most",
  "likely",
  "following",
  "because",
  "after",
  "before",
  "during",
  "between",
  "within",
  "history",
  "present",
  "disease",
  "treatment",
  "medical",
  "system",
]);

function cleanLine(line: string) {
  return line
    .replace(/^\s*page\s+\d+\s*$/i, " ")
    .replace(/^\s*\d+\s*\/\s*\d+\s*$/, " ")
    .replace(/\u0000/g, " ")
    .replace(/[ \t]+/g, " ")
    .trim();
}

function titleCase(token: string) {
  return token.charAt(0).toUpperCase() + token.slice(1);
}

function scoreHeading(line: string) {
  if (!line) return 0;
  if (line.length > 90) return 0;
  let score = 0;
  if (/:$/.test(line)) score += 2;
  if (/^[A-Z0-9\s\-\/&,]+$/.test(line)) score += 2;
  if (/^[A-Z][A-Za-z0-9\s\-\/&,]+$/.test(line)) score += 1;
  if (/summary|overview|diagnosis|management|investigation|treatment|introduction|definition|complication/i.test(line)) score += 2;
  return score;
}

function tokenize(input: string) {
  return input
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]+/gu, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);
}

export function cleanMedicalContent(input: string) {
  const lines = input
    .replace(/\r/g, "")
    .split("\n")
    .map(cleanLine)
    .filter(Boolean);

  const cleaned = lines.join("\n").replace(/\n{3,}/g, "\n\n");
  return normalizeText(cleaned);
}

export function detectSections(input: string): PipelineSection[] {
  const source = input.replace(/\r/g, "").trim();
  if (!source) return [];

  const blocks = source
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);

  const sections: PipelineSection[] = [];
  let activeTitle = "Clinical Overview";
  let activeContent: string[] = [];

  const flush = () => {
    const content = normalizeText(activeContent.join("\n\n"));
    if (!content) return;
    sections.push({
      title: activeTitle,
      content,
      order: sections.length + 1,
    });
    activeContent = [];
  };

  for (const block of blocks) {
    const lines = block.split("\n").map((line) => line.trim()).filter(Boolean);
    const firstLine = lines[0] || "";
    if (lines.length > 1 && scoreHeading(firstLine) >= 2) {
      flush();
      activeTitle = firstLine.replace(/:$/, "");
      activeContent = [lines.slice(1).join(" ")];
      continue;
    }
    activeContent.push(block);
  }
  flush();

  if (sections.length) return sections;

  const fallback: PipelineSection[] = [];
  const paragraphs = source.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  let bucket: string[] = [];
  for (const paragraph of paragraphs) {
    bucket.push(paragraph);
    const joined = bucket.join(" ");
    if (joined.length >= 900) {
      fallback.push({
        title: `Section ${fallback.length + 1}`,
        content: normalizeText(joined),
        order: fallback.length + 1,
      });
      bucket = [];
    }
  }

  if (bucket.length) {
    fallback.push({
      title: `Section ${fallback.length + 1}`,
      content: normalizeText(bucket.join(" ")),
      order: fallback.length + 1,
    });
  }

  return fallback;
}

export function extractMedicalEntities(input: string, subject?: string, topic?: string): PipelineEntity[] {
  const counts = new Map<string, number>();
  for (const token of tokenize(input)) {
    if (token.length < 4 || STOP.has(token)) continue;
    counts.set(token, (counts.get(token) || 0) + 1);
  }

  const rankedKeywords = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([label, score]) => ({ label: titleCase(label), type: "keyword" as const, score }));

  const entities: PipelineEntity[] = [];
  if (subject) entities.push({ label: subject, type: "subject", score: 100 });
  if (topic) entities.push({ label: topic, type: "topic", score: 90 });
  entities.push(...rankedKeywords);

  const seen = new Set<string>();
  return entities.filter((entity) => {
    const key = entity.label.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function buildKnowledgeChunks(cleanedText: string, sections: PipelineSection[], max = 1200, overlap = 150) {
  const prepared = sections.length
    ? sections.map((section) => `[${section.title}]\n${section.content}`)
    : [cleanedText];

  const chunks: string[] = [];
  for (const block of prepared) {
    const normalized = normalizeText(block);
    if (!normalized) continue;
    for (let i = 0; i < normalized.length; i += max - overlap) {
      chunks.push(normalized.slice(i, i + max));
      if (i + max >= normalized.length) break;
    }
  }
  return chunks;
}

export function createMedicalKnowledgePipeline(rawText: string) {
  const cleanedText = cleanMedicalContent(rawText);
  const subject = detectIfomSubject(cleanedText);
  const topic = detectTopic(cleanedText, subject);
  const sections = detectSections(cleanedText);
  const entities = extractMedicalEntities(cleanedText, subject, topic);
  const chunks = buildKnowledgeChunks(cleanedText, sections);

  const stepState: PipelineStepState = {
    upload: "done",
    text_extraction: "done",
    medical_content_cleaning: "done",
    section_detection: "done",
    medical_entity_extraction: "done",
    knowledge_chunks: chunks.length,
    question_generation: "ready",
    flashcard_generation: "ready",
    rag_index: "ready",
  };

  return {
    cleanedText,
    subject,
    topic,
    sections,
    entities,
    chunks,
    stepState,
  };
}
