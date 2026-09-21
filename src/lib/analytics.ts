import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

// Taxonomia (tipos, labels, cores, ordem) vem de um lugar so.
export { TIPOS_ORDER, TIPO_LABEL, CATEGORY_COLOR } from "@/lib/taxonomy";

export type Bucket = {
  key: string;
  label: string;
  total: number;
  byTipo: Record<string, number>;
};

export type ChannelTimeline = {
  channelId: string;
  channelTitle: string | null;
  buckets: Bucket[];
  total: number;
};

export type Timelines = {
  bucket: "day" | "week";
  keys: { key: string; label: string }[];
  channels: ChannelTimeline[];
  aggregate: Bucket[];
  maxChannelBucket: number; // maior barra entre todos os canais (escala compartilhada)
  maxAggregateBucket: number;
};

type Row = {
  channel_id: string;
  channel_title: string | null;
  posted_at: string;
  cat_tipo: string | null;
};

function spDateStr(iso: string): string {
  return new Date(iso).toLocaleDateString("en-CA", {
    timeZone: "America/Sao_Paulo",
  });
}
function ddmm(dateStr: string): string {
  const [, m, d] = dateStr.split("-");
  return `${d}/${m}`;
}
function shiftDays(dateStr: string, n: number): string {
  const d = new Date(`${dateStr}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function mondayOf(dateStr: string): string {
  const d = new Date(`${dateStr}T12:00:00Z`);
  const dow = d.getUTCDay(); // 0 dom .. 6 sab
  return shiftDays(dateStr, -(dow === 0 ? 6 : dow - 1));
}

function buildKeys(bucket: "day" | "week", today: string) {
  const keys: { key: string; label: string }[] = [];
  if (bucket === "day") {
    for (let i = 13; i >= 0; i--) {
      const k = shiftDays(today, -i);
      keys.push({ key: k, label: ddmm(k) });
    }
  } else {
    const mon = mondayOf(today);
    for (let i = 7; i >= 0; i--) {
      const k = shiftDays(mon, -7 * i);
      keys.push({ key: k, label: ddmm(k) });
    }
  }
  return keys;
}

function emptyBuckets(keys: { key: string; label: string }[]): Bucket[] {
  return keys.map((k) => ({ key: k.key, label: k.label, total: 0, byTipo: {} }));
}

export async function getTimelines(bucket: "day" | "week"): Promise<Timelines> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("posts")
    .select("channel_id,channel_title,posted_at,cat_tipo")
    .not("categorized_at", "is", null)
    .limit(5000);
  if (error) throw new Error(error.message);
  const rows = (data as Row[] | null) ?? [];

  const today = new Date().toLocaleDateString("en-CA", {
    timeZone: "America/Sao_Paulo",
  });
  const keys = buildKeys(bucket, today);
  const keyIndex = new Map(keys.map((k, i) => [k.key, i]));

  const byChannel = new Map<string, ChannelTimeline>();
  const aggregate = emptyBuckets(keys);

  for (const r of rows) {
    const day = spDateStr(r.posted_at);
    const bkey = bucket === "day" ? day : mondayOf(day);
    const idx = keyIndex.get(bkey);
    if (idx === undefined) continue; // fora da janela

    const tipo = r.cat_tipo ?? "outro";

    let ch = byChannel.get(r.channel_id);
    if (!ch) {
      ch = {
        channelId: r.channel_id,
        channelTitle: r.channel_title,
        buckets: emptyBuckets(keys),
        total: 0,
      };
      byChannel.set(r.channel_id, ch);
    }
    ch.buckets[idx].total++;
    ch.buckets[idx].byTipo[tipo] = (ch.buckets[idx].byTipo[tipo] ?? 0) + 1;
    ch.total++;

    aggregate[idx].total++;
    aggregate[idx].byTipo[tipo] = (aggregate[idx].byTipo[tipo] ?? 0) + 1;
  }

  const channels = [...byChannel.values()].sort((a, b) => b.total - a.total);
  const maxChannelBucket = Math.max(
    1,
    ...channels.flatMap((c) => c.buckets.map((b) => b.total)),
  );
  const maxAggregateBucket = Math.max(1, ...aggregate.map((b) => b.total));

  return {
    bucket,
    keys,
    channels,
    aggregate,
    maxChannelBucket,
    maxAggregateBucket,
  };
}

// ---- Resumo de conteúdo (Visão geral): distribuição por tipo num período ----
export type ContentSummary = {
  total: number;
  perDay: number;
  peakHour: number | null;
  byTipo: { tipo: string; count: number; pct: number }[];
};

// channelIds undefined = todos os canais. [] = nenhum (afiliado sem canal).
// Intervalo explícito (from..to em ISO) — agrega no banco, sem teto de linhas.
export async function getContentSummary(opts: {
  channelIds?: string[];
  from: string;
  to: string;
}): Promise<ContentSummary> {
  if (opts.channelIds && opts.channelIds.length === 0) {
    return { total: 0, perDay: 0, peakHour: null, byTipo: [] };
  }

  const supabase = getSupabaseAdmin();
  const params = {
    p_channel_ids: opts.channelIds ?? null,
    p_from: opts.from,
    p_to: opts.to,
  };
  const [tipoRes, hourRes] = await Promise.all([
    supabase.rpc("content_tipo_counts_range", params),
    supabase.rpc("content_hour_counts_range", params),
  ]);
  if (tipoRes.error) throw new Error(tipoRes.error.message);
  if (hourRes.error) throw new Error(hourRes.error.message);

  const tipoRows =
    (tipoRes.data as { cat_tipo: string | null; cnt: number }[] | null) ?? [];
  const total = tipoRows.reduce((s, r) => s + Number(r.cnt), 0);
  const byTipo = tipoRows
    .map((r) => ({
      tipo: r.cat_tipo ?? "outro",
      count: Number(r.cnt),
      pct: total ? Math.round((Number(r.cnt) / total) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count);

  let peakHour: number | null = null;
  let max = -1;
  for (const r of (hourRes.data as { hour: number; cnt: number }[] | null) ?? []) {
    if (Number(r.cnt) > max) {
      max = Number(r.cnt);
      peakHour = Number(r.hour);
    }
  }

  const dias =
    Math.round(
      (new Date(`${opts.to}T00:00:00Z`).getTime() -
        new Date(`${opts.from}T00:00:00Z`).getTime()) /
        86_400_000,
    ) + 1;

  return {
    total,
    perDay: dias > 0 ? Math.round(total / dias) : total,
    peakHour,
    byTipo,
  };
}

// Volume por bucket (dia/semana) x tipo, agregado no banco (RPC content_buckets).
// channelIds undefined = todos; [] = nenhum. Sem teto de linhas.
export async function getContentBuckets(
  bucket: "day" | "week",
  channelIds?: string[],
): Promise<Bucket[]> {
  const today = new Date().toLocaleDateString("en-CA", {
    timeZone: "America/Sao_Paulo",
  });
  const keys = buildKeys(bucket, today);
  const buckets = emptyBuckets(keys);
  if (channelIds && channelIds.length === 0) return buckets;

  const keyIndex = new Map(keys.map((k, i) => [k.key, i]));
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.rpc("content_buckets", {
    p_bucket: bucket,
    p_channel_ids: channelIds ?? null,
  });
  if (error) throw new Error(error.message);

  for (const r of (data as
    | { bucket_key: string; cat_tipo: string | null; cnt: number }[]
    | null) ?? []) {
    const idx = keyIndex.get(r.bucket_key);
    if (idx === undefined) continue;
    const tipo = r.cat_tipo ?? "outro";
    const cnt = Number(r.cnt);
    buckets[idx].total += cnt;
    buckets[idx].byTipo[tipo] = (buckets[idx].byTipo[tipo] ?? 0) + cnt;
  }
  return buckets;
}
