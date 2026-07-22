import { createAdminClient } from "@/lib/supabase/server";
import QBankAdmin from "./QBankAdmin";
export default async function AdminQBank() {
  const admin = createAdminClient();
  const { data } = await admin.from("questions").select("id,stem,difficulty,ai_generated,tags,created_at")
    .order("created_at",{ascending:false}).limit(200);
  const { data: lessons } = await admin.from("lessons").select("id,title").order("created_at",{ascending:false});
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">QBank</h1>
      <p className="text-slate-400 text-sm">Manage exam questions.</p>
      <QBankAdmin initial={data ?? []} lessons={lessons ?? []}/>
    </div>
  );
}
