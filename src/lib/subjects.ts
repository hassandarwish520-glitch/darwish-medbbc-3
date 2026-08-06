import { Activity, Beaker, BookOpen, Brain, Dna, HeartPulse, Microscope, MoonStar, Sigma, Stethoscope } from "lucide-react";
import { detectIfomSubject, IFOM_CSE_SUBJECTS } from "@/lib/ai/ifom";

export type SubjectMeta = {
  title: string;
  slug: string;
  description: string;
  accentBar: string;
  iconWrap: string;
  iconClass: string;
  actionClass: string;
  badgeClass: string;
};

export const SUBJECT_CATALOG: SubjectMeta[] = [
  {
    title: "Dermatology",
    slug: "dermatology",
    description: "Eczema, psoriasis, skin cancers, infections and autoimmune skin diseases",
    accentBar: "from-yellow-400 to-amber-500",
    iconWrap: "bg-yellow-500/10",
    iconClass: "text-yellow-300",
    actionClass: "text-yellow-300",
    badgeClass: "border-yellow-400/20 text-yellow-200",
  },
  {
    title: "Infectious Diseases",
    slug: "infectious-diseases",
    description: "Bacterial, viral, fungal and parasitic infections, HIV and antimicrobial therapy",
    accentBar: "from-emerald-400 to-lime-500",
    iconWrap: "bg-emerald-500/10",
    iconClass: "text-emerald-300",
    actionClass: "text-emerald-300",
    badgeClass: "border-emerald-400/20 text-emerald-200",
  },
  {
    title: "Respiratory System",
    slug: "respiratory-system",
    description: "Asthma, COPD, pneumonia, pleural disease, respiratory failure and ventilation",
    accentBar: "from-teal-400 to-cyan-500",
    iconWrap: "bg-cyan-500/10",
    iconClass: "text-cyan-300",
    actionClass: "text-cyan-300",
    badgeClass: "border-cyan-400/20 text-cyan-200",
  },
  {
    title: "Renal & Urogenital",
    slug: "renal-urogenital",
    description: "AKI, CKD, glomerulonephritis, UTI and electrolyte disorders",
    accentBar: "from-orange-400 to-amber-500",
    iconWrap: "bg-orange-500/10",
    iconClass: "text-orange-300",
    actionClass: "text-orange-300",
    badgeClass: "border-orange-400/20 text-orange-200",
  },
  {
    title: "Rheumatology & Orthopedics",
    slug: "rheumatology-orthopedics",
    description: "RA, SLE, gout, osteoporosis and musculoskeletal disorders",
    accentBar: "from-pink-400 to-fuchsia-500",
    iconWrap: "bg-pink-500/10",
    iconClass: "text-pink-300",
    actionClass: "text-pink-300",
    badgeClass: "border-pink-400/20 text-pink-200",
  },
  {
    title: "Hematology",
    slug: "hematology",
    description: "Anemia, leukemia, coagulation, blood cancers and oncology",
    accentBar: "from-rose-400 to-pink-500",
    iconWrap: "bg-rose-500/10",
    iconClass: "text-rose-300",
    actionClass: "text-rose-300",
    badgeClass: "border-rose-400/20 text-rose-200",
  },
  {
    title: "Endocrine",
    slug: "endocrine",
    description: "Thyroid, adrenal, pituitary, diabetes and metabolic disorders",
    accentBar: "from-sky-400 to-cyan-500",
    iconWrap: "bg-sky-500/10",
    iconClass: "text-sky-300",
    actionClass: "text-sky-300",
    badgeClass: "border-sky-400/20 text-sky-200",
  },
  {
    title: "Cardiology",
    slug: "cardiology",
    description: "ACS, heart failure, arrhythmias, valvular disease and cardiac pharmacology",
    accentBar: "from-red-400 to-pink-500",
    iconWrap: "bg-red-500/10",
    iconClass: "text-red-300",
    actionClass: "text-red-300",
    badgeClass: "border-red-400/20 text-red-200",
  },
  {
    title: "Neurology",
    slug: "neurology",
    description: "Stroke, epilepsy, headache, dementia and neuromuscular disorders",
    accentBar: "from-blue-400 to-indigo-500",
    iconWrap: "bg-blue-500/10",
    iconClass: "text-blue-300",
    actionClass: "text-blue-300",
    badgeClass: "border-blue-400/20 text-blue-200",
  },
  {
    title: "Obstetrics",
    slug: "obstetrics",
    description: "Pregnancy, antenatal care, labor, delivery, postpartum medicine and fetal assessment",
    accentBar: "from-fuchsia-400 to-rose-500",
    iconWrap: "bg-fuchsia-500/10",
    iconClass: "text-fuchsia-300",
    actionClass: "text-fuchsia-300",
    badgeClass: "border-fuchsia-400/20 text-fuchsia-200",
  },
  {
    title: "Gynecology",
    slug: "gynecology",
    description: "Menstrual disorders, infertility, contraception, pelvic disease and gynecologic pathology",
    accentBar: "from-pink-400 to-violet-500",
    iconWrap: "bg-pink-500/10",
    iconClass: "text-pink-300",
    actionClass: "text-pink-300",
    badgeClass: "border-pink-400/20 text-pink-200",
  },
  {
    title: "Pediatrics",
    slug: "pediatrics",
    description: "Neonatal medicine, developmental milestones, pediatric infections and vaccines",
    accentBar: "from-violet-400 to-blue-500",
    iconWrap: "bg-violet-500/10",
    iconClass: "text-violet-300",
    actionClass: "text-violet-300",
    badgeClass: "border-violet-400/20 text-violet-200",
  },
  {
    title: "Gastrointestinal System",
    slug: "gastrointestinal-system",
    description: "Peptic ulcer, IBD, liver disease, hepatitis, cirrhosis, GI malignancies, malabsorption and pancreatic disorders",
    accentBar: "from-lime-400 to-green-500",
    iconWrap: "bg-lime-500/10",
    iconClass: "text-lime-300",
    actionClass: "text-lime-300",
    badgeClass: "border-lime-400/20 text-lime-200",
  },
  {
    title: "Psychiatry",
    slug: "psychiatry",
    description: "Depression, anxiety, psychosis, mood disorders and substance use",
    accentBar: "from-purple-400 to-fuchsia-500",
    iconWrap: "bg-purple-500/10",
    iconClass: "text-purple-300",
    actionClass: "text-purple-300",
    badgeClass: "border-purple-400/20 text-purple-200",
  },
  {
    title: "Biostatistics",
    slug: "biostatistics",
    description: "Study design, screening tests, risk measures, bias and data interpretation",
    accentBar: "from-slate-300 to-slate-500",
    iconWrap: "bg-slate-500/10",
    iconClass: "text-slate-200",
    actionClass: "text-slate-200",
    badgeClass: "border-slate-400/20 text-slate-200",
  },
];

const TITLE_ALIASES: Record<string, string> = {
  "infectious diseases": "Infectious Diseases",
  "infectious disease": "Infectious Diseases",
  "respiratory system": "Respiratory System",
  "renal & urogenital": "Renal & Urogenital",
  "renal and urogenital system": "Renal & Urogenital",
  "rheumatology & orthopedics": "Rheumatology & Orthopedics",
  "rheumatology and orthopedic": "Rheumatology & Orthopedics",
  endocrine: "Endocrine",
  endocrinology: "Endocrine",
  hematology: "Hematology",
  cardiology: "Cardiology",
  neurology: "Neurology",
  obstetrics: "Obstetrics",
  obstetric: "Obstetrics",
  obs: "Obstetrics",
  gynecology: "Gynecology",
  gynecologic: "Gynecology",
  gyne: "Gynecology",
  gyn: "Gynecology",
  pediatrics: "Pediatrics",
  pediatric: "Pediatrics",
  psychiatry: "Psychiatry",
  biostatistics: "Biostatistics",
  dermatology: "Dermatology",
  "gastrointestinal system": "Gastrointestinal System",
  gastrointestinal: "Gastrointestinal System",
  gastroenterology: "Gastrointestinal System",
  "gi system": "Gastrointestinal System",
  "gi tract": "Gastrointestinal System",
  gastro: "Gastrointestinal System",
  "hepatology": "Gastrointestinal System",
};

const META_BY_TITLE = new Map(SUBJECT_CATALOG.map((subject) => [subject.title, subject]));
const META_BY_SLUG = new Map(SUBJECT_CATALOG.map((subject) => [subject.slug, subject]));

export function normalizeSubjectTitle(input?: string | null) {
  const raw = String(input || "").trim();
  if (!raw) return "";
  const alias = TITLE_ALIASES[raw.toLowerCase()];
  if (alias) return alias;
  const exact = SUBJECT_CATALOG.find((subject) => subject.title.toLowerCase() === raw.toLowerCase());
  if (exact) return exact.title;
  return raw;
}

export function subjectSlugFromTitle(input?: string | null) {
  const normalized = normalizeSubjectTitle(input);
  if (!normalized) return "";
  const known = META_BY_TITLE.get(normalized);
  if (known) return known.slug;
  return normalized.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export function getSubjectMeta(input?: string | null) {
  const normalized = normalizeSubjectTitle(input);
  return META_BY_TITLE.get(normalized) || META_BY_SLUG.get(String(input || "")) || null;
}

export function getSubjectMetaBySlug(slug: string) {
  return META_BY_SLUG.get(slug) || null;
}

export function classifySubjectFromText(text: string, fallback?: string | null) {
  const direct = normalizeSubjectTitle(text);
  if (META_BY_TITLE.has(direct)) return direct;

  const lowered = text.toLowerCase();
  for (const [alias, title] of Object.entries(TITLE_ALIASES)) {
    if (lowered.includes(alias)) return title;
  }

  const detected = detectIfomSubject(text);
  const normalizedDetected = normalizeSubjectTitle(detected || fallback || "");
  if (META_BY_TITLE.has(normalizedDetected)) return normalizedDetected;

  const normalizedFallback = normalizeSubjectTitle(fallback);
  return META_BY_TITLE.has(normalizedFallback)
    ? normalizedFallback
    : IFOM_CSE_SUBJECTS.includes(normalizedDetected as (typeof IFOM_CSE_SUBJECTS)[number])
      ? normalizedDetected
      : "";
}

export function getSubjectIconName(subject: string) {
  const normalized = normalizeSubjectTitle(subject);
  switch (normalized) {
    case "Cardiology":
      return HeartPulse;
    case "Neurology":
      return Brain;
    case "Endocrine":
      return Activity;
    case "Hematology":
      return Microscope;
    case "Pediatrics":
      return BookOpen;
    case "Psychiatry":
      return MoonStar;
    case "Biostatistics":
      return Sigma;
    case "Respiratory System":
      return Stethoscope;
    case "Infectious Diseases":
      return Beaker;
    case "Gastrointestinal System":
      return Activity;
    case "Obstetrics":
      return Stethoscope;
    case "Gynecology":
      return Dna;
    default:
      return Dna;
  }
}
