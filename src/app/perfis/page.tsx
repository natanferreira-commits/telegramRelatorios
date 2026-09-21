import Link from "next/link";
import { getAffiliateProfiles, type AffiliateProfile } from "@/lib/profiles";
import { getTimelines, type Bucket } from "@/lib/analytics";
import { affiliateColors, affiliateLabel } from "@/lib/affiliate";
import { initials } from "@/lib/time";
import { TIPO_LABEL, GATILHO_LABEL } from "@/lib/taxonomy";
import { StackedBars } from "@/components/StackedBars";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Perfis · Radar de Conteúdo",
};

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900/40 px-3 py-2">
      <div className="text-sm font-medium tabular-nums text-neutral-100">
        {value}
      </div>
      <div className="text-[11px] text-neutral-500">{label}</div>
    </div>
  );
}

function ProfileCard({
  p,
  buckets,
  maxBucket,
}: {
  p: AffiliateProfile;
  buckets: Bucket[] | null;
  maxBucket: number;
}) {
  const aff = affiliateLabel(p.channelTitle, p.channelId);
  const color = affiliateColors(p.channelId);

  return (
    <section className="rounded-2xl border border-neutral-800/80 bg-neutral-900/40 p-5">
      <Link
        href={`/canal/${encodeURIComponent(p.channelId)}`}
        className="group mb-4 flex items-center gap-3"
      >
        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-medium ${color.avatar}`}
        >
          {initials(aff)}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-lg font-semibold transition-colors group-hover:text-violet-200">
            {aff}
          </h2>
          <p className="text-xs text-neutral-500">
            {p.total} posts mapeados · ver postagens
          </p>
        </div>
        <svg
          viewBox="0 0 24 24"
          className="h-4 w-4 shrink-0 text-neutral-600 transition-colors group-hover:text-neutral-300"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="m9 18 6-6-6-6" />
        </svg>
      </Link>

      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="posts/dia" value={String(p.postsPerDay)} />
        <Stat
          label="pico"
          value={
            p.peakHour !== null
              ? `${String(p.peakHour).padStart(2, "0")}h`
              : "—"
          }
        />
        <Stat label="com link" value={`${p.linkPct}%`} />
        <Stat
          label="gatilho top"
          value={
            p.topGatilho
              ? (GATILHO_LABEL[p.topGatilho] ?? p.topGatilho)
              : "—"
          }
        />
      </div>

      {/* Formato: contagem direta do Telegram, sem IA. */}
      <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-neutral-400">
        <span>
          <span className="tabular-nums text-neutral-200">{p.videos}</span> vídeos
        </span>
        <span>
          <span className="tabular-nums text-neutral-200">{p.imagens}</span> imagens
        </span>
        <span>
          <span className="tabular-nums text-neutral-200">{p.links}</span> links
        </span>
      </div>

      {buckets && (
        <div className="mb-4">
          <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
            Volume (últimos 14 dias)
          </div>
          <StackedBars
            buckets={buckets}
            maxTotal={maxBucket}
            height={48}
            showLabels={false}
          />
        </div>
      )}

      <div className="space-y-1.5">
        <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
          Assinatura de conteúdo
        </div>
        {p.tipos.map((t) => (
          <Link
            key={t.tipo}
            href={`/canal/${encodeURIComponent(p.channelId)}?tipo=${t.tipo}`}
            className="group flex items-center gap-3"
          >
            <div className="w-28 shrink-0 truncate text-xs text-neutral-400 transition-colors group-hover:text-neutral-100">
              {TIPO_LABEL[t.tipo] ?? t.tipo}
            </div>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-neutral-800">
              <div
                className={`h-full rounded-full ${color.bar}`}
                style={{ width: `${Math.max(3, t.pct)}%` }}
              />
            </div>
            <div className="w-10 shrink-0 text-right text-xs tabular-nums text-neutral-400">
              {t.pct}%
            </div>
          </Link>
        ))}
      </div>

      {p.topCasa && (
        <div className="mt-4 text-xs text-neutral-500">
          Casa mais citada:{" "}
          <span className="text-neutral-300">{p.topCasa}</span>
        </div>
      )}
    </section>
  );
}

export default async function PerfisPage() {
  let profiles: AffiliateProfile[] = [];
  let timelines: Awaited<ReturnType<typeof getTimelines>> | null = null;
  let error: string | null = null;
  try {
    [profiles, timelines] = await Promise.all([
      getAffiliateProfiles(),
      getTimelines("day"),
    ]);
  } catch (e) {
    error = e instanceof Error ? e.message : "erro desconhecido";
  }

  const bucketsById = new Map(
    (timelines?.channels ?? []).map((c) => [c.channelId, c.buckets]),
  );
  const maxBucket = timelines?.maxChannelBucket ?? 1;

  return (
    <main className="mx-auto max-w-3xl px-5 py-10 md:px-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">
          Perfis dos afiliados
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          Volume no tempo e assinatura de conteúdo de cada canal, lado a lado
        </p>
      </header>

      {error && (
        <div className="rounded-xl border border-red-900/60 bg-red-950/40 p-4 text-sm text-red-300">
          Erro ao carregar: {error}
        </div>
      )}

      {!error && profiles.length === 0 && (
        <div className="rounded-2xl border border-dashed border-neutral-800 bg-neutral-900/30 p-12 text-center">
          <div className="text-3xl">📊</div>
          <div className="mt-4 font-medium">Sem perfis ainda</div>
          <p className="mx-auto mt-1 max-w-md text-sm text-neutral-500">
            Os perfis aparecem assim que houver posts categorizados nos canais.
          </p>
        </div>
      )}

      {!error && profiles.length > 0 && (
        <div className="space-y-4">
          {profiles.map((p) => (
            <ProfileCard
              key={p.channelId}
              p={p}
              buckets={bucketsById.get(p.channelId) ?? null}
              maxBucket={maxBucket}
            />
          ))}
        </div>
      )}
    </main>
  );
}
