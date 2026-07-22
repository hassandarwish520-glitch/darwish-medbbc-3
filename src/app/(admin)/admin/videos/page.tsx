import { createAdminClient } from "@/lib/supabase/server";
import VideosAdmin from "./VideosAdmin";
export default async function AdminVideos() {
  const admin = createAdminClient();
  const { data } = await admin.from("lessons").select("id,title,visible,meta")
    .eq("kind","html").contains("meta", { type:"video" }).order("created_at",{ascending:false});
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">Video Sessions</h1>
      <p className="text-slate-400 text-sm">Add YouTube and Telegram session links.</p>
      <VideosAdmin initial={data ?? []} />
    </div>
  );
}
