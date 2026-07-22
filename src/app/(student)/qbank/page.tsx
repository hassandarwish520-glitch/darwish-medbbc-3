import { createClient } from "@/lib/supabase/server";
import QBankRunner from "./QBankRunner";

export default async function QBankPage() {
  const s = createClient();
  const { data: questions } = await s.from("questions").select("*").limit(50);
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold">Question Bank</h1>
      <p className="text-slate-400 text-sm">USMLE / MBBS style questions with detailed explanations.</p>
      <QBankRunner questions={questions ?? []} />
    </div>
  );
}
