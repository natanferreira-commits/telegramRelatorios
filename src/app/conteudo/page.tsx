import Link from "next/link";
import { getPostChannels, getPostsByDay, type PostItem } from "@/lib/posts";
import { getAffiliateOptions, type AffiliateOption } from "@/lib/affiliates";
import { getContentBuckets, type Bucket } from "@/lib/analytics";
import {
  OBJETIVO_OF,
  OBJETIVO_ORDER,
  OBJETIVO_LABEL,
  OBJETIVO_COLOR,
  TIPO_LABEL,
  GATILHO_LABEL,
} from "@/lib/taxonomy";
import { ChartFilter } from "@/components/ChartFilter";
import { CompareSelector } from "@/components/CompareSelector";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Conteúdo · Radar de Conteúdo",
};

type SP = Promise<{ [k: string]: string | string[] | undefined }>;

function str(v: string | string[] | undefined): string | undefined {
  return typeof v === "string" && v ? v : undefined;
}

type CompItem = {
  key: string;
  label: string;
  color: string;
  n: number;
  pct: number;
  tipos: { tipo: string; n: number }[];
};

function compositionOf(buckets: Bucket[]): { total: number; composition: CompItem[] } {
  const tipoTotals: Record<string, number> = {};
  for (const b of buckets)
    for (const [t, n] of Object.entries(b.byTipo))
      tipoTotals[t] = (tipoTotals[t] ?? 0) + n;
  const total = Object.values(tipoTotals).reduce((s, n) => s + n, 0);

  const composition = OBJETIVO_ORDER.map((o) => {
    const tipos = Object.entries(tipoTotals)
      .filter(([t]) => (OBJETIVO_OF[t] ?? "outro") === o)
      .map(([tipo, n]) => ({ tipo, n }))
      .sort((a, b) => b.n - a.n);
    const n = tipos.reduce((s, t) => s + t.n, 0);
    return {
      key: o,
      label: OBJETIVO_LABEL[o],
      color: OBJETIVO_COLOR[o],
      n,
      pct: total ? Math.round((n / total) * 100) : 0,
      tipos,
    };
  }).filter((c) => c.n > 0);

  return { total, composition };
}

/* ---------- componentes de gráfico ---------- */
function Composicao({ composition, showTipos = true }: { composition: CompItem[]; showTipos?: boolean }) {
  return (
    <div className="flex flex-col gap-4">
      {composition.map((c) => (
        <div key={c.key}>
          <div className="mb-1.5 flex items-baseline gap-2">
            <span className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: c.color }} />
            <span className="text-[13px] font-medium">{c.label}</span>
            <span className="ml-auto text-[13px] tabular-nums">
              <b className="font-semibold">{c.pct}%</b>
              <span className="ml-1.5 text-muted">{c.n}</span>
            </span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-[5px] bg-raise">
            <div className="h-full rounded-[5px]" style={{ width: `${Math.max(2, c.pct)}%`, background: c.color }} />
          </div>
          {showTipos && c.tipos.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 pl-[18px] text-[11.5px] text-faint">
              {c.tipos.map((t) => (
                <span key={t.tipo}>
                  {TIPO_LABEL[t.tipo] ?? t.tipo}
                  <span className="ml-1 tabular-nums text-muted">{t.n}</span>
                </span>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function TimelineObjetivo({
  buckets,
  bucket,
  hrefDia,
  diaAtivo,
}: {
  buckets: Bucket[];
  bucket: "day" | "week";
  hrefDia?: (key: string) => string;
  diaAtivo?: string;
}) {
  const H = 190;
  const timeline = buckets.map((b) => {
    const byObj: Record<string, number> = {};
    for (const [t, n] of Object.entries(b.byTipo)) {
      const o = OBJETIVO_OF[t] ?? "outro";
      byObj[o] = (byObj[o] ?? 0) + n;
    }
    return { key: b.key, label: b.label, total: b.total, byObj };
  });
  const maxCol = Math.max(1, ...timeline.map((t) => Object.values(t.byObj).reduce((s, n) => s + n, 0)));
  const presentes = OBJETIVO_ORDER.filter((o) => timeline.some((t) => (t.byObj[o] ?? 0) > 0));

  return (
    <section className="rounded-2xl border border-line bg-panel p-5">
      <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-faint">
        Volume no tempo · por {bucket === "day" ? "dia" : "semana"}
      </div>
      <p className="mb-4 text-[12.5px] text-muted">
        Quanto foi postado e de que objetivo, ao longo do período.
        {hrefDia && " Clique num dia pra ler o que foi postado."}
      </p>
      <div className="mb-4 flex flex-wrap gap-x-4 gap-y-1.5 text-[12px]">
        {presentes.map((o) => (
          <span key={o} className="inline-flex items-center gap-1.5 text-muted">
            <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: OBJETIVO_COLOR[o] }} />
            {OBJETIVO_LABEL[o]}
          </span>
        ))}
      </div>
      <div className="flex items-end gap-1.5" style={{ height: H + 22 }}>
        {timeline.map((col) => {
          const ativo = diaAtivo === col.key;
          const barras = (
            <>
              <div className="flex w-full flex-col-reverse gap-[2px]" style={{ height: H }}>
                {OBJETIVO_ORDER.filter((o) => (col.byObj[o] ?? 0) > 0).map((o) => (
                  <div
                    key={o}
                    className="w-full rounded-[2px]"
                    style={{ height: `${((col.byObj[o] ?? 0) / maxCol) * H}px`, background: OBJETIVO_COLOR[o] }}
                    title={`${OBJETIVO_LABEL[o]}: ${col.byObj[o]}`}
                  />
                ))}
              </div>
              <span className={`text-[10px] ${ativo ? "font-semibold text-lime" : "text-faint"}`}>
                {col.label}
              </span>
            </>
          );

          if (!hrefDia) {
            return (
              <div key={col.key} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
                {barras}
              </div>
            );
          }
          return (
            <Link
              key={col.key}
              href={hrefDia(col.key)}
              scroll={false}
              title={`${col.total} posts — ver o que foi postado`}
              className={`flex min-w-0 flex-1 flex-col items-center gap-1.5 rounded-[3px] pt-1 transition-colors hover:bg-raise ${
                ativo ? "bg-lime/10" : ""
              }`}
            >
              {barras}
            </Link>
          );
        })}
      </div>
    </section>
  );
}

/* ---------- histórico: o que foi postado num dia ---------- */
function horaSP(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const MEDIA_LABEL: Record<string, string> = {
  text: "texto",
  photo: "imagem",
  video: "vídeo",
  video_note: "vídeo bolinha",
  animation: "gif",
  voice: "áudio",
  audio: "áudio",
  document: "arquivo",
  poll: "enquete",
};

function PostsDoDia({
  posts,
  dia,
  escopo,
  hrefLimpar,
  multiCanal,
}: {
  posts: PostItem[];
  dia: string;
  escopo: string;
  hrefLimpar: string;
  multiCanal: boolean;
}) {
  const dataBR = dia.split("-").reverse().join("/");
  return (
    <section className="overflow-hidden rounded-2xl border border-lime/30 bg-panel">
      <div className="flex flex-wrap items-baseline gap-2 border-b border-linesoft px-5 py-4">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-lime">
            O que foi postado
          </div>
          <h2 className="mt-0.5 text-[15px] font-semibold">
            {dataBR} · {escopo}
          </h2>
        </div>
        <span className="text-[12px] text-faint">
          {posts.length} {posts.length === 1 ? "post" : "posts"}
        </span>
        <Link
          href={hrefLimpar}
          scroll={false}
          className="ml-auto text-[12.5px] text-muted transition-colors hover:text-ink"
        >
          fechar
        </Link>
      </div>

      {posts.length === 0 ? (
        <p className="px-5 py-8 text-center text-[13px] text-muted">
          Nenhum post nesse dia.
        </p>
      ) : (
        <ul className="divide-y divide-linesoft">
          {posts.map((p) => {
            const obj = OBJETIVO_OF[p.tipo ?? "outro"] ?? "outro";
            return (
              <li key={p.id} className="flex gap-3 px-5 py-3.5">
                <div className="flex w-11 shrink-0 flex-col items-center gap-1.5 pt-0.5">
                  <span className="text-[11.5px] tabular-nums text-faint">
                    {horaSP(p.postedAt)}
                  </span>
                  <span
                    className="h-2.5 w-2.5 rounded-[3px]"
                    style={{ background: OBJETIVO_COLOR[obj] }}
                    title={OBJETIVO_LABEL[obj]}
                  />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex flex-wrap items-center gap-1.5 text-[11px]">
                    <span className="rounded-full border border-line px-1.5 py-0.5 font-medium text-muted">
                      {TIPO_LABEL[p.tipo ?? "outro"] ?? p.tipo}
                    </span>
                    {p.mediaType && p.mediaType !== "text" && (
                      <span className="rounded-full border border-line px-1.5 py-0.5 text-faint">
                        {MEDIA_LABEL[p.mediaType] ?? p.mediaType}
                      </span>
                    )}
                    {p.temLink && (
                      <span className="rounded-full border border-line px-1.5 py-0.5 text-faint">
                        link
                      </span>
                    )}
                    {p.casa && (
                      <span className="rounded-full border border-line px-1.5 py-0.5 text-faint">
                        {p.casa}
                      </span>
                    )}
                    {p.gatilho && p.gatilho !== "nenhum" && (
                      <span className="rounded-full border border-line px-1.5 py-0.5 text-faint">
                        {GATILHO_LABEL[p.gatilho] ?? p.gatilho}
                      </span>
                    )}
                    {multiCanal && p.channelTitle && (
                      <span className="text-faint">· {p.channelTitle}</span>
                    )}
                  </div>
                  {p.text ? (
                    <p className="whitespace-pre-wrap break-words text-[13px] leading-relaxed text-ink">
                      {p.text}
                    </p>
                  ) : (
                    <p className="text-[13px] italic text-faint">
                      (sem texto — só {MEDIA_LABEL[p.mediaType ?? ""] ?? "mídia"})
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export default async function ConteudoPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const bucket = sp.periodo === "semana" ? "week" : "day";
  const canal = str(sp.canal);
  const compIds = (str(sp.comp) ?? "").split(",").filter(Boolean);
  const windowDays = bucket === "day" ? 14 : 56;

  let channels: Awaited<ReturnType<typeof getPostChannels>> = [];
  let affiliates: AffiliateOption[] = [];
  let error: string | null = null;

  try {
    [channels, affiliates] = await Promise.all([
      getPostChannels(),
      getAffiliateOptions().catch(() => [] as AffiliateOption[]),
    ]);
  } catch (e) {
    error = e instanceof Error ? e.message : "erro desconhecido";
  }

  const selectedAffs = compIds
    .map((id) => affiliates.find((a) => String(a.id) === id))
    .filter((a): a is AffiliateOption => Boolean(a));
  const compareMode = selectedAffs.length >= 2;

  // Busca a agregação por escopo (no banco).
  type Panel = { aff: AffiliateOption; total: number; composition: CompItem[]; semCanal: boolean };
  type Single = {
    buckets: Bucket[];
    total: number;
    composition: CompItem[];
    escopo: string;
    semCanal: boolean;
    channelIds?: string[];
  };
  let panels: Panel[] = [];
  let single: Single | null = null;

  if (!error) {
    try {
      if (compareMode) {
        panels = await Promise.all(
          selectedAffs.map(async (aff) => {
            const semCanal = aff.channelIds.length === 0;
            const buckets = semCanal ? [] : await getContentBuckets(bucket, aff.channelIds);
            const { total, composition } = compositionOf(buckets);
            return { aff, total, composition, semCanal };
          }),
        );
      } else {
        const s = selectedAffs[0];
        let channelIds: string[] | undefined;
        let escopo: string;
        let semCanal = false;
        if (s) {
          escopo = s.nome;
          semCanal = s.channelIds.length === 0;
          channelIds = s.channelIds;
        } else if (canal) {
          channelIds = [canal];
          escopo = channels.find((c) => c.id === canal)?.title ?? canal;
        } else {
          channelIds = undefined;
          escopo = "todos os canais";
        }
        const buckets = semCanal ? [] : await getContentBuckets(bucket, channelIds);
        const { total, composition } = compositionOf(buckets);
        single = { buckets, total, composition, escopo, semCanal, channelIds };
      }
    } catch (e) {
      error = e instanceof Error ? e.message : "erro desconhecido";
    }
  }

  // ---- drill-down: o que foi postado num dia ----
  // Só faz sentido no modo dia (a barra é um dia) e fora da comparação.
  const diaSel =
    bucket === "day" && !compareMode && /^\d{4}-\d{2}-\d{2}$/.test(str(sp.dia) ?? "")
      ? (str(sp.dia) as string)
      : null;

  let postsDoDia: PostItem[] = [];
  if (diaSel && single && !single.semCanal) {
    try {
      postsDoDia = await getPostsByDay({ channelIds: single.channelIds, day: diaSel });
    } catch {
      postsDoDia = [];
    }
  }

  // preserva os filtros ao montar os links do drill-down
  const baseParams = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (k !== "dia" && typeof v === "string" && v) baseParams.set(k, v);
  }
  const hrefDia = (key: string) => {
    const p = new URLSearchParams(baseParams);
    p.set("dia", key);
    return `?${p.toString()}`;
  };
  const hrefLimpar = `?${baseParams.toString()}`;

  return (
    <main className="mx-auto max-w-3xl px-5 py-10 md:px-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Conteúdo</h1>
        <p className="mt-1 text-sm text-muted">
          {compareMode
            ? "Comparando a assinatura de conteúdo dos afiliados, frente a frente"
            : "O que cada afiliado posta — por objetivo"}
        </p>
      </header>

      <CompareSelector affiliates={affiliates.map((a) => ({ id: a.id, nome: a.nome }))} />
      {!compareMode && <ChartFilter channels={channels} />}

      {error ? (
        <div className="rounded-xl border border-crit/40 bg-crit/10 p-4 text-sm text-crit">
          <p className="font-medium">Erro ao carregar.</p>
          <p className="mt-1 text-crit/80">{error}</p>
          <p className="mt-2 text-[12.5px] text-muted">
            Se a mensagem fala de função ou tabela inexistente, rode{" "}
            <code>supabase/schema.sql</code> no Supabase.
          </p>
        </div>
      ) : compareMode ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {panels.map(({ aff, total, composition, semCanal }) => {
            const perDay = Math.round(total / windowDays);
            return (
              <section key={aff.id} className="rounded-2xl border border-line bg-panel p-5">
                <div className="mb-4 flex items-baseline justify-between border-b border-linesoft pb-3">
                  <h2 className="text-[15px] font-semibold">{aff.nome}</h2>
                  <span className="text-[12px] text-muted">
                    <b className="tabular-nums text-ink">{total}</b> posts · ~{perDay}/dia
                  </span>
                </div>
                {semCanal ? (
                  <p className="py-8 text-center text-[12.5px] text-muted">Sem canal vinculado. Vincule em Afiliados.</p>
                ) : total === 0 ? (
                  <p className="py-8 text-center text-[12.5px] text-muted">Sem posts no período.</p>
                ) : (
                  <Composicao composition={composition} showTipos={false} />
                )}
              </section>
            );
          })}
        </div>
      ) : single && single.semCanal ? (
        <div className="rounded-2xl border border-dashed border-line bg-panel/40 p-12 text-center">
          <div className="text-3xl">🔗</div>
          <div className="mt-4 font-medium">{single.escopo} não tem canal vinculado</div>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted">
            Vincule o canal do Telegram desse afiliado em <b>Afiliados</b> pra ver o conteúdo dele.
          </p>
        </div>
      ) : single && single.total === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-panel/40 p-12 text-center">
          <div className="text-3xl">📊</div>
          <div className="mt-4 font-medium">Sem dados no período</div>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted">
            Quando os canais postarem (e forem categorizados), o conteúdo aparece aqui.
          </p>
        </div>
      ) : single ? (
        <div className="flex flex-col gap-4">
          <section className="rounded-2xl border border-line bg-panel p-5">
            <div className="mb-1 flex items-baseline justify-between">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-faint">
                Composição por objetivo · {single.escopo}
              </div>
              <div className="text-[12px] text-muted">
                <b className="tabular-nums text-ink">{single.total}</b> posts
              </div>
            </div>
            <p className="mb-4 text-[12.5px] text-muted">
              O equilíbrio do canal: quanto é aposta, resultado, captação e relacionamento.
            </p>
            <Composicao composition={single.composition} />
          </section>
          <TimelineObjetivo
            buckets={single.buckets}
            bucket={bucket}
            hrefDia={bucket === "day" ? hrefDia : undefined}
            diaAtivo={diaSel ?? undefined}
          />
          {diaSel && (
            <PostsDoDia
              posts={postsDoDia}
              dia={diaSel}
              escopo={single.escopo}
              hrefLimpar={hrefLimpar}
              multiCanal={(single.channelIds?.length ?? 0) !== 1}
            />
          )}
        </div>
      ) : null}
    </main>
  );
}
