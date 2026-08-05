"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { Globe, ImagePlus, Loader2, MessageSquare, Send, Users, X } from "lucide-react";

type Attachment = {
  path: string;
  url: string;
  name?: string;
  type?: string;
  size?: number;
  caption?: string;
};

type Conversation = {
  id: string;
  user_id: string;
  title: string | null;
  created_at: string;
  preview: string;
  last_message_at: string;
  unread_student_count: number;
  student?: {
    id: string;
    email?: string | null;
    full_name?: string | null;
    role?: string | null;
    status?: string | null;
  } | null;
};

type ChatMessage = {
  id: string;
  role: string;
  content: string;
  created_at: string;
  attachments?: Attachment[];
};

type AdminData = {
  conversations: Conversation[];
  selected_conversation: Conversation | null;
  messages: ChatMessage[];
};

type Locale = "ar" | "en";

const COPY: Record<
  Locale,
  {
    inboxTitle: string;
    inboxSubtitle: string;
    loadingInbox: string;
    noConversations: string;
    studentFallback: string;
    noEmail: string;
    noPreview: string;
    selectConversation: string;
    selectConversationHint: string;
    admin: string;
    student: string;
    system: string;
    noMessages: string;
    placeholder: string;
    image: string;
    reply: string;
    medicalImage: string;
    failedLoad: string;
    failedUpload: string;
    failedReply: string;
    language: string;
    arabic: string;
    english: string;
  }
> = {
  ar: {
    inboxTitle: "صندوق رسائل الدعم",
    inboxSubtitle: "تظهر رسائل الطلاب هنا تلقائيًا.",
    loadingInbox: "جاري تحميل الرسائل...",
    noConversations: "لا توجد محادثات دعم بعد.",
    studentFallback: "طالب",
    noEmail: "لا يوجد بريد",
    noPreview: "لا توجد رسائل بعد",
    selectConversation: "اختر محادثة",
    selectConversationHint: "اختر محادثة طالب للرد عليها.",
    admin: "الأدمن",
    student: "الطالب",
    system: "النظام",
    noMessages: "لا توجد رسائل في هذه المحادثة بعد.",
    placeholder: "اكتب ردك للطالب...",
    image: "صورة",
    reply: "رد",
    medicalImage: "صورة طبية",
    failedLoad: "تعذر تحميل صندوق الرسائل",
    failedUpload: "تعذر رفع الصورة",
    failedReply: "تعذر إرسال الرد",
    language: "اللغة",
    arabic: "العربية",
    english: "English",
  },
  en: {
    inboxTitle: "Support Inbox",
    inboxSubtitle: "Student messages appear here automatically.",
    loadingInbox: "Loading inbox...",
    noConversations: "No support conversations yet.",
    studentFallback: "Student",
    noEmail: "No email",
    noPreview: "No messages yet",
    selectConversation: "Select a conversation",
    selectConversationHint: "Choose a student conversation to reply.",
    admin: "Admin",
    student: "Student",
    system: "System",
    noMessages: "No messages in this conversation yet.",
    placeholder: "Write your reply to the student...",
    image: "Image",
    reply: "Reply",
    medicalImage: "Medical image",
    failedLoad: "Failed to load support inbox",
    failedUpload: "Failed to upload image",
    failedReply: "Failed to send reply",
    language: "Language",
    arabic: "العربية",
    english: "English",
  },
};

export default function AdminMessagesPage() {
  const [lang, setLang] = useState<Locale>("ar");
  const [data, setData] = useState<AdminData>({ conversations: [], selected_conversation: null, messages: [] });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const t = COPY[lang];
  const dir = lang === "ar" ? "rtl" : "ltr";

  async function load(conversationId?: string | null) {
    setLoading(true);
    setError(null);
    const url = conversationId ? `/api/support/admin?conversation_id=${encodeURIComponent(conversationId)}` : "/api/support/admin";
    const r = await fetch(url, { cache: "no-store" });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      setError(j?.error || t.failedLoad);
    } else {
      setData(j);
      const nextId = j?.selected_conversation?.id ?? null;
      setSelectedId(nextId);
    }
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  const messages = useMemo(() => [...(data.messages ?? [])].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()), [data.messages]);

  async function onPickFile(file: File) {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("caption", text.trim());
    setUploading(true);
    setError(null);
    const r = await fetch("/api/support/upload", { method: "POST", body: fd });
    const j = await r.json().catch(() => ({}));
    setUploading(false);
    if (!r.ok) {
      setError(j?.error || t.failedUpload);
      return;
    }
    setAttachments((list) => [...list, j]);
  }

  async function sendReply() {
    if (!selectedId || (!text.trim() && !attachments.length) || sending) return;
    setSending(true);
    setError(null);
    const r = await fetch("/api/support/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversation_id: selectedId, content: text.trim(), attachments }),
    });
    const j = await r.json().catch(() => ({}));
    setSending(false);
    if (!r.ok) {
      setError(j?.error || t.failedReply);
      return;
    }
    setText("");
    setAttachments([]);
    if (fileRef.current) fileRef.current.value = "";
    await load(selectedId);
  }

  return (
    <div dir={dir} className="grid min-h-screen grid-cols-[340px_minmax(0,1fr)]">
      <aside className="border-r border-ink-800 bg-[#0b1322]">
        <div className="border-b border-ink-800 px-5 py-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-white"><Users className="h-5 w-5 text-brand" /> {t.inboxTitle}</div>
              <div className="mt-1 text-xs text-slate-400">{t.inboxSubtitle}</div>
            </div>
            <div className="flex items-center gap-2 rounded-2xl border border-ink-700 bg-ink-950/70 px-2 py-2 text-[11px] text-slate-300">
              <Globe className="h-4 w-4" />
              <button
                type="button"
                onClick={() => setLang("ar")}
                className={`rounded-xl px-3 py-1.5 transition ${lang === "ar" ? "bg-brand text-white" : "bg-ink-800 text-slate-300 hover:bg-ink-700"}`}
              >
                {COPY.ar.arabic}
              </button>
              <button
                type="button"
                onClick={() => setLang("en")}
                className={`rounded-xl px-3 py-1.5 transition ${lang === "en" ? "bg-brand text-white" : "bg-ink-800 text-slate-300 hover:bg-ink-700"}`}
              >
                {COPY.en.english}
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-2 p-3">
          {loading && !data.conversations.length ? (
            <div className="flex items-center gap-2 px-3 py-3 text-sm text-slate-400"><Loader2 className="h-4 w-4 animate-spin" /> {t.loadingInbox}</div>
          ) : data.conversations.length ? (
            data.conversations.map((item) => {
              const active = selectedId === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => void load(item.id)}
                  className={`w-full rounded-2xl border px-4 py-3 text-left transition ${active ? "border-cyan-400/30 bg-cyan-400/10" : "border-ink-700 bg-ink-900 hover:border-ink-600"}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold text-white">{item.student?.full_name || item.student?.email || t.studentFallback}</div>
                      <div className="mt-1 text-xs text-slate-400">{item.student?.email || t.noEmail}</div>
                    </div>
                    {item.unread_student_count > 0 ? (
                      <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] text-amber-300">{item.unread_student_count}</span>
                    ) : null}
                  </div>
                  <div className="mt-2 line-clamp-2 text-xs leading-6 text-slate-400">{item.preview || t.noPreview}</div>
                </button>
              );
            })
          ) : (
            <div className="rounded-2xl border border-ink-700 bg-ink-900 px-4 py-3 text-sm text-slate-500">{t.noConversations}</div>
          )}
        </div>
      </aside>

      <main className="flex min-w-0 flex-col bg-[#07111b]">
        <div className="border-b border-ink-800 px-6 py-4">
          <div className="flex items-start gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-brand/10 text-brand"><MessageSquare className="h-5 w-5" /></div>
            <div>
              <div className="text-lg font-semibold text-white">{data.selected_conversation?.student?.full_name || data.selected_conversation?.student?.email || t.selectConversation}</div>
              <div className="mt-1 text-xs text-slate-400">{data.selected_conversation?.student?.email || t.selectConversationHint}</div>
            </div>
          </div>
        </div>

        <div className="flex-1 space-y-3 overflow-auto px-6 py-5">
          {messages.length ? messages.map((msg) => {
            const mine = msg.role === "admin";
            const student = msg.role === "student";
            return (
              <div key={msg.id} className={`max-w-[82%] rounded-2xl px-4 py-3 text-sm leading-7 ${mine ? "ml-auto bg-cyan-500/12 text-cyan-50" : student ? "bg-brand/10 text-white" : "bg-ink-800 text-slate-200"}`}>
                <div className="mb-1 text-[11px] uppercase tracking-[0.18em] text-slate-400">{mine ? t.admin : student ? t.student : t.system}</div>
                <div className="whitespace-pre-wrap">{msg.content}</div>
                {msg.attachments?.length ? (
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    {msg.attachments.map((file) => (
                      <a key={file.path} href={file.url} target="_blank" className="overflow-hidden rounded-2xl border border-white/10 bg-black/20 p-2" rel="noreferrer">
                        <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-ink-950">
                          <Image src={file.url} alt={file.name || t.medicalImage} fill className="object-cover" unoptimized />
                        </div>
                        <div className="mt-2 text-xs text-slate-300">{file.caption || file.name || t.medicalImage}</div>
                      </a>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          }) : (
            <div className="text-sm text-slate-500">{t.noMessages}</div>
          )}
        </div>

        <div className="border-t border-ink-800 p-4">
          {attachments.length ? (
            <div className="mb-3 flex flex-wrap gap-3">
              {attachments.map((file) => (
                <div key={file.path} className="relative overflow-hidden rounded-2xl border border-ink-700 bg-[#0b1322] p-2">
                  <button type="button" className="absolute right-2 top-2 z-10 rounded-full bg-black/60 p-1 text-white" onClick={() => setAttachments((list) => list.filter((item) => item.path !== file.path))}>
                    <X className="h-3 w-3" />
                  </button>
                  <div className="relative h-24 w-24 overflow-hidden rounded-xl">
                    <Image src={file.url} alt={file.name || t.medicalImage} fill className="object-cover" unoptimized />
                  </div>
                  <div className="mt-2 max-w-24 truncate text-[11px] text-slate-300">{file.name || t.medicalImage}</div>
                </div>
              ))}
            </div>
          ) : null}

          {error ? <div className="mb-3 rounded-2xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</div> : null}
          <div className="flex gap-2">
            <textarea
              dir={dir}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={t.placeholder}
              className="input min-h-[92px] flex-1 resize-none"
              disabled={!selectedId}
            />
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void onPickFile(file);
              }}
            />
            <button type="button" className="btn-ghost h-auto min-w-[120px]" disabled={!selectedId || uploading || sending} onClick={() => fileRef.current?.click()}>
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />} {t.image}
            </button>
            <button type="button" className="btn-primary h-auto min-w-[120px]" disabled={!selectedId || sending || uploading || (!text.trim() && !attachments.length)} onClick={() => void sendReply()}>
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} {t.reply}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
