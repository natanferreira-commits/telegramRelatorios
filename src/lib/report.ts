import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { destinoOf, type Destino } from "@/lib/houses";

// Camada de relatorio: tudo aqui e dado bruto contado (volume, alcance,
// destino dos links, formato, horario). Nada de IA, nada de interpretacao.

export type RPost = {
  id: number;
  channelId: string;
  channelTitle: string | null;
  postedAt: string;
  dia: string; // YYYY-MM-DD em Sao Paulo
  hora: number; // 0-23 em Sao Paulo
  text: string | null;
  mediaType: string | null;
  views: number | null;
  forwards: number | null;
  reactions: number | null;
  hasLink: boolean;
  destinos: Destino[]; // sem repeticao, por post
  casas: string[]; // so as casas de aposta
};

type Row = {
  id: number;
  channel_id: string;
  channel_title: string | null;
  posted_at: string;
  text: string | null;
  media_type: string | null;
  views: number | null;
  forwards: number | null;
  reactions: number | null;
  has_link: boolean | null;
  raw_payload: { links?: string[] } | null;
};

const TZ = "America/Sao_Paulo";

export function addDays(day: string, n: number): string {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function hojeSP(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: TZ });
}

export function daysBetween(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from, i = 0; d <= to && i < 120; d = addDays(d, 1), i++) out.push(d);
  return out;
}

export function labelDia(day: string): string {
  const d = new Date(`${day}T12:00:00Z`);
  const sem = d.toLocaleDateString("pt-BR", { weekday: "short", timeZone: "UTC" }).replace(".", "");
  const [, m, dd] = day.split("-");
  return `${sem} ${dd}/${m}`;
}

function toPost(r: Row): RPost {
  const date = new Date(r.posted_at);
  const seen = new Set<string>();
  const destinos: Destino[] = [];
  for (const url of r.raw_payload?.links ?? []) {
    const d = destinoOf(url);
    if (!d || seen.has(d.label)) continue;
    seen.add(d.label);
    destinos.push(d);
  }
  return {
    id: r.id,
    channelId: r.channel_id,
    channelTitle: r.channel_title,
    postedAt: r.posted_at,
    dia: date.toLocaleDateString("en-CA", { timeZone: TZ }),
    hora: Number(date.toLocaleTimeString("en-GB", { timeZone: TZ, hour: "2-digit", hour12: false }).slice(0, 2)) % 24,
    text: r.text,
    mediaType: r.media_type,
    views: r.views,
    forwards: r.forwards,
    reactions: r.reactions,
    hasLink: Boolean(r.has_link),
    destinos,
    casas: destinos.filter((d) => d.tipo === "casa").map((d) => d.label),
  };
}

// Posts de um intervalo de dias (em SP), do mais antigo pro mais novo.
// channelIds undefined = todos os canais; [] = nenhum.
export async function getPostsRange(opts: {
  channelIds?: string[];
  from: string;
  to: string;
}): Promise<RPost[]> {
  if (opts.channelIds && opts.channelIds.length === 0) return [];
  const supabase = getSupabaseAdmin();
  // Brasil esta fixo em UTC-3: meia-noite de SP = 03:00Z.
  const ini = `${opts.from}T03:00:00Z`;
  const fim = `${addDays(opts.to, 1)}T03:00:00Z`;

  const PAGE = 1000;
  const rows: Row[] = [];
  for (let offset = 0; offset < 10_000; offset += PAGE) {
    let q = supabase
      .from("posts")
      .select("id,channel_id,channel_title,posted_at,text,media_type,views,forwards,reactions,has_link,raw_payload")
      .gte("posted_at", ini)
      .lt("posted_at", fim)
      .order("posted_at", { ascending: true })
      .range(offset, offset + PAGE - 1);
    if (opts.channelIds) q = q.in("channel_id", opts.channelIds);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    const page = (data as Row[] | null) ?? [];
    rows.push(...page);
    if (page.length < PAGE) break;
  }
  return rows.map(toPost);
}

export type Formato = "texto" | "foto" | "video" | "enquete" | "outros";

export function formatoOf(mediaType: string | null): Formato {
  if (!mediaType || mediaType === "text") return "texto";
  if (mediaType === "photo" || mediaType === "animation") return "foto";
  if (mediaType === "video" || mediaType === "video_note") return "video";
  if (mediaType === "poll") return "enquete";
  return "outros";
}

export const FORMATO_LABEL: Record<Formato, string> = {
  texto: "Só texto",
  foto: "Foto / GIF",
  video: "Vídeo",
  enquete: "Enquete",
  outros: "Outros",
};

export type DayStat = {
  dia: string;
  posts: number;
  comLink: number;
  comCasa: number;
  viewsMedia: number | null;
};

export type Summary = {
  dias: number;
  posts: number;
  porDia: number;
  viewsMedia: number | null;
  comLink: number;
  comCasa: number;
  encaminhamentos: number;
  formatos: Record<Formato, number>;
  casas: { nome: string; posts: number }[];
  outrosDestinos: { nome: string; posts: number }[];
  horas: number[]; // 24 posicoes
  porDiaRows: DayStat[];
};

const media = (nums: number[]) =>
  nums.length ? Math.round(nums.reduce((s, n) => s + n, 0) / nums.length) : null;

export function summarize(posts: RPost[], from: string, to: string): Summary {
  const dias = daysBetween(from, to);
  const byDay = new Map<string, RPost[]>(dias.map((d) => [d, []]));
  const casas = new Map<string, number>();
  const outros = new Map<string, number>();
  const formatos: Record<Formato, number> = { texto: 0, foto: 0, video: 0, enquete: 0, outros: 0 };
  const horas = Array.from({ length: 24 }, () => 0);

  for (const p of posts) {
    byDay.get(p.dia)?.push(p);
    formatos[formatoOf(p.mediaType)]++;
    horas[p.hora]++;
    for (const d of p.destinos) {
      const m = d.tipo === "casa" ? casas : outros;
      m.set(d.label, (m.get(d.label) ?? 0) + 1);
    }
  }

  const rank = (m: Map<string, number>) =>
    [...m].map(([nome, n]) => ({ nome, posts: n })).sort((a, b) => b.posts - a.posts || a.nome.localeCompare(b.nome));

  const views = posts.map((p) => p.views).filter((v): v is number => v !== null);

  return {
    dias: dias.length,
    posts: posts.length,
    porDia: dias.length ? Math.round((posts.length / dias.length) * 10) / 10 : 0,
    viewsMedia: media(views),
    comLink: posts.filter((p) => p.hasLink).length,
    comCasa: posts.filter((p) => p.casas.length > 0).length,
    encaminhamentos: posts.reduce((s, p) => s + (p.forwards ?? 0), 0),
    formatos,
    casas: rank(casas),
    outrosDestinos: rank(outros),
    horas,
    porDiaRows: dias.map((dia) => {
      const ps = byDay.get(dia) ?? [];
      return {
        dia,
        posts: ps.length,
        comLink: ps.filter((p) => p.hasLink).length,
        comCasa: ps.filter((p) => p.casas.length > 0).length,
        viewsMedia: media(ps.map((p) => p.views).filter((v): v is number => v !== null)),
      };
    }),
  };
}
