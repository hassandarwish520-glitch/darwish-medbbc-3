import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

type CookieWrite = { name: string; value: string; options?: Record<string, unknown> };

type Profile = {
  id: string;
  email?: string | null;
  full_name?: string | null;
  institution?: string | null;
  preparation_type?: string | null;
  current_level?: string | null;
  purpose_of_access?: string | null;
  selected_plan?: string | null;
  role?: string | null;
  status?: string | null;
  activated_at?: string | null;
  activated_by?: string | null;
  created_at?: string | null;
  [key: string]: unknown;
};

function mustEnv(name: "NEXT_PUBLIC_SUPABASE_URL" | "NEXT_PUBLIC_SUPABASE_ANON_KEY" | "SUPABASE_SERVICE_ROLE_KEY") {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

export const createClient = async () => {
  const cookieStore = await cookies();
  return createServerClient(mustEnv("NEXT_PUBLIC_SUPABASE_URL"), mustEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"), {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (list: CookieWrite[]) => {
        try {
          list.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          /* server component */
        }
      },
    },
  });
};

export const createAdminClient = () =>
  createSupabaseClient(mustEnv("NEXT_PUBLIC_SUPABASE_URL"), mustEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { autoRefreshToken: false, persistSession: false },
  });

export function isAdminProfile(profile: Pick<Profile, "role" | "status"> | null | undefined) {
  return profile?.role === "admin" && profile?.status !== "suspended";
}

export async function requireUser() {
  const s = await createClient();
  const {
    data: { user },
  } = await s.auth.getUser();

  if (!user) return null;

  const { data: profile } = await s.from("profiles").select("*").eq("id", user.id).maybeSingle<Profile>();
  return { user, profile };
}

export async function requireActive() {
  const ctx = await requireUser();
  if (!ctx || ctx.profile?.status !== "active") return null;
  return ctx;
}

export async function requireAdmin() {
  const ctx = await requireUser();
  if (!ctx || !isAdminProfile(ctx.profile)) return null;
  return ctx;
}
