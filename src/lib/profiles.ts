import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { isVideo, isImage } from "@/lib/format";

export type TipoShare = { tipo: string; count: number; pct: number };

export type AffiliateProfile = {
  channelId: string;
  channelTitle: string | null;
  total: number;
  tipos: TipoShare[]; // ordenado do maior pro menor
  linkPct: number;
  videos: number; // contagens de formato (sem IA)
  imagens: number;
  links: number;
  topCasa: string | null;
  topGatilho: string | null; // exclui "nenhum"
  peakHour: number | null; // 0..23 (fuso BR)
  postsPerDay: number;
  lastPostAt: string;
};

type Row = {
  channel_id: string;
  channel_title: string | null;
  posted_at: string;
  media_type: string | null;
  has_link: boolean | null;
  cat_tipo: string | null;
  cat_casa: string | null;
  cat_gatilho: string | null;
};

function spHour(iso: string): number {
  const h = Number(
    new Date(iso).toLocaleString("en-US", {
      timeZone: "America/Sao_Paulo",
      hour: "2-digit",
      hour12: false,
    }),
  );
  return Number.isFinite(h) ? h % 24 : 0;
}

function spDay(iso: string): string {
  return new Date(iso).toLocaleDateString("en-CA", {
    timeZone: "America/Sao_Paulo",
  });
}

function topKey(counts: Map<string, number>): string | null {
  let best: string | null = null;
  let bestN = 0;
  for (const [k, n] of counts) {
    if (n > bestN) {
      best = k;
      bestN = n;
    }
  }
  return best;
}

export async function getAffiliateProfiles(): Promise<AffiliateProfile[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("posts")
    .select(
      "channel_id,channel_title,posted_at,media_type,has_link,cat_tipo,cat_casa,cat_gatilho",
    )
    .not("categorized_at", "is", null)
    .limit(5000);
  if (error) throw new Error(error.message);

  const rows = (data as Row[] | null) ?? [];
  const groups = new Map<string, Row[]>();
  for (const r of rows) {
    const arr = groups.get(r.channel_id) ?? [];
    arr.push(r);
    groups.set(r.channel_id, arr);
  }

  const profiles: AffiliateProfile[] = [];
  for (const [channelId, posts] of groups) {
    const total = posts.length;
    const tipoCount = new Map<string, number>();
    const casaCount = new Map<string, number>();
    const gatCount = new Map<string, number>();
    const hourCount = new Map<number, number>();
    const days = new Set<string>();
    let links = 0;
    let videos = 0;
    let imagens = 0;
    let lastPostAt = posts[0].posted_at;

    for (const p of posts) {
      const tipo = p.cat_tipo ?? "outro";
      tipoCount.set(tipo, (tipoCount.get(tipo) ?? 0) + 1);
      if (p.cat_casa) casaCount.set(p.cat_casa, (casaCount.get(p.cat_casa) ?? 0) + 1);
      if (p.cat_gatilho && p.cat_gatilho !== "nenhum") {
        gatCount.set(p.cat_gatilho, (gatCount.get(p.cat_gatilho) ?? 0) + 1);
      }
      if (p.has_link) links++;
      if (isVideo(p.media_type)) videos++;
      if (isImage(p.media_type)) imagens++;
      const h = spHour(p.posted_at);
      hourCount.set(h, (hourCount.get(h) ?? 0) + 1);
      days.add(spDay(p.posted_at));
      if (p.posted_at > lastPostAt) lastPostAt = p.posted_at;
    }

    const tipos: TipoShare[] = [...tipoCount.entries()]
      .map(([tipo, count]) => ({ tipo, count, pct: Math.round((count / total) * 100) }))
      .sort((a, b) => b.count - a.count);

    let peakHour: number | null = null;
    let peakN = 0;
    for (const [h, n] of hourCount) {
      if (n > peakN) {
        peakHour = h;
        peakN = n;
      }
    }

    profiles.push({
      channelId,
      channelTitle: posts[0].channel_title,
      total,
      tipos,
      linkPct: Math.round((links / total) * 100),
      videos,
      imagens,
      links,
      topCasa: topKey(casaCount),
      topGatilho: topKey(gatCount),
      peakHour,
      postsPerDay: Math.round((total / Math.max(1, days.size)) * 10) / 10,
      lastPostAt,
    });
  }

  return profiles.sort((a, b) => b.total - a.total);
}
