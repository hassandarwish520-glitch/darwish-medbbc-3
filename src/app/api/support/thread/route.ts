import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, createClient, requireActive } from "@/lib/supabase/server";

export const runtime = "nodejs";

const WELCOME = "مرحبًا، وصلت رسالتك إلى فريق المنصة. يمكنك إرسال سؤالك هنا وسيتم الرد عليك عند توفر الأدمن أو المدرّس.";

type Attachment = {
  path: string;
  url: string;
  name?: string;
  type?: string;
  size?: number;
  caption?: string;
};

function normalizeAttachments(value: unknown): Attachment[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      if (typeof row.path !== "string" || typeof row.url !== "string") return null;
      return {
        path: row.path,
        url: row.url,
        name: typeof row.name === "string" ? row.name : undefined,
        type: typeof row.type === "string" ? row.type : undefined,
        size: typeof row.size === "number" ? row.size : undefined,
        caption: typeof row.caption === "string" ? row.caption : undefined,
      };
    })
    .filter(Boolean) as Attachment[];
}

async function getOrCreateConversation(userId: string) {
  const s = await createClient();
  const { data: existing } = await s
    .from("ai_conversations")
    .select("id,title,created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (existing) return existing;

  const admin = createAdminClient();
  const { data: created, error } = await admin
    .from("ai_conversations")
    .insert({ user_id: userId, title: "Support chat" })
    .select("id,title,created_at")
    .single();
  if (error || !created) throw new Error(error?.message || "Failed to create conversation");

  await admin.from("ai_messages").insert({
    conversation_id: created.id,
    role: "system",
    content: WELCOME,
    citations: { channel: "support", attachments: [] },
  });

  return created;
}

export async function GET() {
  const ctx = await requireActive();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const conversation = await getOrCreateConversation(ctx.user.id);
  const s = await createClient();
  const { data: messages, error } = await s
    .from("ai_messages")
    .select("id,role,content,citations,created_at")
    .eq("conversation_id", conversation.id)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({
    conversation,
    messages: (messages ?? []).map((item: any) => ({
      ...item,
      attachments: normalizeAttachments(item?.citations?.attachments),
    })),
  });
}

export async function POST(req: NextRequest) {
  const ctx = await requireActive();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { content, attachments } = await req.json();
  const text = typeof content === "string" ? content.trim() : "";
  const files = normalizeAttachments(attachments);
  if (!text && !files.length) return NextResponse.json({ error: "content or attachment is required" }, { status: 400 });

  const conversation = await getOrCreateConversation(ctx.user.id);
  const s = await createClient();

  const { count } = await s
    .from("ai_messages")
    .select("id", { count: "exact", head: true })
    .eq("conversation_id", conversation.id)
    .eq("role", "student");

  const { data: inserted, error } = await s
    .from("ai_messages")
    .insert({
      conversation_id: conversation.id,
      role: "student",
      content: text || (files.length ? "[medical image attached]" : ""),
      citations: { channel: "support", first_student_message: (count ?? 0) === 0, attachments: files },
    })
    .select("id,role,content,citations,created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, message: { ...inserted, attachments: files }, conversation_id: conversation.id });
}
