// Taxonomia de conteudo do Modulo A. Fonte unica de verdade.
// A classificacao gira em torno do OBJETIVO do post (o que ele quer fazer),
// nao do formato. Formato (video/imagem/link) e atributo a parte, detectado
// direto do Telegram (ver lib/format.ts), sem IA.

// Tipos de conteudo (o que a IA classifica). Mantenha em sincronia com o
// prompt em lib/categorize.ts.
export const TIPOS = [
  "tip",
  "analise",
  "green",
  "red",
  "reembolso",
  "cadastro",
  "promo",
  "enquete",
  "interacao",
  "motivacional",
  "outro",
] as const;
export type Tipo = (typeof TIPOS)[number];

export const TIPO_LABEL: Record<string, string> = {
  tip: "tip",
  analise: "análise",
  green: "green",
  red: "red",
  reembolso: "reembolso",
  cadastro: "cadastro (CTA)",
  promo: "promo/bônus",
  enquete: "enquete",
  interacao: "interação",
  motivacional: "motivacional",
  outro: "outro",
};

// Ordem de empilhamento no grafico (de baixo pra cima), agrupada por objetivo
// pra leitura ficar coerente.
export const TIPOS_ORDER = [
  "tip",
  "analise",
  "green",
  "red",
  "reembolso",
  "cadastro",
  "promo",
  "enquete",
  "interacao",
  "motivacional",
  "outro",
] as const;

// Cor por tipo (classes literais pro Tailwind detectar). Cores proximas dentro
// do mesmo objetivo pra a barra "ler" o grupo de relance.
export const CATEGORY_COLOR: Record<string, string> = {
  tip: "bg-sky-500",
  analise: "bg-indigo-500",
  green: "bg-emerald-500",
  red: "bg-rose-500",
  reembolso: "bg-amber-500",
  cadastro: "bg-orange-500",
  promo: "bg-yellow-500",
  enquete: "bg-violet-500",
  interacao: "bg-blue-500",
  motivacional: "bg-pink-500",
  outro: "bg-neutral-500",
};

// Objetivos: agrupamento de leitura. Cada tipo cai em um objetivo.
export const OBJETIVOS = [
  { key: "aposta", label: "Aposta", tipos: ["tip", "analise"] },
  { key: "resultado", label: "Resultado", tipos: ["green", "red", "reembolso"] },
  { key: "captacao", label: "Captação", tipos: ["cadastro", "promo"] },
  {
    key: "relacionamento",
    label: "Relacionamento",
    tipos: ["enquete", "interacao", "motivacional"],
  },
  { key: "outro", label: "Outro", tipos: ["outro"] },
] as const;

// Mapa tipo -> objetivo, derivado de OBJETIVOS.
export const OBJETIVO_OF: Record<string, string> = Object.fromEntries(
  OBJETIVOS.flatMap((o) => o.tipos.map((t) => [t, o.key])),
);

export const GATILHOS = [
  "urgencia",
  "autoridade",
  "escassez",
  "proximidade",
  "nenhum",
] as const;

export const GATILHO_LABEL: Record<string, string> = {
  urgencia: "urgência",
  autoridade: "autoridade",
  escassez: "escassez",
  proximidade: "proximidade",
};

// Ordem, rótulo e cor por objetivo (fold dos 11 tipos em 5 grupos legíveis).
// Paleta categórica validada (colorblind-safe) pro fundo escuro do cockpit.
export const OBJETIVO_ORDER = [
  "aposta",
  "resultado",
  "captacao",
  "relacionamento",
  "outro",
] as const;

export const OBJETIVO_LABEL: Record<string, string> = {
  aposta: "Aposta",
  resultado: "Resultado",
  captacao: "Captação",
  relacionamento: "Relacionamento",
  outro: "Outro",
};

export const OBJETIVO_COLOR: Record<string, string> = {
  aposta: "#3f86c9",
  resultado: "#3fa084",
  captacao: "#cf7636",
  relacionamento: "#9560c0",
  outro: "#8a938e",
};
