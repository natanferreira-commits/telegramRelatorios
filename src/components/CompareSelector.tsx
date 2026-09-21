"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

type Opt = { id: number; nome: string };

export function CompareSelector({ affiliates }: { affiliates: Opt[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const sel = new Set((params.get("comp") ?? "").split(",").filter(Boolean));

  function push(next: Set<string>) {
    const p = new URLSearchParams(params.toString());
    p.delete("canal");
    if (next.size) p.set("comp", [...next].join(","));
    else p.delete("comp");
    router.push(`${pathname}?${p.toString()}`, { scroll: false });
  }

  function toggle(id: string) {
    const n = new Set(sel);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    push(n);
  }

  if (affiliates.length === 0) return null;

  return (
    <div className="mb-4">
      <div className="mb-2 flex items-center gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-faint">
          Afiliados
        </span>
        {sel.size >= 2 && (
          <span className="text-[11px] font-medium text-lime">
            comparando {sel.size}
          </span>
        )}
        {sel.size > 0 && (
          <button
            onClick={() => push(new Set())}
            className="ml-auto text-[12px] text-muted transition-colors hover:text-ink"
          >
            limpar
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {affiliates.map((a) => {
          const on = sel.has(String(a.id));
          return (
            <button
              key={a.id}
              onClick={() => toggle(String(a.id))}
              className={`rounded-full border px-3 py-1.5 text-[12.5px] transition-colors ${
                on
                  ? "border-lime/50 bg-lime/10 text-ink"
                  : "border-line bg-panel text-muted hover:border-[#33413a] hover:text-ink"
              }`}
            >
              {a.nome}
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-[11.5px] text-faint">
        Selecione 1 pra ver o afiliado, ou 2+ pra comparar frente a frente.
      </p>
    </div>
  );
}
