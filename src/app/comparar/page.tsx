import { getAffiliateOptions, type AffiliateOption } from "@/lib/affiliates";
import { getDailyRange, type DailyRow } from "@/lib/sources";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Comparar períodos · Radar de Conteúdo",
};

type SP = Promise<{ [k: string]: string | string[] | undefined }>;

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const str = (v: string | string[] | undefined) => (typeof v === "string" && v ? v : undefined);
const iso = (v: string | undefined) => (v && ISO.test(v) ? v : undefined);

// Hoje em São Paulo, como YYYY-MM-DD.
function hojeSP(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

function addDays(day: string, n: number): string {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function labelDia(day: string): string {
  const d = new Date(`${day}T12:00:00Z`);
  const sem = d.toLocaleDateString("pt-BR", { weekday: "short", timeZone: "UTC" }).replace(".", "");
  const [, m, dd] = day.split("-");
  return `${sem} ${dd}/${m}`;
}

// Lista todos os dias do intervalo (dia sem post aparece como zero).
function fillDays(rows: DailyRow[], from: string, to: string): DailyRow[] {
  const byDay = new Map(rows.map((r) => [r.dia, r]));
  const out: DailyRow[] = [];
  for (let d = from, i = 0; d <= to && i < 92; d = addDays(d, 1), i++) {
    out.push(
      byDay.get(d) ?? {
        dia: d,
        posts: 0,
        comLink: 0,
        tips: 0,
        analises: 0,
        cadastroPromo: 0,
        resultados: 0,
        interacao: 0,
        viewsMedia: null,
      },
    );
  }
  return out;
}

type Totals = {
  posts: number;
  comLink: number;
  tips: number;
  analises: number;
  cadastroPromo: number;
  resultados: number;
  interacao: number;
  viewsMedia: number | null;
  porDia: number;
};

function totalsOf(rows: DailyRow[]): Totals {
  const sum = (k: keyof DailyRow) => rows.reduce((s, r) => s + (Number(r[k]) || 0), 0);
  // média de views ponderada pelo nº de posts do dia
  const comViews = rows.filter((r) => r.viewsMedia !== null && r.posts > 0);
  const pesos = comViews.reduce((s, r) => s + r.posts, 0);
  const posts = sum("posts");
  return {
    posts,
    comLink: sum("comLink"),
    tips: sum("tips"),
    analises: sum("analises"),
    cadastroPromo: sum("cadastroPromo"),
    resultados: sum("resultados"),
    interacao: sum("interacao"),
    viewsMedia: pesos
      ? Math.round(comViews.reduce((s, r) => s + (r.viewsMedia ?? 0) * r.posts, 0) / pesos)
      : null,
    porDia: rows.length ? Math.round((posts / rows.length) * 10) / 10 : 0,
  };
}

function Delta({ a, b }: { a: number | null; b: number | null }) {
  if (a === null || b === null) return <span className="text-faint">—</span>;
  if (b === 0) return <span className="text-faint">{a === 0 ? "=" : "novo"}</span>;
  const pct = Math.round(((a - b) / b) * 100);
  if (pct === 0) return <span className="text-muted">=</span>;
  return (
    <span className={`font-semibold tabular-nums ${pct > 0 ? "text-ok" : "text-crit"}`}>
      {pct > 0 ? "▲" : "▼"} {Math.abs(pct)}%
    </span>
  );
}

const METRICAS: { key: keyof Totals; label: string; hint?: string }[] = [
  { key: "posts", label: "Posts" },
  { key: "porDia", label: "Posts por dia" },
  { key: "viewsMedia", label: "Views por post", hint: "média" },
  { key: "tips", label: "Tips" },
  { key: "analises", label: "Análises" },
  { key: "cadastroPromo", label: "Cadastro / promo / reembolso" },
  { key: "resultados", label: "Green / red" },
  { key: "interacao", label: "Interação" },
  { key: "comLink", label: "Com link" },
];

const fmt = (n: number | null) => (n === null ? "—" : n.toLocaleString("pt-BR"));

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
  let rowsA: DailyRow[] = [];
  let rowsB: DailyRow[] = [];
  let error: string | null = null;

  try {
    donos = await getAffiliateOptions();
    const dono = donos.find((d) => String(d.id) === donoId);
    const channelIds = dono ? dono.channelIds : undefined;
    const [a, b] = await Promise.all([
      getDailyRange({ channelIds, from: aFrom, to: aTo }),
      getDailyRange({ channelIds, from: bFrom, to: bTo }),
    ]);
    rowsA = fillDays(a, aFrom, aTo);
    rowsB = fillDays(b, bFrom, bTo);
  } catch (e) {
    error = e instanceof Error ? e.message : "erro desconhecido";
  }

  const tA = totalsOf(rowsA);
  const tB = totalsOf(rowsB);
  const linhas = Math.max(rowsA.length, rowsB.length);

  const input =
    "rounded-lg border border-line bg-ground px-3 py-2 text-[13.5px] text-ink outline-none focus:border-lime/60 [color-scheme:dark]";

  return (
    <main className="mx-auto max-w-5xl px-5 py-10 md:px-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Comparar períodos</h1>
        <p className="mt-1 text-sm text-muted">
          O que mudou no conteúdo entre dois períodos — volume, alcance e mix. O padrão compara com
          4 semanas antes, pra cair nos mesmos dias da semana.
        </p>
      </header>

      <form method="get" className="mb-7 flex flex-wrap items-end gap-3 rounded-xl border border-line bg-panel p-4">
        <label className="flex min-w-[200px] flex-1 flex-col gap-1 text-[11px] font-medium uppercase tracking-wide text-faint">
          Dono
          <select name="dono" defaultValue={donoId ?? ""} className={input}>
            <option value="">Todos os canais</option>
            {donos.map((d) => (
              <option key={d.id} value={d.id}>
                {d.nome}
              </option>
            ))}
          </select>
        </label>
        <fieldset className="flex items-end gap-2">
          <legend className="mb-1 text-[11px] font-medium uppercase tracking-wide text-lime">Período A</legend>
          <input type="date" name="a_from" defaultValue={aFrom} className={input} aria-label="Período A, de" />
          <input type="date" name="a_to" defaultValue={aTo} className={input} aria-label="Período A, até" />
        </fieldset>
        <fieldset className="flex items-end gap-2">
          <legend className="mb-1 text-[11px] font-medium uppercase tracking-wide text-faint">Período B (base)</legend>
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
        <>
          <section className="mb-7 overflow-x-auto rounded-xl border border-line bg-panel">
            <table className="w-full min-w-[520px] text-[13.5px]">
              <thead>
                <tr className="border-b border-line text-left text-[11px] uppercase tracking-wide text-faint">
                  <th className="px-4 py-3 font-medium">Métrica</th>
                  <th className="px-4 py-3 text-right font-medium text-lime">A · {labelDia(aFrom)} – {labelDia(aTo)}</th>
                  <th className="px-4 py-3 text-right font-medium">B · {labelDia(bFrom)} – {labelDia(bTo)}</th>
                  <th className="px-4 py-3 text-right font-medium">A vs B</th>
                </tr>
              </thead>
              <tbody>
                {METRICAS.map((m) => (
                  <tr key={m.key} className="border-b border-linesoft last:border-0">
                    <td className="px-4 py-2.5">
                      {m.label}
                      {m.hint && <span className="ml-1.5 text-xs text-faint">{m.hint}</span>}
                    </td>
                    <td className="px-4 py-2.5 text-right font-semibold tabular-nums">{fmt(tA[m.key])}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-muted">{fmt(tB[m.key])}</td>
                    <td className="px-4 py-2.5 text-right">
                      <Delta a={tA[m.key]} b={tB[m.key]} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <h2 className="mb-3 text-sm font-semibold text-muted">Dia a dia</h2>
          <section className="overflow-x-auto rounded-xl border border-line bg-panel">
            <table className="w-full min-w-[640px] text-[13px]">
              <thead>
                <tr className="border-b border-line text-left text-[11px] uppercase tracking-wide text-faint">
                  <th className="px-4 py-3 font-medium text-lime">Dia (A)</th>
                  <th className="px-3 py-3 text-right font-medium">Posts</th>
                  <th className="px-3 py-3 text-right font-medium">Tips</th>
                  <th className="px-3 py-3 text-right font-medium">Views/post</th>
                  <th className="border-l border-line px-4 py-3 font-medium">Dia (B)</th>
                  <th className="px-3 py-3 text-right font-medium">Posts</th>
                  <th className="px-3 py-3 text-right font-medium">Tips</th>
                  <th className="px-3 py-3 text-right font-medium">Views/post</th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: linhas }, (_, i) => {
                  const a = rowsA[i];
                  const b = rowsB[i];
                  return (
                    <tr key={i} className="border-b border-linesoft last:border-0">
                      <td className="px-4 py-2.5">{a ? labelDia(a.dia) : "—"}</td>
                      <td className="px-3 py-2.5 text-right font-semibold tabular-nums">{a ? a.posts : "—"}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{a ? a.tips : "—"}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{a ? fmt(a.viewsMedia) : "—"}</td>
                      <td className="border-l border-line px-4 py-2.5 text-muted">{b ? labelDia(b.dia) : "—"}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-muted">{b ? b.posts : "—"}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-muted">{b ? b.tips : "—"}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-muted">{b ? fmt(b.viewsMedia) : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
          <p className="mt-3 text-xs text-faint">
            Tipos dependem da categorização por IA — posts ainda pendentes contam no total, mas não
            em tips/análises. Veja a fila em Status.
          </p>
        </>
      )}
    </main>
  );
}
