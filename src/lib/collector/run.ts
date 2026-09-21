// "sessions" vem do pacote raiz: o subcaminho telegram/sessions nao resolve
// como pacote externo no Node (quebra o build da Vercel).
import { TelegramClient, sessions } from "telegram";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { categorizePost } from "@/lib/categorize";
import {
  collapseAlbums,
  isContentMessage,
  isOwnerPost,
  toRow,
  type PostRow,
} from "@/lib/collector/map";

const { StringSession } = sessions;

// Coletor: le os canais como uma CONTA DE USUARIO do Telegram (MTProto).
// - Descobre sozinho os canais/grupos em que a conta esta (tabela sources).
// - Pra cada fonte ativa, continua do ultimo post coletado (cursor last_msg_id).
//   Se ficar dias parado, na volta ele recupera o buraco — nada se perde.
// - Roda com prazo (deadline): serve tanto pra rota serverless quanto pro CLI.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;
type Supa = ReturnType<typeof getSupabaseAdmin>;

export type RunOptions = {
  origem: "cron" | "cli" | "manual";
  deadlineMs: number; // orcamento total de tempo desta execucao
  maxPerSource?: number; // teto de mensagens por fonte nesta execucao
  log?: (msg: string) => void;
};

export type RunResult = {
  ok: boolean;
  skipped?: string;
  fontes: number;
  novos: number;
  categorizados: number;
  pendentes: number;
  erros: string[];
};

type SourceRow = {
  channel_id: string;
  title: string | null;
  kind: "channel" | "group";
  ativo: boolean;
  backfill_days: number;
  last_msg_id: number;
};

const CHUNK = 100; // mensagens por pagina do Telegram
const REFRESH_HOURS = 72; // re-le as ultimas 72h pra atualizar views/reacoes
const CATEGORIZE_CONCURRENCY = 4;
const CATEGORIZE_RESERVE_MS = 20_000; // tempo guardado pro fim (gravar o run)

function makeClient(): TelegramClient {
  const apiId = Number(process.env.TG_API_ID);
  const apiHash = process.env.TG_API_HASH;
  const session = process.env.TG_SESSION;
  if (!apiId || !apiHash || !session) {
    throw new Error(
      "Telegram nao configurado. Defina TG_API_ID, TG_API_HASH e TG_SESSION (rode npm run tg:login).",
    );
  }
  const client = new TelegramClient(new StringSession(session), apiId, apiHash, {
    connectionRetries: 3,
    floodSleepThreshold: 30, // espera sozinho flood-wait curto; longo vira erro
  });
  client.setLogLevel("error" as Any);
  return client;
}

// Lista os canais/grupos que a conta enxerga e sincroniza em sources
// (sem mexer em ativo/cursor de quem ja existe). Devolve o mapa id -> entidade.
async function syncDialogs(
  client: TelegramClient,
  supabase: Supa,
): Promise<Map<string, Any>> {
  const dialogs = await client.getDialogs({ limit: 500 });
  const entities = new Map<string, Any>();
  const rows: Record<string, unknown>[] = [];

  for (const d of dialogs as Any[]) {
    const ent = d.entity;
    if (!ent || ent.className !== "Channel") continue; // canal ou supergrupo
    const id = String(d.id);
    entities.set(id, ent);
    rows.push({
      channel_id: id,
      title: ent.title ?? d.title ?? null,
      username: ent.username ?? null,
      kind: ent.megagroup ? "group" : "channel",
      members: typeof ent.participantsCount === "number" ? ent.participantsCount : null,
    });
  }

  if (rows.length > 0) {
    // upsert so das colunas descritivas: ativo / cursor ficam como estao.
    const { error } = await supabase
      .from("sources")
      .upsert(rows, { onConflict: "channel_id" });
    if (error) throw new Error(`sources: ${error.message}`);
  }
  return entities;
}

async function upsertRows(supabase: Supa, rows: PostRow[]) {
  if (rows.length === 0) return;
  const { error } = await supabase
    .from("posts")
    .upsert(rows, { onConflict: "channel_id,telegram_msg_id" });
  if (error) throw new Error(`posts: ${error.message}`);
}

function mapChunk(msgs: Any[], src: SourceRow): PostRow[] {
  const kept = msgs.filter(
    (m) => isContentMessage(m) && isOwnerPost(m, src.kind),
  );
  const rows = kept.map((m) => toRow(m, src.channel_id, src.title));
  return collapseAlbums(kept, rows);
}

// Primeira coleta: acha de qual mensagem comecar (a ultima ANTES da janela
// de historico). Dali pra frente e tudo incremental.
async function startCursor(
  client: TelegramClient,
  entity: Any,
  backfillDays: number,
): Promise<number> {
  const since = Math.floor(Date.now() / 1000) - backfillDays * 86_400;
  const before = await client.getMessages(entity, { limit: 1, offsetDate: since });
  return before.length > 0 ? Number((before[0] as Any).id) : 0;
}

async function collectSource(
  client: TelegramClient,
  supabase: Supa,
  src: SourceRow,
  entity: Any,
  opts: { timeLeft: () => number; maxPerSource: number },
): Promise<number> {
  let cursor = Number(src.last_msg_id) || 0;
  const firstRun = cursor === 0;
  if (firstRun) cursor = await startCursor(client, entity, src.backfill_days);

  let novos = 0;
  let buffer: Any[] = [];

  const flush = async () => {
    if (buffer.length === 0) return;
    const rows = mapChunk(buffer, src);
    await upsertRows(supabase, rows);
    novos += rows.length;
    cursor = Math.max(cursor, ...buffer.map((m) => Number(m.id)));
    buffer = [];
    // Salva o cursor a cada pagina: se o tempo acabar, a proxima execucao
    // continua exatamente daqui.
    await supabase
      .from("sources")
      .update({ last_msg_id: cursor })
      .eq("channel_id", src.channel_id);
  };

  let seen = 0;
  for await (const m of client.iterMessages(entity, {
    reverse: true,
    minId: cursor,
    limit: opts.maxPerSource,
    waitTime: 1,
  })) {
    buffer.push(m);
    seen++;
    if (buffer.length >= CHUNK) {
      await flush();
      if (opts.timeLeft() < CATEGORIZE_RESERVE_MS) break;
    }
  }
  await flush();

  // Atualiza alcance (views/encaminhamentos/reacoes) dos posts recentes —
  // o numero so "assenta" depois de um ou dois dias.
  if (!firstRun && opts.timeLeft() > CATEGORIZE_RESERVE_MS) {
    const limite = Date.now() / 1000 - REFRESH_HOURS * 3600;
    const recentes = (await client.getMessages(entity, { limit: 100 })) as Any[];
    const rows = mapChunk(
      recentes.filter((m) => Number(m.date) >= limite).reverse(),
      src,
    );
    await upsertRows(supabase, rows);
  }

  await supabase
    .from("sources")
    .update({ last_run_at: new Date().toISOString(), last_error: null })
    .eq("channel_id", src.channel_id);

  return seen === 0 ? 0 : novos;
}

// Categoriza (IA) o que estiver pendente, ate o prazo acabar.
async function categorizePending(
  supabase: Supa,
  timeLeft: () => number,
): Promise<number> {
  if (!process.env.ANTHROPIC_API_KEY) return 0;
  let total = 0;

  while (timeLeft() > CATEGORIZE_RESERVE_MS) {
    const { data, error } = await supabase
      .from("posts")
      .select("id,text,media_type")
      .is("categorized_at", null)
      .order("posted_at", { ascending: false })
      .limit(40);
    if (error) throw new Error(`categorize: ${error.message}`);
    const rows =
      (data as { id: number; text: string | null; media_type: string | null }[] | null) ?? [];
    if (rows.length === 0) break;

    let i = 0;
    let okNoLote = 0;
    const worker = async () => {
      while (i < rows.length && timeLeft() > CATEGORIZE_RESERVE_MS) {
        const post = rows[i++];
        try {
          const cat = await categorizePost(post.text, post.media_type);
          await supabase
            .from("posts")
            .update({
              cat_tipo: cat.tipo,
              cat_casa: cat.casa || null,
              cat_modalidade: cat.modalidade || null,
              cat_gatilho: cat.gatilho,
              categorized_at: new Date().toISOString(),
            })
            .eq("id", post.id);
          okNoLote++;
        } catch {
          // falha de IA/rede: o post continua pendente e a proxima rodada pega.
        }
      }
    };
    await Promise.all(Array.from({ length: CATEGORIZE_CONCURRENCY }, worker));
    total += okNoLote;
    if (okNoLote === 0) break; // IA fora do ar: nao fica girando em falso
  }
  return total;
}

export async function runCollector(options: RunOptions): Promise<RunResult> {
  const startedAt = Date.now();
  const timeLeft = () => options.deadlineMs - (Date.now() - startedAt);
  const log = options.log ?? (() => {});
  const supabase = getSupabaseAdmin();
  const erros: string[] = [];

  // Trava: a mesma sessao do Telegram NAO pode conectar em dois lugares ao
  // mesmo tempo (o Telegram derruba a sessao). Se ja tem execucao recente em
  // aberto, esta sai sem fazer nada.
  // Janela da trava: a rota serverless morre em ate 5 min (6 de folga); o CLI
  // da primeira carga pode rodar ~25 min, entao segura o cron por 30.
  const { data: recentes } = await supabase
    .from("collector_runs")
    .select("origem,started_at")
    .is("finished_at", null)
    .gte("started_at", new Date(Date.now() - 30 * 60_000).toISOString());
  const abertas = ((recentes as { origem: string | null; started_at: string }[] | null) ?? []).filter(
    (r) =>
      r.origem === "cli" ||
      Date.now() - new Date(r.started_at).getTime() < 6 * 60_000,
  );
  if (abertas.length > 0) {
    return {
      ok: true,
      skipped: "ja existe uma coleta em andamento",
      fontes: 0,
      novos: 0,
      categorizados: 0,
      pendentes: 0,
      erros,
    };
  }

  const { data: runRow } = await supabase
    .from("collector_runs")
    .insert({ origem: options.origem })
    .select("id")
    .single();
  const runId = (runRow as { id: number } | null)?.id;

  let fontes = 0;
  let novos = 0;
  let categorizados = 0;
  let client: TelegramClient | null = null;

  try {
    client = makeClient();
    await client.connect();
    if (!(await client.checkAuthorization())) {
      throw new Error("Sessao do Telegram invalida ou expirada. Rode npm run tg:login de novo.");
    }

    const entities = await syncDialogs(client, supabase);
    log(`canais/grupos visiveis: ${entities.size}`);

    const { data: ativos, error } = await supabase
      .from("sources")
      .select("channel_id,title,kind,ativo,backfill_days,last_msg_id")
      .eq("ativo", true)
      // quem esta ha mais tempo sem rodar vai primeiro (justo quando o prazo e curto)
      .order("last_run_at", { ascending: true, nullsFirst: true });
    if (error) throw new Error(`sources: ${error.message}`);

    for (const src of (ativos as SourceRow[] | null) ?? []) {
      if (timeLeft() < CATEGORIZE_RESERVE_MS * 2) {
        log("prazo curto: o resto das fontes fica pra proxima execucao");
        break;
      }
      const entity = entities.get(src.channel_id);
      if (!entity) {
        const msg = "a conta nao esta mais neste canal";
        erros.push(`${src.title ?? src.channel_id}: ${msg}`);
        await supabase.from("sources").update({ last_error: msg }).eq("channel_id", src.channel_id);
        continue;
      }
      try {
        const n = await collectSource(client, supabase, src, entity, {
          timeLeft,
          maxPerSource: options.maxPerSource ?? 3000,
        });
        fontes++;
        novos += n;
        log(`${src.title ?? src.channel_id}: ${n} posts`);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        erros.push(`${src.title ?? src.channel_id}: ${msg}`);
        await supabase.from("sources").update({ last_error: msg }).eq("channel_id", src.channel_id);
      }
    }
  } catch (e) {
    erros.push(e instanceof Error ? e.message : String(e));
  } finally {
    // Desconecta ANTES de categorizar: libera a sessao do Telegram o quanto antes.
    if (client) {
      try {
        await client.destroy();
      } catch {
        /* ignora */
      }
    }
  }

  try {
    categorizados = await categorizePending(supabase, timeLeft);
    log(`categorizados: ${categorizados}`);
  } catch (e) {
    erros.push(e instanceof Error ? e.message : String(e));
  }

  const { count: pendentes } = await supabase
    .from("posts")
    .select("*", { count: "exact", head: true })
    .is("categorized_at", null);

  const ok = erros.length === 0;
  if (runId) {
    await supabase
      .from("collector_runs")
      .update({
        finished_at: new Date().toISOString(),
        ok,
        fontes,
        novos,
        categorizados,
        pendentes: pendentes ?? 0,
        erro: erros.length ? erros.join(" | ").slice(0, 2000) : null,
      })
      .eq("id", runId);
  }

  return { ok, fontes, novos, categorizados, pendentes: pendentes ?? 0, erros };
}
