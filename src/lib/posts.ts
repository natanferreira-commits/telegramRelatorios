import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export type PostItem = {
  id: number;
  channelId: string;
  channelTitle: string | null;
  mediaType: string | null;
  text: string | null;
  postedAt: string;
  tipo: string | null;
  casa: string | null;
  gatilho: string | null;
  temLink: boolean | null;
};

export type PostFilters = { channelId?: string; q?: string; tipo?: string };
export type PostChannel = { id: string; title: string };

type Row = {
  id: number;
  channel_id: string;
  channel_title: string | null;
  media_type: string | null;
  text: string | null;
  posted_at: string;
  has_link: boolean | null;
  cat_tipo: string | null;
  cat_casa: string | null;
  cat_gatilho: string | null;
};

export async function getPosts(filters: PostFilters = {}): Promise<PostItem[]> {
  const supabase = getSupabaseAdmin();
  let query = supabase
    .from("posts")
    .select(
      "id,channel_id,channel_title,media_type,text,posted_at,has_link,cat_tipo,cat_casa,cat_gatilho",
    )
    .order("posted_at", { ascending: false })
    .limit(300);
  if (filters.channelId) query = query.eq("channel_id", filters.channelId);
  if (filters.tipo) query = query.eq("cat_tipo", filters.tipo);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  let items: PostItem[] = (data as Row[] | null ?? []).map((p) => ({
    id: p.id,
    channelId: p.channel_id,
    channelTitle: p.channel_title,
    mediaType: p.media_type,
    text: p.text,
    postedAt: p.posted_at,
    tipo: p.cat_tipo,
    casa: p.cat_casa,
    gatilho: p.cat_gatilho,
    temLink: p.has_link,
  }));

  const q = filters.q?.trim().toLowerCase();
  if (q) items = items.filter((p) => (p.text ?? "").toLowerCase().includes(q));

  return items;
}

// Posts de um dia (fuso America/Sao_Paulo), pro drill-down do gráfico.
// channelIds undefined = todos os canais; [] = nenhum.
// Busca uma janela folgada e filtra o dia em SP no JS — assim não dependemos
// do offset do fuso dentro da query.
export async function getPostsByDay(opts: {
  channelIds?: string[];
  day: string; // YYYY-MM-DD (dia em SP)
}): Promise<PostItem[]> {
  if (opts.channelIds && opts.channelIds.length === 0) return [];
  const supabase = getSupabaseAdmin();

  const base = new Date(`${opts.day}T00:00:00Z`).getTime();
  const ini = new Date(base - 86_400_000).toISOString();
  const fim = new Date(base + 2 * 86_400_000).toISOString();

  let query = supabase
    .from("posts")
    .select(
      "id,channel_id,channel_title,media_type,text,posted_at,has_link,cat_tipo,cat_casa,cat_gatilho",
    )
    .gte("posted_at", ini)
    .lt("posted_at", fim)
    .order("posted_at", { ascending: true })
    .limit(500);
  if (opts.channelIds) query = query.in("channel_id", opts.channelIds);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const diaSP = (iso: string) =>
    new Date(iso).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });

  return ((data as Row[] | null) ?? [])
    .filter((p) => diaSP(p.posted_at) === opts.day)
    .map((p) => ({
      id: p.id,
      channelId: p.channel_id,
      channelTitle: p.channel_title,
      mediaType: p.media_type,
      text: p.text,
      postedAt: p.posted_at,
      tipo: p.cat_tipo,
      casa: p.cat_casa,
      gatilho: p.cat_gatilho,
      temLink: p.has_link,
    }));
}

export async function getPostChannels(): Promise<PostChannel[]> {
  const supabase = getSupabaseAdmin();
  // Agrega no banco (channel_list) — sem teto de linhas.
  const { data, error } = await supabase.rpc("channel_list");
  if (error) throw new Error(error.message);

  return (
    (data as { channel_id: string; channel_title: string | null }[] | null) ?? []
  )
    .map((r) => ({ id: r.channel_id, title: r.channel_title ?? r.channel_id }))
    .sort((a, b) => a.title.localeCompare(b.title));
}
