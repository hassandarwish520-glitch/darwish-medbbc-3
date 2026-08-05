import { requireUser } from "@/lib/supabase/server";
import SettingsClient from "./SettingsClient";

export default async function Settings() {
  const ctx = await requireUser();
  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-2xl font-bold">Settings</h1>
      <p className="text-slate-400 text-sm">Manage your profile.</p>
      <SettingsClient profile={ctx!.profile as any}/>
    </div>
  );
}
