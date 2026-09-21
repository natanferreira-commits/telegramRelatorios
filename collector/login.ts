// Login UNICO da conta do Telegram que vai ler os canais. Gera a TG_SESSION.
//   npm run tg:login
//
// Use um NUMERO DEDICADO da operacao (chip so pra isso) — nunca a conta pessoal
// de ninguem: a sessao gerada da acesso total a essa conta.
//
// Antes: crie api_id / api_hash em https://my.telegram.org (API development tools)
// logado com esse mesmo numero.

import { createInterface } from "node:readline/promises";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
// "sessions" vem do pacote raiz: o subcaminho telegram/sessions nao resolve
// como pacote externo no Node (quebra o build da Vercel).
import { TelegramClient, sessions } from "telegram";

const { StringSession } = sessions;

try {
  process.loadEnvFile(".env.local");
} catch {
  /* sem .env.local ainda */
}

const rl = createInterface({ input: process.stdin, output: process.stdout });
const ask = async (q: string) => (await rl.question(q)).trim();

function saveEnv(values: Record<string, string>) {
  const file = ".env.local";
  let lines = existsSync(file) ? readFileSync(file, "utf8").split(/\r?\n/) : [];
  for (const [k, v] of Object.entries(values)) {
    lines = lines.filter((l) => !l.startsWith(`${k}=`));
    lines.push(`${k}=${v}`);
  }
  writeFileSync(file, lines.filter((l, i, a) => l || i < a.length - 1).join("\n") + "\n");
}

async function main() {
  const apiId = Number(process.env.TG_API_ID || (await ask("api_id: ")));
  const apiHash = process.env.TG_API_HASH || (await ask("api_hash: "));
  if (!apiId || !apiHash) throw new Error("api_id e api_hash sao obrigatorios");

  const client = new TelegramClient(new StringSession(""), apiId, apiHash, {
    connectionRetries: 3,
  });

  await client.start({
    phoneNumber: () => ask("Numero com DDI (ex: +5511999999999): "),
    phoneCode: () => ask("Codigo que chegou no Telegram/SMS: "),
    password: () => ask("Senha de duas etapas (se tiver; senao Enter): "),
    onError: (e) => console.error("Erro:", e.message),
  });

  const session = String(client.session.save());
  const me = await client.getMe();
  await client.destroy();
  rl.close();

  saveEnv({ TG_API_ID: String(apiId), TG_API_HASH: apiHash, TG_SESSION: session });

  console.log("\nLogado como:", (me as { firstName?: string }).firstName ?? "(sem nome)");
  console.log("Salvei TG_API_ID, TG_API_HASH e TG_SESSION no .env.local.");
  console.log("\nAgora cole as MESMAS tres variaveis na Vercel (Settings > Environment Variables).");
  console.log("A TG_SESSION esta no .env.local — trate como senha: nunca commite, nunca mande em chat.");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
