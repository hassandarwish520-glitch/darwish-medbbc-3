import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, requireAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";

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

export async function GET(req: NextRequest) {
  const ctx = await requireAdmin();
  if (!ctx) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const admin = createAdminClient();
  const conversationId = new URL(req.url).searchParams.get("conversation_id");

  const { data: conversations, error: convoError } = await admin
    .from("ai_conversations")
    .select("id,user_id,title,created_at")
    .order("created_at", { ascending: false })
    .limit(200);
  if (convoError) return NextResponse.json({ error: convoError.message }, { status: 500 });

  const userIds = [...new Set((conversations ?? []).map((item) => item.user_id).filter(Boolean))];
  const { data: profiles } = userIds.length
    ? await admin.from("profiles").select("id,email,full_name,role,status").in("id", userIds)
    : { data: [] as any[] };

  const convoIds = (conversations ?? []).map((item) => item.id);
  const { data: allMessages } = convoIds.length
    ? await admin.from("ai_messages").select("id,conversation_id,role,content,citations,created_at").in("conversation_id", convoIds).order("created_at", { ascending: true })
    : { data: [] as any[] };

  const profileMap = new Map((profiles ?? []).map((row: any) => [row.id, row]));
  const messageGroups = new Map<string, any[]>();
  for (const item of allMessages ?? []) {
    const list = messageGroups.get(item.conversation_id) ?? [];
    list.push({ ...item, attachments: normalizeAttachments(item?.citations?.attachments) });
    messageGroups.set(item.conversation_id, list);
  }

  const items = (conversations ?? []).map((item) => {
    const messages = messageGroups.get(item.id) ?? [];
    const last = messages[messages.length - 1] ?? null;
    const unreadStudentCount = messages.filter((msg) => msg.role === "student").length - messages.filter((msg) => msg.role === "admin").length;
    return {
      ...item,
      student: profileMap.get(item.user_id) ?? null,
      preview: last?.content ?? "",
      last_message_at: last?.created_at ?? item.created_at,
      unread_student_count: Math.max(unreadStudentCount, 0),
    };
  }).sort((a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime());

  let selectedConversation = items[0] ?? null;
  if (conversationId) {
    selectedConversation = items.find((item) => item.id === conversationId) ?? selectedConversation;
  }

  const selectedMessages = selectedConversation ? (messageGroups.get(selectedConversation.id) ?? []) : [];

  return NextResponse.json({ conversations: items, selected_conversation: selectedConversation, messages: selectedMessages });
}

export async function POST(req: NextRequest) {
  const ctx = await requireAdmin();
  if (!ctx) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { conversation_id, content, attachments } = await req.json();
  const text = typeof content === "string" ? content.trim() : "";
  const files = normalizeAttachments(attachments);
  if (!conversation_id || (!text && !files.length)) return NextResponse.json({ error: "conversation_id and content or attachment are required" }, { status: 400 });

  const admin = createAdminClient();
  const { data: inserted, error } = await admin
    .from("ai_messages")
    .insert({
      conversation_id,
      role: "admin",
      content: text || (files.length ? "[medical image attached]" : ""),
      citations: { channel: "support", sender: ctx.user.id, attachments: files },
    })
    .select("id,role,content,citations,created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, message: { ...inserted, attachments: files } });
}
