import Link from "next/link";
import { FORMATO_LABEL, formatoOf, type RPost } from "@/lib/report";

// Pecas visuais dos relatorios. Tudo server component: tooltip e o `title`
// nativo, filtro e formulario GET — a tela funciona sem JS no cliente.
//
// Cores de serie (validadas pra daltonismo contra o fundo do painel):
//   A / principal = bg-seriea (verde)   B / base = bg-serieb (violeta)
// Texto nunca veste a cor da serie: o quadradinho ao lado carrega a identidade.

export const fmt = (n: number | null | undefined) =>
  n === null || n === undefined ? "—" : n.toLocaleString("pt-BR");

export function Delta({ a, b }: { a: number | null; b: number | null }) {
  if (a === null || b === null) return <span className="text-faint">—</span>;
  if (b === 0) return <span className="text-faint">{a === 0 ? "=" : "novo"}</span>;
  const pct = Math.round(((a - b) / b) * 100);
  if (pct === 0) return <span className="text-muted">=</span>;
  return (
    <span className="whitespace-nowrap font-semibold tabular-nums text-ink">
      <span aria-hidden className="mr-0.5 text-muted">{pct > 0 ? "▲" : "▼"}</span>
      {pct > 0 ? "+" : "−"}
      {Math.abs(pct)}%
    </span>
  );
}

export function Card({ title, hint, children, className = "" }: {
  title?: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-xl border border-line bg-panel p-4 md:p-5 ${className}`}>
      {title && (
        <header className="mb-4 flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
          <h2 className="text-[13.5px] font-semibold">{title}</h2>
          {hint && <p className="text-xs text-faint">{hint}</p>}
        </header>
      )}
      {children}
    </section>
  );
}

export function Legend({ items }: { items: { label: string; className: string }[] }) {
  return (
    <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
      {items.map((i) => (
        <span key={i.label} className="inline-flex items-center gap-1.5">
          <span className={`h-2.5 w-2.5 rounded-[3px] ${i.className}`} />
          {i.label}
        </span>
      ))}
    </div>
  );
}

// Numero de destaque. Com `b`, mostra a base e a variacao embaixo.
export function StatTile({ label, a, b, hint }: {
  label: string;
  a: number | null;
  b?: number | null;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-line bg-panel p-4">
      <p className="text-[11px] font-medium uppercase tracking-wide text-faint">{label}</p>
      <p className="mt-1.5 text-[26px] font-semibold leading-none tabular-nums">{fmt(a)}</p>
      {b !== undefined ? (
        <p className="mt-2 flex items-center gap-2 text-xs text-muted">
          <span className="tabular-nums">B: {fmt(b)}</span>
          <Delta a={a} b={b ?? null} />
        </p>
      ) : (
        hint && <p className="mt-2 text-xs text-faint">{hint}</p>
      )}
    </div>
  );
}

const BAR_H = 132;

// Colunas por dia. Uma serie (so `a`) ou duas lado a lado (`a` e `b`).
// Um eixo so: medidas de escala diferente vao em graficos separados.
export function DayBars({ a, b, labels, labelsB, hrefs, activeIndex, unit }: {
  a: (number | null)[];
  b?: (number | null)[];
  labels: string[];
  labelsB?: string[];
  hrefs?: (string | undefined)[];
  activeIndex?: number;
  unit: string;
}) {
  const max = Math.max(1, ...a.map((v) => v ?? 0), ...(b ?? []).map((v) => v ?? 0));
  const n = Math.max(a.length, b?.length ?? 0);
  const dense = n > 16;
  // Periodo longo: colunas finas pra caber sem rolagem horizontal.
  const colMin = dense ? "min-w-[5px]" : "min-w-[18px]";
  const gap = dense ? "gap-[3px]" : "gap-1.5";
  const h = (v: number | null) => (v ? Math.max(3, Math.round((v / max) * BAR_H)) : 0);

  return (
    <div className="overflow-x-auto">
      <div className={`flex min-w-full items-end ${gap} border-b border-line pb-0`} style={{ height: BAR_H + 22 }}>
        {Array.from({ length: n }, (_, i) => {
          const va = a[i] ?? null;
          const vb = b ? (b[i] ?? null) : null;
          const tip = b
            ? `A · ${labels[i] ?? "—"}: ${fmt(va)} ${unit}\nB · ${labelsB?.[i] ?? "—"}: ${fmt(vb)} ${unit}`
            : `${labels[i]}: ${fmt(va)} ${unit}`;
          const col = (
            <div className={`flex h-full ${colMin} flex-1 flex-col items-center justify-end gap-1`} title={tip}>
              {!dense && (
                <span className="whitespace-nowrap text-[10.5px] tabular-nums text-muted">
                  {va === null ? "" : fmt(va)}
                  {b && vb !== null && <span className="text-faint"> · {fmt(vb)}</span>}
                </span>
              )}
              <div className="flex w-full items-end justify-center gap-[2px]">
                <div
                  className={`w-full max-w-[22px] rounded-t-[4px] bg-seriea ${activeIndex === i ? "outline outline-2 outline-offset-2 outline-lime" : ""}`}
                  style={{ height: h(va) }}
                />
                {b && <div className="w-full max-w-[22px] rounded-t-[4px] bg-serieb" style={{ height: h(vb) }} />}
              </div>
            </div>
          );
          const href = hrefs?.[i];
          return href ? (
            <Link key={i} href={href} scroll={false} className={`flex h-full ${colMin} flex-1 rounded-t-md hover:bg-raise`}>
              {col}
            </Link>
          ) : (
            <div key={i} className={`flex h-full ${colMin} flex-1`}>{col}</div>
          );
        })}
      </div>
      <div className={`flex min-w-full ${gap} pt-1.5`}>
        {Array.from({ length: n }, (_, i) => (
          <span key={i} className={`${colMin} flex-1 overflow-hidden text-center text-[10px] text-faint`}>
            {dense ? (i % 2 === 0 ? (labels[i] ?? "").slice(-5, -3) : "") : (labels[i] ?? "")}
          </span>
        ))}
      </div>
    </div>
  );
}

// Ranking com barra embutida. Com `b`, vira comparativo A x B por linha.
export function RankTable({ rows, headA = "Posts", headB, empty }: {
  rows: { nome: string; a: number; b?: number }[];
  headA?: string;
  headB?: string;
  empty: string;
}) {
  if (rows.length === 0) return <p className="text-sm text-muted">{empty}</p>;
  const max = Math.max(1, ...rows.map((r) => Math.max(r.a, r.b ?? 0)));
  const two = headB !== undefined;
  return (
    <table className="w-full text-[13px]">
      <thead>
        <tr className="text-left text-[11px] uppercase tracking-wide text-faint">
          <th className="pb-2 font-medium">Destino</th>
          <th className="pb-2 pl-3 font-medium" colSpan={2}>{headA}</th>
          {two && <th className="pb-2 pl-3 font-medium" colSpan={2}>{headB}</th>}
          {two && <th className="pb-2 pl-3 text-right font-medium">A vs B</th>}
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.nome} className="border-t border-linesoft">
            <td className="max-w-[180px] truncate py-2 pr-2" title={r.nome}>{r.nome}</td>
            <td className="w-10 py-2 pl-3 text-right font-semibold tabular-nums">{r.a}</td>
            <td className="w-[28%] py-2 pl-2">
              <div className="h-2 rounded-r-[4px] bg-seriea" style={{ width: `${(r.a / max) * 100}%`, minWidth: r.a ? 3 : 0 }} />
            </td>
            {two && <td className="w-10 py-2 pl-3 text-right tabular-nums text-muted">{r.b ?? 0}</td>}
            {two && (
              <td className="w-[28%] py-2 pl-2">
                <div className="h-2 rounded-r-[4px] bg-serieb" style={{ width: `${((r.b ?? 0) / max) * 100}%`, minWidth: r.b ? 3 : 0 }} />
              </td>
            )}
            {two && <td className="py-2 pl-3 text-right"><Delta a={r.a} b={r.b ?? 0} /></td>}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const TIPO_CHIP: Record<string, string> = {
  casa: "border-seriea/50 text-ink",
  social: "border-line text-muted",
  proprio: "border-line text-muted",
  outro: "border-line text-faint",
};

export function PostCard({ post, showChannel = false }: { post: RPost; showChannel?: boolean }) {
  const hora = new Date(post.postedAt).toLocaleTimeString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
  });
  const formato = formatoOf(post.mediaType);
  return (
    <article className="rounded-lg border border-linesoft bg-panel2 p-3">
      <div className="mb-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11.5px] text-faint">
        <span className="font-mono text-muted">{hora}</span>
        {formato !== "texto" && <span className="rounded border border-line px-1.5 py-px">{FORMATO_LABEL[formato]}</span>}
        {post.destinos.map((d) => (
          <span key={d.label} className={`rounded border px-1.5 py-px ${TIPO_CHIP[d.tipo]}`}>
            {d.tipo === "casa" && <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-seriea align-middle" />}
            {d.label}
          </span>
        ))}
        <span className="ml-auto tabular-nums" title="Visualizações">
          {post.views === null ? "" : `${fmt(post.views)} views`}
        </span>
      </div>
      {showChannel && post.channelTitle && <p className="mb-1 text-[11px] text-faint">{post.channelTitle}</p>}
      <p className="line-clamp-4 whitespace-pre-line text-[13px] leading-snug text-ink/90">
        {post.text ?? <span className="text-faint">(sem texto — só mídia)</span>}
      </p>
    </article>
  );
}
