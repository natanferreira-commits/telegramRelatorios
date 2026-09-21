import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Saude da coleta — so leitura, so numeros (nada de texto de post).
// Fica fora do login pra dar pra checar rapido "esta entrando post?".
export async function GET() {
  try {
    const supabase = getSupabaseAdmin();
    const [total, pend, lastPost, lastRun, fontes] = await Promise.all([
      supabase.from("posts").select("*", { count: "exact", head: true }),
      supabase.from("posts").select("*", { count: "exact", head: true }).is("categorized_at", null),
      supabase.from("posts").select("posted_at").order("posted_at", { ascending: false }).limit(1),
      supabase
        .from("collector_runs")
        .select("started_at,finished_at,ok")
        .order("started_at", { ascending: false })
        .limit(1),
      supabase.from("sources").select("*", { count: "exact", head: true }).eq("ativo", true),
    ]);

    const err = total.error || pend.error || lastRun.error || fontes.error;
    if (err) return NextResponse.json({ ok: false, error: err.message }, { status: 500 });

    return NextResponse.json({
      ok: true,
      posts: total.count ?? 0,
      fila_categorizacao: pend.count ?? 0,
      ultimo_post: (lastPost.data as { posted_at: string }[] | null)?.[0]?.posted_at ?? null,
      fontes_monitoradas: fontes.count ?? 0,
      ultima_coleta: (lastRun.data as Record<string, unknown>[] | null)?.[0] ?? null,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
