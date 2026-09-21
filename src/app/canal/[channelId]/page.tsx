import Link from "next/link";
import { getPosts, type PostItem } from "@/lib/posts";
import { affiliateColors, affiliateLabel } from "@/lib/affiliate";
import { initials, formatDayPt, formatTimePt } from "@/lib/time";
import { TIPO_LABEL, TIPOS_ORDER, CATEGORY_COLOR } from "@/lib/taxonomy";

export const dynamic = "force-dynamic";

type SP = Promise<{ [k: string]: string | string[] | undefined }>;

function str(v: string | string[] | undefined): string | undefined {
  return typeof v === "string" && v ? v : undefined;
}

const MEDIA_LABEL: Record<string, string> = {
  photo: "foto",
  video: "vídeo",
  video_note: "vídeo bolinha",
  animation: "gif",
  voice: "áudio",
  audio: "áudio",
  document: "arquivo",
  poll: "enquete",
};

export default async function CanalPage({
  params,
  searchParams,
}: {
  params: Promise<{ channelId: string }>;
  searchParams: SP;
}) {
  const { channelId } = await params;
  const sp = await searchParams;
  const tipo = str(sp.tipo);

  let all: PostItem[] = [];
  let error: string | null = null;
  try {
    all = await getPosts({ channelId });
  } catch (e) {
    error = e instanceof Error ? e.message : "erro desconhecido";
  }

  const channelTitle = all[0]?.channelTitle ?? channelId;
  const aff = affiliateLabel(channelTitle, channelId);
  const color = affiliateColors(channelId);

  // Categorias presentes nesse canal (pra os filtros).
  const tiposPresentes = TIPOS_ORDER.filter((t) =>
    all.some((p) => p.tipo === t),
  );

  const shown = tipo ? all.filter((p) => p.tipo === tipo) : all;

  // Agrupa por dia (mais recente primeiro; all ja vem desc).
  const groups: { day: string; items: PostItem[] }[] = [];
  for (const p of shown) {
    const day = formatDayPt(p.postedAt);
    let g = groups[groups.length - 1];
    if (!g || g.day !== day) {
      g = { day, items: [] };
      groups.push(g);
    }
    g.items.push(p);
  }

  const chipBase =
    "rounded-full px-3 py-1 text-xs font-medium transition-colors";

  return (
    <main className="mx-auto max-w-3xl px-5 py-8 md:px-8">
      <Link
        href="/perfis"
        className="mb-5 inline-flex items-center gap-1.5 text-sm text-neutral-400 transition-colors hover:text-neutral-200"
      >
        <svg
          viewBox="0 0 24 24"
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="m15 18-6-6 6-6" />
        </svg>
        Voltar para os perfis
      </Link>

      <header className="mb-5 flex items-center gap-3">
        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-medium ${color.avatar}`}
        >
          {initials(aff)}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-semibold tracking-tight">
            {aff}
          </h1>
          <p className="text-xs text-neutral-500">
            {all.length} posts mapeados · réplica das postagens
          </p>
        </div>
      </header>

      {tiposPresentes.length > 0 && (
        <div className="mb-5 flex flex-wrap items-center gap-2">
          <Link
            href={`/canal/${encodeURIComponent(channelId)}`}
            className={`${chipBase} ${
              !tipo
                ? "bg-violet-500/15 text-violet-200"
                : "border border-neutral-800 text-neutral-400 hover:text-neutral-200"
            }`}
          >
            Tudo
          </Link>
          {tiposPresentes.map((t) => (
            <Link
              key={t}
              href={`/canal/${encodeURIComponent(channelId)}?tipo=${t}`}
              className={`${chipBase} inline-flex items-center gap-1.5 ${
                tipo === t
                  ? "bg-violet-500/15 text-violet-200"
                  : "border border-neutral-800 text-neutral-400 hover:text-neutral-200"
              }`}
            >
              <span className={`h-2 w-2 rounded-sm ${CATEGORY_COLOR[t]}`} />
              {TIPO_LABEL[t] ?? t}
            </Link>
          ))}
        </div>
      )}

      {error ? (
        <div className="rounded-xl border border-red-900/60 bg-red-950/40 p-4 text-sm text-red-300">
          Erro ao carregar: {error}
        </div>
      ) : shown.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-neutral-800 bg-neutral-900/30 p-12 text-center text-sm text-neutral-500">
          Nenhum post {tipo ? `da categoria "${TIPO_LABEL[tipo] ?? tipo}"` : ""}{" "}
          nesse canal.
        </div>
      ) : (
        groups.map((g) => (
          <section key={g.day} className="mb-6">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-neutral-500">
              {g.day}
            </h2>
            <ul className="space-y-2.5">
              {g.items.map((p) => {
                const media = p.mediaType
                  ? MEDIA_LABEL[p.mediaType]
                  : undefined;
                return (
                  <li
                    key={p.id}
                    className="rounded-xl border border-neutral-800/80 bg-neutral-900/50 p-4"
                  >
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        {p.tipo && (
                          <span className="inline-flex items-center gap-1.5 rounded-md bg-neutral-800 px-1.5 py-0.5 text-xs font-medium text-neutral-200">
                            <span
                              className={`h-2 w-2 rounded-sm ${CATEGORY_COLOR[p.tipo] ?? "bg-neutral-500"}`}
                            />
                            {TIPO_LABEL[p.tipo] ?? p.tipo}
                          </span>
                        )}
                        {media && (
                          <span className="rounded-md border border-neutral-700 px-1.5 py-0.5 text-xs text-neutral-400">
                            {media}
                          </span>
                        )}
                        {p.temLink && (
                          <span className="text-xs text-neutral-500">
                            · com link
                          </span>
                        )}
                      </div>
                      <span className="shrink-0 text-xs text-neutral-500">
                        {formatTimePt(p.postedAt)}
                      </span>
                    </div>
                    <p className="whitespace-pre-wrap text-sm text-neutral-200">
                      {p.text ?? (
                        <span className="text-neutral-500">
                          {media ? `[${media} sem legenda]` : "[sem texto]"}
                        </span>
                      )}
                    </p>
                  </li>
                );
              })}
            </ul>
          </section>
        ))
      )}
    </main>
  );
}
