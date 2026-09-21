import { NextRequest } from "next/server";
import { AUTH_COOKIE, sha256Hex } from "@/lib/auth";

// As rotas /api ficam FORA do proxy de login (pra aceitar o cron), entao cada
// rota que muda dado ou gasta recurso confere aqui quem esta chamando:
//  - cron da Vercel: header "Authorization: Bearer <CRON_SECRET>"
//  - pessoa logada no painel: cookie de sessao
// Sem PANEL_PASSWORD nem CRON_SECRET definidos (dev local), libera.
export async function isAuthorized(req: NextRequest): Promise<boolean> {
  const password = process.env.PANEL_PASSWORD;
  const cronSecret = process.env.CRON_SECRET;
  if (!password && !cronSecret) return true;

  if (cronSecret && req.headers.get("authorization") === `Bearer ${cronSecret}`) {
    return true;
  }
  if (password) {
    const cookie = req.cookies.get(AUTH_COOKIE)?.value;
    if (cookie && cookie === (await sha256Hex(password))) return true;
  }
  return false;
}
