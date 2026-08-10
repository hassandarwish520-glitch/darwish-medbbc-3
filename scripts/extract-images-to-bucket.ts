/**
 * extract-images-to-bucket.ts
 *
 * One-shot migration: takes every question whose image_path is a bulky
 * `data:image/...;base64,...` payload, decodes it, uploads the binary to the
 * `lesson-assets` storage bucket at `questions/<lesson_id>/<question_id>.<ext>`,
 * and rewrites the row so image_path points at the bucket path.
 *
 * Why: 13 Cardio images are ~470KB of base64 inside Postgres rows. Storing
 * binaries in the bucket keeps rows light and lets the existing
 * /api/assets/[...path] route stream them (QBankRunner's assetHref already
 * handles both data: URLs and bucket paths — no UI change needed).
 *
 * Safe: idempotent (skips rows already migrated), upsert uploads, and only
 * touches rows matching `data:image/%`. A verification count prints at end.
 *
 * Run from the project root:
 *   npx tsx scripts/extract-images-to-bucket.ts
 *
 * Requires .env / .env.local with:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */
import * as fs from "node:fs";
import * as path from "node:path";

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

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env/.env.local");
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function mimeToExt(mime: string): string {
  if (/png/i.test(mime)) return "png";
  if (/jpe?g/i.test(mime)) return "jpg";
  if (/webp/i.test(mime)) return "webp";
  if (/gif/i.test(mime)) return "gif";
  return "bin";
}

async function main() {
  const BATCH = 20;
  let offset = 0;
  let migrated = 0;
  let failed = 0;

  console.log("── Scanning for questions with inline data:image payloads ──");

  for (;;) {
    const { data: rows, error } = await admin
      .from("questions")
      .select("id, lesson_id, image_path")
      .like("image_path", "data:image/%")
      .order("id")
      .range(offset, offset + BATCH - 1);
    if (error) { console.error("select error:", error.message); process.exit(1); }
    if (!rows?.length) break;

    for (const row of rows as Array<{ id: string; lesson_id: string | null; image_path: string }>) {
      try {
        const match = /^data:(image\/[a-zA-Z0-9+.-]+);base64,(.+)$/s.exec(row.image_path);
        if (!match) throw new Error("unrecognized data: URL shape");
        const mime = match[1];
        const b64 = match[2].replace(/\s+/g, "");
        const buf = Buffer.from(b64, "base64");
        if (!buf.length) throw new Error("empty decoded payload");

        const ext = mimeToExt(mime);
        const storagePath = `questions/${row.lesson_id ?? "pool"}/${row.id}.${ext}`;

        const { error: upErr } = await admin.storage
          .from("lesson-assets")
          .upload(storagePath, buf, { contentType: mime, upsert: true });
        if (upErr) throw new Error(`upload: ${upErr.message}`);

        const { error: updErr } = await admin
          .from("questions")
          .update({ image_path: storagePath })
          .eq("id", row.id);
        if (updErr) throw new Error(`update: ${updErr.message}`);

        migrated++;
        console.log(`  ✓ ${row.id.slice(0, 8)}… → ${storagePath} (${(buf.length / 1024).toFixed(0)} KB)`);
      } catch (e) {
        failed++;
        console.error(`  ✗ ${row.id}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    if (rows.length < BATCH) break;
    offset += BATCH;
  }

  // Post-check: nothing should still carry data:image payloads
  const { count: remaining } = await admin
    .from("questions")
    .select("id", { count: "exact", head: true })
    .like("image_path", "data:image/%");

  console.log(`\n══ SUMMARY ══`);
  console.log(`migrated: ${migrated} | failed: ${failed} | still-inline: ${remaining ?? 0}`);
  if ((remaining ?? 0) === 0 && migrated > 0) {
    console.log("✅ all question images now live in the lesson-assets bucket");
    console.log("The runner serves them via /api/assets/<path> — no UI change needed.");
  } else if (migrated === 0 && (remaining ?? 0) === 0) {
    console.log("ℹ️  nothing to migrate — no inline images found (already done or blocks not imported yet)");
  }
}

main().catch((err) => {
  console.error("💥 Failed:", err);
  process.exit(1);
});
