/**
 * Workspace API backed by the existing `notes` table.
 *
 * IMPORTANT:
 * This route does NOT rely on extra SQL columns like `notes.title`
 * or `notes.blocks`. Everything is stored inside `notes.meta.workspace`
 * so the feature works immediately even before custom migrations run.
 */
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, createClient, requireActive } from "@/lib/supabase/server";
import { extractNoteIndexText } from "@/lib/ai/source-text";
import { indexSource } from "@/lib/ai/rag";

export const runtime = "nodejs";

const CATEGORIES = ["subject", "lecture", "qbank", "qbank-active", "documents"] as const;
type Category = (typeof CATEGORIES)[number];

type WorkspaceMeta = {
  kind?: string;
  category?: Category;
  title?: string | null;
  blocks?: unknown[];
  pinned?: boolean;
  published?: boolean;
  visibility?: "private" | "published";
  legacy_body?: string | null;
  source?: string | null;
  original_file_url?: string | null;
  original_file_name?: string | null;
  video_url?: string | null;
};

type RawNoteRow = {
  id: string;
  user_id?: string;
  lesson_id: string | null;
  body: string | null;
  meta: Record<string, unknown> | null;
  updated_at: string;
  created_at?: string;
};

type WorkspaceDto = {
  id: string;
  lesson_id: string | null;
  title: string | null;
  category: Category;
  blocks: unknown[];
  legacy_body: string | null;
  meta: Record<string, unknown>;
  pinned: boolean;
  updated_at: string;
  created_at?: string;
};

type PostBody = {
  category?: Category;
  title?: string | null;
  lesson_id?: string | null;
  blocks?: unknown;
  legacy_body?: string | null;
  meta?: Record<string, unknown>;
  pinned?: boolean;
};

type PatchBody = {
  id?: string;
  category?: Category;
  title?: string | null;
  lesson_id?: string | null;
  blocks?: unknown;
  legacy_body?: string | null;
  meta?: Record<string, unknown>;
  pinned?: boolean;
};

function isCategory(value: unknown): value is Category {
  return typeof value === "string" && (CATEGORIES as readonly string[]).includes(value);
}

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
        if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") clean[key] = v;
      }
      if (Array.isArray(obj.rows)) {
        clean.rows = obj.rows.map((r) => (Array.isArray(r) ? r.map((c) => (typeof c === "string" ? c : "")) : []));
      }
      if (Array.isArray(obj.strokes)) clean.strokes = obj.strokes;
      return clean;
    })
    .filter((b): b is Record<string, unknown> => b !== null);
}

function noteMeta(meta: Record<string, unknown> | null | undefined): Record<string, unknown> {
  return meta && typeof meta === "object" ? meta : {};
}

function workspaceMeta(meta: Record<string, unknown> | null | undefined): WorkspaceMeta {
  const root = noteMeta(meta);
  const ws = root.workspace;
  return ws && typeof ws === "object" ? (ws as WorkspaceMeta) : {};
}

function normalizeRow(row: RawNoteRow): WorkspaceDto | null {
  const rootMeta = noteMeta(row.meta);
  const ws = workspaceMeta(rootMeta);
  const category = isCategory(ws.category) ? ws.category : "documents";
  const kind = typeof ws.kind === "string" ? ws.kind : null;
  if (kind && kind !== "workspace") return null;
  return {
    id: row.id,
    lesson_id: row.lesson_id,
    title: typeof ws.title === "string" && ws.title.trim() ? ws.title.trim() : null,
    category,
    blocks: Array.isArray(ws.blocks) ? ws.blocks : [],
    legacy_body: typeof ws.legacy_body === "string" ? ws.legacy_body : row.body ?? null,
    meta: rootMeta,
    pinned: Boolean(ws.pinned),
    updated_at: row.updated_at,
    created_at: row.created_at,
  };
}

function mergeWorkspaceMeta(existingMeta: Record<string, unknown> | null | undefined, next: {
  category: Category;
  title?: string | null;
  blocks?: unknown;
  legacy_body?: string | null;
  pinned?: boolean;
  meta?: Record<string, unknown>;
}) {
  const root = {
    ...noteMeta(existingMeta),
    ...(next.meta && typeof next.meta === "object" ? next.meta : {}),
  };
  const currentWorkspace = workspaceMeta(existingMeta);
  root.workspace = {
    ...currentWorkspace,
    kind: "workspace",
    category: next.category,
    title: next.title?.trim() || currentWorkspace.title || null,
    blocks: next.blocks !== undefined ? sanitizeBlocks(next.blocks) : Array.isArray(currentWorkspace.blocks) ? currentWorkspace.blocks : [],
    pinned: typeof next.pinned === "boolean" ? next.pinned : Boolean(currentWorkspace.pinned),
    legacy_body: next.legacy_body?.trim() || currentWorkspace.legacy_body || null,
    published:
      typeof next.meta?.published === "boolean"
        ? next.meta.published
        : typeof currentWorkspace.published === "boolean"
          ? currentWorkspace.published
          : false,
    visibility:
      next.meta?.published === true || currentWorkspace.visibility === "published"
        ? "published"
        : "private",
  };
  return root;
}

export async function GET(req: NextRequest) {
  const ctx = await requireActive();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const categoryParam = url.searchParams.get("category");
  const lessonId = url.searchParams.get("lesson_id");
  const onlyPinned = url.searchParams.get("pinned") === "true";
  const limit = Math.min(Number(url.searchParams.get("limit") || 200), 400);

  const db = await createClient();
  let query = db
    .from("notes")
    .select("id, user_id, lesson_id, body, meta, updated_at, created_at")
    .eq("user_id", ctx.user.id)
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (lessonId) query = query.eq("lesson_id", lessonId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let workspaces = ((data ?? []) as RawNoteRow[])
    .map(normalizeRow)
    .filter((row): row is WorkspaceDto => Boolean(row));

  if (categoryParam && isCategory(categoryParam)) workspaces = workspaces.filter((row) => row.category === categoryParam);
  if (onlyPinned) workspaces = workspaces.filter((row) => row.pinned);

  return NextResponse.json({ workspaces });
}

export async function POST(req: NextRequest) {
  const ctx = await requireActive();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as PostBody;
  const category = isCategory(body.category) ? body.category : "documents";
  const now = new Date().toISOString();
  const meta = mergeWorkspaceMeta({}, {
    category,
    title: body.title ?? null,
    blocks: body.blocks,
    legacy_body: body.legacy_body ?? null,
    pinned: body.pinned,
    meta: body.meta,
  });

  const payload = {
    user_id: ctx.user.id,
    lesson_id: body.lesson_id ?? null,
    body: body.legacy_body?.trim() || "",
    meta,
    updated_at: now,
  };

  const db = await createClient();
  const { data, error } = await db
    .from("notes")
    .insert(payload)
    .select("id, user_id, lesson_id, body, meta, updated_at, created_at")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  try {
    const text = extractNoteIndexText({ body: data.body || "" });
    if (text) await indexSource("note", data.id, text);
  } catch {
    // non-blocking
  }

  return NextResponse.json({ workspace: normalizeRow(data as RawNoteRow) });
}

export async function PATCH(req: NextRequest) {
  const ctx = await requireActive();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as PatchBody;
  if (!body.id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const db = await createClient();
  const admin = createAdminClient();
  const { data: existing, error: existingError } = await db
    .from("notes")
    .select("id, user_id, lesson_id, body, meta, updated_at, created_at")
    .eq("id", body.id)
    .eq("user_id", ctx.user.id)
    .single();
  if (existingError) return NextResponse.json({ error: existingError.message }, { status: 500 });

  const current = existing as RawNoteRow;
  const currentWs = workspaceMeta(current.meta);
  const category = isCategory(body.category) ? body.category : isCategory(currentWs.category) ? currentWs.category : "documents";
  const meta = mergeWorkspaceMeta(current.meta, {
    category,
    title: body.title ?? currentWs.title ?? null,
    blocks: body.blocks !== undefined ? body.blocks : currentWs.blocks,
    legacy_body: body.legacy_body ?? currentWs.legacy_body ?? current.body ?? null,
    pinned: typeof body.pinned === "boolean" ? body.pinned : Boolean(currentWs.pinned),
    meta: body.meta,
  });

  const update = {
    lesson_id: body.lesson_id !== undefined ? body.lesson_id || null : current.lesson_id,
    body: body.legacy_body?.trim() || current.body || "",
    meta,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await db
    .from("notes")
    .update(update)
    .eq("id", body.id)
    .eq("user_id", ctx.user.id)
    .select("id, user_id, lesson_id, body, meta, updated_at, created_at")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  try {
    await admin.from("rag_chunks").delete().eq("source_type", "note").eq("source_id", data.id);
    const text = extractNoteIndexText({ body: data.body || "" });
    if (text) await indexSource("note", data.id, text);
  } catch {
    // non-blocking
  }

  return NextResponse.json({ workspace: normalizeRow(data as RawNoteRow) });
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
