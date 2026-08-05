// Returns a short-lived Google Docs Viewer URL for a PPTX lesson.
// The real Supabase storage URL is never sent to the client — only the
// Google-proxied render URL is returned, so the raw file cannot be downloaded.
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, isAdminProfile, requireActive } from "@/lib/supabase/server";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // Must be an authenticated, active user
  const ctx = await requireActive();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: lesson } = await admin.from("lessons").select("id, storage_path, visible, meta").eq("id", id).single();

  if (!lesson) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!lesson.visible && !isAdminProfile(ctx.profile)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!lesson.storage_path) return NextResponse.json({ error: "No file" }, { status: 404 });

  // Create a signed URL valid for 1 hour — Google fetches it server-side,
  // the student never sees it in the browser.
  const { data: signed, error } = await admin.storage
    .from("lesson-assets")
    .createSignedUrl(lesson.storage_path, 3600);

  if (error || !signed?.signedUrl) {
    return NextResponse.json({ error: "Could not generate signed URL" }, { status: 500 });
  }

  // Build Google Docs Viewer embed URL
  const viewerUrl =
    "https://docs.google.com/viewer?url=" +
    encodeURIComponent(signed.signedUrl) +
    "&embedded=true";

  return NextResponse.json(
    { viewerUrl },
    {
      headers: {
        // Prevent this signed URL from being cached or leaked
        "Cache-Control": "private, no-store",
      },
    }
  );
}
