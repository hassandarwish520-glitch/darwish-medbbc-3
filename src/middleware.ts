import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

type CookieWrite = { name: string; value: string; options?: Record<string, unknown> };
type AdminProfile = { role?: string | null; status?: string | null };

function isAdminProfile(profile: AdminProfile | null | undefined) {
  return profile?.role === "admin" && profile?.status !== "suspended";
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list: CookieWrite[]) => {
        list.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // FIX: Use getSession() instead of getUser() — reads from cookie, no network round-trip.
  // Server components and API routes perform their own getUser() validation when needed.
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user ?? null;

  const path = request.nextUrl.pathname;
  const isAuthPage = path.startsWith("/sign-in") || path.startsWith("/sign-up");
  const isAdminPage = path.startsWith("/admin");
  const isAdminApi = path.startsWith("/api/admin");
  const isProtected =
    path.startsWith("/dashboard") ||
    path.startsWith("/courses") ||
    path.startsWith("/qbank") ||
    path.startsWith("/collections") ||
    path.startsWith("/flashcards") ||
    path.startsWith("/lesson") ||
    path.startsWith("/bookmarks") ||
    path.startsWith("/progress") ||
    path.startsWith("/settings") ||
    path.startsWith("/notes") ||
    path.startsWith("/ifom-library") ||
    path.startsWith("/videos") ||
    isAdminPage;

  if (!user && (isProtected || isAdminApi)) {
    if (isAdminApi) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    return NextResponse.redirect(new URL("/sign-in", request.url));
  }

  if (user && (isAdminPage || isAdminApi)) {
    // FIX: Only query the profile when actually needed (admin check), not on every request.
    const { data: profile } = await supabase.from("profiles").select("role,status").eq("id", user.id).maybeSingle<AdminProfile>();
    if (!isAdminProfile(profile)) {
      if (isAdminApi) return NextResponse.json({ error: "forbidden" }, { status: 403 });
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
  }

  if (user && isAuthPage) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return response;
}

export const config = {
  // FIX: Exclude all API routes from middleware — they do their own auth.
  // Only run middleware on page routes that need redirect logic.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/).*)",
  ],
};
