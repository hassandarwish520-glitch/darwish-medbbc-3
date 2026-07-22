# Darwish MedBBC — Production Medical Education Platform

**Stack:** Next.js 14 (App Router) · TypeScript · TailwindCSS · Supabase (Auth + Postgres + RLS + Storage + pgvector) · Vercel

---

## ✨ الميزات المنفذة

- **Auth + RBAC + RLS** — تسجيل طلاب / معلمين، أدمن مثبّت `hassandarwish520@gmail.com`، حالات `pending / active / suspended`.
- **لوحة أدمن مستقلة** — تفعيل الطلاب، إدارة الكورسات، رفع مستندات، QBank، Flashcards، Videos، AI Studio.
- **HTML Lessons** — CSS/JS/الصور/التفاعلات تُحفظ كما هي، تُعرض داخل iframe آمن `sandbox` عبر `/api/viewer/[id]/html` — لا تُكشف روابط التخزين إطلاقاً.
- **PDF Viewer داخلي** — بحث + تكبير + تصفح صفحات + متجاوب.
- **Question Bank** — SBA / Vignettes / Recall / Application، درجات صعوبة، تفسيرات، تتبّع محاولات.
- **Flashcards SM-2** — تكرار متباعد، جلسات مراجعة، تدرّج (Again / Hard / Good / Easy).
- **Shared AI Engine** — Tutor + Question Gen + Flashcard Gen + Summaries، نفس API wrapper.
- **RAG** — pgvector + `text-embedding-3-small`، فهرسة تلقائية للـ HTML lessons، تخزين مؤقت بالـ hash لتجنّب إعادة الحساب.
- **Bookmarks · Notes · Progress · Settings** — لكل طالب.

---

## 🚀 خطوات الرفع الفعلية

### 1. أنشئ حساب GitHub Repository جديد
باستخدام إيميلك `hassandarwish520@gmail.com`:
1. اذهب إلى https://github.com/new
2. اسم الريبو: `darwish-medbbc`
3. اختر **Private** (لأن الكود يخص منصة إنتاجية).
4. لا تختر أي template — سنرفع الكود يدوياً.

### 2. ارفع الكود
بعد فك الـ ZIP:
```bash
cd darwish-medbbc
git init
git add .
git commit -m "feat: initial Darwish MedBBC production build"
git branch -M main
git remote add origin https://github.com/<username>/darwish-medbbc.git
git push -u origin main
```

### 3. أنشئ مشروع Supabase
1. https://supabase.com/dashboard → **New Project**.
2. Region: الأقرب لجمهورك (Frankfurt / Bahrain).
3. سجّل: **Project URL**, **anon key**, **service_role key**.
4. افتح **SQL Editor** والصق كامل ملف `supabase/migrations/0001_init.sql` ثم `Run`.
5. تأكد أن bucket `lesson-assets` أُنشئ (خاص/private).

### 4. أنشئ حساب الأدمن
- افتح Supabase → Authentication → Users → **Add User** → أدخل `hassandarwish520@gmail.com` وكلمة مرور قوية → Auto-confirm.
- الـ trigger سيرفع دوره إلى `admin` تلقائياً ويجعله `active`.

### 5. اربط Vercel
1. https://vercel.com/new → استورد الريبو.
2. Framework: Next.js (يُكتشف تلقائياً).
3. أضف Environment Variables (من `.env.example`):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `AI_PROVIDER=openai` (أو `openrouter`)
   - `AI_BASE_URL=https://api.openai.com/v1` (أو `https://openrouter.ai/api/v1`)
   - `AI_API_KEY=...`
   - `AI_CHAT_MODEL=gpt-4o-mini`
   - `AI_EMBED_MODEL=text-embedding-3-small`
   - `ADMIN_BOOTSTRAP_EMAIL=hassandarwish520@gmail.com`
4. Deploy.

### 6. أول تسجيل دخول
- افتح `https://<your-app>.vercel.app/sign-in`
- سجّل بحساب `hassandarwish520@gmail.com` → ستدخل مباشرة إلى **Admin Panel**.
- ابدأ برفع Documents (HTML / PDF) وستُفهرَس تلقائياً في RAG.

---

## 🗂️ هيكل المشروع

```
src/
  app/
    (auth)/sign-in, sign-up
    (student)/dashboard, courses, lesson, qbank, flashcards, bookmarks, progress, settings
    (admin)/admin/(students, courses, documents, qbank, flashcards, videos, ai)
    api/
      viewer/[id]/[fmt]        # Secure internal HTML/PDF stream
      ai/tutor                 # RAG-powered chat
      ai/generate              # Bulk gen (questions/flashcards/index)
      admin/(users, lessons, courses, questions, flashcards)
      flashcards/review        # SM-2 grading
      health
  components/ (AppShell, LessonViewer, AITutor, BookmarkButton)
  lib/
    supabase/(client, server)
    ai/(engine, rag, tasks)
supabase/migrations/0001_init.sql   # Full schema + RLS + trigger + RPC
```

---

## 🔐 قواعد الأمن الملزَمة (منفذة في RLS)
- طلاب `pending` لا يقرأون أي محتوى.
- Storage bucket `lesson-assets` **private** — يُقرأ فقط عبر `/api/viewer/*` بعد التحقق من الجلسة.
- `service_role_key` تُستخدم فقط على الخادم (routes الأدمن).
- كل جدول عليه RLS: طلاب ينشئون/يقرأون بياناتهم فقط، الأدمن يكتب المحتوى.

---

## 🧠 AI Shared Engine
- `lib/ai/engine.ts` — نداء واحد لأي provider متوافق مع OpenAI (OpenAI/OpenRouter/DeepSeek/Together).
- `lib/ai/rag.ts` — chunking + embed + upsert + `match_rag_chunks` RPC.
- `lib/ai/tasks.ts` — `tutorAnswer`, `generateQuestions`, `generateFlashcards`, `summarize` — كلها تستخدم نفس pipeline.

لا يوجد ازدواج AI — أي feature جديدة تُبنى فوق هذه الطبقة.

---

## ✅ ملاحظات إنتاج
- لا توجد بيانات وهمية — لا demo accounts داخل الكود (احذف الكارتين من UI السابق).
- لا TODOs — كل route مربوط بجدول حقيقي.
- Bootstrap admin عبر SQL trigger — لا يحتاج تدخل يدوي.
