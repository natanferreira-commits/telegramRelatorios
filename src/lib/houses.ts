// Pra onde um link aponta. Sem IA: so olha o dominio.
// "casa" = casa de apostas (link de afiliado); o resto e rede social, site
// proprio ou outro destino.

export type DestinoTipo = "casa" | "social" | "proprio" | "outro";
export type Destino = { label: string; tipo: DestinoTipo };

// Ordem importa: o primeiro padrao que casar com o dominio vence.
// Pra adicionar uma casa nova, basta uma linha aqui.
const CASAS: [RegExp, string][] = [
  [/betwarrior/, "BetWarrior"],
  [/betmgm/, "BetMGM"],
  [/esportiva/, "Esportiva"],
  [/superbet/, "Superbet"],
  [/novibet/, "Novibet"],
  [/bet365/, "bet365"],
  [/betano/, "Betano"],
  [/sportingbet/, "Sportingbet"],
  [/betfair/, "Betfair"],
  [/estrelabet/, "EstrelaBet"],
  [/betnacional/, "Betnacional"],
  [/pixbet/, "Pixbet"],
  [/vaidebet/, "VaideBet"],
  [/kto\./, "KTO"],
  [/stake/, "Stake"],
  [/f12/, "F12"],
  [/mcgames/, "MC Games"],
  [/h2bet|h2\.bet/, "H2bet"],
  [/br4bet|br4\.bet/, "BR4Bet"],
  [/multibet/, "MultiBet"],
  [/lotogreen/, "Lotogreen"],
  [/bateubet|bateu\.bet/, "BateuBet"],
  [/casadeapostas/, "Casa de Apostas"],
  [/betsson/, "Betsson"],
  [/rivalo/, "Rivalo"],
  [/luva\.bet|luvabet/, "Luva Bet"],
  [/7k\.bet|7kbet/, "7K"],
  [/betspeed/, "BetSpeed"],
];

const SOCIAL: [RegExp, string][] = [
  [/^t\.me$|telegram\./, "Telegram"],
  [/wa\.me|wa\.link|whatsapp\./, "WhatsApp"],
  [/instagram\./, "Instagram"],
  [/tiktok\./, "TikTok"],
  [/youtube\.|youtu\.be/, "YouTube"],
  [/twitter\.|^x\.com$/, "X"],
  [/facebook\.|fb\.me/, "Facebook"],
];

// Sites proprios dos afiliados (bolao, stats, linkbio...).
const PROPRIO = /caumo|cabreloa|goldorayo|rennan|vitorzz|elbarba|grupodupla|duplaaposta/;

export function hostOf(url: string): string | null {
  try {
    const u = new URL(/^https?:/i.test(url) ? url : `https://${url}`);
    return u.hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

export function destinoOf(url: string): Destino | null {
  const host = hostOf(url);
  if (!host) return null;
  for (const [re, label] of CASAS) if (re.test(host)) return { label, tipo: "casa" };
  for (const [re, label] of SOCIAL) if (re.test(host)) return { label, tipo: "social" };
  if (PROPRIO.test(host)) return { label: host, tipo: "proprio" };
  // Dominio .bet desconhecido: e casa, so nao esta na lista ainda.
  if (/\.bet(\.br)?$/.test(host)) return { label: host, tipo: "casa" };
  return { label: host, tipo: "outro" };
}
