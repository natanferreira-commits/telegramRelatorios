import { getSources, type Source } from "@/lib/sources";
import { SourcesManager } from "@/components/SourcesManager";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Fontes · Radar de Conteúdo",
};

export default async function FontesPage() {
  let sources: Source[] = [];
  let error: string | null = null;
  try {
    sources = await getSources();
  } catch (e) {
    error = e instanceof Error ? e.message : "erro desconhecido";
  }

  const ativos = sources.filter((s) => s.ativo).length;

  return (
    <main className="mx-auto max-w-3xl px-5 py-10 md:px-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Fontes</h1>
        <p className="mt-1 text-sm text-muted">
          Todo canal ou grupo em que a conta do Telegram entra aparece aqui sozinho, na próxima
          coleta. Ligue os que quer monitorar e diga de quem é — nosso ou concorrente.
        </p>
        {!error && (
          <p className="mt-2 text-xs text-faint">
            {sources.length} visíveis · {ativos} monitorando
          </p>
        )}
      </header>

      {error ? (
        <div className="rounded-xl border border-crit/40 bg-crit/10 p-4 text-sm text-crit">
          <p className="font-medium">Não consegui carregar as fontes.</p>
          <p className="mt-1 text-crit/80">{error}</p>
          <p className="mt-2 text-[12.5px] text-muted">
            Se a mensagem fala de tabela ou função inexistente, rode <code>supabase/schema.sql</code>{" "}
            no SQL Editor do Supabase.
          </p>
        </div>
      ) : sources.length === 0 ? (
        <div className="rounded-xl border border-line bg-panel p-6 text-sm text-muted">
          <p className="font-medium text-ink">Nenhum canal ainda.</p>
          <p className="mt-1">
            Entre nos canais com o número dedicado e rode uma coleta em{" "}
            <a href="/status" className="text-lime underline-offset-2 hover:underline">
              Status
            </a>
            . Os canais aparecem aqui em seguida.
          </p>
        </div>
      ) : (
        <SourcesManager sources={sources} />
      )}
    </main>
  );
}
