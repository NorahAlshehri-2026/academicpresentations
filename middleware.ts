import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { hasAcceptedTerms } from "@/app/_lib/terms";

/**
 * Refreshes the session on every request and keeps signed-out visitors out of
 * the three dashboards. This is convenience, not security: the database
 * policies are what actually protect the data, and they hold even if this file
 * is wrong.
 */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (list: { name: string; value: string; options: CookieOptions }[]) => {
          list.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;

  // /join is deliberately open: a class link has to work for a student who has
  // never been here and has no account yet. The page itself shows nothing but
  // the course title, the section and a signup form, and the code is checked
  // on the server before any account is created.
  const guarded = ["/dashboard", "/teach", "/admin", "/learn", "/shared", "/progress", "/review", "/units", "/coursebook", "/activities", "/recordings"];

  if (!user && guarded.some((p) => path.startsWith(p))) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }

  // Terms of use: a student who has not accepted the current version sees
  // nothing of the course until they do. These pages stay open so they can
  // read the terms, sign in or out, and finish joining a class. Teachers and
  // administrators are not asked.
  const openWithoutTerms = ["/agreement", "/guide", "/login", "/auth", "/join", "/welcome", "/invite", "/api", "/calendar"];
  if (
    user &&
    !hasAcceptedTerms(user.app_metadata) &&
    !openWithoutTerms.some((p) => path === p || path.startsWith(p + "/"))
  ) {
    const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
    if (me?.role === "student") {
      const url = request.nextUrl.clone();
      url.pathname = "/agreement";
      url.search = "";
      url.searchParams.set("next", path + request.nextUrl.search);
      const redirect = NextResponse.redirect(url);
      // keep any refreshed sign-in cookies
      response.cookies.getAll().forEach((c) => redirect.cookies.set(c));
      return redirect;
    }
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|mp3|mp4|webm)$).*)"],
};
