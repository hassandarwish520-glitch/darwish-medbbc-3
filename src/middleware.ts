import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (list) => {
          list.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    }
  );
  const { data: { user } } = await supabase.auth.getUser();
  const path = request.nextUrl.pathname;

  const isAuthPage = path.startsWith("/sign-in") || path.startsWith("/sign-up");
  const isProtected = path.startsWith("/dashboard") || path.startsWith("/admin") ||
                      path.startsWith("/courses") || path.startsWith("/qbank") ||
                      path.startsWith("/flashcards") || path.startsWith("/lesson");

  if (!user && isProtected) return NextResponse.redirect(new URL("/sign-in", request.url));
  if (user && isAuthPage)  return NextResponse.redirect(new URL("/dashboard", request.url));

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/health).*)"],
};
