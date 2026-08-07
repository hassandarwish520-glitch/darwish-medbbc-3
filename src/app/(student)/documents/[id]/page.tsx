import { notFound, redirect } from "next/navigation";
import { createAdminClient, isAdminProfile, requireActive } from "@/lib/supabase/server";
import DocumentWorkspaceClient from "./DocumentWorkspaceClient";
import type { Block } from "@/components/BlockEditor";
type DocumentBlock = Block;

export const dynamic = "force-dynamic";

function assetHref(path?: string | null) {
  if (!path) return null;
  return `/api/assets/${String(path).split("/").map(encodeURIComponent).join("/")}`;
}

type RawWorkspace = {
  id: string;
  title: string | null;
  category: string;
  blocks: unknown;
  legacy_body: string | null;
  lesson_id: string | null;
  meta: unknown;
  pinned: boolean;
  updated_at: string;
  user_id: string;
};

function isCategory(value: unknown): value is "subject" | "lecture" | "qbank" | "qbank-active" | "documents" {
  return value === "subject" || value === "lecture" || value === "qbank" || value === "qbank-active" || value === "documents";
}

export default async function DocumentWorkspacePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await requireActive();
  if (!ctx) redirect("/sign-in");

  const isAdmin = isAdminProfile(ctx.profile);
  const admin = createAdminClient();

  const { data: row } = await admin
    .from("notes")
    .select("id, user_id, title, category, blocks, legacy_body, lesson_id, meta, pinned, updated_at")
    .eq("id", id)
    .maybeSingle<RawWorkspace>();
  if (!row) notFound();
  if (row.user_id !== ctx.user.id && !isAdmin) notFound();

  const category: "subject" | "lecture" | "qbank" | "qbank-active" | "documents" = isCategory(row.category)
    ? row.category
    : "documents";

  let lesson: {
    id: string;
    title: string;
    kind: string;
    document_url: string | null;
    document_name: string | null;
    document_mime: string | null;
    course_title: string | null;
  } | null = null;

  if (row.lesson_id) {
    const { data: ls } = await admin
      .from("lessons")
      .select("id, title, kind, meta, storage_path, course_id, courses(title)")
      .eq("id", row.lesson_id)
      .maybeSingle<{
        id: string;
        title: string;
        kind: string;
        meta: unknown;
        storage_path: string | null;
        course_id: string | null;
        courses: { title: string } | null;
      }>();
    if (ls) {
      const meta = (ls.meta ?? null) as {
        document_path?: string | null;
        document_name?: string | null;
        document_mime?: string | null;
        url?: string | null;
      } | null;
      lesson = {
        id: ls.id,
        title: ls.title,
        kind: ls.kind,
        document_url: meta?.url ?? assetHref(meta?.document_path) ?? assetHref(ls.storage_path),
        document_name: meta?.document_name ?? ls.title,
        document_mime: meta?.document_mime ?? null,
        course_title: ls.courses?.title ?? null,
      };
    }
  }

  return (
    <DocumentWorkspaceClient
      workspace={{
        id: row.id,
        title: row.title,
        category,
        blocks: Array.isArray(row.blocks) ? (row.blocks as DocumentBlock[]) : [],
        legacy_body: row.legacy_body,
        lesson_id: row.lesson_id,
        meta: (row.meta ?? {}) as Record<string, unknown>,
        pinned: row.pinned,
        updated_at: row.updated_at,
      }}
      lesson={lesson}
      isAdmin={isAdmin}
    />
  );
}
