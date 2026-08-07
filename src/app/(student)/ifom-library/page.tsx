import { requireActive } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import IFOMLibraryClient from "./IFOMLibraryClient";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type SharedMedicalLibraryRow = {
  id: string;
  entry_type?: string | null;
  title?: string | null;
  body?: string | null;
  quote?: string | null;
  subject_slug?: string | null;
  created_at?: string | null;
  data?: Record<string, any> | null;
  share_to_ifom?: boolean | null;
  ifom_type?: string | null;
  ifom_subject?: string | null;
  ifom_title?: string | null;
  ifom_body?: string | null;
  ifom_hint?: string | null;
  ifom_choices?: any[] | null;
  ifom_answer_key?: string | null;
  ifom_image_path?: string | null;
  ifom_image_caption?: string | null;
  ifom_tags?: string[] | null;
};

const VALID_TYPES = new Set(["image_question", "ultrashot", "flashcard", "note"] as const);

function toSharedRows(value: unknown): SharedMedicalLibraryRow[] {
  return Array.isArray(value) ? (value as unknown as SharedMedicalLibraryRow[]) : [];
}

function normalizeSubject(input: string | null | undefined) {
  const raw = (input || "General").trim();
  if (!raw) return "General";
  return raw
    .split(/[-_]+/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function normalizePrivateItem(item: any) {
  return {
    ...item,
    id: `private:${item.id}`,
    source: "private",
    source_label: "My note",
    read_only: false,
  };
}

function normalizeSharedItem(row: SharedMedicalLibraryRow | any) {
  const data = row.data && typeof row.data === "object" ? row.data : {};
  const resolvedType = [row.ifom_type, data.ifom_type, data.type, row.entry_type].find(
    (value): value is string => typeof value === "string" && VALID_TYPES.has(value as any)
  ) ?? "note";

  const rawChoices = row.ifom_choices ?? data.choices ?? null;
  const choices = Array.isArray(rawChoices)
    ? rawChoices
        .map((choice: any, index: number) => {
          if (choice && typeof choice === "object") {
            const key = typeof choice.key === "string" ? choice.key : String.fromCharCode(65 + index);
            const text = typeof choice.text === "string" ? choice.text : "";
            return { key, text };
          }
          if (typeof choice === "string") {
            return { key: String.fromCharCode(65 + index), text: choice };
          }
          return null;
        })
        .filter(Boolean)
    : null;

  const tagsSource = row.ifom_tags ?? data.tags ?? [];

  return {
    id: `shared:${row.id}`,
    type: resolvedType,
    subject: normalizeSubject(row.ifom_subject ?? data.subject ?? data.subject_title ?? row.subject_slug ?? "General"),
    title: row.ifom_title ?? data.title ?? row.title ?? null,
    body: row.ifom_body ?? data.body ?? row.body ?? row.quote ?? null,
    hint: row.ifom_hint ?? data.hint ?? null,
    choices,
    answer_key: row.ifom_answer_key ?? data.answer_key ?? null,
    image_path: row.ifom_image_path ?? data.image_path ?? data.attachment_path ?? data.file_path ?? null,
    image_caption: row.ifom_image_caption ?? data.image_caption ?? null,
    tags: Array.isArray(tagsSource) ? tagsSource.filter((tag) => typeof tag === "string") : [],
    created_at: row.created_at ?? new Date().toISOString(),
    source: "shared",
    source_label: "From admin",
    read_only: true,
  };
}

export default async function IFOMLibraryPage() {
  const ctx = await requireActive();
  if (!ctx) redirect("/sign-in");

  const db = await createClient();

  const [{ data: privateItems }, sharedItems] = await Promise.all([
    db
      .from("ifom_library")
      .select("*")
      .eq("user_id", ctx.user.id)
      .order("created_at", { ascending: false })
      .limit(500),
    (async () => {
      const sharedSelect = [
        "id",
        "entry_type",
        "title",
        "body",
        "quote",
        "subject_slug",
        "created_at",
        "data",
        "share_to_ifom",
        "ifom_type",
        "ifom_subject",
        "ifom_title",
        "ifom_body",
        "ifom_hint",
        "ifom_choices",
        "ifom_answer_key",
        "ifom_image_path",
        "ifom_image_caption",
        "ifom_tags",
      ].join(", ");

      const primary = await db
        .from("medical_library_entries")
        .select(sharedSelect)
        .eq("share_to_ifom", true)
        .order("created_at", { ascending: false })
        .limit(300);

      if (!primary.error) return toSharedRows(primary.data).map((row) => normalizeSharedItem(row));

      const fallbackQueries = [
        db
          .from("medical_library_entries")
          .select("id, entry_type, title, body, quote, subject_slug, created_at, data")
          .contains("data", { share_to_ifom: true })
          .order("created_at", { ascending: false })
          .limit(300),
        db
          .from("medical_library_entries")
          .select("id, entry_type, title, body, quote, subject_slug, created_at, data")
          .contains("data", { ifom_shared: true })
          .order("created_at", { ascending: false })
          .limit(300),
      ];

      for (const attempt of fallbackQueries) {
        const res = await attempt;
        if (!res.error) return toSharedRows(res.data).map((row) => normalizeSharedItem(row));
      }

      return [];
    })(),
  ]);

  const mergedItems = [
    ...((privateItems ?? []).map(normalizePrivateItem)),
    ...sharedItems,
  ].sort((a: any, b: any) => {
    const aTime = new Date(a.created_at || 0).getTime();
    const bTime = new Date(b.created_at || 0).getTime();
    return bTime - aTime;
  });

  return (
    <div className="page-shell">
      <IFOMLibraryClient initialItems={mergedItems as any[]} />
    </div>
  );
}
