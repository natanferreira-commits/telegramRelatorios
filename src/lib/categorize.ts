import Anthropic from "@anthropic-ai/sdk";
import { TIPOS, GATILHOS } from "@/lib/taxonomy";

// Modelo barato e rapido pra classificacao em volume.
const MODEL = "claude-haiku-4-5";

// So o sentido do post depende da IA (tipo/casa/modalidade/gatilho).
// Formato e link sao detectados sem IA (ver lib/format.ts).
export type PostCategory = {
  tipo: string;
  casa: string; // "" se nenhuma
  modalidade: string; // "" se nenhuma
  gatilho: string;
};

let cached: Anthropic | null = null;
function getClient(): Anthropic {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY nao configurada");
  // timeout curto por chamada + 1 retry: uma chamada travada falha rapido em
  // vez de comer o orcamento de tempo do backfill (a rota tem deadline propria).
  if (!cached) cached = new Anthropic({ apiKey: key, timeout: 15000, maxRetries: 1 });
  return cached;
}

const SYSTEM = `Voce classifica posts de canais de Telegram de afiliados de apostas (tipsters).
A classificacao gira em torno do OBJETIVO do post: o que o afiliado esta tentando fazer ali.

Devolva um objeto JSON com EXATAMENTE estas chaves:

- "tipo": um de [${TIPOS.join(", ")}]
   tip = da a entrada/palpite pronto pra apostar ("entra no over 2.5", "back no time X").
   analise = leitura ou estatistica de um jogo SEM dar o palpite mastigado (deixa o apostador decidir).
   green = comemora resultado que deu certo, print de ganho, "bateu", "green".
   red = assume a perda, post sobre ter perdido ("foi red hoje"), desabafo de derrota.
   reembolso = acao de devolver a aposta em caso de red (incentivo de CPA): avisa, explica ou abre o reembolso.
   cadastro = chamada explicita pra se cadastrar / abrir conta numa casa (CTA de registro).
   promo = bonus ou promocao de uma casa (oferta), sem ser necessariamente um pedido de cadastro.
   enquete = pergunta ou votacao pra engajar (inclui poll do Telegram).
   interacao = conversa, pergunta aberta, bom dia, papo com a audiencia (sem ser enquete).
   motivacional = mentalidade, lifestyle, conexao pessoal, frase de motivacao.
   outro = nao se encaixa em nenhum dos anteriores.
- "casa": nome da casa de apostas mencionada, ou "" se nenhuma.
- "modalidade": esporte/modalidade (ex: futebol, basquete, cassino), ou "" se nao der pra saber.
- "gatilho": um de [${GATILHOS.join(", ")}] (gatilho mental predominante; "nenhum" se nao houver).

Diferencas que importam:
- tip x analise: tip ENTREGA o palpite; analise so mostra os numeros/leitura.
- red x reembolso: red so assume a perda; reembolso e a ACAO de devolver o valor por causa do red.
- cadastro x promo: cadastro pede pra registrar; promo divulga uma oferta/bonus da casa.

Responda APENAS com o JSON, sem markdown, sem texto antes ou depois.`;

function clean(text: string): string {
  return text
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();
}

function pick<T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: T,
): T {
  return typeof value === "string" &&
    (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

export async function categorizePost(
  text: string | null,
  mediaType: string | null,
): Promise<PostCategory> {
  const client = getClient();
  const resp = await client.messages.create({
    model: MODEL,
    max_tokens: 300,
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: `Tipo de midia: ${mediaType ?? "texto"}\n\nTexto do post:\n${text || "(post sem texto, so midia)"}`,
      },
    ],
  });

  const block = resp.content.find((b) => b.type === "text");
  const raw = block && block.type === "text" ? block.text : "{}";

  let parsed: Record<string, unknown> = {};
  try {
    parsed = JSON.parse(clean(raw));
  } catch {
    parsed = {};
  }

  return {
    tipo: pick(parsed.tipo, TIPOS, "outro"),
    casa: typeof parsed.casa === "string" ? parsed.casa : "",
    modalidade: typeof parsed.modalidade === "string" ? parsed.modalidade : "",
    gatilho: pick(parsed.gatilho, GATILHOS, "nenhum"),
  };
}
