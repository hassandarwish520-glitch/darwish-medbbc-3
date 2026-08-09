/**
 * add-cardio-blocks.ts
 *
 * Programmatically inserts the three Cardio blocks (35 + 35 + 21 = 91 questions)
 * into the Supabase database as **fixed blocks** (not random pool), identical in
 * shape to NBME / UWorld-style fixed blocks. This script performs the exact same
 * actions that the admin UI's "QBank → Import → QBank Blocks" flow does, but
 * driven from your local machine — so you don't have to re-upload the HTML and
 * risk the parser mismatch.
 *
 * Run: `npx tsx scripts/add-cardio-blocks.ts`
 * Requires the project's env vars in .env/.env.local:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Idempotent: re-running deletes the previous "Cardio Block XX" lessons and their
 * questions before adding fresh ones, so you can re-run safely after edits.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { parseDirectImportFile } from "../src/lib/import/direct-import";
import { detectDifficulty, detectIfomSubject, detectTopic } from "../src/lib/ai/ifom";

// Lightweight .env / .env.local reader — avoids adding a `dotenv` dependency.
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

async function findOrCreateUser() {
  const adminEmail = process.env.ADMIN_BOOTSTRAP_EMAIL || "hassandarwish520@gmail.com";
  const { data } = await admin.from("profiles").select("id,email").eq("email", adminEmail).maybeSingle();
  if (data?.id) return data.id;
  const { data: anyProfile } = await admin.from("profiles").select("id").limit(1).maybeSingle();
  if (anyProfile?.id) return anyProfile.id;
  console.error("❌ No admin profile found in the database.");
  process.exit(1);
}

async function deleteExistingBlock(title: string) {
  const { data: lessons } = await admin
    .from("lessons").select("id").eq("title", title).eq("kind", "qbank");
  for (const l of lessons ?? []) {
    await admin.from("questions").delete().eq("lesson_id", l.id);
    await admin.from("rag_chunks").delete().eq("source_type", "lesson").eq("source_id", l.id);
    await admin.from("source_documents").delete().eq("lesson_id", l.id);
    await admin.from("lessons").delete().eq("id", l.id);
    console.log(`  · removed previous block "${title}" (${l.id})`);
  }
}

async function extractQuestionsFromHtml(filePath: string) {
  const html = fs.readFileSync(filePath, "utf-8");
  const scriptBodies: string[] = [];
  const re = /<script\b(?![^>]*\bsrc\s*=)[^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const b = (m[1] || "").trim();
    if (b.length > 2 && /\[\s*\{/.test(b)) scriptBodies.push(b);
  }
  for (const body of scriptBodies) {
    const parsed = parseDirectImportFile(body, filePath, "intermediate");
    if (parsed.length) return parsed;
  }
  throw new Error(`No embedded questions found in ${filePath}`);
}

async function main() {
  const createdBy = await findOrCreateUser();
  let totalInserted = 0;

  for (const blk of BLOCKS) {
    const filePath = path.resolve(process.cwd(), blk.file);
    if (!fs.existsSync(filePath)) {
      console.error(`❌ File missing: ${filePath}`);
      continue;
    }

    console.log(`\n══════ ${blk.title} ══════`);
    await deleteExistingBlock(blk.title);

    const parsed = await extractQuestionsFromHtml(filePath);
    console.log(`  · parsed ${parsed.length} questions from ${blk.file}`);

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
    if (lessonErr) { console.error("lesson insert error:", lessonErr.message); continue; }
    console.log(`  · created lesson ${lesson.id}`);

    const rows = parsed.map(q => {
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

    const { data: inserted, error } = await admin
      .from("questions").insert(rows).select("id");
    if (error) { console.error("  · question insert error:", error.message); continue; }
    console.log(`  · inserted ${inserted?.length ?? rows.length} questions`);
    totalInserted += inserted?.length ?? 0;
  }

  console.log(`\n✅ Done. ${totalInserted} questions inserted across ${BLOCKS.length} fixed blocks.`);
  console.log(`Now open: /qbank → Cardiology → you should see 3 fixed blocks listed at the top of the subject card.`);
}

main().catch(err => {
  console.error("💥 Failed:", err);
  process.exit(1);
});
