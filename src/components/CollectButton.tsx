"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Result = {
  ok?: boolean;
  skipped?: string;
  error?: string;
  fontes?: number;
  novos?: number;
  categorizados?: number;
  pendentes?: number;
  erros?: string[];
};

export function CollectButton() {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [msg, setMsg] = useState<{ text: string; bad: boolean } | null>(null);

  async function run() {
    setRunning(true);
    setMsg(null);
    try {
      const res = await fetch("/api/collect", { method: "POST" });
      const r = (await res.json().catch(() => ({}))) as Result;
      if (r.skipped) setMsg({ text: r.skipped, bad: false });
      else if (r.error) setMsg({ text: r.error, bad: true });
      else {
        const base = `${r.novos ?? 0} posts de ${r.fontes ?? 0} fontes · ${r.categorizados ?? 0} categorizados · ${r.pendentes ?? 0} na fila`;
        setMsg({
          text: r.erros?.length ? `${base} — ${r.erros.join(" | ")}` : base,
          bad: Boolean(r.erros?.length),
        });
      }
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : "falha na chamada", bad: true });
    } finally {
      setRunning(false);
      router.refresh();
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={run}
        disabled={running}
        className="rounded-lg bg-lime px-4 py-2 text-[13px] font-semibold text-[#06120c] transition-colors hover:bg-lime/90 disabled:opacity-60"
      >
        {running ? "Coletando… (até 4 min)" : "Coletar agora"}
      </button>
      {msg && <p className={`text-[13px] ${msg.bad ? "text-crit" : "text-muted"}`}>{msg.text}</p>}
    </div>
  );
}
