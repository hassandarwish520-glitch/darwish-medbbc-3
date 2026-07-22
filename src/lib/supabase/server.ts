import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export const createClient = () => {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (list) => {
          try { list.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); }
          catch { /* server component */ }
        },
      },
    }
  );
};

export const createAdminClient = () => {
  const { createClient } = require("@supabase/supabase-js");
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
};

export async function requireUser() {
  const s = createClient();
  const { data: { user } } = await s.auth.getUser();
  if (!user) return null;
  const { data: profile } = await s.from("profiles").select("*").eq("id", user.id).single();
  return { user, profile };
}

export async function requireActive() {
  const ctx = await requireUser();
  if (!ctx || ctx.profile?.status !== "active") return null;
  return ctx;
}

export async function requireAdmin() {
  const ctx = await requireUser();
  if (!ctx || ctx.profile?.role !== "admin" || ctx.profile?.status !== "active") return null;
  return ctx;
}
