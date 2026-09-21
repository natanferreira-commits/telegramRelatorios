// Tempo relativo curto em pt-BR (ex: "agora", "há 5min", "há 3h", "há 2d").
export function formatRelativePt(iso: string, now: number = Date.now()): string {
  const diff = Math.max(0, now - new Date(iso).getTime());
  const s = Math.floor(diff / 1000);
  if (s < 60) return "agora";
  const m = Math.floor(s / 60);
  if (m < 60) return `há ${m}min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.floor(h / 24);
  return `há ${d}d`;
}

// Hora curta (ex: "14:32") no fuso de Brasilia.
export function formatTimePt(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Dia por extenso curto (ex: "21 de junho") no fuso de Brasilia.
export function formatDayPt(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "long",
  });
}

// Horas desde um instante (pra alarmes de "coleta parada").
export function hoursSince(iso: string, now: number = Date.now()): number {
  return Math.max(0, now - new Date(iso).getTime()) / 3_600_000;
}

export function initials(name: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}
