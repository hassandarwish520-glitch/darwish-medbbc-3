import { createAdminClient } from "@/lib/supabase/server";
import VideosAdmin from "./VideosAdmin";

export default async function AdminVideos() {
  const admin = createAdminClient();
  const [{ data: videos }, { data: courses }] = await Promise.all([
    admin
      .from("lessons")
      .select("id,title,visible,meta,course_id")
      .eq("kind", "html")
      .contains("meta", { type: "video" })
      .order("created_at", { ascending: false }),
    admin.from("courses").select("id,title").order("title"),
  ]);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">Video Sessions</h1>
      <p className="text-slate-400 text-sm">Add video sessions and attach notes so AI Tutor can use them in RAG answers.</p>
      <VideosAdmin initial={videos ?? []} courses={courses ?? []} />
    </div>
  );
}
