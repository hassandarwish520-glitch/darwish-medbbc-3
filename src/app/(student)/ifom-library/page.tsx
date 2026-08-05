import { requireActive } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import IFOMLibraryClient from "./IFOMLibraryClient";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function IFOMLibraryPage() {
  const ctx = await requireActive();
  if (!ctx) redirect("/sign-in");

  const db = await createClient();
  const { data: items } = await db
    .from("ifom_library")
    .select("*")
    .eq("user_id", ctx.user.id)
    .order("created_at", { ascending: false })
    .limit(500);

  return (
    <div className="page-shell">
      <IFOMLibraryClient initialItems={(items ?? []) as any[]} />
    </div>
  );
}
