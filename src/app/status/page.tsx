import { getRuns, getSources, getTotals, type CollectorRun, type Source } from "@/lib/sources";
import { formatRelativePt, formatTimePt, hoursSince } from "@/lib/time";
import { CollectButton } from "@/components/CollectButton";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Status · Radar de Conteúdo",
};

function Stat({ label, value, tone }: { label: string; value: string; tone?: "warn" | "crit" }) {
  const color = tone === "crit" ? "text-crit" : tone === "warn" ? "text-warn" : "text-ink";
  return (
    <div className="rounded-xl border border-line bg-panel p-4">
      <p className="text-[11px] font-medium uppercase tracking-wide text-faint">{label}</p>
      <p className={`mt-1.5 text-2xl font-semibold tabular-nums ${color}`}>{value}</p>
    </div>
  );
}

function diaHora(iso: string): string {
  const d = new Date(iso).toLocaleDateString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
  });
  return `${d} ${formatTimePt(iso)}`;
}

export default async function StatusPage() {
  let runs: CollectorRun[] = [];
  let sources: Source[] = [];
  let totals = { posts: 0, pendentes: 0, ultimoPost: null as string | null };
  let error: string | null = null;

  try {
    [runs, sources, totals] = await Promise.all([getRuns(), getSources(), getTotals()]);
  } catch (e) {
    error = e instanceof Error ? e.message : "erro desconhecido";
  }

  const ativos = sources.filter((s) => s.ativo);
  const ultima = runs.find((r) => r.finishedAt);
  const horasParado = ultima ? hoursSince(ultima.startedAt) : null;

  return (
    <main className="mx-auto max-w-4xl px-5 py-10 md:px-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Status da coleta</h1>
        <p className="mt-1 text-sm text-muted">
          A coleta roda sozinha no agendamento. Se ficar parada, na volta ela recupera o que
          faltou — cada fonte continua do último post coletado.
        </p>
      </header>

      {error ? (
        <div className="rounded-xl border border-crit/40 bg-crit/10 p-4 text-sm text-crit">
          <p className="font-medium">Não consegui carregar o status.</p>
          <p className="mt-1 text-crit/80">{error}</p>
          <p className="mt-2 text-[12.5px] text-muted">
            Se fala de tabela inexistente, rode <code>supabase/schema.sql</code> no Supabase.
          </p>
        </div>
      ) : (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="Posts coletados" value={totals.posts.toLocaleString("pt-BR")} />
            <Stat
              label="Fila de categorização"
              value={totals.pendentes.toLocaleString("pt-BR")}
              tone={totals.pendentes > 500 ? "warn" : undefined}
            />
            <Stat label="Fontes monitoradas" value={String(ativos.length)} tone={ativos.length === 0 ? "warn" : undefined} />
            <Stat
              label="Última coleta"
              value={ultima ? formatRelativePt(ultima.startedAt) : "nunca"}
              tone={horasParado === null || horasParado > 26 ? "crit" : horasParado > 3 ? "warn" : undefined}
            />
          </div>

          <div className="mb-8 rounded-xl border border-line bg-panel p-4">
            <CollectButton />
          </div>

          <h2 className="mb-3 text-sm font-semibold text-muted">Fontes monitoradas</h2>
          {ativos.length === 0 ? (
            <p className="mb-8 rounded-xl border border-line bg-panel p-5 text-sm text-muted">
              Nenhuma fonte ligada. Rode uma coleta pra descobrir os canais e ligue em{" "}
              <a href="/fontes" className="text-lime underline-offset-2 hover:underline">
                Fontes
              </a>
              .
            </p>
          ) : (
            <section className="mb-8 overflow-x-auto rounded-xl border border-line bg-panel">
              <table className="w-full min-w-[520px] text-[13.5px]">
                <thead>
                  <tr className="border-b border-line text-left text-[11px] uppercase tracking-wide text-faint">
                    <th className="px-4 py-3 font-medium">Canal</th>
                    <th className="px-4 py-3 font-medium">Dono</th>
                    <th className="px-4 py-3 text-right font-medium">Posts</th>
                    <th className="px-4 py-3 text-right font-medium">Coletado</th>
                  </tr>
                </thead>
                <tbody>
                  {ativos.map((s) => (
                    <tr key={s.channelId} className="border-b border-linesoft last:border-0">
                      <td className="px-4 py-2.5">
                        {s.title}
                        {s.lastError && <p className="mt-0.5 text-xs text-crit">{s.lastError}</p>}
                      </td>
                      <td className="px-4 py-2.5 text-muted">{s.dono?.nome ?? "—"}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{s.posts.toLocaleString("pt-BR")}</td>
                      <td className="px-4 py-2.5 text-right text-muted">
                        {s.lastRunAt ? formatRelativePt(s.lastRunAt) : "aguardando"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          <h2 className="mb-3 text-sm font-semibold text-muted">Últimas execuções</h2>
          {runs.length === 0 ? (
            <p className="rounded-xl border border-line bg-panel p-5 text-sm text-muted">Nenhuma execução ainda.</p>
          ) : (
            <section className="overflow-x-auto rounded-xl border border-line bg-panel">
              <table className="w-full min-w-[560px] text-[13px]">
                <thead>
                  <tr className="border-b border-line text-left text-[11px] uppercase tracking-wide text-faint">
                    <th className="px-4 py-3 font-medium">Quando</th>
                    <th className="px-4 py-3 font-medium">Origem</th>
                    <th className="px-4 py-3 text-right font-medium">Novos</th>
                    <th className="px-4 py-3 text-right font-medium">Categorizados</th>
                    <th className="px-4 py-3 font-medium">Resultado</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.map((r) => (
                    <tr key={r.id} className="border-b border-linesoft align-top last:border-0">
                      <td className="whitespace-nowrap px-4 py-2.5">{diaHora(r.startedAt)}</td>
                      <td className="px-4 py-2.5 text-muted">{r.origem ?? "—"}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{r.novos ?? "—"}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{r.categorizados ?? "—"}</td>
                      <td className="px-4 py-2.5">
                        {!r.finishedAt ? (
                          <span className="text-warn">em andamento / interrompida</span>
                        ) : r.ok ? (
                          <span className="text-ok">ok</span>
                        ) : (
                          <span className="text-crit">{r.erro ?? "erro"}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}
        </>
      )}
    </main>
  );
}
