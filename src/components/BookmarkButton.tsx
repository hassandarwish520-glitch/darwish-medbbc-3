"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Bookmark, BookmarkCheck } from "lucide-react";

export default function BookmarkButton({ lessonId }: { lessonId: string }) {
  const [saved, setSaved] = useState<boolean>(false);
  const s = createClient();

  useEffect(() => {
    (async () => {
      const { data } = await s.from("bookmarks").select("id").eq("lesson_id", lessonId).maybeSingle();
      setSaved(!!data);
    })();
  }, [lessonId]);

  async function toggle() {
    if (saved) {
      await s.from("bookmarks").delete().eq("lesson_id", lessonId);
      setSaved(false);
    } else {
      await s.from("bookmarks").insert({ lesson_id: lessonId, user_id: (await s.auth.getUser()).data.user!.id });
      setSaved(true);
    }
  }

  return (
    <button onClick={toggle} className="btn-ghost">
      {saved ? <><BookmarkCheck className="h-4 w-4 text-brand"/> Saved</> : <><Bookmark className="h-4 w-4"/> Bookmark</>}
    </button>
  );
}
