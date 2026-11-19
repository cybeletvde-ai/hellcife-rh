import { supabase } from './supabaseClient';

export interface RecifeServerClock {
  dateObj: Date;
  data: string; // YYYY-MM-DD (America/Recife)
  hora: string; // HH:MM:SS (America/Recife)
  iso: string;
  syncedWithServer: boolean;
}

const RECIFE_TZ = 'America/Recife';

let cachedServerOffsetMs: number | null = null;
let lastSyncPerfMs = 0;

export function formatRecifeDateParts(d: Date): { data: string; hora: string } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: RECIFE_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(d);

  const map: Record<string, string> = {};
  for (const p of parts) {
    map[p.type] = p.value;
  }

  const hh = map.hour === '24' ? '00' : map.hour || '00';
  return {
    data: `${map.year}-${map.month}-${map.day}`,
    hora: `${hh}:${map.minute || '00'}:${map.second || '00'}`,
  };
}

export function formatRecifeDateTimeBR(isoStr?: string): string {
  if (!isoStr) return '—';
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return isoStr;
  return d.toLocaleString('pt-BR', {
    timeZone: RECIFE_TZ,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

export async function syncOfficialRecifeOffset(force = false): Promise<number | null> {
  const nowPerf = performance.now();
  if (!force && cachedServerOffsetMs !== null && nowPerf - lastSyncPerfMs < 20000) {
    return cachedServerOffsetMs;
  }

  // 1. Tenta ler diretamente a hora do PostgreSQL via RPC agora_recife()
  try {
    const t0 = performance.now();
    const { data, error } = await supabase.rpc('agora_recife');
    const t1 = performance.now();
    if (!error && data && typeof data.epoch_ms === 'number') {
      const rttHalf = Math.round((t1 - t0) / 2);
      const serverEpoch = data.epoch_ms + rttHalf;
      cachedServerOffsetMs = serverEpoch - Date.now();
      lastSyncPerfMs = performance.now();
      return cachedServerOffsetMs;
    }
  } catch {
    // Continua para fallback via cabeçalho HTTP Date
  }

  // 2. Fallback via cabeçalho HTTP Date do servidor de origem (mesmo domínio, imune ao relógio do aparelho)
  try {
    if (typeof window !== 'undefined' && typeof fetch !== 'undefined') {
      const t0 = performance.now();
      const res = await fetch(`${window.location.origin}/?t=${Date.now()}`, {
        method: 'HEAD',
        cache: 'no-store',
      });
      const t1 = performance.now();
      const dateHeader = res.headers.get('date');
      if (dateHeader) {
        const parsedMs = Date.parse(dateHeader);
        if (!isNaN(parsedMs)) {
          const rttHalf = Math.round((t1 - t0) / 2);
          cachedServerOffsetMs = parsedMs + rttHalf - Date.now();
          lastSyncPerfMs = performance.now();
          return cachedServerOffsetMs;
        }
      }
    }
  } catch {
    // Sem rede no momento
  }

  return cachedServerOffsetMs;
}

export function getEstimatedRecifeClock(): RecifeServerClock {
  const offset = cachedServerOffsetMs ?? 0;
  const serverNow = new Date(Date.now() + offset);
  const { data, hora } = formatRecifeDateParts(serverNow);
  return {
    dateObj: serverNow,
    data,
    hora,
    iso: serverNow.toISOString(),
    syncedWithServer: cachedServerOffsetMs !== null,
  };
}

export async function fetchOfficialRecifeClock(): Promise<RecifeServerClock> {
  await syncOfficialRecifeOffset(true);
  return getEstimatedRecifeClock();
}
