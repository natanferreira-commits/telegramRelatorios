import {
  type Bucket,
  TIPOS_ORDER,
  TIPO_LABEL,
  CATEGORY_COLOR,
} from "@/lib/analytics";

// Grafico de barras empilhadas por categoria. Server component (estatico).
export function StackedBars({
  buckets,
  maxTotal,
  height = 160,
  showLabels = true,
}: {
  buckets: Bucket[];
  maxTotal: number;
  height?: number;
  showLabels?: boolean;
}) {
  const safeMax = Math.max(1, maxTotal);

  return (
    <div className="flex items-end gap-1">
      {buckets.map((b) => (
        <div key={b.key} className="flex min-w-0 flex-1 flex-col items-center gap-1">
          <div
            className="flex w-full flex-col-reverse overflow-hidden rounded-sm"
            style={{ height }}
          >
            {b.total === 0 && (
              <div className="h-px w-full bg-neutral-800" aria-hidden />
            )}
            {TIPOS_ORDER.map((tp) => {
              const c = b.byTipo[tp] ?? 0;
              if (!c) return null;
              return (
                <div
                  key={tp}
                  className={CATEGORY_COLOR[tp]}
                  style={{ height: (c / safeMax) * height }}
                  title={`${TIPO_LABEL[tp]}: ${c}`}
                />
              );
            })}
          </div>
          {showLabels && (
            <div className="text-[9px] tabular-nums text-neutral-500">
              {b.label}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export function CategoryLegend({ tipos }: { tipos: string[] }) {
  const ordered = TIPOS_ORDER.filter((t) => tipos.includes(t));
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-neutral-400">
      {ordered.map((t) => (
        <span key={t} className="inline-flex items-center gap-1.5">
          <span className={`h-2.5 w-2.5 rounded-sm ${CATEGORY_COLOR[t]}`} />
          {TIPO_LABEL[t] ?? t}
        </span>
      ))}
    </div>
  );
}
