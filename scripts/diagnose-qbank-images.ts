/**
 * diagnose-qbank-images.ts
 *
 * Offline verification of the QBank image pipeline (no DB needed):
 * parses each Cardio block HTML through the REAL import pipeline and
 * reports how many questions carry data:image payloads, their sizes,
 * and that a JSON round-trip (what Supabase does) preserves them intact.
 *
 * Run from the project root:
 *   npx tsx scripts/diagnose-qbank-images.ts
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { importQuestionsFromFileBuffer } from "../src/lib/import/qbank-block-import";

const FILES = [
  "Cardio_Block_01_35Q.html",
  "Cardio_Block_02_35Q.html",
  "Cardio_Block_03_21Q.html",
];

let allOk = true;
let grandTotal = 0;
let grandImages = 0;

for (const f of FILES) {
  const filePath = path.resolve(process.cwd(), f);
  if (!fs.existsSync(filePath)) {
    console.error(`❌ missing ${f} — run from the project root that contains the HTML blocks`);
    allOk = false;
    continue;
  }
  const bytes = fs.readFileSync(filePath);
  const parsed = importQuestionsFromFileBuffer({ bytes, filename: f, difficulty: "intermediate" });
  const withImg = parsed.filter((q) => q.image_path?.startsWith("data:"));
  grandTotal += parsed.length;
  grandImages += withImg.length;

  console.log(`\n══ ${f} ══`);
  console.log(`  parsed=${parsed.length}  with data:image = ${withImg.length}`);

  for (const q of withImg) {
    // Simulate the Supabase client JSON round-trip
    const round = JSON.parse(JSON.stringify({ image_path: q.image_path }));
    const intact = round.image_path === q.image_path;
    if (!intact) allOk = false;
    const bytesLen = Buffer.from(q.image_path!.split(",")[1] || "", "base64").length;
    console.log(
      `    · ${q.stem.slice(0, 46)}… | ${(bytesLen / 1024).toFixed(0)} KB image | roundtrip ${intact ? "intact ✅" : "MUTATED ❌"}`
    );
  }
}

console.log(`\n══ SUMMARY ══`);
console.log(`questions: ${grandTotal} | images: ${grandImages}`);
console.log(allOk ? "✅ pipeline OK — images survive parse + JSON serialization" : "❌ pipeline BROKEN — see ❌ lines above");
process.exit(allOk ? 0 : 1);
