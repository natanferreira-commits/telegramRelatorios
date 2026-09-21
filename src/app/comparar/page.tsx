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
  type Summary,
} from "@/lib/report";
import { Card, DayBars, Delta, fmt, Legend, PostCard, RankTable, StatTile } from "@/components/report-ui";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Comparar períodos · Radar de Conteúdo",
};

type SP = Promise<{ [k: string]: string | string[] | undefined }>;

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const str = (v: string | string[] | undefined) => (typeof v === "string" && v ? v : undefined);
const iso = (v: string | undefined) => (v && ISO.test(v) ? v : undefined);

const SERIES = [
  { label: "Período A", className: "bg-seriea" },
  { label: "Período B (base)", className: "bg-serieb" },
];

function groupByDay(posts: RPost[]): Map<string, RPost[]> {
  const m = new Map<string, RPost[]>();
  for (const p of posts) {
    const list = m.get(p.dia) ?? [];
    list.push(p);
    m.set(p.dia, list);
  }
  return m;
}

function DayColumn({ day, posts, serie }: { day: string | undefined; posts: RPost[]; serie: "a" | "b" }) {
  if (!day) return <div />;
  return (
    <div className="min-w-0">
      <div className="mb-2 flex items-center gap-2 text-xs">
        <span className={`h-2.5 w-2.5 rounded-[3px] ${serie === "a" ? "bg-seriea" : "bg-serieb"}`} />
        <span className="font-semibold capitalize text-ink">{labelDia(day)}</span>
        <span className="text-faint">
          {posts.length} {posts.length === 1 ? "post" : "posts"}
        </span>
      </div>
      <div className="space-y-2">
        {posts.length === 0 ? (
          <p className="rounded-lg border border-dashed border-line p-3 text-xs text-faint">Nenhum post neste dia.</p>
        ) : (
          posts.map((p) => <PostCard key={p.id} post={p} />)
        )}
      </div>
    </div>
  );
}

export default async function CompararPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const hoje = hojeSP();

  // Padrão: últimos 5 dias fechados × os mesmos dias da semana, 4 semanas antes.
  const aTo = iso(str(sp.a_to)) ?? addDays(hoje, -1);
  const aFrom = iso(str(sp.a_from)) ?? addDays(aTo, -4);
  const bFrom = iso(str(sp.b_from)) ?? addDays(aFrom, -28);
  const bTo = iso(str(sp.b_to)) ?? addDays(aTo, -28);
  const donoId = str(sp.dono);

  let donos: AffiliateOption[] = [];
  let postsA: RPost[] = [];
  let postsB: RPost[] = [];
  let error: string | null = null;

  try {
    donos = await getAffiliateOptions();
    const dono = donos.find((d) => String(d.id) === donoId);
    const channelIds = dono ? dono.channelIds : undefined;
    [postsA, postsB] = await Promise.all([
      getPostsRange({ channelIds, from: aFrom, to: aTo }),
      getPostsRange({ channelIds, from: bFrom, to: bTo }),
    ]);
  } catch (e) {
    error = e instanceof Error ? e.message : "erro desconhecido";
  }

  const A: Summary = summarize(postsA, aFrom, aTo);
  const B: Summary = summarize(postsB, bFrom, bTo);
  const diasA = daysBetween(aFrom, aTo);
  const diasB = daysBetween(bFrom, bTo);
  const linhas = Math.max(diasA.length, diasB.length);
  const byDayA = groupByDay(postsA);
  const byDayB = groupByDay(postsB);

  // Casas: união das duas listas, ordenada pelo maior volume.
  const casaNomes = [...new Set([...A.casas, ...B.casas].map((c) => c.nome))];
  const casas = casaNomes
    .map((nome) => ({
      nome,
      a: A.casas.find((c) => c.nome === nome)?.posts ?? 0,
      b: B.casas.find((c) => c.nome === nome)?.posts ?? 0,
    }))
    .sort((x, y) => Math.max(y.a, y.b) - Math.max(x.a, x.b));

  const input =
    "rounded-lg border border-line bg-ground px-3 py-2 text-[13.5px] text-ink outline-none focus:border-lime/60 [color-scheme:dark]";

  return (
    <main className="mx-auto max-w-6xl px-5 py-10 md:px-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Comparar períodos</h1>
        <p className="mt-1 text-sm text-muted">
          Dois períodos lado a lado: volume, alcance, casas divulgadas e os posts de cada dia. O padrão
          compara com 4 semanas antes, pra cair nos mesmos dias da semana.
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
        <fieldset className="flex items-end gap-2">
          <legend className="mb-1 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-faint">
            <span className="h-2.5 w-2.5 rounded-[3px] bg-seriea" /> Período A
          </legend>
          <input type="date" name="a_from" defaultValue={aFrom} className={input} aria-label="Período A, de" />
          <input type="date" name="a_to" defaultValue={aTo} className={input} aria-label="Período A, até" />
        </fieldset>
        <fieldset className="flex items-end gap-2">
          <legend className="mb-1 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-faint">
            <span className="h-2.5 w-2.5 rounded-[3px] bg-serieb" /> Período B (base)
          </legend>
          <input type="date" name="b_from" defaultValue={bFrom} className={input} aria-label="Período B, de" />
          <input type="date" name="b_to" defaultValue={bTo} className={input} aria-label="Período B, até" />
        </fieldset>
        <button type="submit" className="rounded-lg bg-lime px-4 py-2 text-[13px] font-semibold text-[#06120c] hover:bg-lime/90">
          Comparar
        </button>
      </form>

      {error ? (
        <div className="rounded-xl border border-crit/40 bg-crit/10 p-4 text-sm text-crit">
          <p className="font-medium">Erro ao carregar.</p>
          <p className="mt-1 text-crit/80">{error}</p>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <StatTile label="Posts" a={A.posts} b={B.posts} />
            <StatTile label="Posts por dia" a={A.porDia} b={B.porDia} />
            <StatTile label="Views por post" a={A.viewsMedia} b={B.viewsMedia} />
            <StatTile label="Com link de casa" a={A.comCasa} b={B.comCasa} />
            <StatTile label="Com qualquer link" a={A.comLink} b={B.comLink} />
            <StatTile label="Encaminhamentos" a={A.encaminhamentos} b={B.encaminhamentos} />
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <Card title="Posts por dia" hint="cada par = mesmo dia da sequência">
              <Legend items={SERIES} />
              <DayBars
                a={A.porDiaRows.map((r) => r.posts)}
                b={B.porDiaRows.map((r) => r.posts)}
                labels={diasA.map(labelDia)}
                labelsB={diasB.map(labelDia)}
                unit="posts"
              />
            </Card>
            <Card title="Views por post, por dia" hint="média do dia · posts recentes ainda acumulam views">
              <Legend items={SERIES} />
              <DayBars
                a={A.porDiaRows.map((r) => r.viewsMedia)}
                b={B.porDiaRows.map((r) => r.viewsMedia)}
                labels={diasA.map(labelDia)}
                labelsB={diasB.map(labelDia)}
                unit="views/post"
              />
            </Card>
          </div>

          <div className="grid gap-5 lg:grid-cols-[3fr_2fr]">
            <Card title="Casas divulgadas" hint="posts com link pra cada casa">
              <RankTable rows={casas} headA="A" headB="B" empty="Nenhum link de casa nos dois períodos." />
            </Card>
            <Card title="Formato dos posts">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wide text-faint">
                    <th className="pb-2 font-medium">Formato</th>
                    <th className="pb-2 text-right font-medium">A</th>
                    <th className="pb-2 text-right font-medium">B</th>
                    <th className="pb-2 text-right font-medium">A vs B</th>
                  </tr>
                </thead>
                <tbody>
                  {(Object.keys(FORMATO_LABEL) as Formato[])
                    .filter((f) => A.formatos[f] || B.formatos[f])
                    .map((f) => (
                      <tr key={f} className="border-t border-linesoft">
                        <td className="py-2">{FORMATO_LABEL[f]}</td>
                        <td className="py-2 text-right font-semibold tabular-nums">{A.formatos[f]}</td>
                        <td className="py-2 text-right tabular-nums text-muted">{B.formatos[f]}</td>
                        <td className="py-2 text-right"><Delta a={A.formatos[f]} b={B.formatos[f]} /></td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </Card>
          </div>

          <Card title="Dia a dia">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-[13px]">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wide text-faint">
                    <th className="pb-2 font-medium">Dia (A)</th>
                    <th className="pb-2 text-right font-medium">Posts</th>
                    <th className="pb-2 text-right font-medium">C/ casa</th>
                    <th className="pb-2 text-right font-medium">Views/post</th>
                    <th className="border-l border-line pb-2 pl-4 font-medium">Dia (B)</th>
                    <th className="pb-2 text-right font-medium">Posts</th>
                    <th className="pb-2 text-right font-medium">C/ casa</th>
                    <th className="pb-2 text-right font-medium">Views/post</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: linhas }, (_, i) => {
                    const a = A.porDiaRows[i];
                    const b = B.porDiaRows[i];
                    return (
                      <tr key={i} className="border-t border-linesoft">
                        <td className="py-2 capitalize">{a ? labelDia(a.dia) : "—"}</td>
                        <td className="py-2 text-right font-semibold tabular-nums">{a ? a.posts : "—"}</td>
                        <td className="py-2 text-right tabular-nums">{a ? a.comCasa : "—"}</td>
                        <td className="py-2 text-right tabular-nums">{a ? fmt(a.viewsMedia) : "—"}</td>
                        <td className="border-l border-line py-2 pl-4 capitalize text-muted">{b ? labelDia(b.dia) : "—"}</td>
                        <td className="py-2 text-right tabular-nums text-muted">{b ? b.posts : "—"}</td>
                        <td className="py-2 text-right tabular-nums text-muted">{b ? b.comCasa : "—"}</td>
                        <td className="py-2 text-right tabular-nums text-muted">{b ? fmt(b.viewsMedia) : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          <Card title="Posts lado a lado" hint="o que foi postado em cada dia, na ordem do dia">
            <div className="space-y-6">
              {Array.from({ length: linhas }, (_, i) => (
                <div key={i} className="grid gap-4 border-t border-linesoft pt-5 first:border-0 first:pt-0 md:grid-cols-2">
                  <DayColumn day={diasA[i]} posts={byDayA.get(diasA[i] ?? "") ?? []} serie="a" />
                  <DayColumn day={diasB[i]} posts={byDayB.get(diasB[i] ?? "") ?? []} serie="b" />
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
    </main>
  );
}
