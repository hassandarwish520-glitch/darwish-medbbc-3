/**
 * reimport-cardio-blocks.ts
 *
 * SAFE re-import of the three Cardio fixed blocks WITH their embedded images.
 *
 * What it does:
 *  1. Deletes every previous copy of the Cardio blocks from the DB
 *     — both the script-created lessons (kind = "qbank") AND any copies
 *       imported earlier through the admin UI (kind = "html-file" / "html-inline")
 *     — matching is done by title patterns so stale/broken rows are removed.
 *  2. Re-parses the HTML files with the FIXED parser (embedded-script extraction)
 *     so data:image base64 figures are stored with each question.
 *  3. Re-inserts lessons as official fixed blocks under subject "Cardiology"
 *     and inserts all questions with image_path / image_caption preserved.
 *
 * Run from the project root:
 *   npx tsx scripts/reimport-cardio-blocks.ts
 *
 * Requires .env / .env.local with:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { importQuestionsFromFileBuffer } from "../src/lib/import/qbank-block-import";
import { detectDifficulty, detectIfomSubject, detectTopic } from "../src/lib/ai/ifom";

function loadEnvFile(p: string) {
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, "utf-8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}
for (const f of [".env.local", ".env"]) loadEnvFile(path.resolve(process.cwd(), f));

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env/.env.local");
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const BLOCKS = [
  { file: "Cardio_Block_01_35Q.html", title: "Cardiology Block 1 (35 Questions)" },
  { file: "Cardio_Block_02_35Q.html", title: "Cardiology Block 2 (35 Questions)" },
  { file: "Cardio_Block_03_21Q.html", title: "Cardiology Block 3 (21 Questions)" },
];

// Title patterns that identify OLD copies of these blocks (script + UI imports)
const OLD_TITLE_PATTERNS = [
  "Cardiology Block 1%",
  "Cardiology Block 2%",
  "Cardiology Block 3%",
  "Cardio_Block_01%",
  "Cardio_Block_02%",
  "Cardio_Block_03%",
];

async function findAdminUser() {
  const adminEmail = process.env.ADMIN_BOOTSTRAP_EMAIL || "hassandarwish520@gmail.com";
  const { data } = await admin.from("profiles").select("id,email").eq("email", adminEmail).maybeSingle();
  if (data?.id) return data.id;
  const { data: anyProfile } = await admin.from("profiles").select("id").limit(1).maybeSingle();
  if (anyProfile?.id) return anyProfile.id;
  console.error("❌ No admin profile found in the database.");
  process.exit(1);
}

async function deleteOldBlocks() {
  for (const pattern of OLD_TITLE_PATTERNS) {
    const { data: lessons } = await admin
      .from("lessons")
      .select("id,title")
      .ilike("title", pattern);
    for (const l of lessons ?? []) {
      await admin.from("questions").delete().eq("lesson_id", l.id);
      await admin.from("rag_chunks").delete().eq("source_type", "lesson").eq("source_id", l.id);
      await admin.from("source_documents").delete().eq("lesson_id", l.id);
      await admin.from("lessons").delete().eq("id", l.id);
      console.log(`  · removed old block "${l.title}" (${l.id})`);
    }
  }
}

function extractQuestionsFromHtml(filePath: string) {
  const bytes = fs.readFileSync(filePath);
  const parsed = importQuestionsFromFileBuffer({
    bytes,
    filename: path.basename(filePath),
    difficulty: "intermediate",
  });
  if (parsed.length) return parsed;
  throw new Error(`No embedded questions found in ${filePath}`);
}

async function main() {
  const createdBy = await findAdminUser();
  let totalInserted = 0;
  let totalImages = 0;

  console.log("── Step 1: removing old Cardio block copies ──");
  await deleteOldBlocks();

  for (const blk of BLOCKS) {
    const filePath = path.resolve(process.cwd(), blk.file);
    if (!fs.existsSync(filePath)) {
      console.error(`❌ File missing: ${filePath}`);
      continue;
    }

    console.log(`\n══════ ${blk.title} ══════`);
    const parsed = extractQuestionsFromHtml(filePath);
    const withImages = parsed.filter((q) => q.image_path);
    console.log(`  · parsed ${parsed.length} questions (${withImages.length} with images)`);

    const { data: lesson, error: lessonErr } = await admin
      .from("lessons")
      .insert({
        title: blk.title,
        kind: "qbank",
        visible: true,
        meta: {
          type: "qbank",
          section: "qbank",
          subject: "Cardiology",
          skip_auto_import: true,
          imported_from: blk.file,
          question_count: parsed.length,
          is_official_block: true,
          fixed_block: true,
          block_kind: "official",
          exam: "IFOM_CSE",
        },
      })
      .select("id")
      .single();
    if (lessonErr) { console.error("  · lesson insert error:", lessonErr.message); continue; }
    console.log(`  · created lesson ${lesson.id}`);

    const rows = parsed.map((q) => {
      const subject = q.subject || detectIfomSubject(q.stem + " " + (q.tags ?? []).join(" ")) || "Cardiology";
      const topic = q.topic || detectTopic(q.stem + " " + q.explanation) || "Cardiology – Mixed";
      const difficulty = q.difficulty || detectDifficulty(q.stem + " " + q.explanation);
      return {
        lesson_id: lesson.id,
        stem: q.stem,
        choices: q.choices,
        answer_key: q.answer_key,
        explanation: q.explanation,
        difficulty,
        tags: Array.from(new Set([...(q.tags ?? []), subject, "Cardiology", "Block", "Official", "FixedBlock", topic])),
        image_path: q.image_path || null,
        image_caption: q.image_caption || null,
        ai_generated: false,
        created_by: createdBy,
      };
    });

    const { data: inserted, error } = await admin.from("questions").insert(rows).select("id");
    if (error) { console.error("  · question insert error:", error.message); continue; }
    console.log(`  · inserted ${inserted?.length ?? rows.length} questions (images: ${withImages.length})`);
    totalInserted += inserted?.length ?? 0;
    totalImages += withImages.length;
  }

  console.log(`\n✅ Done. ${totalInserted} questions re-imported across ${BLOCKS.length} fixed blocks, ${totalImages} question images preserved.`);
  console.log("Now open: /subjects/cardiology → the 3 fixed blocks appear under 'Fixed QBank Blocks', each with its figures.");
}

main().catch((err) => {
  console.error("💥 Failed:", err);
  process.exit(1);
});
