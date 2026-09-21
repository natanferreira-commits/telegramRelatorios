// Converte uma mensagem do Telegram (MTProto / GramJS) na linha da tabela posts.
// Tudo aqui e deterministico (sem IA): formato, link, alcance.

// Tipagem frouxa de proposito: os objetos do GramJS mudam de forma entre
// camadas da API, entao a gente le so os campos que precisa, com defesa.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

export type PostRow = {
  channel_id: string;
  channel_title: string | null;
  telegram_msg_id: number;
  text: string | null;
  media_type: string;
  has_link: boolean;
  album_size: number | null;
  views: number | null;
  forwards: number | null;
  reactions: number | null;
  posted_at: string;
  raw_payload: Record<string, unknown>;
};

const LINK_RE =
  /https?:\/\/|t\.me\/|wa\.me\/|\b[a-z0-9-]+\.(com|net|bet|io|app|link|me|gg|vip)\b/i;

function mediaTypeOf(msg: Any): string {
  const media = msg.media;
  if (!media) return "text";
  const cls: string = media.className ?? "";
  if (cls === "MessageMediaPhoto") return "photo";
  if (cls === "MessageMediaPoll") return "poll";
  if (cls === "MessageMediaWebPage") return "text"; // so preview de link
  if (cls === "MessageMediaDocument") {
    const attrs: Any[] = media.document?.attributes ?? [];
    const has = (name: string) => attrs.find((a) => a?.className === name);
    if (has("DocumentAttributeSticker")) return "sticker";
    if (has("DocumentAttributeAnimated")) return "animation";
    const video = has("DocumentAttributeVideo");
    if (video) return video.roundMessage ? "video_note" : "video";
    const audio = has("DocumentAttributeAudio");
    if (audio) return audio.voice ? "voice" : "audio";
    return "document";
  }
  return "outro";
}

function textOf(msg: Any): string | null {
  const t = typeof msg.message === "string" ? msg.message.trim() : "";
  if (t) return t;
  // Enquete: o "texto" e a pergunta.
  const q = msg.media?.poll?.question;
  if (typeof q === "string" && q.trim()) return q.trim();
  if (q && typeof q.text === "string" && q.text.trim()) return q.text.trim();
  return null;
}

// Links dos botoes embaixo do post ("CADASTRE-SE", "ENTRAR NO VIP").
function buttonUrls(msg: Any): string[] {
  const rows: Any[] = msg.replyMarkup?.rows ?? [];
  const urls: string[] = [];
  for (const row of rows) {
    for (const b of row?.buttons ?? []) {
      if (typeof b?.url === "string") urls.push(b.url);
    }
  }
  return urls;
}

// Destino dos links do texto. Quase todo link de afiliado vem "escondido"
// (texto clicavel): a URL so existe na entidade, nao no texto.
function textUrls(msg: Any, text: string | null): string[] {
  const urls: string[] = [];
  const raw: string = typeof msg.message === "string" ? msg.message : (text ?? "");
  for (const e of (msg.entities ?? []) as Any[]) {
    if (e?.className === "MessageEntityTextUrl" && typeof e.url === "string") {
      urls.push(e.url);
    } else if (e?.className === "MessageEntityUrl") {
      const u = raw.substr(Number(e.offset) || 0, Number(e.length) || 0).trim();
      if (u) urls.push(u);
    }
  }
  return urls;
}

function hasLinkOf(msg: Any, text: string | null, buttons: string[]): boolean {
  if (buttons.length > 0) return true;
  const entities: Any[] = msg.entities ?? [];
  if (
    entities.some(
      (e) =>
        e?.className === "MessageEntityUrl" ||
        e?.className === "MessageEntityTextUrl",
    )
  ) {
    return true;
  }
  return LINK_RE.test(text ?? "");
}

function reactionsOf(msg: Any): number | null {
  const results: Any[] | undefined = msg.reactions?.results;
  if (!results) return null;
  return results.reduce((s, r) => s + (Number(r?.count) || 0), 0);
}

// So mensagem "de verdade" (ignora entrada/saida de membro, fixados etc).
export function isContentMessage(msg: Any): boolean {
  return msg?.className === "Message";
}

// Em grupo (megagroup) so interessa o que o DONO posta, nao a conversa dos
// membros: post do canal vinculado ou admin anonimo (fromId vazio/canal).
export function isOwnerPost(msg: Any, kind: "channel" | "group"): boolean {
  if (kind === "channel") return true;
  if (msg.post) return true;
  const from = msg.fromId;
  return !from || from.className === "PeerChannel";
}

export function toRow(
  msg: Any,
  channelId: string,
  channelTitle: string | null,
): PostRow {
  const text = textOf(msg);
  const buttons = buttonUrls(msg);
  const links = [...new Set([...textUrls(msg, text), ...buttons])];
  return {
    channel_id: channelId,
    channel_title: channelTitle,
    telegram_msg_id: Number(msg.id),
    text,
    media_type: mediaTypeOf(msg),
    has_link: hasLinkOf(msg, text, buttons),
    album_size: null,
    views: typeof msg.views === "number" ? msg.views : null,
    forwards: typeof msg.forwards === "number" ? msg.forwards : null,
    reactions: reactionsOf(msg),
    posted_at: new Date(Number(msg.date) * 1000).toISOString(),
    raw_payload: {
      grouped_id: msg.groupedId ? String(msg.groupedId) : null,
      media_class: msg.media?.className ?? null,
      buttons,
      links,
      edited: msg.editDate ? Number(msg.editDate) : null,
      pinned: Boolean(msg.pinned),
    },
  };
}

// Album (varias fotos num post so) chega como N mensagens com o mesmo
// groupedId. Conta como UM post: fica a de menor id, com a legenda de quem tiver.
export function collapseAlbums(msgs: Any[], rows: PostRow[]): PostRow[] {
  const out: PostRow[] = [];
  const byGroup = new Map<string, PostRow>();
  rows.forEach((row, i) => {
    const gid = msgs[i].groupedId ? String(msgs[i].groupedId) : null;
    if (!gid) {
      out.push(row);
      return;
    }
    const head = byGroup.get(gid);
    if (!head) {
      row.album_size = 1;
      byGroup.set(gid, row);
      out.push(row);
      return;
    }
    head.album_size = (head.album_size ?? 1) + 1;
    if (!head.text && row.text) {
      head.text = row.text;
      head.has_link = head.has_link || row.has_link;
    }
    if (row.telegram_msg_id < head.telegram_msg_id) {
      head.telegram_msg_id = row.telegram_msg_id;
    }
    head.views = Math.max(head.views ?? 0, row.views ?? 0) || head.views;
  });
  return out;
}
