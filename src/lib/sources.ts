import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

// Canal/grupo que a conta do Telegram enxerga (preenchido pelo coletor).
export type Source = {
  channelId: string;
  title: string;
  username: string | null;
  kind: "channel" | "group";
  members: number | null;
  ativo: boolean;
  backfillDays: number;
  lastMsgId: number;
  lastRunAt: string | null;
  lastError: string | null;
  posts: number;
  dono: { id: number; nome: string; grupo: string } | null;
};

export type CollectorRun = {
  id: number;
  startedAt: string;
  finishedAt: string | null;
  ok: boolean | null;
  origem: string | null;
  fontes: number | null;
  novos: number | null;
  categorizados: number | null;
  pendentes: number | null;
  erro: string | null;
};

type SourceRow = {
  channel_id: string;
  title: string | null;
  username: string | null;
  kind: string | null;
  members: number | null;
  ativo: boolean;
  backfill_days: number;
  last_msg_id: number;
  last_run_at: string | null;
  last_error: string | null;
};

export async function getSources(): Promise<Source[]> {
  const supabase = getSupabaseAdmin();
  const [srcRes, linkRes, affRes, cntRes] = await Promise.all([
    supabase
      .from("sources")
      .select(
        "channel_id,title,username,kind,members,ativo,backfill_days,last_msg_id,last_run_at,last_error",
      )
      .order("ativo", { ascending: false })
      .order("title", { ascending: true }),
    supabase.from("affiliate_channels").select("affiliate_id,channel_id"),
    supabase.from("affiliates").select("id,nome,grupo"),
    supabase.rpc("channel_list"),
  ]);
  if (srcRes.error) throw new Error(srcRes.error.message);

  const affById = new Map<number, { id: number; nome: string; grupo: string }>();
  for (const a of (affRes.data as { id: number; nome: string; grupo: string }[] | null) ?? []) {
    affById.set(a.id, a);
  }
  const donoByChannel = new Map<string, { id: number; nome: string; grupo: string }>();
  for (const l of (linkRes.data as { affiliate_id: number; channel_id: string }[] | null) ?? []) {
    const a = affById.get(l.affiliate_id);
    if (a && !donoByChannel.has(l.channel_id)) donoByChannel.set(l.channel_id, a);
  }
  const countByChannel = new Map<string, number>();
  for (const c of (cntRes.data as { channel_id: string; cnt: number }[] | null) ?? []) {
    countByChannel.set(c.channel_id, Number(c.cnt));
  }

  return ((srcRes.data as SourceRow[] | null) ?? []).map((s) => ({
    channelId: s.channel_id,
    title: s.title ?? s.channel_id,
    username: s.username,
    kind: s.kind === "group" ? "group" : "channel",
    members: s.members,
    ativo: s.ativo,
    backfillDays: s.backfill_days,
    lastMsgId: Number(s.last_msg_id) || 0,
    lastRunAt: s.last_run_at,
    lastError: s.last_error,
    posts: countByChannel.get(s.channel_id) ?? 0,
    dono: donoByChannel.get(s.channel_id) ?? null,
  }));
}

export async function getRuns(limit = 15): Promise<CollectorRun[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("collector_runs")
    .select("id,started_at,finished_at,ok,origem,fontes,novos,categorizados,pendentes,erro")
    .order("started_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (
    (data as
      | {
          id: number;
          started_at: string;
          finished_at: string | null;
          ok: boolean | null;
          origem: string | null;
          fontes: number | null;
          novos: number | null;
          categorizados: number | null;
          pendentes: number | null;
          erro: string | null;
        }[]
      | null) ?? []
  ).map((r) => ({
    id: r.id,
    startedAt: r.started_at,
    finishedAt: r.finished_at,
    ok: r.ok,
    origem: r.origem,
    fontes: r.fontes,
    novos: r.novos,
    categorizados: r.categorizados,
    pendentes: r.pendentes,
    erro: r.erro,
  }));
}

export async function getTotals(): Promise<{ posts: number; pendentes: number; ultimoPost: string | null }> {
  const supabase = getSupabaseAdmin();
  const [total, pend, last] = await Promise.all([
    supabase.from("posts").select("*", { count: "exact", head: true }),
    supabase.from("posts").select("*", { count: "exact", head: true }).is("categorized_at", null),
    supabase.from("posts").select("posted_at").order("posted_at", { ascending: false }).limit(1),
  ]);
  return {
    posts: total.count ?? 0,
    pendentes: pend.count ?? 0,
    ultimoPost: (last.data as { posted_at: string }[] | null)?.[0]?.posted_at ?? null,
  };
}

// ===== Comparativo de períodos =====

export type DailyRow = {
  dia: string;
  posts: number;
  comLink: number;
  tips: number;
  analises: number;
  cadastroPromo: number;
  resultados: number;
  interacao: number;
  viewsMedia: number | null;
};

export async function getDailyRange(opts: {
  channelIds?: string[];
  from: string;
  to: string;
}): Promise<DailyRow[]> {
  if (opts.channelIds && opts.channelIds.length === 0) return [];
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.rpc("content_daily_range", {
    p_channel_ids: opts.channelIds ?? null,
    p_from: opts.from,
    p_to: opts.to,
  });
  if (error) throw new Error(error.message);
  return (
    (data as
      | {
          dia: string;
          posts: number;
          com_link: number;
          tips: number;
          analises: number;
          cadastro_promo: number;
          resultados: number;
          interacao: number;
          views_media: number | null;
        }[]
      | null) ?? []
  ).map((r) => ({
    dia: r.dia,
    posts: Number(r.posts),
    comLink: Number(r.com_link),
    tips: Number(r.tips),
    analises: Number(r.analises),
    cadastroPromo: Number(r.cadastro_promo),
    resultados: Number(r.resultados),
    interacao: Number(r.interacao),
    viewsMedia: r.views_media === null ? null : Number(r.views_media),
  }));
}
