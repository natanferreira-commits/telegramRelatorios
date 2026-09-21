// Cor fixa por afiliado, pra bater o olho e saber de quem e a conversa.
// Evita verde/amarelo/vermelho (essas cores significam SLA).
// As classes precisam ser literais pro Tailwind detectar, por isso a tabela fixa.
const PALETTE = [
  { chip: "bg-violet-500/15 text-violet-300", avatar: "bg-violet-500/20 text-violet-200", bar: "bg-violet-500" },
  { chip: "bg-blue-500/15 text-blue-300", avatar: "bg-blue-500/20 text-blue-200", bar: "bg-blue-500" },
  { chip: "bg-sky-500/15 text-sky-300", avatar: "bg-sky-500/20 text-sky-200", bar: "bg-sky-500" },
  { chip: "bg-cyan-500/15 text-cyan-300", avatar: "bg-cyan-500/20 text-cyan-200", bar: "bg-cyan-500" },
  { chip: "bg-teal-500/15 text-teal-300", avatar: "bg-teal-500/20 text-teal-200", bar: "bg-teal-500" },
  { chip: "bg-fuchsia-500/15 text-fuchsia-300", avatar: "bg-fuchsia-500/20 text-fuchsia-200", bar: "bg-fuchsia-500" },
  { chip: "bg-indigo-500/15 text-indigo-300", avatar: "bg-indigo-500/20 text-indigo-200", bar: "bg-indigo-500" },
  { chip: "bg-pink-500/15 text-pink-300", avatar: "bg-pink-500/20 text-pink-200", bar: "bg-pink-500" },
];

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

export function affiliateColors(key: string) {
  return PALETTE[hash(key) % PALETTE.length];
}

// Limpa prefixos comuns ("Suporte X" -> "X") pra ficar o nome do afiliado.
export function affiliateLabel(
  botName: string | null,
  botId: string | null,
): string {
  const raw = botName ?? botId ?? "Canal";
  const cleaned = raw.replace(/^(suporte|atendimento)\s+/i, "").trim();
  return cleaned || raw;
}
