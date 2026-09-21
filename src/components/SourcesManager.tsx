"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { type Source } from "@/lib/sources";

async function patchSource(body: Record<string, unknown>): Promise<string | null> {
  const res = await fetch("/api/sources", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (res.ok) return null;
  const j = (await res.json().catch(() => null)) as { error?: string } | null;
  return j?.error ?? `erro ${res.status}`;
}

function SourceRow({ source }: { source: Source }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [dono, setDono] = useState(source.dono?.nome ?? "");
  const [grupo, setGrupo] = useState(source.dono?.grupo ?? "proprio");
  const [dias, setDias] = useState(String(source.backfillDays));

  const save = (body: Record<string, unknown>) =>
    start(async () => {
      setError(await patchSource({ channel_id: source.channelId, ...body }));
      router.refresh();
    });

  const donoMudou = dono.trim() !== (source.dono?.nome ?? "") || grupo !== (source.dono?.grupo ?? "proprio");
  const jaColetou = source.lastMsgId > 0;

  return (
    <li className={`rounded-xl border bg-panel p-4 ${source.ativo ? "border-lime/30" : "border-line"}`}>
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14.5px] font-semibold">{source.title}</p>
          <p className="mt-0.5 text-xs text-faint">
            {source.kind === "group" ? "Grupo" : "Canal"}
            {source.username ? ` · @${source.username}` : " · privado"}
            {source.members ? ` · ${source.members.toLocaleString("pt-BR")} membros` : ""}
            {` · ${source.posts.toLocaleString("pt-BR")} posts coletados`}
          </p>
        </div>
        <button
          type="button"
          disabled={pending}
          onClick={() => save({ ativo: !source.ativo })}
          className={`rounded-lg px-3.5 py-2 text-[13px] font-semibold transition-colors disabled:opacity-50 ${
            source.ativo
              ? "bg-lime text-[#06120c] hover:bg-lime/90"
              : "border border-line text-muted hover:bg-raise hover:text-ink"
          }`}
        >
          {source.ativo ? "Monitorando" : "Monitorar"}
        </button>
      </div>

      <div className="mt-3.5 flex flex-wrap items-end gap-2.5 border-t border-linesoft pt-3.5">
        <label className="flex min-w-[180px] flex-1 flex-col gap-1 text-[11px] font-medium uppercase tracking-wide text-faint">
          Dono do canal
          <input
            list="donos"
            value={dono}
            onChange={(e) => setDono(e.target.value)}
            placeholder="ex: Mateus Caumo"
            className="rounded-lg border border-line bg-ground px-3 py-2 text-[13.5px] font-normal normal-case tracking-normal text-ink outline-none placeholder:text-faint focus:border-lime/60"
          />
        </label>
        <label className="flex flex-col gap-1 text-[11px] font-medium uppercase tracking-wide text-faint">
          Tipo
          <select
            value={grupo}
            onChange={(e) => setGrupo(e.target.value)}
            className="rounded-lg border border-line bg-ground px-3 py-2 text-[13.5px] font-normal normal-case tracking-normal text-ink outline-none focus:border-lime/60"
          >
            <option value="proprio">Nosso</option>
            <option value="concorrente">Concorrente</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-[11px] font-medium uppercase tracking-wide text-faint">
          Histórico (dias)
          <input
            type="number"
            min={1}
            max={365}
            value={dias}
            disabled={jaColetou}
            onChange={(e) => setDias(e.target.value)}
            onBlur={() => {
              if (!jaColetou && Number(dias) !== source.backfillDays) save({ backfill_days: Number(dias) });
            }}
            title={jaColetou ? "Já coletado: o histórico inicial não muda mais" : "Quantos dias pra trás puxar na primeira coleta"}
            className="w-24 rounded-lg border border-line bg-ground px-3 py-2 text-[13.5px] font-normal text-ink outline-none focus:border-lime/60 disabled:opacity-50"
          />
        </label>
        <button
          type="button"
          disabled={pending || !donoMudou}
          onClick={() => save({ dono: dono.trim() || null, grupo })}
          className="rounded-lg border border-line px-3.5 py-2 text-[13px] font-semibold text-ink transition-colors hover:bg-raise disabled:opacity-40"
        >
          Salvar dono
        </button>
      </div>

      {(error || source.lastError) && (
        <p className="mt-3 text-xs text-crit">{error ?? `Última coleta: ${source.lastError}`}</p>
      )}
    </li>
  );
}

export function SourcesManager({ sources }: { sources: Source[] }) {
  const [q, setQ] = useState("");
  const donos = [...new Set(sources.map((s) => s.dono?.nome).filter((n): n is string => Boolean(n)))].sort();
  const termo = q.trim().toLowerCase();
  const visiveis = termo
    ? sources.filter(
        (s) =>
          s.title.toLowerCase().includes(termo) ||
          (s.username ?? "").toLowerCase().includes(termo) ||
          (s.dono?.nome ?? "").toLowerCase().includes(termo),
      )
    : sources;

  return (
    <>
      <datalist id="donos">
        {donos.map((d) => (
          <option key={d} value={d} />
        ))}
      </datalist>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Buscar canal, @ ou dono…"
        className="mb-4 w-full rounded-lg border border-line bg-panel px-3.5 py-2.5 text-sm text-ink outline-none placeholder:text-faint focus:border-lime/60"
      />
      <ul className="space-y-3">
        {visiveis.map((s) => (
          <SourceRow key={s.channelId} source={s} />
        ))}
      </ul>
      {visiveis.length === 0 && (
        <p className="rounded-xl border border-line bg-panel p-6 text-center text-sm text-muted">
          Nenhum canal encontrado.
        </p>
      )}
    </>
  );
}
