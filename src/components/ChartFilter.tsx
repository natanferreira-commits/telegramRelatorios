"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { type PostChannel } from "@/lib/posts";

type AffiliateOpt = { id: number; nome: string };

const selectClass =
  "rounded-lg border border-line bg-panel2 px-3 py-2 text-sm text-ink outline-none focus:border-lime/60";

export function ChartFilter({
  channels,
  affiliates = [],
}: {
  channels: PostChannel[];
  affiliates?: AffiliateOpt[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const periodo = params.get("periodo") === "semana" ? "semana" : "dia";

  function setParams(updates: Record<string, string>) {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    router.push(`${pathname}?${next.toString()}`, { scroll: false });
  }

  return (
    <div className="mb-5 flex flex-wrap items-center gap-2">
      {affiliates.length > 0 && (
        <select
          value={params.get("afiliado") ?? ""}
          onChange={(e) => setParams({ afiliado: e.target.value, canal: "" })}
          className={selectClass}
        >
          <option value="">Todos os afiliados</option>
          {affiliates.map((a) => (
            <option key={a.id} value={String(a.id)}>
              {a.nome}
            </option>
          ))}
        </select>
      )}

      <select
        value={params.get("canal") ?? ""}
        onChange={(e) => setParams({ canal: e.target.value, afiliado: "", comp: "" })}
        className={selectClass}
      >
        <option value="">Todos os canais</option>
        {channels.map((c) => (
          <option key={c.id} value={c.id}>
            {c.title}
          </option>
        ))}
      </select>

      <div className="inline-flex overflow-hidden rounded-lg border border-line">
        {(["dia", "semana"] as const).map((opt) => (
          <button
            key={opt}
            onClick={() => setParams({ periodo: opt === "dia" ? "" : opt })}
            className={`px-3 py-2 text-sm transition-colors ${
              periodo === opt
                ? "bg-lime/10 text-lime"
                : "text-muted hover:text-ink"
            }`}
          >
            {opt === "dia" ? "Por dia" : "Por semana"}
          </button>
        ))}
      </div>
    </div>
  );
}
