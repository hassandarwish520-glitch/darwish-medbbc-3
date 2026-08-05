import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Bookmark } from "lucide-react";

export default async function Bookmarks() {
  const s = await createClient();
  const { data } = await s.from("bookmarks").select("id, lessons(id,title,kind)").order("created_at",{ascending:false});
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold">Bookmarks</h1>
      <div className="mt-4 space-y-2">
        {(data ?? []).map((b: any) => b.lessons && (
          <Link key={b.id} href={`/lesson/${b.lessons.id}`} className="card p-3 flex items-center gap-3 hover:border-brand">
            <Bookmark className="h-4 w-4 text-brand"/>
            <div><div className="font-medium">{b.lessons.title}</div>
              <div className="text-xs text-slate-500 uppercase">{b.lessons.kind}</div></div>
          </Link>
        ))}
        {(!data || !data.length) && <div className="text-slate-500 text-sm">No bookmarks yet.</div>}
      </div>
    </div>
  );
}
