import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE, sha256Hex } from "@/lib/auth";

// Protege o painel com login por senha (cookie de sessao).
// Se PANEL_PASSWORD nao estiver definido (ex: dev local), nao bloqueia.
// O webhook /api fica de fora pelo matcher abaixo.
export async function proxy(req: NextRequest) {
  const password = process.env.PANEL_PASSWORD;
  if (!password) return NextResponse.next();

  // A propria pagina de login fica liberada.
  if (req.nextUrl.pathname === "/login") return NextResponse.next();

  const cookie = req.cookies.get(AUTH_COOKIE)?.value;
  const expected = await sha256Hex(password);
  if (cookie === expected) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  url.searchParams.set("next", req.nextUrl.pathname);
  return NextResponse.redirect(url);
}

export const config = {
  // Tudo, menos as rotas de API, estaticos e favicon.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
