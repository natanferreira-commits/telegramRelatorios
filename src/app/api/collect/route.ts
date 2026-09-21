import { NextRequest, NextResponse } from "next/server";
import { isAuthorized } from "@/lib/authz";
import { runCollector } from "@/lib/collector/run";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Precisa de Fluid Compute na Vercel (padrao em projeto novo) pra passar de 60s.
export const maxDuration = 300;

// Coleta com prazo: faz o que der em ~4 min e salva o cursor. O que faltar a
// proxima chamada continua. Chamado pelo cron (vercel.json) ou pelo botao
// "Coletar agora" da tela /status.
async function handle(req: NextRequest) {
  if (!(await isAuthorized(req))) {
    return NextResponse.json({ ok: false, error: "nao autorizado" }, { status: 401 });
  }
  const isCron = req.headers.get("authorization")?.startsWith("Bearer ") ?? false;
  try {
    const result = await runCollector({
      origem: isCron ? "cron" : "manual",
      deadlineMs: 240_000,
    });
    return NextResponse.json(result, { status: result.ok ? 200 : 207 });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}

export async function GET(req: NextRequest) {
  return handle(req);
}

export async function POST(req: NextRequest) {
  return handle(req);
}
