"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { createClient } from "@/lib/supabase/client";
import { repairQuestion } from "@/lib/question-normalizer";
import {
  ArrowLeft,
  Bell,
  BookmarkPlus,
  BookOpen,
  Calculator,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Expand,
  Flag,
  FlaskConical,
  FolderTree,
  Highlighter,
  ImageIcon,
  Lightbulb,
  List,
  Maximize2,
  Minimize2,
  Minus,
  MoreVertical,
  Pause,
  PencilLine,
  Play,
  Plus,
  Target,
  X,
  XCircle,
} from "lucide-react";
import Link from "next/link";

type Q = {
  id: string;
  stem: string;
  choices: { key: string; text: string }[];
  answer_key: string;
  explanation: string | null;
  difficulty: string;
  tags: string[];
  image_path?: string | null;
  image_caption?: string | null;
  video_url?: string | null;
};

type Mode = "tutor" | "exam" | "timed";

type Result = {
  id: string;
  chosen: string;
  correct: boolean;
};

type ContextTab = "figure" | "labs" | "calculator";

type LabItem = {
  test: string;
  value: string;
  ref: string;
  tone?: "normal" | "abnormal";
};

type ClinicalDatum = {
  label: string;
  value: string;
  ref?: string;
  tone?: "normal" | "abnormal";
};

type ClinicalSection = {
  title: string;
  items: ClinicalDatum[];
};

const LAB_REFERENCE: Record<string, LabItem[]> = {
  CBC: [
    { test: "WBC", value: "6.8 ×10³/µL", ref: "4.0 – 10.0" },
    { test: "RBC", value: "4.51 ×10⁶/µL", ref: "3.8 – 5.2" },
    { test: "Hemoglobin", value: "13.2 g/dL", ref: "12.0 – 15.5" },
    { test: "Hematocrit", value: "39.8 %", ref: "36 – 46" },
    { test: "MCV", value: "88 fL", ref: "80 – 100" },
    { test: "Platelets", value: "245 ×10³/µL", ref: "150 – 400" },
  ],
  BMP: [
    { test: "Na⁺", value: "138 mEq/L", ref: "135 – 145" },
    { test: "K⁺", value: "4.2 mEq/L", ref: "3.5 – 5.0" },
    { test: "Cl⁻", value: "102 mEq/L", ref: "98 – 106" },
    { test: "HCO₃⁻", value: "24 mEq/L", ref: "22 – 28" },
    { test: "BUN", value: "16 mg/dL", ref: "7 – 20" },
    { test: "Creatinine", value: "0.9 mg/dL", ref: "0.6 – 1.3" },
  ],
  LFTs: [
    { test: "AST", value: "24 U/L", ref: "10 – 40" },
    { test: "ALT", value: "28 U/L", ref: "7 – 56" },
    { test: "ALP", value: "88 U/L", ref: "44 – 147" },
    { test: "Total bilirubin", value: "0.8 mg/dL", ref: "0.2 – 1.2" },
    { test: "Albumin", value: "4.1 g/dL", ref: "3.5 – 5.0" },
  ],
  Coagulation: [
    { test: "PT", value: "12.1 s", ref: "11 – 13.5" },
    { test: "INR", value: "1.0", ref: "0.8 – 1.1" },
    { test: "aPTT", value: "31 s", ref: "25 – 35" },
    { test: "Fibrinogen", value: "310 mg/dL", ref: "200 – 400" },
  ],
  ABG: [
    { test: "pH", value: "7.40", ref: "7.35 – 7.45" },
    { test: "PaCO₂", value: "40 mmHg", ref: "35 – 45" },
    { test: "HCO₃⁻", value: "24 mEq/L", ref: "22 – 26" },
    { test: "PaO₂", value: "94 mmHg", ref: "80 – 100" },
  ],
  Endocrine: [
    { test: "TSH", value: "2.1 µIU/mL", ref: "0.4 – 4.5" },
    { test: "Free T4", value: "1.1 ng/dL", ref: "0.8 – 1.8" },
    { test: "Morning cortisol", value: "14 µg/dL", ref: "5 – 25" },
  ],
  Urinalysis: [
    { test: "Specific gravity", value: "1.018", ref: "1.005 – 1.030" },
    { test: "Protein", value: "Negative", ref: "Negative" },
    { test: "Glucose", value: "Negative", ref: "Negative" },
    { test: "RBC / HPF", value: "0 – 2", ref: "0 – 2" },
  ],
  CSF: [
    { test: "Opening pressure", value: "15 cm H₂O", ref: "10 – 20" },
    { test: "Protein", value: "34 mg/dL", ref: "15 – 45" },
    { test: "Glucose", value: "64 mg/dL", ref: "50 – 80" },
    { test: "WBC", value: "2 /µL", ref: "0 – 5" },
  ],
};

function assetHref(path?: string | null) {
  if (!path) return "";
  if (/\$\{/.test(path)) return "";
  if (/^(https?:|data:|blob:|\/)\/?/i.test(path)) return path;
  return `/api/assets/${path.split("/").map(encodeURIComponent).join("/")}`;
}

function splitExplanation(value?: string | null) {
  const raw = (value || "").trim();
  if (!raw) return { explanation: "", educationalObjective: "" };
  const parts = raw.split(/educational\s*objective\s*:/i);
  return {
    explanation: parts[0]?.trim() || "",
    educationalObjective: parts[1]?.trim() || "",
  };
}

function normalizeCapturedValue(value: string) {
  return value.replace(/^[\s:=,-]+|[\s,;:.]+$/g, "").replace(/\s+/g, " ").trim();
}

const LAB_PANEL_LABELS = [
  "na+", "na", "k+", "k", "cl-", "cl", "hco3", "hco3-", "bun", "creatinine", "glucose", "calcium",
  "wbc", "hemoglobin", "platelets", "hematocrit", "mcv",
  "ast", "alt", "alp", "total bilirubin", "bilirubin", "albumin", "ck", "troponin i", "troponin", "amylase", "lipase",
  "pt", "inr", "aptt", "paco2", "pao2", "ph",
  "total cholesterol", "cholesterol", "ldl", "hdl", "triglycerides", "tg",
];

function toDisplayText(value: string) {
  return value
    .replace(/<br\s*\/?/gi, "<br")
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/\r/g, "")
    .replace(/[ 	]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function normalizeLineKey(value: string) {
  return value.toLowerCase().replace(/[–—−]/g, "-").replace(/\s+/g, " ").trim();
}

function isLabHeadingLine(value: string) {
  return /^(lab|labs|laboratory|laboratory data|laboratory studies|lab value|lab values|value)$/i.test(value.trim());
}

function isLabSectionHeading(value: string) {
  return /^(cbc|chemistry|enzymes|coagulation|abg|bmp|cmp|lfts?|cardiac enzymes)$/i.test(value.trim());
}

function isLabLabelLine(value: string) {
  const normalized = normalizeLineKey(value).replace(/[():]/g, "");
  return LAB_PANEL_LABELS.some((label) => normalized === label || normalized.startsWith(`${label} `))
}

function isLabValueLine(value: string) {
  return /\d/.test(value) && /(m?eq\/l|mmol\/l|mg\/dl|g\/dl|u\/l|units?\/l|ng\/ml|ng\/l|mm\s*hg|%|\/μ?l|\/u?l|fl|s(?:econds?)?\b)/i.test(value);
}

function extractClinicalSections(stem: string): ClinicalSection[] {
  const text = stem.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  if (!text) return [];

  const sections: ClinicalSection[] = [];
  const pushSection = (title: string, items: ClinicalDatum[]) => {
    const seen = new Set<string>();
    const unique = items.filter((item) => {
      const key = item.label.toLowerCase();
      if (!item.value || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    if (unique.length) sections.push({ title, items: unique });
  };

  const capture = (regex: RegExp) => {
    const match = text.match(regex);
    return match?.[1] ? normalizeCapturedValue(match[1]) : "";
  };

  const datum = (label: string, regex: RegExp, ref?: string): ClinicalDatum => ({
    label,
    value: capture(regex),
    ref,
    tone: "normal",
  });

  const chemistries: ClinicalDatum[] = [
    datum("Na⁺", /(?:\bna(?:\+)?\b|sodium)[\s:=]*([^•;,]+?(?:m?eq\/l|mmol\/l))/i, "135 – 145 mEq/L"),
    datum("K⁺", /(?:\bk(?:\+)?\b|potassium)[\s:=]*([^•;,]+?(?:m?eq\/l|mmol\/l))/i, "3.5 – 5.0 mEq/L"),
    datum("Cl⁻", /(?:\bcl(?:-|−|⁻)?\b|chloride)[\s:=]*([^•;,]+?(?:m?eq\/l|mmol\/l))/i, "98 – 106 mEq/L"),
    datum("HCO₃⁻", /(?:hco3|bicarbonate|co2)[\s:=]*([^•;,]+?(?:m?eq\/l|mmol\/l))/i, "22 – 28 mEq/L"),
    datum("BUN", /(?:\bbun\b|blood urea nitrogen)[\s:=]*([^•;,]+?(?:mg\/dl))/i, "7 – 20 mg/dL"),
    datum("Creatinine", /(?:creatinine|\bcr\b)[\s:=]*([^•;,]+?(?:mg\/dl))/i, "0.6 – 1.3 mg/dL"),
    datum("Glucose", /(?:glucose)[\s:=]*([^•;,]+?(?:mg\/dl))/i, "70 – 100 mg/dL"),
    datum("Calcium", /(?:calcium|\bca\b)[\s:=]*([^•;,]+?(?:mg\/dl))/i, "8.5 – 10.5 mg/dL"),
  ].filter((item) => item.value);
  pushSection("Chemistry", chemistries);

  const hematology: ClinicalDatum[] = [
    datum("WBC", /(?:wbc|white blood cells?)[\s:=]*([^•;,]+?(?:×?10\^?3\/?μ?l|x10\^?3\/?u?l|\/μ?l|\/u?l))/i, "4.0 – 10.0 ×10³/µL"),
    datum("Hemoglobin", /(?:hemoglobin|hgb)[\s:=]*([^•;,]+?(?:g\/dl))/i, "12.0 – 15.5 g/dL"),
    datum("Platelets", /(?:platelets?|plt)[\s:=]*([^•;,]+?(?:×?10\^?3\/?μ?l|x10\^?3\/?u?l|\/μ?l|\/u?l))/i, "150 – 400 ×10³/µL"),
    datum("Hematocrit", /(?:hematocrit|hct)[\s:=]*([^•;,]+?(?:%))/i, "36 – 46 %"),
    datum("MCV", /(?:\bmcv\b)[\s:=]*([^•;,]+?(?:fl))/i, "80 – 100 fL"),
  ].filter((item) => item.value);
  pushSection("CBC", hematology);

  const enzymes: ClinicalDatum[] = [
    datum("AST", /(?:\bast\b|aspartate aminotransferase)[\s:=]*([^•;,]+?(?:u\/l|units?\/l))/i, "10 – 40 U/L"),
    datum("ALT", /(?:\balt\b|alanine aminotransferase)[\s:=]*([^•;,]+?(?:u\/l|units?\/l))/i, "7 – 56 U/L"),
    datum("ALP", /(?:\balp\b|alkaline phosphatase)[\s:=]*([^•;,]+?(?:u\/l|units?\/l))/i, "44 – 147 U/L"),
    datum("Total bilirubin", /(?:total bilirubin|bilirubin)[\s:=]*([^•;,]+?(?:mg\/dl))/i, "0.2 – 1.2 mg/dL"),
    datum("Albumin", /(?:albumin)[\s:=]*([^•;,]+?(?:g\/dl))/i, "3.5 – 5.0 g/dL"),
    datum("CK", /(?:\bck\b|creatine kinase|creatine phosphokinase)[\s:=]*([^•;,]+?(?:u\/l|units?\/l))/i, "30 – 200 U/L"),
    datum("Troponin I", /(?:troponin\s*i?)[\s:=]*([^•;,]+?(?:ng\/ml|ng\/l))/i, "< 0.04 ng/mL"),
    datum("Amylase", /(?:amylase)[\s:=]*([^•;,]+?(?:u\/l|units?\/l))/i, "30 – 110 U/L"),
    datum("Lipase", /(?:lipase)[\s:=]*([^•;,]+?(?:u\/l|units?\/l))/i, "0 – 160 U/L"),
  ].filter((item) => item.value);
  pushSection("Enzymes", enzymes);

  const coagulation: ClinicalDatum[] = [
    datum("PT", /(?:\bpt\b|prothrombin time)[\s:=]*([^•;,]+?(?:s(?:econds?)?\b|\d+(?:\.\d+)?))/i, "11 – 13.5 s"),
    datum("INR", /(?:\binr\b)[\s:=]*([^•;,]+?(?:\d+(?:\.\d+)?))/i, "0.8 – 1.1"),
    datum("aPTT", /(?:aptt|activated partial thromboplastin time)[\s:=]*([^•;,]+?(?:s(?:econds?)?\b|\d+(?:\.\d+)?))/i, "25 – 35 s"),
  ].filter((item) => item.value);
  pushSection("Coagulation", coagulation);

  const gases: ClinicalDatum[] = [
    datum("pH", /(?:\bph\b)[\s:=]*([^•;,]+)/i, "7.35 – 7.45"),
    datum("PaCO₂", /(?:paco2)[\s:=]*([^•;,]+?(?:mm\s*hg))/i, "35 – 45 mmHg"),
    datum("PaO₂", /(?:pao2)[\s:=]*([^•;,]+?(?:mm\s*hg))/i, "80 – 100 mmHg"),
  ].filter((item) => item.value);
  pushSection("ABG", gases);

  const lipids: ClinicalDatum[] = [
    datum("Total cholesterol", /(?:total cholesterol|cholesterol)[\s:=]*([^•;,]+?(?:mg\/dl))/i, "< 200 mg/dL"),
    datum("LDL", /(?:\bldl\b|ldl cholesterol)[\s:=]*([^•;,]+?(?:mg\/dl))/i, "< 100 mg/dL"),
    datum("HDL", /(?:\bhdl\b|hdl cholesterol)[\s:=]*([^•;,]+?(?:mg\/dl))/i, "> 40 mg/dL"),
    datum("Triglycerides", /(?:triglycerides|\btg\b)[\s:=]*([^•;,]+?(?:mg\/dl))/i, "< 150 mg/dL"),
  ].filter((item) => item.value);
  pushSection("Lipid profile", lipids);

  return sections;
}

type StemPresentation = {
  title: string | null;
  stemBody: string;
  labSections: ClinicalSection[];
  derivedSections: ClinicalSection[];
  hasExplicitLabPanel: boolean;
};

function splitQuestionTitle(stemBody: string) {
  const cleaned = stemBody.trim();
  const lines = cleaned.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  const looksLikeScenarioStart = (value: string) => /^(?:A|An|The)?\s*(?:\d{1,2}-year-old\b|man\b|woman\b|patient\b|infant\b|child\b|newborn\b|pregnant woman\b|person\b|he\b|she\b|they\b|this patient\b|presents\b|comes\b|is brought\b)/i.test(value.trim());
  const looksLikeTitleLine = (value: string) => {
    const normalized = value.replace(/[.:!?]+$/g, "").trim();
    const words = normalized.split(/\s+/).filter(Boolean);
    return (
      normalized.length >= 12 &&
      normalized.length <= 140 &&
      words.length >= 2 &&
      words.length <= 18 &&
      !/\b(\d{1,2}-year-old|comes to|presents to|history of|physical exam|which of the following)\b/i.test(normalized)
    );
  };

  if (lines.length >= 2 && looksLikeTitleLine(lines[0]) && looksLikeScenarioStart(lines[1])) {
    return { title: lines[0].replace(/[.:]+$/g, "").trim(), stemBody: lines.slice(1).join("\n\n").trim() };
  }

  const inlineMatch = cleaned.match(/^(.{12,140}?)[.:]\s+(?=(?:A|An|The)?\s*(?:\d{1,2}-year-old\b|man\b|woman\b|patient\b|infant\b|child\b|newborn\b|pregnant woman\b|person\b|he\b|she\b|they\b|this patient\b|presents\b|comes\b|is brought\b))([\s\S]+)$/i);
  if (inlineMatch) {
    const title = inlineMatch[1].trim();
    const remainder = inlineMatch[2].trim();
    if (looksLikeTitleLine(title) && remainder) {
      return { title, stemBody: remainder };
    }
  }

  return { title: null, stemBody: cleaned };
}

function extractExplicitLabPanel(displayText: string) {
  const lines = displayText.split("\n").map((line) => line.trim());
  let start = -1;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line) continue;
    if (isLabHeadingLine(line)) {
      start = i;
      break;
    }
    if (isLabLabelLine(line) && isLabValueLine(lines[i + 1] || "")) {
      let pairs = 0;
      let j = i;
      while (j < lines.length) {
        if (isLabHeadingLine(lines[j]) || isLabSectionHeading(lines[j]) || !lines[j]) {
          j += 1;
          continue;
        }
        if (isLabLabelLine(lines[j]) && isLabValueLine(lines[j + 1] || "")) {
          pairs += 1;
          j += 2;
          continue;
        }
        break;
      }
      if (pairs >= 3) {
        start = i;
        break;
      }
    }
  }

  if (start === -1) {
    return { stemBody: displayText.trim(), labSections: [], hasExplicitLabPanel: false };
  }

  let end = start;
  let pairs = 0;
  while (end < lines.length) {
    const line = lines[end];
    if (!line || isLabHeadingLine(line) || isLabSectionHeading(line)) {
      end += 1;
      continue;
    }
    if (isLabLabelLine(line) && isLabValueLine(lines[end + 1] || "")) {
      pairs += 1;
      end += 2;
      continue;
    }
    if (pairs >= 3) break;
    end += 1;
  }

  if (pairs < 3) {
    return { stemBody: displayText.trim(), labSections: [], hasExplicitLabPanel: false };
  }

  const panelText = lines.slice(start, end).filter(Boolean).join("\n");
  const stemBody = [...lines.slice(0, start), ...lines.slice(end)]
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  const labSections = extractClinicalSections(panelText);
  return { stemBody, labSections, hasExplicitLabPanel: labSections.length > 0 };
}

function getStemPresentation(stem: string): StemPresentation {
  const displayText = toDisplayText(stem);
  const labPanel = extractExplicitLabPanel(displayText);
  const titled = splitQuestionTitle(labPanel.stemBody);
  const derivedSections = extractClinicalSections(titled.stemBody);
  return {
    title: titled.title,
    stemBody: titled.stemBody,
    labSections: labPanel.labSections,
    derivedSections,
    hasExplicitLabPanel: labPanel.hasExplicitLabPanel,
  };
}

function ClinicalDataTables({
  sections,
  title,
  subtitle,
}: {
  sections: ClinicalSection[];
  title: string;
  subtitle?: string;
}) {
  if (!sections.length) return null;
  return (
    <div className="rounded-[22px] border p-4" style={{ borderColor: "rgba(37,99,235,0.20)", background: "var(--qb-blue-soft)" }}>
      <div>
        <div className="text-[11px] font-bold uppercase tracking-[0.16em]" style={{ color: "var(--qb-blue-text)" }}>{title}</div>
        {subtitle ? <div className="mt-1 text-xs" style={{ color: "var(--qb-panel-muted)" }}>{subtitle}</div> : null}
      </div>
      <div className="mt-4 space-y-4">
        {sections.map((section) => (
          <div key={section.title} className="overflow-hidden rounded-[18px] border" style={{ borderColor: "var(--qb-panel-soft-border)", background: "var(--qb-panel-soft)" }}>
            <div className="border-b px-4 py-3 text-sm font-semibold" style={{ borderColor: "var(--qb-panel-soft-border)", color: "var(--qb-panel-title)" }}>
              {section.title}
            </div>
            <div className="grid grid-cols-[1.15fr_0.85fr] gap-3 border-b px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] md:grid-cols-[1.1fr_1fr_1fr]" style={{ borderColor: "var(--qb-panel-soft-border)", color: "var(--qb-panel-muted)" }}>
              <div>Item</div>
              <div>Value</div>
              <div className="hidden md:block">Reference</div>
            </div>
            {section.items.map((item) => (
              <div key={`${section.title}-${item.label}`} className="grid grid-cols-[1.15fr_0.85fr] gap-3 border-b px-4 py-3 text-sm last:border-b-0 md:grid-cols-[1.1fr_1fr_1fr]" style={{ borderColor: "var(--qb-panel-soft-border)", color: "var(--qb-panel-text)" }}>
                <div className="font-medium">{item.label}</div>
                <div className="text-right font-semibold md:text-left" style={{ color: item.tone === "abnormal" ? "#fca5a5" : "#86efac" }}>{item.value}</div>
                <div className="col-span-2 text-[12px] md:hidden" style={{ color: "var(--qb-panel-muted)" }}>Reference: {item.ref || "—"}</div>
                <div className="hidden md:block" style={{ color: "var(--qb-panel-muted)" }}>{item.ref || "—"}</div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function getTopic(tags: string[]) {
  return tags.filter(Boolean).slice(1, 3).join(" · ") || "Clinical reasoning";
}

function excerpt(value: string, max = 90) {
  const trimmed = value.replace(/\s+/g, " ").trim();
  return trimmed.length > max ? `${trimmed.slice(0, max).trim()}…` : trimmed;
}

function difficultyStyle(d: string) {
  if (!d) return { color: "var(--c-text-4)", bg: "var(--c-elevated)", border: "var(--c-border)" };
  const l = d.toLowerCase();
  if (l === "easy") return { color: "#22c55e", bg: "rgba(34,197,94,0.08)", border: "rgba(34,197,94,0.28)" };
  if (l === "hard") return { color: "#ef4444", bg: "rgba(239,68,68,0.08)", border: "rgba(239,68,68,0.28)" };
  return { color: "#f59e0b", bg: "rgba(245,158,11,0.08)", border: "rgba(245,158,11,0.28)" };
}

function formatTime(totalSeconds: number) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export default function QBankRunner({
  questions,
  mode: initialMode = "tutor",
  subjectLabel = "Mixed Session",
  exam = "IFOM_CSE",
  backHref = "/qbank",
  sessionId,
}: {
  questions: Q[];
  mode?: Mode;
  subjectLabel?: string;
  exam?: string;
  backHref?: string;
  sessionId?: string;
}) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [i, setI] = useState(0);
  const [picks, setPicks] = useState<(string | null)[]>(() => Array(questions.length).fill(null));
  const [revealeds, setRevealeds] = useState<boolean[]>(() => Array(questions.length).fill(false));
  const [results, setResults] = useState<Result[]>([]);
  const [seconds, setSeconds] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [toolStatus, setToolStatus] = useState<string | null>(null);
  const [toolBusy, setToolBusy] = useState<"highlight" | "bookmark" | "note" | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [questionMapOpen, setQuestionMapOpen] = useState(true);
  const [contextVisible, setContextVisible] = useState(true);
  const [contextTab, setContextTab] = useState<ContextTab>("labs");
  const [labCategory, setLabCategory] = useState<string>("CBC");
  const [imageOpen, setImageOpen] = useState(false);
  const [imageZoom, setImageZoom] = useState(1);
  const [focusMode, setFocusMode] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [calcNa, setCalcNa] = useState("140");
  const [calcCl, setCalcCl] = useState("102");
  const [calcHco3, setCalcHco3] = useState("24");
  const [isDarkTheme, setIsDarkTheme] = useState(true);

  const picked = picks[i] ?? null;
  const revealed = revealeds[i] ?? false;

  const sessionIdRef = useRef<string | null>(sessionId || null);
  const resultsRef = useRef<Result[]>([]);
  const iRef = useRef(0);
  const secondsRef = useRef(0);

  useEffect(() => {
    setContextTab("labs");
    setImageOpen(false);
    setImageZoom(1);
  }, [i]);

  useEffect(() => {
    resultsRef.current = results;
  }, [results]);
  useEffect(() => {
    iRef.current = i;
  }, [i]);
  useEffect(() => {
    secondsRef.current = seconds;
  }, [seconds]);

  useEffect(() => {
    const onFullscreen = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFullscreen);
    return () => document.removeEventListener("fullscreenchange", onFullscreen);
  }, []);

  useEffect(() => {
    const syncTheme = () => setIsDarkTheme(document.documentElement.classList.contains("dark"));
    syncTheme();
    const observer = new MutationObserver(syncTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (focusMode) {
      setQuestionMapOpen(false);
      setContextVisible(false);
    }
  }, [focusMode]);

  useEffect(() => {
    if (sessionIdRef.current || !questions.length) return;
    let cancelled = false;
    fetch("/api/quiz/configure", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: initialMode === "tutor" ? "Tutor" : initialMode === "exam" ? "Exam" : "Timed",
        exam_code: exam,
        subject_title: subjectLabel,
        question_count: questions.length,
        question_ids: questions.map((q) => q.id),
      }),
    })
      .then((r) => r.json())
      .catch(() => null)
      .then((data) => {
        if (cancelled) return;
        if (data?.session?.id) sessionIdRef.current = data.session.id;
      });
    return () => {
      cancelled = true;
    };
  }, [exam, initialMode, questions, subjectLabel]);

  useEffect(() => {
    function saveAsSuspended() {
      const sid = sessionIdRef.current;
      if (!sid) return;
      const answersMap: Record<string, { chosen: string; correct: boolean }> = {};
      resultsRef.current.forEach((r) => {
        answersMap[r.id] = { chosen: r.chosen, correct: r.correct };
      });
      fetch(`/api/quiz/sessions/${sid}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        keepalive: true,
        body: JSON.stringify({
          status: resultsRef.current.length >= questions.length ? "complete" : "suspended",
          current_index: iRef.current,
          answers_json: answersMap,
          seconds_elapsed: secondsRef.current,
        }),
      }).catch(() => {});
    }
    const onVisibility = () => {
      if (document.visibilityState === "hidden") saveAsSuspended();
    };
    window.addEventListener("pagehide", saveAsSuspended);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", saveAsSuspended);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [questions.length]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    if (!isPaused && !revealed && i < questions.length) {
      interval = setInterval(() => setSeconds((s) => s + 1), 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [i, isPaused, questions.length, revealed]);

  const answered = results.length;
  const correctCount = results.filter((r) => r.correct).length;
  const incorrectCount = answered - correctCount;
  const accuracy = answered ? Math.round((correctCount / answered) * 100) : 0;
  const navigatorItems = questions.map((item, idx) => {
    const result = results.find((r) => r.id === item.id);
    return { item, idx, result, picked: picks[idx], revealed: revealeds[idx] };
  });

  async function toggleFullscreen() {
    try {
      if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
      else await document.exitFullscreen();
    } catch {
      // ignore
    }
  }

  async function patchSession(patch: Record<string, unknown>) {
    const sid = sessionIdRef.current;
    if (!sid) return;
    try {
      await fetch(`/api/quiz/sessions/${sid}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
    } catch {
      // ignore
    }
  }

  if (!questions.length) {
    return (
      <div className="card mt-6 p-10 text-center" style={{ color: "var(--c-text-3)" }}>
        <Target className="mx-auto mb-3 h-8 w-8 opacity-40" />
        <p className="font-medium">No questions found for this selection.</p>
      </div>
    );
  }

  if (i >= questions.length) {
    return (
      <div className="min-h-[100dvh]" style={{ background: "var(--c-bg)" }}>
        <div className="mx-auto max-w-5xl px-4 py-8 md:px-6">
          <div className="overflow-hidden rounded-[30px] border" style={{ background: "var(--c-card)", borderColor: "var(--c-border)", boxShadow: "var(--shadow-elevated)" }}>
            <div className="h-1.5 w-full bg-gradient-to-r from-brand via-cyan-400 to-violet-500" />
            <div className="p-8 text-center">
              <div className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-[11px] font-bold uppercase tracking-widest" style={{ background: "var(--c-brand-bg)", color: "var(--c-brand)", border: "1px solid var(--c-brand-border)" }}>
                Session Complete
              </div>
              <div className="mt-4 text-3xl font-bold tracking-tight" style={{ color: "var(--c-text-1)" }}>{subjectLabel}</div>
              <div className="mt-1 text-sm" style={{ color: "var(--c-text-3)" }}>{correctCount} of {questions.length} correct</div>
              <div className="mt-3 text-5xl font-extrabold text-brand">{accuracy}%</div>
              <div className="mx-auto mt-6 max-w-lg">
                <div className="flex h-3 w-full overflow-hidden rounded-full" style={{ background: "var(--c-elevated)" }}>
                  <div className="h-full rounded-full bg-gradient-to-r from-brand to-cyan-400 transition-all duration-700" style={{ width: `${accuracy}%` }} />
                </div>
              </div>
              <div className="mt-6 grid grid-cols-2 gap-3 text-left sm:grid-cols-4">
                <Metric label="Answered" value={answered} color="var(--c-text-1)" />
                <Metric label="Correct" value={correctCount} color="#22c55e" />
                <Metric label="Incorrect" value={incorrectCount} color="#ef4444" />
                <Metric label="Accuracy" value={`${accuracy}%`} color="#38bdf8" />
              </div>
              <Link href={backHref} className="btn-primary mt-6 w-full">Back to Q-Bank</Link>
            </div>
          </div>
          <div className="mt-5 space-y-2.5">
            {questions.map((question, idx) => {
              const result = results[idx];
              return (
                <div key={question.id} className="card px-4 py-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="text-sm font-medium leading-relaxed" style={{ color: "var(--c-text-2)" }}>
                      <span className="mr-1 font-normal" style={{ color: "var(--c-text-4)" }}>{idx + 1}.</span>
                      {excerpt(question.stem)}
                    </div>
                    {result?.correct ? (
                      <span className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider" style={{ color: "#22c55e", background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)" }}>
                        <CheckCircle2 className="h-3 w-3" /> Correct
                      </span>
                    ) : (
                      <span className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider" style={{ color: "#ef4444", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
                        <XCircle className="h-3 w-3" /> Wrong
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  const rawQ = questions[i];
  const q = repairQuestion(rawQ);
  const imageHref = assetHref(q.image_path);
  const topic = getTopic(q.tags);
  const diff = difficultyStyle(q.difficulty);
  const details = splitExplanation(q.explanation);
  const stemPresentation = getStemPresentation(q.stem);
  const questionTitle = stemPresentation.title;
  const questionStemBody = stemPresentation.stemBody;
  const clinicalSections = stemPresentation.labSections;
  const derivedSections = stemPresentation.derivedSections;
  const hasQuestionSpecificData = stemPresentation.hasExplicitLabPanel && clinicalSections.length > 0;
  const hasDerivedClinicalData = !hasQuestionSpecificData && derivedSections.length > 0;
  const progressPct = ((i + 1) / questions.length) * 100;
  const isCorrectAnswer = picked === q.answer_key;
  const wrongChoices = q.choices.filter((choice) => choice.key !== q.answer_key);
  const labItems = LAB_REFERENCE[labCategory] ?? [];
  const anionGap = Number(calcNa || 0) - (Number(calcCl || 0) + Number(calcHco3 || 0));


  const runnerVars = (isDarkTheme ? {
    "--qb-shell-bg": "radial-gradient(circle at top right, rgba(37,99,235,0.12), transparent 28%), var(--c-bg)",
    "--qb-chrome-bg": "rgba(6,11,24,0.86)",
    "--qb-chrome-border": "rgba(255,255,255,0.08)",
    "--qb-chrome-button-bg": "rgba(12,18,34,0.92)",
    "--qb-chrome-button-border": "rgba(255,255,255,0.08)",
    "--qb-chrome-text": "#dbe6ff",
    "--qb-chrome-muted": "#92a2bf",
    "--qb-panel-bg": "linear-gradient(180deg, rgba(12,18,34,0.96), rgba(8,13,26,0.96))",
    "--qb-panel-border": "rgba(255,255,255,0.08)",
    "--qb-panel-shadow": "0 18px 48px rgba(0,0,0,0.22)",
    "--qb-panel-title": "#ffffff",
    "--qb-panel-text": "#dce5f4",
    "--qb-panel-muted": "#7f90ae",
    "--qb-panel-soft": "rgba(255,255,255,0.03)",
    "--qb-panel-soft-alt": "rgba(255,255,255,0.02)",
    "--qb-panel-soft-border": "rgba(255,255,255,0.06)",
    "--qb-question-card-bg": "linear-gradient(180deg, rgba(12,18,34,0.97), rgba(8,13,26,0.97))",
    "--qb-question-card-border": "rgba(255,255,255,0.08)",
    "--qb-question-card-shadow": "0 18px 48px rgba(0,0,0,0.22)",
    "--qb-question-text": "#f8fbff",
    "--qb-choice-bubble-bg": "rgba(255,255,255,0.05)",
    "--qb-footer-bg": "rgba(6,11,24,0.88)",
    "--qb-footer-border": "rgba(255,255,255,0.08)",
    "--qb-blue": "#2563eb",
    "--qb-blue-soft": "rgba(37,99,235,0.12)",
    "--qb-blue-text": "#93c5fd",
    "--qb-progress-bg": "rgba(255,255,255,0.05)",
    "--qb-report-bg": "rgba(127,29,29,0.18)",
    "--qb-report-border": "rgba(248,113,113,0.28)",
    "--qb-report-chip-bg": "rgba(12,18,34,0.90)",
    "--qb-report-chip-border": "rgba(248,113,113,0.24)",
    "--qb-report-text": "#fecaca",
    "--qb-report-chip-text": "#fca5a5",
    "--qb-empty-text": "#92a2bf"
  } : {
    "--qb-shell-bg": "linear-gradient(180deg, #f7fafd 0%, #f1f5fa 100%)",
    "--qb-chrome-bg": "linear-gradient(180deg, #1f5588 0%, #173f69 100%)",
    "--qb-chrome-border": "rgba(14,42,73,0.18)",
    "--qb-chrome-button-bg": "rgba(255,255,255,0.16)",
    "--qb-chrome-button-border": "rgba(255,255,255,0.28)",
    "--qb-chrome-text": "#ffffff",
    "--qb-chrome-muted": "#e7eff9",
    "--qb-panel-bg": "linear-gradient(180deg, #ffffff 0%, #fbfdff 100%)",
    "--qb-panel-border": "#d7e1ec",
    "--qb-panel-shadow": "0 10px 28px rgba(15,23,42,0.07)",
    "--qb-panel-title": "#0f2742",
    "--qb-panel-text": "#243b57",
    "--qb-panel-muted": "#5f738d",
    "--qb-panel-soft": "#f7fafd",
    "--qb-panel-soft-alt": "#eef4fb",
    "--qb-panel-soft-border": "#dce6f1",
    "--qb-question-card-bg": "linear-gradient(180deg, #ffffff 0%, #fdfefe 100%)",
    "--qb-question-card-border": "#d7e1ec",
    "--qb-question-card-shadow": "0 10px 28px rgba(15,23,42,0.07)",
    "--qb-question-text": "#0d2238",
    "--qb-choice-bubble-bg": "#edf3fb",
    "--qb-footer-bg": "rgba(249,252,255,0.96)",
    "--qb-footer-border": "#d6e0eb",
    "--qb-blue": "#1c5aa1",
    "--qb-blue-soft": "rgba(28,90,161,0.10)",
    "--qb-blue-text": "#184d87",
    "--qb-progress-bg": "#e6edf5",
    "--qb-report-bg": "rgba(220,38,38,0.06)",
    "--qb-report-border": "rgba(220,38,38,0.18)",
    "--qb-report-chip-bg": "#ffffff",
    "--qb-report-chip-border": "rgba(220,38,38,0.16)",
    "--qb-report-text": "#991b1b",
    "--qb-report-chip-text": "#b91c1c",
    "--qb-empty-text": "#6a7f98"
  }) as CSSProperties;

  async function submit() {
    if (!picked || revealed) return;
    const correct = picked === q.answer_key;
    const newResult = { id: q.id, chosen: picked, correct };
    setRevealeds((prev) => {
      const next = [...prev];
      next[i] = true;
      return next;
    });
    setResults((list) => {
      const existing = list.find((r) => r.id === q.id);
      const updated = existing ? list.map((r) => (r.id === q.id ? newResult : r)) : [...list, newResult];
      void (async () => {
        const answersMap: Record<string, { chosen: string; correct: boolean }> = {};
        updated.forEach((r) => {
          answersMap[r.id] = { chosen: r.chosen, correct: r.correct };
        });
        const isLast = iRef.current + 1 >= questions.length;
        await patchSession({
          status: isLast ? "complete" : "active",
          current_index: iRef.current,
          answers_json: answersMap,
          seconds_elapsed: secondsRef.current,
          ...(isLast ? { score_pct: Math.round((updated.filter((r) => r.correct).length / questions.length) * 100) } : {}),
        });
      })();
      return updated;
    });

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      await supabase.from("question_attempts").insert({
        user_id: user.id,
        question_id: q.id,
        chosen: picked,
        correct,
        time_ms: seconds * 1000,
      });
    }
  }

  async function saveLibraryEntry(
    entry_type: "highlight" | "bookmark" | "note",
    payload?: { body?: string | null; quote?: string | null; color?: string | null },
  ) {
    setToolBusy(entry_type);
    setToolStatus(null);
    try {
      const response = await fetch("/api/medical-library", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entry_type,
          lesson_id: null,
          subject_slug: null,
          title: `${subjectLabel} · Q${i + 1}`,
          body: payload?.body ?? null,
          quote: payload?.quote ?? q.stem,
          color: payload?.color ?? (entry_type === "highlight" ? "#fde047" : entry_type === "bookmark" ? "#60a5fa" : "#34d399"),
          data: { question_id: q.id, subject_label: subjectLabel, exam, answer_key: q.answer_key, chosen: picked, tags: q.tags },
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || "Failed");
      setToolStatus(entry_type === "highlight" ? "Highlighted." : entry_type === "bookmark" ? "Bookmarked." : "Note saved.");
      if (entry_type === "note") {
        setNoteText("");
        setNoteOpen(false);
      }
    } catch (error: unknown) {
      setToolStatus(error instanceof Error ? error.message : "Failed");
    } finally {
      setToolBusy(null);
    }
  }

  function openNoteComposer(prefill?: string) {
    setNoteOpen(true);
    setToolStatus("Write your note, then press Save note.");
    if (prefill) {
      setNoteText((prev) => (prev.trim() ? prev : prefill));
    }
  }

  function next() {
    setI((x) => x + 1);
    setSeconds(0);
    setToolStatus(null);
    setNoteOpen(false);
    setNoteText("");
    setReportOpen(false);
    setImageOpen(false);
    setImageZoom(1);
  }

  function prev() {
    if (i <= 0) return;
    setI((x) => x - 1);
    setSeconds(0);
    setToolStatus(null);
    setNoteOpen(false);
    setNoteText("");
    setReportOpen(false);
    setImageOpen(false);
    setImageZoom(1);
  }

  return (
    <div className="qbank-theme-scope qbank-runner-scope min-h-[100dvh] pb-28" style={{ ...runnerVars, background: "var(--qb-shell-bg)" }}>
      <div className="sticky top-0 z-40 border-b backdrop-blur-xl" style={{ background: "var(--qb-chrome-bg)", borderColor: "var(--qb-chrome-border)" }}>
        <div className="mx-auto flex w-full max-w-[1520px] items-start justify-between gap-4 px-4 py-4 md:px-6">
          <div className="min-w-0 flex items-start gap-3">
            <Link href={backHref} className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border" style={{ borderColor: "var(--qb-chrome-button-border)", background: "var(--qb-chrome-button-bg)", color: "var(--qb-chrome-text)" }}>
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div className="min-w-0">
              <div className="text-sm font-bold uppercase tracking-[0.18em]" style={{ color: "var(--qb-chrome-text)" }}>QBank</div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-sm" style={{ color: "var(--qb-chrome-muted)" }}>
                <span className="font-semibold">{subjectLabel}</span>
                <span style={{ color: "#5f6f8d" }}>•</span>
                <span>Question {i + 1} of {questions.length}</span>
                <span className="rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ borderColor: "rgba(96,165,250,0.28)", background: "var(--qb-blue-soft)", color: "var(--qb-blue-text)" }}>{(q.tags[0] || subjectLabel).toUpperCase()}</span>
                <span className="rounded-full border px-2.5 py-1 text-[11px] font-semibold" style={{ borderColor: diff.border, background: diff.bg, color: diff.color }}>{q.difficulty || "Intermediate"}</span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <div className="flex items-center gap-2 rounded-2xl border px-3 py-2 text-sm font-semibold" style={{ borderColor: "var(--qb-chrome-button-border)", background: "var(--qb-chrome-button-bg)", color: "var(--qb-chrome-text)" }}>
              <span className="tabular-nums">{formatTime(seconds)}</span>
              <button onClick={() => setIsPaused((v) => !v)}>{isPaused ? <Play className="h-4 w-4 fill-current" /> : <Pause className="h-4 w-4 fill-current" />}</button>
            </div>
            <div className="flex rounded-2xl border p-1" style={{ borderColor: "var(--qb-chrome-button-border)", background: "var(--qb-chrome-button-bg)" }}>
              {(["tutor", "exam"] as const).map((entry) => (
                <button key={entry} onClick={() => setMode(entry)} className="rounded-xl px-4 py-2 text-sm font-semibold capitalize transition" style={mode === entry ? { background: "var(--qb-blue)", color: "#fff" } : { color: "var(--qb-chrome-muted)" }}>
                  {entry}
                </button>
              ))}
            </div>
            <button onClick={() => void saveLibraryEntry("bookmark")} className="grid h-11 w-11 place-items-center rounded-2xl border" style={{ borderColor: "var(--qb-chrome-button-border)", background: "var(--qb-chrome-button-bg)", color: "var(--qb-chrome-text)" }}>
              <BookmarkPlus className="h-4 w-4" />
            </button>
            <button onClick={() => setReportOpen((v) => !v)} className="grid h-11 w-11 place-items-center rounded-2xl border" style={{ borderColor: "var(--qb-chrome-button-border)", background: "var(--qb-chrome-button-bg)", color: reportOpen ? "var(--qb-report-chip-text)" : "var(--qb-chrome-text)" }}>
              <Flag className="h-4 w-4" />
            </button>
            <button onClick={() => setFocusMode((v) => !v)} className="grid h-11 w-11 place-items-center rounded-2xl border" style={{ borderColor: "var(--qb-chrome-button-border)", background: focusMode ? "var(--qb-blue-soft)" : "var(--qb-chrome-button-bg)", color: focusMode ? "var(--qb-blue-text)" : "var(--qb-chrome-text)" }}>
              <Target className="h-4 w-4" />
            </button>
            <button onClick={toggleFullscreen} className="grid h-11 w-11 place-items-center rounded-2xl border" style={{ borderColor: "var(--qb-chrome-button-border)", background: "var(--qb-chrome-button-bg)", color: "var(--qb-chrome-text)" }}>
              {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </button>
            <button className="grid h-11 w-11 place-items-center rounded-2xl border" style={{ borderColor: "var(--qb-chrome-button-border)", background: "var(--qb-chrome-button-bg)", color: "var(--qb-chrome-text)" }}>
              <MoreVertical className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-[1520px] px-4 py-4 md:px-6">
        {reportOpen ? (
          <div className="mb-4 rounded-[22px] border p-4" style={{ background: "var(--qb-report-bg)", borderColor: "var(--qb-report-border)" }}>
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold" style={{ color: "var(--qb-report-text)" }}>
              <Flag className="h-4 w-4" /> Report issue
            </div>
            <div className="flex flex-wrap gap-2">
              {["Wrong answer key", "Unclear stem", "Formatting issue", "Explanation issue"].map((reason) => (
                <button key={reason} onClick={() => { setToolStatus(`Reported: ${reason}`); setReportOpen(false); }} className="rounded-xl border px-3 py-2 text-xs font-medium" style={{ borderColor: "var(--qb-report-chip-border)", background: "var(--qb-report-chip-bg)", color: "var(--qb-report-chip-text)" }}>
                  {reason}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {!focusMode ? (
          <section className="mb-4 overflow-hidden rounded-[24px] border" style={{ borderColor: "var(--qb-panel-border)", background: "var(--qb-panel-bg)", boxShadow: "var(--qb-panel-shadow)" }}>
            <button onClick={() => setQuestionMapOpen((v) => !v)} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left md:px-5">
              <div className="flex items-center gap-2">
                <div className="grid h-9 w-9 place-items-center rounded-2xl border" style={{ borderColor: "var(--qb-panel-soft-border)", background: "var(--qb-panel-soft)", color: "var(--qb-panel-title)" }}>
                  <List className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-sm font-semibold" style={{ color: "var(--qb-panel-title)" }}>Question Map</div>
                  <div className="text-xs" style={{ color: "var(--qb-panel-muted)" }}>{answered}/{questions.length} answered</div>
                </div>
              </div>
              <div className="flex items-center gap-3 text-xs" style={{ color: "var(--qb-panel-muted)" }}>
                <span>{answered}/{questions.length} answered</span>
                <ChevronDown className={`h-4 w-4 transition ${questionMapOpen ? "rotate-180" : "rotate-0"}`} />
              </div>
            </button>
            {questionMapOpen ? (
              <div className="border-t px-4 py-4 md:px-5" style={{ borderColor: "var(--qb-panel-soft-border)" }}>
                <div className="flex flex-wrap items-center gap-4 text-xs" style={{ color: "var(--qb-panel-muted)" }}>
                  <Legend color="#3b82f6" label="Current" />
                  <Legend color="#22c55e" label="Correct" />
                  <Legend color="#ef4444" label="Incorrect" />
                  <Legend color="#f59e0b" label="Selected" />
                  <Legend color="#94a3b8" label="Unanswered" />
                </div>
                <div className="mt-4 grid grid-cols-9 gap-2 sm:grid-cols-12 lg:grid-cols-18">
                  {navigatorItems.map(({ item, idx, result, picked: pickedLocal, revealed: revealedLocal }) => {
                    const active = idx === i;
                    const hasPick = Boolean(pickedLocal);
                    const isCorrect = result?.correct;
                    return (
                      <button
                        key={item.id}
                        onClick={() => { setI(idx); setSeconds(0); setToolStatus(null); setNoteOpen(false); }}
                        className="flex h-8 items-center justify-center rounded-xl border text-[11px] font-semibold transition"
                        style={active
                          ? { borderColor: "#3b82f6", background: "rgba(59,130,246,0.18)", color: "#93c5fd" }
                          : revealedLocal && isCorrect
                            ? { borderColor: "rgba(34,197,94,0.28)", background: "rgba(34,197,94,0.12)", color: "#4ade80" }
                            : revealedLocal && !isCorrect
                              ? { borderColor: "rgba(239,68,68,0.28)", background: "rgba(239,68,68,0.12)", color: "#f87171" }
                              : hasPick
                                ? { borderColor: "rgba(245,158,11,0.28)", background: "rgba(245,158,11,0.12)", color: "#fbbf24" }
                                : { borderColor: "var(--qb-panel-soft-border)", background: "var(--qb-panel-soft)", color: "var(--qb-panel-muted)" }}
                      >
                        {idx + 1}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </section>
        ) : null}

        <section className="overflow-hidden rounded-[26px] border" style={{ borderColor: "var(--qb-question-card-border)", background: "var(--qb-question-card-bg)", boxShadow: "var(--qb-question-card-shadow)" }}>
          <div className="px-4 py-4 md:px-5 md:py-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ borderColor: "rgba(96,165,250,0.24)", background: "var(--qb-blue-soft)", color: "var(--qb-blue-text)" }}>{(q.tags[0] || subjectLabel).toUpperCase()}</span>
              <span className="rounded-full border px-3 py-1 text-[11px] font-medium" style={{ borderColor: isDarkTheme ? "var(--qb-panel-soft-border)" : "#e3eaf2", background: isDarkTheme ? "var(--qb-panel-soft)" : "#ffffff", color: isDarkTheme ? "var(--qb-panel-text)" : "#44586f" }}>{topic}</span>
              {q.difficulty ? <span className="rounded-full border px-3 py-1 text-[11px] font-medium" style={{ borderColor: diff.border, background: isDarkTheme ? diff.bg : "#fff8e8", color: diff.color }}>{q.difficulty}</span> : null}
            </div>

            {questionTitle ? (
              <div className="mt-5 max-w-[1040px] rounded-[24px] border px-4 py-4 md:px-5" style={{ borderColor: "rgba(59,130,246,0.18)", background: "var(--qb-blue-soft)" }}>
                <div className="text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: "var(--qb-blue-text)" }}>Topic title</div>
                <div className="mt-2 text-[20px] font-semibold leading-[1.45] tracking-[-0.02em] md:text-[26px]" style={{ color: "var(--qb-panel-title)" }}>
                  {questionTitle}
                </div>
              </div>
            ) : null}

            <div className="mt-4 max-w-[1040px] whitespace-pre-wrap text-[20px] font-semibold leading-[1.7] tracking-[-0.02em] md:text-[28px]" style={{ color: "var(--qb-question-text)" }}>
              {questionStemBody}
            </div>

            {imageHref ? (
              <div className="mt-5 overflow-hidden rounded-[22px] border" style={{ borderColor: "rgba(37,99,235,0.20)", background: "var(--qb-panel-soft)" }}>
                <div className="flex items-center justify-between gap-3 border-b px-4 py-3" style={{ borderColor: "var(--qb-panel-soft-border)" }}>
                  <div>
                    <div className="text-[11px] font-bold uppercase tracking-[0.16em]" style={{ color: "var(--qb-blue-text)" }}>Question figure</div>
                    <div className="mt-1 text-xs" style={{ color: "var(--qb-panel-muted)" }}>Essential image from the question stem</div>
                  </div>
                  <button onClick={() => setImageOpen(true)} className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold" style={{ borderColor: "var(--qb-panel-soft-border)", background: "var(--qb-panel-soft-alt)", color: "var(--qb-panel-text)" }}>
                    <Expand className="h-3.5 w-3.5" /> Enlarge
                  </button>
                </div>
                <button onClick={() => setImageOpen(true)} className="block w-full bg-black/10">
                  <img src={imageHref} alt={q.image_caption || "Question figure"} className="max-h-[560px] w-full object-contain" />
                </button>
                {q.image_caption ? (
                  <div className="border-t px-4 py-3 text-sm" style={{ borderColor: "var(--qb-panel-soft-border)", color: "var(--qb-panel-muted)" }}>
                    {q.image_caption}
                  </div>
                ) : null}
              </div>
            ) : null}

            {hasQuestionSpecificData ? (
              <div className="mt-5">
                <ClinicalDataTables
                  sections={clinicalSections}
                  title="Question data"
                  subtitle="Only the explicit lab panel is shown here to avoid repeating the same values in the stem."
                />
              </div>
            ) : hasDerivedClinicalData ? (
              <div className="mt-5">
                <ClinicalDataTables
                  sections={derivedSections}
                  title="Clinical data snapshot"
                  subtitle="Key numeric values were extracted from the vignette and organized for faster reading."
                />
              </div>
            ) : null}

            <div className="mt-6 space-y-3">
              {q.choices.map((choice) => {
                const isCorrect = choice.key === q.answer_key;
                const isPicked = choice.key === picked;
                let bg = isDarkTheme ? "rgba(255,255,255,0.02)" : "#ffffff";
                let border = isDarkTheme ? "rgba(255,255,255,0.07)" : "#c7d4e2";
                let textColor = isDarkTheme ? "#f3f7ff" : "#102740";
                let helperColor = isDarkTheme ? "#8da0c0" : "#607792";
                if (revealed) {
                  if (isCorrect) {
                    bg = isDarkTheme ? "rgba(34,197,94,0.10)" : "rgba(34,197,94,0.08)";
                    border = "rgba(34,197,94,0.35)";
                    textColor = isDarkTheme ? "#dcfce7" : "#166534";
                    helperColor = isDarkTheme ? "#86efac" : "#15803d";
                  } else if (isPicked) {
                    bg = isDarkTheme ? "rgba(239,68,68,0.10)" : "rgba(239,68,68,0.08)";
                    border = "rgba(239,68,68,0.30)";
                    textColor = isDarkTheme ? "#fee2e2" : "#991b1b";
                    helperColor = isDarkTheme ? "#fca5a5" : "#b91c1c";
                  }
                } else if (isPicked) {
                  bg = isDarkTheme ? "rgba(59,130,246,0.12)" : "rgba(28,90,161,0.10)";
                  border = isDarkTheme ? "rgba(59,130,246,0.35)" : "rgba(28,90,161,0.28)";
                  helperColor = isDarkTheme ? "#93c5fd" : "#184d87";
                }
                return (
                  <button
                    key={choice.key}
                    disabled={revealed}
                    onClick={() => setPicks((prev) => { const next = [...prev]; next[i] = choice.key; return next; })}
                    className="w-full rounded-[20px] border p-4 text-left transition md:p-5"
                    style={{ background: bg, borderColor: border, boxShadow: isDarkTheme ? "none" : "0 1px 2px rgba(15,23,42,0.04), 0 8px 18px rgba(15,23,42,0.03)" }}
                  >
                    <div className="flex items-center gap-4">
                      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold" style={{ background: "var(--qb-choice-bubble-bg)", color: helperColor }}>
                        {choice.key}
                      </span>
                      <span className="text-base font-medium md:text-[17px]" style={{ color: textColor }}>{choice.text}</span>
                      {revealed && isCorrect ? <CheckCircle2 className="ml-auto h-4 w-4 shrink-0" style={{ color: "#4ade80" }} /> : null}
                      {revealed && isPicked && !isCorrect ? <XCircle className="ml-auto h-4 w-4 shrink-0" style={{ color: "#f87171" }} /> : null}
                    </div>
                  </button>
                );
              })}
            </div>

            {revealed && mode === "tutor" ? (
              <div className="mt-6 space-y-4">
                <div className="rounded-[22px] border p-4" style={{ borderColor: isCorrectAnswer ? "rgba(34,197,94,0.28)" : "rgba(239,68,68,0.28)", background: isCorrectAnswer ? "rgba(34,197,94,0.10)" : "rgba(239,68,68,0.10)" }}>
                  <div className="flex flex-wrap items-center gap-2">
                    {isCorrectAnswer ? <CheckCircle2 className="h-5 w-5" style={{ color: "#4ade80" }} /> : <XCircle className="h-5 w-5" style={{ color: "#f87171" }} />}
                    <span className="text-sm font-bold uppercase tracking-[0.16em]" style={{ color: isCorrectAnswer ? "#86efac" : "#fca5a5" }}>{isCorrectAnswer ? "Correct" : "Incorrect"}</span>
                    <span className="ml-auto text-xs font-semibold" style={{ color: "var(--qb-panel-text)" }}>Correct answer: {q.answer_key}</span>
                  </div>
                  <div className="mt-2 text-sm leading-7" style={{ color: isDarkTheme ? "#dce5f4" : "var(--qb-panel-text)" }}>
                    {isCorrectAnswer ? `You answered ${picked}.` : <>You answered <strong>{picked}</strong>. Correct answer: <strong>{q.answer_key}</strong>.</>}
                  </div>
                </div>

                {details.explanation ? (
                  <div className="rounded-[22px] border p-4" style={{ borderColor: "var(--qb-panel-soft-border)", background: "var(--qb-panel-soft)" }}>
                    <div className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em]" style={{ color: isDarkTheme ? "#93c5fd" : "var(--qb-blue-text)" }}>
                      <BookOpen className="h-4 w-4" /> Explanation
                    </div>
                    <div className="whitespace-pre-wrap text-sm leading-7" style={{ color: isDarkTheme ? "#dce5f4" : "var(--qb-panel-text)" }}>{details.explanation}</div>
                  </div>
                ) : null}

                {details.educationalObjective ? (
                  <div className="rounded-[22px] border p-4" style={{ borderColor: "rgba(16,185,129,0.25)", background: "rgba(16,185,129,0.08)" }}>
                    <div className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em]" style={{ color: isDarkTheme ? "#6ee7b7" : "#0f9d7a" }}>
                      <Lightbulb className="h-4 w-4" /> High-yield takeaway
                    </div>
                    <div className="text-sm leading-7" style={{ color: isDarkTheme ? "#dce5f4" : "var(--qb-panel-text)" }}>{details.educationalObjective}</div>
                  </div>
                ) : null}

                {wrongChoices.length > 0 ? (
                  <details className="rounded-[22px] border p-4" style={{ borderColor: "var(--qb-panel-soft-border)", background: "var(--qb-panel-soft)" }}>
                    <summary className="cursor-pointer list-none text-sm font-semibold" style={{ color: isDarkTheme ? "#dce5f4" : "var(--qb-panel-title)" }}>Why the other choices are incorrect</summary>
                    <div className="mt-3 space-y-2">
                      {wrongChoices.map((choice) => (
                        <div key={choice.key} className="flex items-start gap-2 text-sm">
                          <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold" style={{ background: "var(--qb-choice-bubble-bg)", color: "var(--qb-panel-muted)" }}>{choice.key}</span>
                          <span style={{ color: "var(--qb-panel-muted)" }}>{choice.text}</span>
                        </div>
                      ))}
                    </div>
                  </details>
                ) : null}
              </div>
            ) : null}

            {noteOpen ? (
              <div className="mt-5 rounded-[22px] border p-4" style={{ borderColor: "var(--qb-panel-soft-border)", background: "var(--qb-panel-soft)" }}>
                <div className="mb-3 text-xs font-semibold uppercase tracking-[0.16em]" style={{ color: "var(--qb-blue-text)" }}>Medical Library note</div>
                <textarea value={noteText} onChange={(e) => setNoteText(e.target.value)} rows={4} className="input w-full resize-none rounded-2xl text-sm" placeholder="Write a note to save in Medical Library…" />
                <div className="mt-3 flex gap-2">
                  <button className="btn-primary text-sm" disabled={!noteText.trim()} onClick={() => void saveLibraryEntry("note", { body: noteText })}>Save note</button>
                  <button className="btn-ghost text-sm" onClick={() => { setNoteOpen(false); setNoteText(""); }}>Cancel</button>
                </div>
              </div>
            ) : null}
          </div>
        </section>

        {!focusMode && contextVisible ? (
          <section className="mt-4 overflow-hidden rounded-[24px] border" style={{ borderColor: "var(--qb-panel-border)", background: "var(--qb-panel-bg)", boxShadow: "var(--qb-panel-shadow)" }}>
            <div className="flex items-start justify-between gap-3 border-b px-4 py-4 md:px-5" style={{ borderColor: "var(--qb-panel-soft-border)" }}>
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--qb-panel-muted)" }}>Context Panel</div>
                <div className="mt-1 text-lg font-semibold" style={{ color: "var(--qb-panel-title)" }}>Figure & Tools</div>
              </div>
              <button onClick={() => setContextVisible(false)} className="grid h-10 w-10 place-items-center rounded-2xl border" style={{ borderColor: "var(--qb-panel-soft-border)", background: "var(--qb-panel-soft)", color: "var(--qb-panel-text)" }}>
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="px-4 py-4 md:px-5">
              <div className="grid gap-2 md:grid-cols-[220px_220px_220px_auto]">
                <button onClick={() => setContextTab("figure")} disabled={!imageHref} className="flex items-center justify-center gap-2 rounded-[18px] border px-4 py-3 text-sm font-semibold transition disabled:opacity-40" style={contextTab === "figure" ? { borderColor: "var(--qb-blue)", background: "var(--qb-blue-soft)", color: "var(--qb-blue-text)" } : { borderColor: "var(--qb-panel-soft-border)", background: "var(--qb-panel-soft)", color: "var(--qb-panel-text)" }}>
                  <ImageIcon className="h-4 w-4" /> Figure
                </button>
                <button onClick={() => setContextTab("labs")} className="flex items-center justify-center gap-2 rounded-[18px] border px-4 py-3 text-sm font-semibold transition" style={contextTab === "labs" ? { borderColor: "var(--qb-blue)", background: "var(--qb-blue-soft)", color: "var(--qb-blue-text)" } : { borderColor: "var(--qb-panel-soft-border)", background: "var(--qb-panel-soft)", color: "var(--qb-panel-text)" }}>
                  <FlaskConical className="h-4 w-4" /> Labs
                  <span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: "rgba(59,130,246,0.18)", color: "#bfdbfe" }}>{hasQuestionSpecificData ? clinicalSections.length : Object.keys(LAB_REFERENCE).length}</span>
                </button>
                <button onClick={() => setContextTab("calculator")} className="flex items-center justify-center gap-2 rounded-[18px] border px-4 py-3 text-sm font-semibold transition" style={contextTab === "calculator" ? { borderColor: "var(--qb-blue)", background: "var(--qb-blue-soft)", color: "var(--qb-blue-text)" } : { borderColor: "var(--qb-panel-soft-border)", background: "var(--qb-panel-soft)", color: "var(--qb-panel-text)" }}>
                  <Calculator className="h-4 w-4" /> Calculator
                </button>
                <div />
              </div>

              {contextTab === "figure" ? (
                <div className="mt-4 overflow-hidden rounded-[22px] border" style={{ borderColor: "var(--qb-panel-soft-border)", background: "var(--qb-panel-soft)" }}>
                  {imageHref ? (
                    <>
                      <button onClick={() => setImageOpen(true)} className="block w-full">
                        <img src={imageHref} alt={q.image_caption || "Figure"} className="max-h-[520px] w-full object-contain" />
                      </button>
                      <div className="flex items-center justify-between border-t px-4 py-3 text-sm" style={{ borderColor: "var(--qb-panel-soft-border)", color: "var(--qb-panel-text)" }}>
                        <button onClick={() => openNoteComposer(`Figure note for question ${i + 1}`)} className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold" style={{ borderColor: "var(--qb-panel-soft-border)", background: "var(--qb-panel-soft)" }}>
                          <PencilLine className="h-3.5 w-3.5" /> Add note
                        </button>
                        <button onClick={() => setImageOpen(true)} className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold" style={{ borderColor: "var(--qb-panel-soft-border)", background: "var(--qb-panel-soft)" }}>
                          <Expand className="h-3.5 w-3.5" /> Enlarge
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="p-8 text-center text-sm" style={{ color: "var(--qb-panel-muted)" }}>This question has no linked figure.</div>
                  )}
                </div>
              ) : null}

              {contextTab === "labs" ? (
                <div className="mt-4 space-y-4">
                  {hasQuestionSpecificData ? (
                    <div className="rounded-[22px] border p-4 text-sm" style={{ borderColor: "var(--qb-panel-soft-border)", background: "var(--qb-panel-soft)", color: "var(--qb-panel-text)" }}>
                      The question lab panel is already displayed above the stem. Use the cards below only for quick reference ranges.
                    </div>
                  ) : null}

                  <div className="grid gap-3 lg:grid-cols-[190px_minmax(0,1fr)]">
                    <div className="rounded-[22px] border p-3" style={{ borderColor: "var(--qb-panel-soft-border)", background: "var(--qb-panel-soft)" }}>
                      <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--qb-panel-muted)" }}>Reference sets</div>
                      <div className="space-y-2">
                        {Object.entries(LAB_REFERENCE).map(([category, items]) => (
                          <button key={category} onClick={() => setLabCategory(category)} className="flex w-full items-center justify-between rounded-[14px] px-3 py-2.5 text-sm font-medium transition" style={labCategory === category ? { borderColor: "rgba(28,90,161,0.18)", background: "var(--qb-blue-soft)", color: "var(--qb-blue-text)", boxShadow: isDarkTheme ? "none" : "inset 0 0 0 1px rgba(28,90,161,0.14)" } : { background: "var(--qb-panel-soft-alt)", color: "var(--qb-panel-text)" }}>
                            <span>{category}</span>
                            <span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: labCategory === category ? (isDarkTheme ? "rgba(147,197,253,0.18)" : "rgba(28,90,161,0.12)") : "var(--qb-panel-soft)", color: labCategory === category ? (isDarkTheme ? "#bfdbfe" : "var(--qb-blue-text)") : "var(--qb-panel-muted)" }}>{items.length}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-[22px] border p-3 md:p-4" style={{ borderColor: "var(--qb-panel-soft-border)", background: "var(--qb-panel-soft)" }}>
                      <div className="mb-3 text-base font-semibold" style={{ color: "var(--qb-panel-title)" }}>{labCategory}</div>
                      <div className="overflow-hidden rounded-[18px] border" style={{ borderColor: "var(--qb-panel-soft-border)" }}>
                        <div className="grid grid-cols-[1.1fr_1fr_1fr] gap-3 border-b px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ borderColor: "var(--qb-panel-soft-border)", color: "var(--qb-panel-muted)" }}>
                          <div>Test</div>
                          <div>Your value</div>
                          <div>Reference range</div>
                        </div>
                        {labItems.map((item) => (
                          <div key={item.test} className="grid grid-cols-[1.1fr_1fr_1fr] gap-3 border-b px-4 py-3 text-sm last:border-b-0" style={{ borderColor: "var(--qb-panel-soft-border)", color: "var(--qb-panel-text)" }}>
                            <div>{item.test}</div>
                            <div style={{ color: item.tone === "abnormal" ? "#fca5a5" : "#86efac" }}>{item.value}</div>
                            <div style={{ color: "var(--qb-panel-muted)" }}>{item.ref}</div>
                          </div>
                        ))}
                      </div>
                      <div className="mt-3 text-xs" style={{ color: "var(--qb-panel-muted)" }}>Question-specific values appear above when detected. This area stays as a quick reference set.</div>
                    </div>
                  </div>
                </div>
              ) : null}

              {contextTab === "calculator" ? (
                <div className="mt-4 grid gap-3 lg:grid-cols-2">
                  <div className="rounded-[22px] border p-4" style={{ borderColor: "var(--qb-panel-soft-border)", background: "var(--qb-panel-soft)" }}>
                    <div className="text-base font-semibold" style={{ color: "var(--qb-panel-title)" }}>Anion gap</div>
                    <div className="mt-3 grid grid-cols-3 gap-3">
                      <CalcField label="Na⁺" value={calcNa} onChange={setCalcNa} />
                      <CalcField label="Cl⁻" value={calcCl} onChange={setCalcCl} />
                      <CalcField label="HCO₃⁻" value={calcHco3} onChange={setCalcHco3} />
                    </div>
                    <div className="mt-4 rounded-[18px] border px-4 py-3 text-sm" style={{ borderColor: "rgba(28,90,161,0.20)", background: "var(--qb-blue-soft)", color: "var(--qb-blue-text)" }}>
                      Anion gap = <strong>{Number.isFinite(anionGap) ? anionGap : "—"}</strong>
                    </div>
                  </div>
                  <div className="rounded-[22px] border p-4" style={{ borderColor: "var(--qb-panel-soft-border)", background: "var(--qb-panel-soft)" }}>
                    <div className="text-base font-semibold" style={{ color: "var(--qb-panel-title)" }}>Quick reference</div>
                    <div className="mt-3 space-y-2 text-sm" style={{ color: "var(--qb-panel-text)" }}>
                      <div className="rounded-[16px] border px-3 py-2" style={{ borderColor: "var(--qb-panel-soft-border)", background: "var(--qb-panel-soft-alt)" }}>Normal anion gap: <strong>8 – 12</strong></div>
                      <div className="rounded-[16px] border px-3 py-2" style={{ borderColor: "var(--qb-panel-soft-border)", background: "var(--qb-panel-soft-alt)" }}>Winter’s formula: <strong>1.5 × HCO₃ + 8 ± 2</strong></div>
                      <div className="rounded-[16px] border px-3 py-2" style={{ borderColor: "var(--qb-panel-soft-border)", background: "var(--qb-panel-soft-alt)" }}>Corrected Na⁺ in hyperglycemia: <strong>+1.6 per 100 glucose above 100</strong></div>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </section>
        ) : !focusMode ? (
          <div className="mt-4 flex justify-end">
            <button onClick={() => setContextVisible(true)} className="inline-flex items-center gap-2 rounded-2xl border px-4 py-2 text-sm font-semibold" style={{ borderColor: "var(--qb-chrome-button-border)", background: "var(--qb-chrome-button-bg)", color: "var(--qb-chrome-text)" }}>
              <FolderTree className="h-4 w-4" /> Show context panel
            </button>
          </div>
        ) : null}

        {!focusMode ? (
          <section className="mt-4 overflow-hidden rounded-[24px] border" style={{ borderColor: "var(--qb-panel-border)", background: "var(--qb-panel-bg)", boxShadow: "var(--qb-panel-shadow)" }}>
            <div className="px-4 py-4 md:px-5">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--qb-panel-muted)" }}>Session status</div>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <StatusTile label="Done" value={answered} color={isDarkTheme ? "#dce5f4" : "var(--qb-panel-title)"} />
                <StatusTile label="Correct" value={correctCount} color="#4ade80" />
                <StatusTile label="Wrong" value={incorrectCount} color="#f87171" />
              </div>
              <div className="mt-4 rounded-[18px] border px-4 py-3" style={{ borderColor: "var(--qb-panel-soft-border)", background: "var(--qb-panel-soft-alt)" }}>
                <div className="mb-2 flex items-center justify-between text-xs" style={{ color: "var(--qb-panel-muted)" }}>
                  <span>Accuracy so far: {accuracy}%</span>
                  <span>{answered}/{questions.length}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full" style={{ background: "var(--qb-progress-bg)" }}>
                  <div className="h-full rounded-full bg-gradient-to-r from-[#2563eb] to-[#60a5fa] transition-all" style={{ width: `${accuracy}%` }} />
                </div>
              </div>
            </div>
          </section>
        ) : null}
      </div>

      {imageOpen && imageHref ? (
        <div className="fixed inset-0 z-50 bg-black/80 p-4 backdrop-blur-sm md:p-8">
          <div className="mx-auto flex h-full max-w-6xl flex-col overflow-hidden rounded-[28px] border" style={{ background: "var(--c-card)", borderColor: "var(--c-border)" }}>
            <div className="flex items-center justify-between gap-3 border-b px-4 py-3 md:px-6" style={{ borderColor: "var(--c-border)" }}>
              <div>
                <div className="text-sm font-semibold" style={{ color: "var(--c-text-1)" }}>Figure 1 of 1</div>
                <div className="text-xs" style={{ color: "var(--c-text-4)" }}>{q.image_caption || subjectLabel}</div>
              </div>
              <button onClick={() => setImageOpen(false)} className="grid h-10 w-10 place-items-center rounded-2xl border" style={{ borderColor: "var(--c-border)", background: "var(--c-elevated)", color: "var(--c-text-2)" }}>
                <Minimize2 className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4 md:p-6">
              <div className="flex h-full items-center justify-center rounded-[24px]" style={{ background: "var(--c-elevated)" }}>
                <img src={imageHref} alt={q.image_caption || "Question image"} className="max-h-full max-w-full object-contain transition-transform duration-150" style={{ transform: `scale(${imageZoom})` }} />
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3 md:px-6" style={{ borderColor: "var(--c-border)" }}>
              <div className="flex items-center gap-2">
                <button onClick={() => setImageZoom((z) => Math.max(1, +(z - 0.25).toFixed(2)))} className="grid h-10 w-10 place-items-center rounded-2xl border" style={{ borderColor: "var(--c-border)", background: "var(--c-elevated)", color: "var(--c-text-2)" }}><Minus className="h-4 w-4" /></button>
                <div className="min-w-[72px] text-center text-sm font-semibold" style={{ color: "var(--c-text-2)" }}>{Math.round(imageZoom * 100)}%</div>
                <button onClick={() => setImageZoom((z) => Math.min(3, +(z + 0.25).toFixed(2)))} className="grid h-10 w-10 place-items-center rounded-2xl border" style={{ borderColor: "var(--c-border)", background: "var(--c-elevated)", color: "var(--c-text-2)" }}><Plus className="h-4 w-4" /></button>
              </div>
              <div className="flex gap-2">
                <button onClick={() => openNoteComposer(`Image note for question ${i + 1}`)} className="rounded-2xl border px-4 py-2 text-sm font-semibold" style={{ borderColor: "var(--c-border)", background: "var(--c-elevated)", color: "var(--c-text-2)" }}>Add note</button>
                <button onClick={() => void saveLibraryEntry("bookmark")} className="rounded-2xl border px-4 py-2 text-sm font-semibold" style={{ borderColor: "var(--c-border)", background: "var(--c-elevated)", color: "var(--c-blue)" }}>Bookmark</button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div className="fixed inset-x-0 bottom-0 z-40 border-t px-4 pb-4 pt-3 backdrop-blur-xl md:px-6" style={{ background: "var(--qb-footer-bg)", borderColor: "var(--qb-footer-border)", boxShadow: "0 -8px 24px rgba(15,23,42,0.06)" }}>
        <div className="mx-auto flex max-w-[1520px] flex-col gap-2">
          {toolStatus ? <div className="text-center text-xs font-medium" style={{ color: isDarkTheme ? "#93c5fd" : "var(--qb-blue-text)" }}>{toolStatus}</div> : null}
          <div className="flex flex-col gap-2 md:flex-row md:items-center">
            <button onClick={prev} disabled={i <= 0} className="flex h-12 items-center justify-center gap-1.5 rounded-2xl border px-4 text-sm font-semibold transition disabled:opacity-40 md:min-w-[180px]" style={{ borderColor: "var(--qb-panel-soft-border)", background: "var(--qb-panel-soft)", color: "var(--qb-panel-text)" }}>
              <ChevronLeft className="h-4 w-4" /> Previous
            </button>
            <button onClick={() => openNoteComposer()} className="flex h-12 items-center justify-center gap-2 rounded-2xl border px-4 text-sm font-semibold md:min-w-[180px]" style={{ borderColor: noteOpen ? "rgba(28,90,161,0.22)" : "var(--qb-panel-soft-border)", background: noteOpen ? "var(--qb-blue-soft)" : "var(--qb-panel-soft)", color: noteOpen ? "var(--qb-blue-text)" : "var(--qb-panel-text)" }}>
              <PencilLine className="h-4 w-4" /> Add note
            </button>
            <div className="md:flex-1" />
            {!revealed ? (
              <button className="btn-primary h-12 rounded-2xl px-8 text-base md:min-w-[200px]" disabled={!picked} onClick={() => void submit()}>
                Reveal Answer
              </button>
            ) : (
              <button className="btn-primary h-12 rounded-2xl px-8 text-base md:min-w-[200px]" onClick={next}>
                Next <ChevronRight className="ml-1 h-5 w-5" />
              </button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs" style={{ color: "var(--qb-panel-muted)" }}>
            <button onClick={() => void saveLibraryEntry("highlight")} disabled={toolBusy === "highlight"} className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5" style={{ borderColor: "var(--qb-panel-soft-border)", background: "var(--qb-panel-soft)" }}>
              <Highlighter className="h-3.5 w-3.5" /> Highlight
            </button>
            <button onClick={() => void saveLibraryEntry("bookmark")} disabled={toolBusy === "bookmark"} className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5" style={{ borderColor: "var(--qb-panel-soft-border)", background: "var(--qb-panel-soft)" }}>
              <BookmarkPlus className="h-3.5 w-3.5" /> Bookmark
            </button>
            <button onClick={() => setContextVisible((v) => !v)} className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5" style={{ borderColor: "var(--qb-panel-soft-border)", background: "var(--qb-panel-soft)" }}>
              <FolderTree className="h-3.5 w-3.5" /> {contextVisible ? "Hide" : "Show"} context
            </button>
            <Link href="/notifications" className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5" style={{ borderColor: "var(--qb-panel-soft-border)", background: "var(--qb-panel-soft)" }}>
              <Bell className="h-3.5 w-3.5" /> Alerts
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <div className="inline-flex items-center gap-2">
      <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: color }} />
      <span>{label}</span>
    </div>
  );
}

function StatusTile({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div className="rounded-[18px] border px-4 py-4 text-center" style={{ borderColor: "var(--qb-panel-soft-border)", background: "var(--qb-panel-soft)" }}>
      <div className="text-3xl font-bold" style={{ color }}>{value}</div>
      <div className="mt-1 text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--qb-panel-muted)" }}>{label}</div>
    </div>
  );
}

function Metric({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div className="rounded-2xl p-4" style={{ border: "1px solid var(--c-border)", background: "var(--c-elevated)" }}>
      <div className="text-2xl font-bold" style={{ color }}>{value}</div>
      <div className="mt-1 text-xs font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--c-text-4)" }}>{label}</div>
    </div>
  );
}

function CalcField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: "var(--qb-panel-muted)" }}>{label}</div>
      <input value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-2xl border px-3 py-2 text-sm" style={{ borderColor: "var(--qb-panel-soft-border)", background: "var(--qb-panel-soft)", color: "var(--qb-panel-text)" }} />
    </label>
  );
}
