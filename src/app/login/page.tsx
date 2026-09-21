export const metadata = {
  title: "Entrar · Radar de Conteúdo",
};

type SP = Promise<{ [k: string]: string | string[] | undefined }>;

export default async function LoginPage({
  searchParams,
}: {
  searchParams: SP;
}) {
  const sp = await searchParams;
  const hasError = sp.error === "1";
  const next = typeof sp.next === "string" ? sp.next : "/";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ground px-4">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-gradient-to-b from-lime/10 to-transparent" />

      <div className="relative w-full max-w-sm">
        <div className="mb-6 flex items-center justify-center gap-2.5">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-lime">
            <svg
              viewBox="0 0 24 24"
              className="h-5 w-5"
              fill="none"
              stroke="#06120c"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 7h18M3 7l1.5 12a2 2 0 0 0 2 1.7h11a2 2 0 0 0 2-1.7L21 7M9 7V5a3 3 0 0 1 6 0v2" />
            </svg>
          </div>
          <span className="text-lg font-bold tracking-tight text-ink">
            Radar <span className="text-lime">de Conteúdo</span>
          </span>
        </div>

        <form
          action="/api/login"
          method="post"
          className="rounded-2xl border border-line bg-panel p-6"
        >
          <input type="hidden" name="next" value={next} />
          <label className="mb-2 block text-sm text-muted">Senha</label>
          <input
            type="password"
            name="password"
            autoFocus
            placeholder="Senha de acesso"
            className="w-full rounded-lg border border-line bg-panel2 px-3 py-2.5 text-sm text-ink outline-none placeholder:text-faint focus:border-lime/60"
          />

          {hasError && (
            <p className="mt-3 text-sm text-crit">
              Senha incorreta. Tenta de novo.
            </p>
          )}

          <button
            type="submit"
            className="mt-4 w-full rounded-lg bg-lime px-3 py-2.5 text-sm font-semibold text-[#06120c] transition-opacity hover:opacity-90"
          >
            Entrar
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-faint">
          Acesso restrito ao time do Arena
        </p>
      </div>
    </div>
  );
}
