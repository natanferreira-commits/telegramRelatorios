import { getAffiliateOptions, type AffiliateOption } from "@/lib/affiliates";
import {
  addDays,
  daysBetween,
  FORMATO_LABEL,
  getPostsRange,
  hojeSP,
  labelDia,
  summarize,
  type Formato,
  type RPost,
} from "@/lib/report";
import { Card, DayBars, PostCard, RankTable, StatTile } from "@/components/report-ui";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Conteúdo · Radar de Conteúdo",
};

type SP = Promise<{ [k: string]: string | string[] | undefined }>;

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const str = (v: string | string[] | undefined) => (typeof v === "string" && v ? v : undefined);
const iso = (v: string | undefined) => (v && ISO.test(v) ? v : undefined);

export default async function ConteudoPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const hoje = hojeSP();

  const to = iso(str(sp.to)) ?? hoje;
  const from = iso(str(sp.from)) ?? addDays(to, -13);
  const donoId = str(sp.dono);
  const dias = daysBetween(from, to);
  const diaSel = iso(str(sp.dia));

  let donos: AffiliateOption[] = [];
  let posts: RPost[] = [];
  let error: string | null = null;

  try {
    donos = await getAffiliateOptions();
    const dono = donos.find((d) => String(d.id) === donoId);
    posts = await getPostsRange({ channelIds: dono ? dono.channelIds : undefined, from, to });
  } catch (e) {
    error = e instanceof Error ? e.message : "erro desconhecido";
  }

  const S = summarize(posts, from, to);
  const varios = !donoId && new Set(posts.map((p) => p.channelId)).size > 1;

  // Dia aberto na lista de posts: o escolhido, ou o último dia com post.
  const ultimoComPost = [...S.porDiaRows].reverse().find((r) => r.posts > 0)?.dia;
  const dia = diaSel && dias.includes(diaSel) ? diaSel : ultimoComPost;
  const postsDoDia = dia ? posts.filter((p) => p.dia === dia) : [];

  const qs = (extra: Record<string, string>) => {
    const p = new URLSearchParams({ from, to, ...(donoId ? { dono: donoId } : {}), ...extra });
    return `/conteudo?${p.toString()}#posts`;
  };

  const maxHora = Math.max(1, ...S.horas);
  const input =
    "rounded-lg border border-line bg-ground px-3 py-2 text-[13.5px] text-ink outline-none focus:border-lime/60 [color-scheme:dark]";

  return (
    <main className="mx-auto max-w-6xl px-5 py-10 md:px-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Conteúdo</h1>
        <p className="mt-1 text-sm text-muted">
          O que foi postado no período: volume, alcance, pra onde os links apontam, formato e horário.
        </p>
      </header>

      <form method="get" className="mb-6 flex flex-wrap items-end gap-3 rounded-xl border border-line bg-panel p-4">
        <label className="flex min-w-[200px] flex-1 flex-col gap-1 text-[11px] font-medium uppercase tracking-wide text-faint">
          Dono
          <select name="dono" defaultValue={donoId ?? ""} className={input}>
            <option value="">Todos os canais</option>
            {donos.map((d) => (
              <option key={d.id} value={d.id}>{d.nome}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-[11px] font-medium uppercase tracking-wide text-faint">
          De
          <input type="date" name="from" defaultValue={from} className={input} />
        </label>
        <label className="flex flex-col gap-1 text-[11px] font-medium uppercase tracking-wide text-faint">
          Até
          <input type="date" name="to" defaultValue={to} className={input} />
        </label>
        <button type="submit" className="rounded-lg bg-lime px-4 py-2 text-[13px] font-semibold text-[#06120c] hover:bg-lime/90">
          Aplicar
        </button>
      </form>

      {error ? (
        <div className="rounded-xl border border-crit/40 bg-crit/10 p-4 text-sm text-crit">
          <p className="font-medium">Erro ao carregar.</p>
          <p className="mt-1 text-crit/80">{error}</p>
          <p className="mt-2 text-[12.5px] text-muted">
            Se a mensagem fala de função ou tabela inexistente, rode <code>supabase/schema.sql</code> no Supabase.
          </p>
        </div>
      ) : posts.length === 0 ? (
        <div className="rounded-xl border border-line bg-panel p-6 text-sm text-muted">
          <p className="font-medium text-ink">Nenhum post neste período.</p>
          <p className="mt-1">
            Confira em <a href="/fontes" className="text-lime underline-offset-2 hover:underline">Fontes</a> se o canal
            está ligado e em <a href="/status" className="text-lime underline-offset-2 hover:underline">Status</a> se a
            coleta rodou.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <StatTile label="Posts" a={S.posts} hint={`${S.dias} dias`} />
            <StatTile label="Posts por dia" a={S.porDia} hint="média" />
            <StatTile label="Views por post" a={S.viewsMedia} hint="média" />
            <StatTile label="Com link de casa" a={S.comCasa} hint={`${S.posts ? Math.round((S.comCasa / S.posts) * 100) : 0}% dos posts`} />
            <StatTile label="Com qualquer link" a={S.comLink} hint={`${S.posts ? Math.round((S.comLink / S.posts) * 100) : 0}% dos posts`} />
            <StatTile label="Encaminhamentos" a={S.encaminhamentos} hint="soma" />
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <Card title="Posts por dia" hint="clique num dia pra ver os posts">
              <DayBars
                a={S.porDiaRows.map((r) => r.posts)}
                labels={dias.map(labelDia)}
                hrefs={dias.map((d) => qs({ dia: d }))}
                activeIndex={dia ? dias.indexOf(dia) : undefined}
                unit="posts"
              />
            </Card>
            <Card title="Views por post, por dia" hint="média do dia · posts recentes ainda acumulam views">
              <DayBars
                a={S.porDiaRows.map((r) => r.viewsMedia)}
                labels={dias.map(labelDia)}
                hrefs={dias.map((d) => qs({ dia: d }))}
                activeIndex={dia ? dias.indexOf(dia) : undefined}
                unit="views/post"
              />
            </Card>
          </div>

          <div className="grid gap-5 lg:grid-cols-3">
            <Card title="Casas divulgadas" hint="posts com link pra cada casa">
              <RankTable rows={S.casas.map((c) => ({ nome: c.nome, a: c.posts }))} empty="Nenhum link de casa no período." />
            </Card>
            <Card title="Outros destinos" hint="redes, sites próprios e demais links">
              <RankTable rows={S.outrosDestinos.slice(0, 10).map((c) => ({ nome: c.nome, a: c.posts }))} empty="Nenhum outro link no período." />
            </Card>
            <Card title="Formato dos posts">
              <RankTable
                rows={(Object.keys(FORMATO_LABEL) as Formato[])
                  .filter((f) => S.formatos[f] > 0)
                  .map((f) => ({ nome: FORMATO_LABEL[f], a: S.formatos[f] }))}
                empty="—"
              />
            </Card>
          </div>

          <Card title="Horário dos posts" hint="posts por hora do dia (Brasília)">
            <div className="flex items-end gap-1 border-b border-line" style={{ height: 96 }}>
              {S.horas.map((n, h) => (
                <div key={h} className="flex h-full flex-1 flex-col items-center justify-end" title={`${h}h: ${n} posts`}>
                  <div className="w-full max-w-[20px] rounded-t-[4px] bg-seriea" style={{ height: n ? Math.max(3, Math.round((n / maxHora) * 80)) : 0 }} />
                </div>
              ))}
            </div>
            <div className="flex gap-1 pt-1.5">
              {S.horas.map((_, h) => (
                <span key={h} className="flex-1 text-center text-[10px] tabular-nums text-faint">{h % 3 === 0 ? `${h}h` : ""}</span>
              ))}
            </div>
          </Card>

          <Card
            title={dia ? `Posts de ${labelDia(dia)}` : "Posts"}
            hint={dia ? `${postsDoDia.length} ${postsDoDia.length === 1 ? "post" : "posts"} · clique num dia do gráfico pra trocar` : undefined}
            className="scroll-mt-6"
          >
            <div id="posts" className="grid gap-2 md:grid-cols-2">
              {postsDoDia.length === 0 ? (
                <p className="text-sm text-muted">Nenhum post neste dia.</p>
              ) : (
                postsDoDia.map((p) => <PostCard key={p.id} post={p} showChannel={varios} />)
              )}
            </div>
          </Card>
        </div>
      )}
    </main>
  );
}
