import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/server";
import { buildQuestionExport, ExportFormat } from "@/lib/ai/question-export";
import { logSecurityEvent } from "@/lib/security-monitor";

export const runtime = "nodejs";
export const maxDuration = 300;

const ALLOWED_FORMATS: ExportFormat[] = ["aidoc", "json", "markdown", "zip"];

function parseFormat(value: string | null): ExportFormat {
  if (value && (ALLOWED_FORMATS as string[]).includes(value)) return value as ExportFormat;
  return "aidoc";
}

function parseIds(raw: string | null): string[] | undefined {
  if (!raw) return undefined;
  const list = raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return list.length ? list : undefined;
}

function bool(value: string | null, defaultValue: boolean) {
  if (value == null) return defaultValue;
  return /^(1|true|yes|on)$/i.test(value);
}

async function handle(request: {
  actorUserId?: string;
  format: ExportFormat;
  questionIds?: string[];
  lessonId?: string;
  includeFlashcards: boolean;
  includeNotes: boolean;
  meta: boolean;
}) {
  const result = await buildQuestionExport({
    format: request.format,
    questionIds: request.questionIds,
    lessonId: request.lessonId,
    includeFlashcards: request.includeFlashcards,
    includeNotes: request.includeNotes,
  });

  if (request.meta) {
    return NextResponse.json({
      format: request.format,
      extension: result.extension,
      content_type: result.contentType,
      totals: result.manifest.totals,
      exported_at: result.manifest.exported_at,
      schema_version: result.manifest.schema_version,
    });
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `qbank-export-${stamp}.${result.extension}`;
  const body = new Uint8Array(result.body);

  if (request.actorUserId) {
    await logSecurityEvent({
      userId: request.actorUserId,
      eventType: "admin_file_download",
      metadata: {
        source: "qbank_export",
        file_name: filename,
        format: request.format,
        lesson_id: request.lessonId ?? null,
        question_count: result.manifest.totals.questions,
        image_count: result.manifest.totals.images,
      },
    });
  }

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": result.contentType,
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(result.body.length),
      "Cache-Control": "no-store",
      "X-Export-Total-Questions": String(result.manifest.totals.questions),
      "X-Export-Total-Images": String(result.manifest.totals.images),
      "X-Export-Schema-Version": result.manifest.schema_version,
    },
  });
}

export async function GET(req: NextRequest) {
  const ctx = await requireAdmin();
  if (!ctx) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const url = new URL(req.url);
  const format = parseFormat(url.searchParams.get("format"));
  const meta = bool(url.searchParams.get("meta"), false);
  const includeFlashcards = bool(url.searchParams.get("flashcards"), true);
  const includeNotes = bool(url.searchParams.get("notes"), true);
  const questionIds = parseIds(url.searchParams.get("ids"));
  const lessonId = url.searchParams.get("lesson_id") || undefined;

  try {
    return await handle({ actorUserId: ctx.user.id, format, questionIds, lessonId, includeFlashcards, includeNotes, meta });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "export failed" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const ctx = await requireAdmin();
  if (!ctx) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const format = parseFormat(typeof body?.format === "string" ? body.format : null);
  const meta = !!body?.meta;
  const includeFlashcards = body?.flashcards !== false;
  const includeNotes = body?.notes !== false;
  const questionIds = Array.isArray(body?.ids) ? body.ids.map((x: any) => String(x)) : undefined;
  const lessonId = typeof body?.lesson_id === "string" ? body.lesson_id : undefined;

  try {
    return await handle({ actorUserId: ctx.user.id, format, questionIds, lessonId, includeFlashcards, includeNotes, meta });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "export failed" }, { status: 500 });
  }
}
