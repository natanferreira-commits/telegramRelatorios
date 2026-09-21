// Roda o coletor pela linha de comando (sem limite de tempo de serverless).
// Bom pra PRIMEIRA carga, que puxa semanas de historico:
//   npm run collect
//
// ATENCAO: nao rode ao mesmo tempo que o agendamento da Vercel — a mesma
// sessao do Telegram conectada em dois lugares e derrubada pelo Telegram.
// (O coletor tem uma trava, mas evite mesmo assim.)

try {
  process.loadEnvFile(".env.local");
} catch {
  // sem .env.local: usa as variaveis do ambiente
}

async function main() {
  const { runCollector } = await import("../src/lib/collector/run");
  const minutos = Number(process.argv[2]) || 25;
  console.log(`Coletando (ate ${minutos} min)...`);
  const r = await runCollector({
    origem: "cli",
    deadlineMs: minutos * 60_000,
    maxPerSource: 20_000,
    log: (m) => console.log("  " + m),
  });
  console.log(JSON.stringify(r, null, 2));
  process.exit(r.ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
