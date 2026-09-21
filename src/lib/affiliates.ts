import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export type LinkedChannel = { id: string; title: string };

// "Dono" de um ou mais canais: afiliado nosso ou concorrente.
export type Affiliate = {
  id: number;
  nome: string;
  nicho: string | null;
  grupo: "proprio" | "concorrente";
  channels: LinkedChannel[];
  ativo: boolean;
};

// Opção pra filtros: o dono e os ids de canal que ele agrega.
export type AffiliateOption = {
  id: number;
  nome: string;
  channelIds: string[];
};

type AffRow = {
  id: number;
  nome: string;
  nicho: string | null;
  grupo: string | null;
  ativo: boolean | null;
};

type LinkRow = {
  affiliate_id: number;
  channel_id: string;
  channel_title: string | null;
};

export async function getAffiliates(): Promise<Affiliate[]> {
  const supabase = getSupabaseAdmin();

  const [affsRes, linksRes] = await Promise.all([
    supabase
      .from("affiliates")
      .select("id,nome,nicho,grupo,ativo")
      .order("grupo", { ascending: false }) // proprio antes de concorrente
      .order("nome", { ascending: true }),
    supabase.from("affiliate_channels").select("affiliate_id,channel_id,channel_title"),
  ]);

  if (affsRes.error) throw new Error(affsRes.error.message);
  if (linksRes.error) throw new Error(linksRes.error.message);

  const byAffiliate = new Map<number, LinkedChannel[]>();
  for (const l of (linksRes.data as LinkRow[] | null) ?? []) {
    const list = byAffiliate.get(l.affiliate_id) ?? [];
    list.push({ id: l.channel_id, title: l.channel_title ?? l.channel_id });
    byAffiliate.set(l.affiliate_id, list);
  }

  return ((affsRes.data as AffRow[] | null) ?? []).map((r) => ({
    id: r.id,
    nome: r.nome,
    nicho: r.nicho,
    grupo: r.grupo === "concorrente" ? "concorrente" : "proprio",
    channels: (byAffiliate.get(r.id) ?? []).sort((a, b) => a.title.localeCompare(b.title)),
    ativo: r.ativo ?? true,
  }));
}

// Donos ativos que têm ao menos um canal, pra popular filtros.
export async function getAffiliateOptions(): Promise<AffiliateOption[]> {
  const affs = await getAffiliates();
  return affs
    .filter((a) => a.ativo && a.channels.length > 0)
    .map((a) => ({
      id: a.id,
      nome: a.grupo === "concorrente" ? `${a.nome} (concorrente)` : a.nome,
      channelIds: a.channels.map((c) => c.id),
    }));
}
