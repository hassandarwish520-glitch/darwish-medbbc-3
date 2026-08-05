"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  FileImage,
  FileText,
  ImagePlus,
  Layers,
  Loader2,
  Plus,
  RotateCcw,
  ScanSearch,
  Trash2,
  X,
  Zap,
} from "lucide-react";
// Lucide doesn't export Flashlight in all versions — use Zap as fallback alias

// ─── Types ────────────────────────────────────────────────────────────────────

type ItemType = "image_question" | "ultrashot" | "flashcard" | "note";

type Choice = { key: string; text: string };

type LibraryItem = {
  id: string;
  type: ItemType;
  subject: string;
  title: string | null;
  body: string | null;
  hint: string | null;
  choices: Choice[] | null;
  answer_key: string | null;
  image_path: string | null;
  image_caption: string | null;
  tags: string[];
  created_at: string;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const SUBJECTS = [
  "All",
  "Cardiology",
  "Radiology",
  "Neurology",
  "Ob/Gyn",
  "Pediatrics",
  "Psychiatry",
  "Endocrine",
  "Respiratory",
  "Renal",
  "Hematology",
  "Infectious Disease",
  "Rheumatology",
  "Dermatology",
  "Gastroenterology",
  "Orthopedics",
  "Biostatistics",
  "General",
];

const TYPE_META: Record<ItemType, { label: string; color: string; bgColor: string; icon: React.ReactNode }> = {
  image_question: { label: "Image Q", color: "text-violet-300", bgColor: "bg-violet-500/10", icon: <FileImage className="h-4 w-4" /> },
  ultrashot: { label: "Ultrashot", color: "text-amber-300", bgColor: "bg-amber-500/10", icon: <Zap className="h-4 w-4" /> },
  flashcard: { label: "Flashcard", color: "text-emerald-300", bgColor: "bg-emerald-500/10", icon: <Layers className="h-4 w-4" /> },
  note: { label: "Note", color: "text-sky-300", bgColor: "bg-sky-500/10", icon: <FileText className="h-4 w-4" /> },
};

const TYPE_TABS: { key: "all" | ItemType; label: string }[] = [
  { key: "all", label: "All" },
  { key: "image_question", label: "Image Questions" },
  { key: "ultrashot", label: "Ultrashot" },
  { key: "flashcard", label: "Flashcards" },
  { key: "note", label: "Notes" },
];

function assetHref(path?: string | null) {
  if (!path) return "";
  if (/^(https?:|data:|blob:|\/)\/?/i.test(path)) return path;
  return `/api/assets/${path.split("/").map(encodeURIComponent).join("/")}`;
}

async function uploadImage(file: File): Promise<{ path: string; url: string }> {
  const fd = new FormData();
  fd.set("file", file);
  const res = await fetch("/api/uploads", { method: "POST", body: fd });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Upload failed");
  return data as { path: string; url: string };
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function IFOMLibraryClient({ initialItems }: { initialItems: LibraryItem[] }) {
  const [items, setItems] = useState<LibraryItem[]>(initialItems);
  const [activeTab, setActiveTab] = useState<"all" | ItemType>("all");
  const [activeSubject, setActiveSubject] = useState("All");
  const [addOpen, setAddOpen] = useState(false);
  const [viewItem, setViewItem] = useState<LibraryItem | null>(null);
  const [studyMode, setStudyMode] = useState(false);

  const filtered = useMemo(() => {
    return items.filter((i) => {
      if (activeTab !== "all" && i.type !== activeTab) return false;
      if (activeSubject !== "All" && i.subject !== activeSubject) return false;
      return true;
    });
  }, [items, activeTab, activeSubject]);

  const bySubject = useMemo(() => {
    const map = new Map<string, LibraryItem[]>();
    for (const item of filtered) {
      const arr = map.get(item.subject) ?? [];
      arr.push(item);
      map.set(item.subject, arr);
    }
    return Array.from(map.entries()).sort((a, b) => b[1].length - a[1].length);
  }, [filtered]);

  const counts = useMemo(() => {
    const c = { all: items.length, image_question: 0, ultrashot: 0, flashcard: 0, note: 0 };
    for (const i of items) c[i.type]++;
    return c;
  }, [items]);

  function handleCreated(item: LibraryItem) {
    setItems((prev) => [item, ...prev]);
    setAddOpen(false);
  }

  function handleDeleted(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id));
    if (viewItem?.id === id) setViewItem(null);
  }

  return (
    <>
      {/* ── Header ── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="section-title text-3xl">IFOM Library</h1>
          <p className="mt-1 text-slate-400">Your personal medical study vault — image questions, ultrashots, flashcards & notes.</p>
        </div>
        <div className="flex gap-2">
          {items.length > 0 && (
            <button
              onClick={() => setStudyMode(true)}
              className="btn-ghost flex items-center gap-2"
            >
              <ScanSearch className="h-4 w-4" /> Study
            </button>
          )}
          <button onClick={() => setAddOpen(true)} className="btn-primary flex items-center gap-2">
            <Plus className="h-4 w-4" /> Add Item
          </button>
        </div>
      </div>

      {/* ── Stats ── */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(["image_question", "ultrashot", "flashcard", "note"] as ItemType[]).map((t) => {
          const meta = TYPE_META[t];
          return (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              className={`card flex items-center gap-3 p-4 transition hover:border-brand/40 ${activeTab === t ? "border-brand/60" : ""}`}
            >
              <div className={`rounded-xl p-2 ${meta.bgColor} ${meta.color}`}>{meta.icon}</div>
              <div className="text-left">
                <div className="text-xl font-bold">{counts[t]}</div>
                <div className="text-xs text-slate-400">{meta.label}</div>
              </div>
            </button>
          );
        })}
      </div>

      {/* ── Type tabs ── */}
      <div className="mt-6 flex gap-1 overflow-x-auto rounded-2xl bg-ink-900 p-1 border border-ink-700">
        {TYPE_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-shrink-0 rounded-xl px-4 py-2 text-sm font-medium transition ${
              activeTab === tab.key
                ? "bg-brand text-white shadow"
                : "text-slate-400 hover:text-slate-100"
            }`}
          >
            {tab.label}
            <span className="ml-1.5 text-xs opacity-60">{tab.key === "all" ? counts.all : counts[tab.key as ItemType]}</span>
          </button>
        ))}
      </div>

      {/* ── Subject pills ── */}
      <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
        {SUBJECTS.map((s) => (
          <button
            key={s}
            onClick={() => setActiveSubject(s)}
            className={`flex-shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition ${
              activeSubject === s
                ? "border-brand bg-brand/10 text-brand"
                : "border-ink-700 text-slate-400 hover:border-brand/40 hover:text-slate-100"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {/* ── Items ── */}
      {items.length === 0 ? (
        <EmptyState onAdd={() => setAddOpen(true)} />
      ) : filtered.length === 0 ? (
        <div className="card mt-6 p-8 text-center text-slate-400">
          No items match these filters.
          <button onClick={() => { setActiveTab("all"); setActiveSubject("All"); }} className="ml-2 text-brand underline">Clear filters</button>
        </div>
      ) : (
        <div className="mt-6 space-y-8">
          {bySubject.map(([subject, subItems]) => (
            <SubjectSection
              key={subject}
              subject={subject}
              items={subItems}
              onView={setViewItem}
              onDelete={handleDeleted}
            />
          ))}
        </div>
      )}

      {/* ── Modals ── */}
      {addOpen && (
        <AddModal
          onClose={() => setAddOpen(false)}
          onCreated={handleCreated}
        />
      )}
      {viewItem && (
        <ViewModal
          item={viewItem}
          onClose={() => setViewItem(null)}
          onDelete={() => handleDeleted(viewItem.id)}
        />
      )}
      {studyMode && (
        <StudyMode items={filtered} onClose={() => setStudyMode(false)} />
      )}
    </>
  );
}

// ─── Subject Section ──────────────────────────────────────────────────────────

function SubjectSection({
  subject,
  items,
  onView,
  onDelete,
}: {
  subject: string;
  items: LibraryItem[];
  onView: (item: LibraryItem) => void;
  onDelete: (id: string) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div>
      <button
        onClick={() => setCollapsed((v) => !v)}
        className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-slate-300"
      >
        {collapsed ? <ChevronRight className="h-4 w-4 text-brand" /> : <ChevronDown className="h-4 w-4 text-brand" />}
        {subject}
        <span className="ml-1 text-xs font-normal text-slate-500">· {items.length} item{items.length !== 1 ? "s" : ""}</span>
      </button>

      {!collapsed && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <ItemCard key={item.id} item={item} onView={onView} onDelete={onDelete} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Item Card ────────────────────────────────────────────────────────────────

function ItemCard({
  item,
  onView,
  onDelete,
}: {
  item: LibraryItem;
  onView: (item: LibraryItem) => void;
  onDelete: (id: string) => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const meta = TYPE_META[item.type];

  async function remove(e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm("Delete this item?")) return;
    setDeleting(true);
    await fetch(`/api/ifom-library?id=${item.id}`, { method: "DELETE" });
    onDelete(item.id);
  }

  return (
    <div
      onClick={() => onView(item)}
      className="group card cursor-pointer overflow-hidden transition hover:border-brand/50"
    >
      {/* Image */}
      {item.image_path ? (
        <div className="relative h-44 overflow-hidden bg-ink-950">
          <img
            src={assetHref(item.image_path)}
            alt={item.image_caption || "Medical image"}
            className="h-full w-full object-cover transition group-hover:scale-105"
          />
          {item.image_caption && (
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 px-3 py-2 text-xs text-slate-300">
              {item.image_caption}
            </div>
          )}
        </div>
      ) : item.type === "image_question" ? (
        <div className="flex h-32 items-center justify-center bg-ink-950/80 text-slate-600">
          <ImagePlus className="h-8 w-8" />
        </div>
      ) : null}

      <div className="p-4">
        {/* Type badge */}
        <div className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${meta.bgColor} ${meta.color}`}>
          {meta.icon} {meta.label}
        </div>

        {/* Title / stem */}
        <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-200">
          {item.title || item.body || "—"}
        </p>

        {/* Flashcard hint */}
        {item.type === "flashcard" && item.body && (
          <p className="mt-1 line-clamp-2 text-xs text-slate-500">{item.body}</p>
        )}

        {/* MCQ choices preview */}
        {item.type === "image_question" && item.choices && (
          <div className="mt-2 space-y-1">
            {(item.choices as Choice[]).slice(0, 3).map((c) => (
              <div key={c.key} className="flex gap-2 text-xs text-slate-400">
                <span className="font-bold text-brand">{c.key}.</span> {c.text}
              </div>
            ))}
            {(item.choices as Choice[]).length > 3 && (
              <div className="text-xs text-slate-500">+{(item.choices as Choice[]).length - 3} more</div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="mt-3 flex items-center justify-between">
          <span className="text-xs text-slate-500">{item.subject}</span>
          <button
            onClick={remove}
            disabled={deleting}
            className="rounded-full p-1.5 text-slate-600 opacity-0 transition hover:bg-red-500/10 hover:text-red-400 group-hover:opacity-100"
          >
            {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── View Modal ───────────────────────────────────────────────────────────────

function ViewModal({ item, onClose, onDelete }: { item: LibraryItem; onClose: () => void; onDelete: () => void }) {
  const [revealed, setRevealed] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const meta = TYPE_META[item.type];

  async function remove() {
    if (!confirm("Delete this item?")) return;
    await fetch(`/api/ifom-library?id=${item.id}`, { method: "DELETE" });
    onDelete();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-ink-900 shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-ink-700 bg-ink-900 px-6 py-4">
          <div className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${meta.bgColor} ${meta.color}`}>
            {meta.icon} {meta.label} · {item.subject}
          </div>
          <div className="flex gap-2">
            <button onClick={remove} className="rounded-full p-2 text-slate-500 hover:bg-red-500/10 hover:text-red-400">
              <Trash2 className="h-4 w-4" />
            </button>
            <button onClick={onClose} className="rounded-full p-2 text-slate-400 hover:bg-white/10">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {/* Medical Image */}
          {item.image_path && (
            <div className="overflow-hidden rounded-xl border border-ink-700">
              <img src={assetHref(item.image_path)} alt={item.image_caption || "Medical image"} className="w-full object-contain max-h-72" />
              {item.image_caption && <p className="px-4 py-2 text-xs text-slate-400 border-t border-ink-700">{item.image_caption}</p>}
            </div>
          )}

          {/* Question / Title */}
          {item.title && (
            <p className="text-lg font-medium leading-7 text-slate-100">{item.title}</p>
          )}

          {/* Image Question — MCQ */}
          {item.type === "image_question" && item.choices && (
            <div className="space-y-2">
              {(item.choices as Choice[]).map((c) => {
                const isCorrect = c.key === item.answer_key;
                const isSelected = c.key === selectedAnswer;
                let cls = "flex gap-3 rounded-xl border p-3 text-sm transition cursor-pointer ";
                if (selectedAnswer) {
                  if (isCorrect) cls += "border-emerald-500/60 bg-emerald-500/10 text-emerald-300";
                  else if (isSelected) cls += "border-red-500/40 bg-red-500/10 text-red-300";
                  else cls += "border-ink-700 text-slate-500";
                } else {
                  cls += "border-ink-700 hover:border-brand/50 hover:bg-brand/5 text-slate-300";
                }
                return (
                  <button key={c.key} className={cls} onClick={() => !selectedAnswer && setSelectedAnswer(c.key)}>
                    <span className={`font-bold shrink-0 ${selectedAnswer ? (isCorrect ? "text-emerald-400" : isSelected ? "text-red-400" : "text-slate-600") : "text-brand"}`}>{c.key}.</span>
                    {c.text}
                  </button>
                );
              })}
              {selectedAnswer && item.body && (
                <div className="rounded-xl border border-ink-700 bg-ink-800 p-4 text-sm leading-6 text-slate-300">
                  <div className="mb-2 text-xs font-semibold uppercase tracking-widest text-brand">Explanation</div>
                  {item.body}
                </div>
              )}
            </div>
          )}

          {/* Ultrashot */}
          {item.type === "ultrashot" && (
            <div>
              {!revealed ? (
                <button onClick={() => setRevealed(true)} className="btn-primary w-full">Reveal Answer</button>
              ) : (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm leading-6 text-emerald-200">
                  <div className="mb-2 text-xs font-semibold uppercase tracking-widest text-emerald-400">Answer</div>
                  {item.hint || item.body}
                </div>
              )}
            </div>
          )}

          {/* Flashcard */}
          {item.type === "flashcard" && (
            <div>
              {item.body && (
                !revealed ? (
                  <button onClick={() => setRevealed(true)} className="btn-primary w-full flex items-center justify-center gap-2">
                    <RotateCcw className="h-4 w-4" /> Flip to Back
                  </button>
                ) : (
                  <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-5 text-base leading-7 text-emerald-200">
                    <div className="mb-2 text-xs font-semibold uppercase tracking-widest text-emerald-400">Back</div>
                    {item.body}
                  </div>
                )
              )}
            </div>
          )}

          {/* Note */}
          {item.type === "note" && item.body && (
            <div className="rounded-xl border border-ink-700 bg-ink-800/60 p-5 text-sm leading-7 text-slate-300 whitespace-pre-wrap">
              {item.body}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Add Modal ────────────────────────────────────────────────────────────────

const DEFAULT_CHOICES: Choice[] = [
  { key: "A", text: "" },
  { key: "B", text: "" },
  { key: "C", text: "" },
  { key: "D", text: "" },
];

function AddModal({ onClose, onCreated }: { onClose: () => void; onCreated: (item: LibraryItem) => void }) {
  const [type, setType] = useState<ItemType>("image_question");
  const [subject, setSubject] = useState("Cardiology");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [hint, setHint] = useState("");
  const [choices, setChoices] = useState<Choice[]>(DEFAULT_CHOICES);
  const [answerKey, setAnswerKey] = useState("A");
  const [imageCaption, setImageCaption] = useState("");
  const [imagePath, setImagePath] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const imgRef = useRef<HTMLInputElement>(null);

  async function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const { path, url } = await uploadImage(file);
      setImagePath(path);
      setImagePreview(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  function addChoice() {
    const keys = "ABCDEFGHIJ";
    const next = keys[choices.length] ?? String(choices.length + 1);
    setChoices((prev) => [...prev, { key: next, text: "" }]);
  }

  function removeChoice(idx: number) {
    setChoices((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateChoice(idx: number, text: string) {
    setChoices((prev) => prev.map((c, i) => (i === idx ? { ...c, text } : c)));
  }

  async function save() {
    setError("");
    if (!title.trim() && !body.trim()) { setError("Add a question or note text."); return; }
    if (type === "image_question") {
      const filled = choices.filter((c) => c.text.trim());
      if (filled.length < 2) { setError("Add at least 2 answer choices."); return; }
    }
    setSaving(true);
    try {
      const res = await fetch("/api/ifom-library", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          subject,
          title: title.trim() || null,
          body: body.trim() || null,
          hint: hint.trim() || null,
          choices: type === "image_question" ? choices.filter((c) => c.text.trim()) : null,
          answer_key: type === "image_question" ? answerKey : null,
          image_path: imagePath,
          image_caption: imageCaption.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      onCreated(data.item as LibraryItem);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-2xl max-h-[95vh] overflow-y-auto rounded-2xl bg-ink-900 shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-ink-700 bg-ink-900 px-6 py-4">
          <h2 className="text-lg font-semibold">Add to IFOM Library</h2>
          <button onClick={onClose} className="rounded-full p-2 text-slate-400 hover:bg-white/10"><X className="h-5 w-5" /></button>
        </div>

        <div className="p-6 space-y-5">
          {/* Type selector */}
          <div>
            <label className="label mb-2">Type</label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {(["image_question", "ultrashot", "flashcard", "note"] as ItemType[]).map((t) => {
                const m = TYPE_META[t];
                return (
                  <button
                    key={t}
                    onClick={() => setType(t)}
                    className={`flex flex-col items-center gap-2 rounded-xl border p-3 text-xs font-medium transition ${
                      type === t ? `border-brand bg-brand/10 ${m.color}` : "border-ink-700 text-slate-400 hover:border-brand/40"
                    }`}
                  >
                    <div className={`rounded-lg p-1.5 ${m.bgColor} ${m.color}`}>{m.icon}</div>
                    {m.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Subject */}
          <div>
            <label className="label">Subject</label>
            <select
              className="input mt-1 w-full"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            >
              {SUBJECTS.filter((s) => s !== "All").map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {/* Medical image upload */}
          <div>
            <label className="label">{type === "note" ? "Image (optional)" : "Medical Image"}</label>
            <input ref={imgRef} type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
            {imagePreview ? (
              <div className="relative mt-1 overflow-hidden rounded-xl border border-ink-700">
                <img src={imagePreview} alt="Preview" className="max-h-56 w-full object-contain" />
                <button
                  onClick={() => { setImagePath(null); setImagePreview(null); }}
                  className="absolute right-2 top-2 rounded-full bg-black/60 p-1.5 text-slate-300 hover:text-red-400"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => imgRef.current?.click()}
                disabled={uploading}
                className="mt-1 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-ink-600 py-5 text-sm text-slate-400 transition hover:border-brand/50 hover:text-brand"
              >
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
                {uploading ? "Uploading…" : "Click to upload image"}
              </button>
            )}
            {imagePreview && (
              <input
                className="input mt-2 w-full"
                placeholder="Image caption (optional)"
                value={imageCaption}
                onChange={(e) => setImageCaption(e.target.value)}
              />
            )}
          </div>

          {/* Question / Title */}
          <div>
            <label className="label">
              {type === "image_question" ? "Question Stem" :
               type === "ultrashot" ? "Question" :
               type === "flashcard" ? "Front (Question side)" :
               "Note Title"}
            </label>
            <textarea
              className="input mt-1 w-full min-h-[80px] resize-y"
              placeholder={
                type === "image_question" ? "e.g. A 45-year-old male presents with…" :
                type === "ultrashot" ? "e.g. Most common cause of community-acquired pneumonia?" :
                type === "flashcard" ? "e.g. What is the first-line treatment for…?" :
                "Note title (optional)"
              }
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          {/* MCQ Choices */}
          {type === "image_question" && (
            <div>
              <label className="label">Answer Choices</label>
              <div className="mt-1 space-y-2">
                {choices.map((c, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <button
                      onClick={() => setAnswerKey(c.key)}
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs font-bold transition ${
                        answerKey === c.key
                          ? "border-emerald-500 bg-emerald-500 text-white"
                          : "border-ink-600 text-slate-400 hover:border-brand/50"
                      }`}
                      title="Mark as correct answer"
                    >
                      {c.key}
                    </button>
                    <input
                      className="input flex-1 h-10"
                      placeholder={`Choice ${c.key}`}
                      value={c.text}
                      onChange={(e) => updateChoice(i, e.target.value)}
                    />
                    {choices.length > 2 && (
                      <button onClick={() => removeChoice(i)} className="text-slate-500 hover:text-red-400">
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
                <button onClick={addChoice} className="btn-ghost w-full text-sm flex items-center justify-center gap-1">
                  <Plus className="h-3.5 w-3.5" /> Add Choice
                </button>
              </div>
            </div>
          )}

          {/* Body / Back / Answer / Note body */}
          <div>
            <label className="label">
              {type === "image_question" ? "Explanation (shown after answering)" :
               type === "ultrashot" ? "Answer" :
               type === "flashcard" ? "Back (Answer side)" :
               "Note Content"}
            </label>
            <textarea
              className="input mt-1 w-full min-h-[100px] resize-y"
              placeholder={
                type === "image_question" ? "Educational explanation…" :
                type === "ultrashot" ? "Answer text…" :
                type === "flashcard" ? "Answer / back side text…" :
                "Write your medical notes here…"
              }
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <div className="flex gap-3">
            <button onClick={onClose} className="btn-ghost flex-1">Cancel</button>
            <button onClick={save} disabled={saving || uploading} className="btn-primary flex-1 flex items-center justify-center gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              {saving ? "Saving…" : "Save Item"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Study Mode ───────────────────────────────────────────────────────────────

function StudyMode({ items, onClose }: { items: LibraryItem[]; onClose: () => void }) {
  const [idx, setIdx] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);

  const item = items[idx];
  if (!item) return null;
  const meta = TYPE_META[item.type];

  function next() {
    setIdx((i) => Math.min(i + 1, items.length - 1));
    setRevealed(false);
    setSelectedAnswer(null);
  }

  function prev() {
    setIdx((i) => Math.max(i - 1, 0));
    setRevealed(false);
    setSelectedAnswer(null);
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-ink-950">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-ink-700 px-6 py-4">
        <div className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${meta.bgColor} ${meta.color}`}>
          {meta.icon} {meta.label} · {item.subject}
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-slate-400">{idx + 1} / {items.length}</span>
          <button onClick={onClose} className="rounded-full p-2 text-slate-400 hover:bg-white/10"><X className="h-5 w-5" /></button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-2xl space-y-5">
          {item.image_path && (
            <div className="overflow-hidden rounded-2xl border border-ink-700">
              <img src={assetHref(item.image_path)} alt={item.image_caption || "Medical image"} className="w-full object-contain max-h-64" />
              {item.image_caption && <p className="px-4 py-2 text-xs text-slate-400 border-t border-ink-700">{item.image_caption}</p>}
            </div>
          )}

          {item.title && <p className="text-xl font-medium leading-7 text-slate-100">{item.title}</p>}

          {item.type === "image_question" && item.choices && (
            <div className="space-y-2">
              {(item.choices as Choice[]).map((c) => {
                const isCorrect = c.key === item.answer_key;
                const isSelected = c.key === selectedAnswer;
                let cls = "flex gap-3 rounded-xl border p-3.5 text-sm transition cursor-pointer ";
                if (selectedAnswer) {
                  if (isCorrect) cls += "border-emerald-500/60 bg-emerald-500/10 text-emerald-300";
                  else if (isSelected) cls += "border-red-500/40 bg-red-500/10 text-red-300";
                  else cls += "border-ink-700 text-slate-500";
                } else {
                  cls += "border-ink-700 hover:border-brand/50 hover:bg-brand/5 text-slate-300";
                }
                return (
                  <button key={c.key} className={cls} onClick={() => !selectedAnswer && setSelectedAnswer(c.key)}>
                    <span className={`font-bold shrink-0 ${selectedAnswer ? (isCorrect ? "text-emerald-400" : isSelected ? "text-red-400" : "text-slate-600") : "text-brand"}`}>{c.key}.</span>
                    {c.text}
                  </button>
                );
              })}
              {selectedAnswer && item.body && (
                <div className="rounded-xl border border-ink-700 bg-ink-800 p-4 text-sm leading-6 text-slate-300">
                  <div className="mb-2 text-xs font-semibold uppercase tracking-widest text-brand">Explanation</div>
                  {item.body}
                </div>
              )}
            </div>
          )}

          {(item.type === "ultrashot" || item.type === "flashcard") && (
            !revealed ? (
              <button onClick={() => setRevealed(true)} className="btn-primary w-full">
                {item.type === "flashcard" ? "Flip Card" : "Reveal Answer"}
              </button>
            ) : (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-5 text-base leading-7 text-emerald-200">
                <div className="mb-2 text-xs font-semibold uppercase tracking-widest text-emerald-400">
                  {item.type === "flashcard" ? "Back" : "Answer"}
                </div>
                {item.hint || item.body}
              </div>
            )
          )}

          {item.type === "note" && item.body && (
            <div className="rounded-xl border border-ink-700 bg-ink-800/60 p-5 text-sm leading-7 text-slate-300 whitespace-pre-wrap">
              {item.body}
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <div className="border-t border-ink-700 p-4 flex items-center justify-between gap-3">
        <button onClick={prev} disabled={idx === 0} className="btn-ghost flex-1 disabled:opacity-30">← Prev</button>
        <span className="text-xs text-slate-500">{item.subject}</span>
        <button onClick={next} disabled={idx === items.length - 1} className="btn-primary flex-1 disabled:opacity-30">Next →</button>
      </div>
    </div>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="card mt-8 p-10 text-center">
      <div className="mx-auto grid h-20 w-20 place-items-center rounded-2xl bg-brand/10 text-brand">
        <FileImage className="h-10 w-10" />
      </div>
      <h2 className="mt-5 text-2xl font-semibold">Your IFOM Library is empty</h2>
      <p className="mx-auto mt-3 max-w-sm text-base leading-7 text-slate-400">
        Add image questions with MCQ choices, ultrashot Q&amp;A, flashcards, or medical notes — all organized by subject.
      </p>
      <button onClick={onAdd} className="btn-primary mt-6 flex items-center gap-2 mx-auto">
        <Plus className="h-4 w-4" /> Add First Item
      </button>
    </div>
  );
}
