import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { isAuthorized } from "@/lib/authz";

export const runtime = "nodejs";

// Edita uma fonte: liga/desliga o monitoramento, define o historico inicial e
// o dono (cria o dono se o nome ainda nao existir).
// body: { channel_id, ativo?, backfill_days?, dono?: string | null, grupo?: 'proprio'|'concorrente' }
export async function PATCH(req: NextRequest) {
  if (!(await isAuthorized(req))) {
    return NextResponse.json({ ok: false, error: "nao autorizado" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }

  const channelId = typeof body.channel_id === "string" ? body.channel_id : "";
  if (!channelId) {
    return NextResponse.json({ ok: false, error: "channel_id é obrigatório" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  const patch: Record<string, unknown> = {};
  if ("ativo" in body) patch.ativo = Boolean(body.ativo);
  if ("backfill_days" in body) {
    const d = Math.round(Number(body.backfill_days));
    if (Number.isFinite(d)) patch.backfill_days = Math.min(365, Math.max(1, d));
  }
  if (Object.keys(patch).length > 0) {
    const { error } = await supabase.from("sources").update(patch).eq("channel_id", channelId);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  if ("dono" in body) {
    const nome = typeof body.dono === "string" ? body.dono.trim() : "";
    const grupo = body.grupo === "concorrente" ? "concorrente" : "proprio";

    // Um canal tem um dono so nesta tela: limpa o vinculo anterior.
    const del = await supabase.from("affiliate_channels").delete().eq("channel_id", channelId);
    if (del.error) return NextResponse.json({ ok: false, error: del.error.message }, { status: 500 });

    if (nome) {
      const up = await supabase
        .from("affiliates")
        .upsert({ nome, grupo }, { onConflict: "nome" })
        .select("id")
        .single();
      if (up.error) return NextResponse.json({ ok: false, error: up.error.message }, { status: 500 });

      const { data: src } = await supabase
        .from("sources")
        .select("title")
        .eq("channel_id", channelId)
        .single();

      const link = await supabase.from("affiliate_channels").insert({
        affiliate_id: (up.data as { id: number }).id,
        channel_id: channelId,
        channel_title: (src as { title: string | null } | null)?.title ?? null,
      });
      if (link.error) return NextResponse.json({ ok: false, error: link.error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}
