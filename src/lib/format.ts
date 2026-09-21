// Deteccao de formato e link direto do payload do Telegram. Sem IA: ou o
// campo existe ou nao existe, entao e 100% confiavel, instantaneo e de graca.
// Usado na ingestao (api/telegram) e no backfill (api/categorize).

type Msg = Record<string, unknown>;

// "video_note" e o video bolinha do Telegram (sinaliza humanizacao).
export function mediaTypeOf(msg: Msg): string {
  if (msg.video_note) return "video_note";
  if (msg.photo) return "photo";
  if (msg.video) return "video";
  if (msg.animation) return "animation";
  if (msg.voice) return "voice";
  if (msg.audio) return "audio";
  if (msg.document) return "document";
  if (msg.poll) return "poll";
  if (msg.text) return "text";
  return "outro";
}

type Entity = { type?: string };

// Tem link? Olha as entidades marcadas pelo Telegram (pega ate link escondido
// em "text_link") e, como rede, um regex no texto pra dominios soltos.
export function hasLinkOf(msg: Msg): boolean {
  const entities = [
    ...((msg.entities as Entity[]) ?? []),
    ...((msg.caption_entities as Entity[]) ?? []),
  ];
  if (entities.some((e) => e?.type === "url" || e?.type === "text_link")) {
    return true;
  }
  const text = ((msg.text as string) ?? (msg.caption as string) ?? "") || "";
  return /https?:\/\/|t\.me\/|wa\.me\/|\b[a-z0-9-]+\.(com|net|bet|io|app|link|me|gg|vip)\b/i.test(
    text,
  );
}

// Extrai o post (de canal, ou a edicao dele) de um update do Telegram.
export function postFromUpdate(update: Msg): Msg | null {
  const p = (update.channel_post ?? update.edited_channel_post) as
    | Msg
    | undefined;
  return p ?? null;
}

// Conta um post como video (inclui o video bolinha).
export function isVideo(mediaType: string | null): boolean {
  return mediaType === "video" || mediaType === "video_note";
}

export function isImage(mediaType: string | null): boolean {
  return mediaType === "photo" || mediaType === "animation";
}
