/**
 * GET  /api/workspaces
 *   ?category=  subject | lecture | qbank | qbank-active | documents | all
 *   ?lesson_id= optional
 * POST /api/workspaces → create workspace
 * PATCH /api/workspaces → update blocks / meta / title / pinned
 * DELETE /api/workspaces?id=…
 *
 * Workspaces are stored inside the existing `notes` table so existing RLS
 * keeps working. New columns from migration 0015 (kind, category, blocks,
 * legacy_body, title, pinned) categorize them automatically.
 */
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, createClient, requireActive } from "@/lib/supabase/server";
import { extractNoteIndexText } from "@/lib/ai/source-text";
import { indexSource } from "@/lib/ai/rag";

export const runtime = "nodejs";

const CATEGORIES = ["subject", "lecture", "qbank", "qbank-active", "documents"] as const;
type Category = (typeof CATEGORIES)[number];

function isCategory(value: unknown): value is Category {
  return typeof value === "string" && (CATEGORIES as readonly string[]).includes(value);
}

export async function GET(req: NextRequest) {
  const ctx = await requireActive();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const categoryParam = url.searchParams.get("category");
  const lessonId = url.searchParams.get("lesson_id");
  const onlyPinned = url.searchParams.get("pinned") === "true";

  const db = await createClient();
  let query = db
    .from("notes")
    .select("id, lesson_id, title, kind, category, blocks, legacy_body, meta, pinned, updated_at, created_at")
    .eq("user_id", ctx.user.id)
    .order("updated_at", { ascending: false })
    .limit(200);

  if (lessonId) query = query.eq("lesson_id", lessonId);
  if (onlyPinned) query = query.eq("pinned", true);
  if (categoryParam && isCategory(categoryParam)) query = query.eq("category", categoryParam);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ workspaces: data ?? [] });
}

type PostBody = {
  category: Category;
  title?: string | null;
  lesson_id?: string | null;
  blocks?: unknown;
  legacy_body?: string | null;
  meta?: Record<string, unknown>;
  pinned?: boolean;
};

function sanitizeBlocks(raw: unknown): unknown[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((b) => {
      if (!b || typeof b !== "object") return null;
      const obj = b as Record<string, unknown>;
      if (typeof obj.id !== "string" || typeof obj.type !== "string") return null;
      const clean: Record<string, unknown> = { id: obj.id, type: obj.type };
      for (const key of ["text", "caption", "url", "name", "mime", "color", "level", "checked"]) {
        const v = obj[key];
        if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
          clean[key] = v;
        }
      }
      if (Array.isArray(obj.rows)) {
        clean.rows = obj.rows.map((r) =>
          Array.isArray(r) ? r.map((c) => (typeof c === "string" ? c : "")) : []
        );
      }
      if (Array.isArray(obj.strokes)) {
        clean.strokes = obj.strokes;
      }
      return clean;
    })
    .filter((b): b is Record<string, unknown> => b !== null);
}

export async function POST(req: NextRequest) {
  const ctx = await requireActive();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as PostBody;
  if (!isCategory(body.category)) {
    return NextResponse.json({ error: "invalid category" }, { status: 400 });
  }

  const now = new Date().toISOString();
  const insert = {
    user_id: ctx.user.id,
    category: body.category,
    kind: "workspace",
    title: body.title?.trim() || null,
    lesson_id: body.lesson_id ?? null,
    blocks: sanitizeBlocks(body.blocks),
    legacy_body: body.legacy_body?.trim() || null,
    meta: body.meta ?? {},
    pinned: !!body.pinned,
    body: body.legacy_body?.trim() || "", // legacy body kept for RAG fallback
    updated_at: now,
  };

  const db = await createClient();
  const admin = createAdminClient();
  const { data, error } = await db
    .from("notes")
    .insert(insert)
    .select("id, lesson_id, title, kind, category, blocks, legacy_body, body, meta, pinned, updated_at, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Index the legacy body in RAG for AI Tutor fallback
  try {
    const text = extractNoteIndexText({ body: data.legacy_body || data.body || "" });
    if (text) await indexSource("note", data.id, text);
  } catch {
    /* non-blocking */
  }

  return NextResponse.json({ workspace: data });
}

type PatchBody = {
  id: string;
  blocks?: unknown;
  legacy_body?: string | null;
  title?: string | null;
  meta?: Record<string, unknown>;
  category?: Category;
  lesson_id?: string | null;
  pinned?: boolean;
};

export async function PATCH(req: NextRequest) {
  const ctx = await requireActive();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as PatchBody;
  if (!body.id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const now = new Date().toISOString();
  const update: Record<string, unknown> = { updated_at: now };
  if (body.blocks !== undefined) update.blocks = sanitizeBlocks(body.blocks);
  if (body.legacy_body !== undefined) {
    update.legacy_body = body.legacy_body?.trim() || null;
    update.body = body.legacy_body?.trim() || "";
  }
  if (body.title !== undefined) update.title = body.title?.trim() || null;
  if (body.meta) update.meta = body.meta;
  if (isCategory(body.category)) update.category = body.category;
  if (body.lesson_id !== undefined) update.lesson_id = body.lesson_id || null;
  if (typeof body.pinned === "boolean") update.pinned = body.pinned;

  const db = await createClient();
  const admin = createAdminClient();
  const { data, error } = await db
    .from("notes")
    .update(update)
    .eq("id", body.id)
    .eq("user_id", ctx.user.id)
    .select("id, lesson_id, title, kind, category, blocks, legacy_body, body, meta, pinned, updated_at, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  try {
    await admin.from("rag_chunks").delete().eq("source_type", "note").eq("source_id", data.id);
    const text = extractNoteIndexText({ body: data.legacy_body || data.body || "" });
    if (text) await indexSource("note", data.id, text);
  } catch {
    /* non-blocking */
  }

  return NextResponse.json({ workspace: data });
}

export async function DELETE(req: NextRequest) {
  const ctx = await requireActive();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const db = await createClient();
  const admin = createAdminClient();

  const { data: existing } = await db
    .from("notes")
    .select("id")
    .eq("id", id)
    .eq("user_id", ctx.user.id)
    .maybeSingle();
  if (!existing) return NextResponse.json({ error: "not found" }, { status: 404 });

  await admin.from("rag_chunks").delete().eq("source_type", "note").eq("source_id", id);
  const { error } = await db.from("notes").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, deleted_id: id });
}
