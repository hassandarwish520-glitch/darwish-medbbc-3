"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { Globe, ImagePlus, Loader2, MessageSquare, Send, ShieldAlert, X, ExternalLink } from "lucide-react";

type Attachment = {
  path: string;
  url: string;
  name?: string;
  type?: string;
  size?: number;
  caption?: string;
};

type ChatMessage = {
  id: string;
  role: string;
  content: string;
  created_at: string;
  attachments?: Attachment[];
};

type ChatData = {
  conversation?: { id: string; title: string | null };
  messages?: ChatMessage[];
};

type Locale = "ar" | "en";

const COPY: Record<
  Locale,
  {
    title: string;
    subtitle: string;
    policy: string;
    threadTitle: string;
    loading: string;
    noMessages: string;
    you: string;
    admin: string;
    system: string;
    medicalImage: string;
    placeholder: string;
    upload: string;
    send: string;
    failedLoad: string;
    failedUpload: string;
    failedSend: string;
    language: string;
    arabic: string;
    english: string;
  }
> = {
  ar: {
    title: "دردشة الدعم",
    subtitle: "راسل الأدمن أو فريق التدريس من هنا، ويمكنك رفع صور طبية فقط. أي محتوى مخالف أو غير مناسب سيتم رفضه.",
    policy: "يسمح فقط برفع الصور الطبية المرتبطة بالتعلّم أو الاستفسارات الأكاديمية. يمنع رفع أي صورة أو محتوى غير أخلاقي أو خارج الإطار الطبي.",
    threadTitle: "محادثة الدعم",
    loading: "جاري تحميل المحادثة...",
    noMessages: "لا توجد رسائل بعد.",
    you: "أنت",
    admin: "الأدمن",
    system: "النظام",
    medicalImage: "صورة طبية",
    placeholder: "اكتب رسالتك أو استفسارك هنا...",
    upload: "رفع صورة",
    send: "إرسال",
    failedLoad: "تعذر تحميل الرسائل",
    failedUpload: "تعذر رفع الصورة",
    failedSend: "تعذر إرسال الرسالة",
    language: "اللغة",
    arabic: "العربية",
    english: "English",
  },
  en: {
    title: "Support Chat",
    subtitle: "Contact the admin or teaching team here. You can upload medical images only. Any inappropriate or non-compliant content will be rejected.",
    policy: "Only medical images related to learning or academic questions are allowed. Any unethical or non-medical content is prohibited.",
    threadTitle: "Support chat thread",
    loading: "Loading chat...",
    noMessages: "No messages yet.",
    you: "You",
    admin: "Admin",
    system: "System",
    medicalImage: "Medical image",
    placeholder: "Write your message or question here...",
    upload: "Upload image",
    send: "Send",
    failedLoad: "Failed to load messages",
    failedUpload: "Failed to upload image",
    failedSend: "Failed to send message",
    language: "Language",
    arabic: "العربية",
    english: "English",
  },
};

export default function StudentMessagesPage() {
  const [lang, setLang] = useState<Locale>("ar");
  const [data, setData] = useState<ChatData>({ messages: [] });
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const t = COPY[lang];
  const dir = lang === "ar" ? "rtl" : "ltr";

  async function load() {
    setLoading(true);
    setError(null);
    const r = await fetch("/api/support/thread", { cache: "no-store" });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      setError(j?.error || t.failedLoad);
    } else {
      setData(j);
    }
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  const sorted = useMemo(
    () => [...(data.messages ?? [])].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()),
    [data.messages],
  );

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

  async function send() {
    if ((!text.trim() && !attachments.length) || sending) return;
    setSending(true);
    setError(null);
    const r = await fetch("/api/support/thread", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: text.trim(), attachments }),
    });
    const j = await r.json().catch(() => ({}));
    setSending(false);
    if (!r.ok) {
      setError(j?.error || t.failedSend);
      return;
    }
    setText("");
    setAttachments([]);
    if (fileRef.current) fileRef.current.value = "";
    await load();
  }

  return (
    <div dir={dir} className="mx-auto max-w-5xl px-4 py-6 md:px-6">
      <div className="card border-ink-800 bg-ink-900/80 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-brand/10 text-brand"><MessageSquare className="h-5 w-5" /></div>
            <div>
              <h1 className="text-2xl font-bold text-white">{t.title}</h1>
              <p className="mt-1 text-sm text-slate-400">{t.subtitle}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 rounded-2xl border border-ink-700 bg-ink-950/70 px-2 py-2 text-xs text-slate-300">
            <Globe className="h-4 w-4" />
            <span>{t.language}</span>
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

        <div className="mt-4 flex items-start gap-2 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-xs leading-6 text-amber-100">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
          {t.policy}
        </div>
      </div>

      <div className="card mt-4 flex min-h-[560px] flex-col border-ink-800 bg-ink-900/80 p-0">
        <div className="border-b border-ink-800 px-5 py-4 text-sm text-slate-400">{data.conversation?.title || t.threadTitle}</div>
        <div className="flex-1 space-y-3 overflow-auto px-5 py-5">
          {loading ? (
            <div className="flex items-center gap-2 text-slate-400"><Loader2 className="h-4 w-4 animate-spin" /> {t.loading}</div>
          ) : sorted.length ? (
            sorted.map((msg) => {
              const mine = msg.role === "student";
              const staff = msg.role === "admin";
              return (
                <div key={msg.id} className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-7 ${mine ? "ml-auto bg-brand/10 text-white" : staff ? "bg-cyan-500/10 text-cyan-50" : "bg-ink-800 text-slate-200"}`}>
                  <div className="mb-1 text-[11px] uppercase tracking-[0.18em] text-slate-400">{mine ? t.you : staff ? t.admin : t.system}</div>
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
            })
          ) : (
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
          <div className="flex flex-col gap-3 md:flex-row">
            <textarea
              dir={dir}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={t.placeholder}
              className="input min-h-[92px] flex-1 resize-none"
            />
            <div className="flex gap-2 md:flex-col">
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
              <button type="button" className="btn-ghost h-12 min-w-[120px]" disabled={uploading || sending} onClick={() => fileRef.current?.click()}>
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />} {t.upload}
              </button>
              <button type="button" className="btn-primary h-12 min-w-[120px]" disabled={sending || uploading || (!text.trim() && !attachments.length)} onClick={() => void send()}>
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} {t.send}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* External contact channels */}
      <div className="mt-6 card border-ink-800 bg-ink-900/80 p-5">
        <h2 className="text-base font-semibold text-white mb-1">
          {lang === "ar" ? "تواصل معنا مباشرةً" : "Reach us directly"}
        </h2>
        <p className="text-xs text-slate-400 mb-4">
          {lang === "ar"
            ? "يمكنك التواصل معنا عبر المسنجر أو تيليغرام للدعم السريع."
            : "You can also contact us via Messenger or Telegram for quick support."}
        </p>
        <div className="flex flex-wrap gap-3">
          {/* Messenger */}
          <a
            href="https://m.me/61591842446810"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-2xl border border-ink-700 bg-ink-800 px-4 py-3 text-sm font-medium text-white transition hover:bg-ink-700"
          >
            <span
              className="flex h-8 w-8 items-center justify-center rounded-full"
              style={{
                background: "linear-gradient(135deg, #00B2FF 0%, #006AFF 60%, #a033ff 100%)",
              }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36" width="18" height="18" fill="white">
                <path d="M18 2C9.164 2 2 8.72 2 17c0 4.5 1.9 8.54 4.98 11.38.26.24.42.57.43.93l.09 2.9a1.5 1.5 0 0 0 2.1 1.34l3.23-1.43c.27-.12.57-.14.85-.06A18.8 18.8 0 0 0 18 32c8.836 0 16-6.72 16-15S26.836 2 18 2Zm9.29 11.7-4.7 7.44a2.5 2.5 0 0 1-3.6.67l-3.74-2.8a1 1 0 0 0-1.2 0l-5.05 3.83c-.67.51-1.55-.28-1.08-1l4.7-7.44a2.5 2.5 0 0 1 3.6-.67l3.74 2.8a1 1 0 0 0 1.2 0l5.05-3.83c.67-.51 1.55.28 1.08 1Z" />
              </svg>
            </span>
            <span>{lang === "ar" ? "Facebook Messenger" : "Facebook Messenger"}</span>
            <ExternalLink className="h-3.5 w-3.5 text-slate-400" />
          </a>

          {/* Telegram */}
          <a
            href="https://t.me/+JDqV-8P07Ec1MmE0"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-2xl border border-ink-700 bg-ink-800 px-4 py-3 text-sm font-medium text-white transition hover:bg-ink-700"
          >
            <span
              className="flex h-8 w-8 items-center justify-center rounded-full"
              style={{ background: "#229ED9" }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="white">
                <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
              </svg>
            </span>
            <span>{lang === "ar" ? "مجموعة تيليغرام" : "Telegram Group"}</span>
            <ExternalLink className="h-3.5 w-3.5 text-slate-400" />
          </a>
        </div>
      </div>
    </div>
  );
}
