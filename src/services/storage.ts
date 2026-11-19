import {
  ConfiguracaoEmpresa,
  Feriado,
  JornadaTemplate,
  Unidade,
} from '../types/rh';

const KEYS = {
  SESSION: 'hellciferh_session_v1',
  THEME: 'hellciferh_theme_v1',
} as const;

export const DEFAULT_JORNADAS: JornadaTemplate[] = [
  {
    id: 'jornada-44h',
    nome: 'Comercial 44h Semanais (Seg–Sex 08h + Sáb 04h)',
    horasSemanais: 44,
    segSexEntrada: '09:00',
    segSexSaida: '18:00',
    segSexCargaMin: 480,
    intervaloMin: 60,
    sabadoAtivo: true,
    sabadoEntrada: '09:00',
    sabadoSaida: '13:00',
    sabadoCargaMin: 240,
  },
  {
    id: 'jornada-40h',
    nome: 'Administrativa 40h Semanais (Seg–Sex 08h)',
    horasSemanais: 40,
    segSexEntrada: '09:00',
    segSexSaida: '18:00',
    segSexCargaMin: 480,
    intervaloMin: 60,
    sabadoAtivo: false,
    sabadoEntrada: '00:00',
    sabadoSaida: '00:00',
    sabadoCargaMin: 0,
  },
  {
    id: 'jornada-36h',
    nome: 'Parcial 36h Semanais (Seg–Sáb 06h)',
    horasSemanais: 36,
    segSexEntrada: '10:00',
    segSexSaida: '16:15',
    segSexCargaMin: 360,
    intervaloMin: 15,
    sabadoAtivo: true,
    sabadoEntrada: '10:00',
    sabadoSaida: '16:15',
    sabadoCargaMin: 360,
  },
];

export const DEFAULT_FERIADOS: Feriado[] = [
  { id: 'fer-0101', data: '2026-01-01', nome: 'Confraternização Universal', abrangencia: 'Nacional' },
  { id: 'fer-0115', data: '2026-01-15', nome: 'Santo Amaro (Padroeiro)', abrangencia: 'Jaboatão' },
  { id: 'fer-0306', data: '2026-03-06', nome: 'Data Magna de Pernambuco', abrangencia: 'Estadual' },
  { id: 'fer-0403', data: '2026-04-03', nome: 'Paixão de Cristo', abrangencia: 'Nacional' },
  { id: 'fer-0421', data: '2026-04-21', nome: 'Tiradentes', abrangencia: 'Nacional' },
  { id: 'fer-0501', data: '2026-05-01', nome: 'Dia do Trabalho', abrangencia: 'Nacional' },
  { id: 'fer-0504', data: '2026-05-04', nome: 'Emancipação de Jaboatão', abrangencia: 'Jaboatão' },
  { id: 'fer-0624', data: '2026-06-24', nome: 'São João', abrangencia: 'Estadual' },
  { id: 'fer-0716', data: '2026-07-16', nome: 'Nossa Senhora do Carmo', abrangencia: 'Recife' },
  { id: 'fer-0907', data: '2026-09-07', nome: 'Independência do Brasil', abrangencia: 'Nacional' },
  { id: 'fer-1012', data: '2026-10-12', nome: 'Nossa Senhora Aparecida', abrangencia: 'Nacional' },
  { id: 'fer-1102', data: '2026-11-02', nome: 'Finados', abrangencia: 'Nacional' },
  { id: 'fer-1115', data: '2026-11-15', nome: 'Proclamação da República', abrangencia: 'Nacional' },
  { id: 'fer-1120', data: '2026-11-20', nome: 'Consciência Negra', abrangencia: 'Nacional' },
  { id: 'fer-1208', data: '2026-12-08', nome: 'Nossa Senhora da Conceição', abrangencia: 'Recife' },
  { id: 'fer-1225', data: '2026-12-25', nome: 'Natal', abrangencia: 'Nacional' },
];

export const DEFAULT_CONFIG: ConfiguracaoEmpresa = {
  razaoSocial: 'Hellcife Tattoo Supply Comércio Ltda',
  nomeFantasia: 'Hellcife Tattoo Supply',
  cnpj: '00.000.000/0001-00',
  regimeTributario: 'Simples Nacional',
  bancoHorasModo: 'Pagamento Mensal (Sem Acúmulo)',
  empresasUnidade: {
    Recife: {
      unidade: 'Recife',
      razaoSocial: 'Hellcife Tattoo Supply Comércio Ltda',
      nomeFantasia: 'Hellcife Tattoo Supply',
      cnpj: '00.000.000/0001-00',
      inscricaoEstadual: '',
      cep: '',
      logradouro: 'Av. Conde da Boa Vista',
      numero: '',
      complemento: '',
      bairro: 'Boa Vista',
      cidade: 'Recife',
      uf: 'PE',
      telefone: '',
      email: '',
      site: '',
    },
    Jaboatão: {
      unidade: 'Jaboatão',
      razaoSocial: 'Hellcife Tattoo Supply Comércio Ltda',
      nomeFantasia: 'Hellcife Tattoo Supply',
      cnpj: '00.000.000/0001-00',
      inscricaoEstadual: '',
      cep: '',
      logradouro: 'Av. Bernardo Vieira de Melo',
      numero: '',
      complemento: '',
      bairro: 'Piedade',
      cidade: 'Jaboatão dos Guararapes',
      uf: 'PE',
      telefone: '',
      email: '',
      site: '',
    },
  },
  regrasUnidade: {
    Recife: {
      unidade: 'Recife',
      extraOrdinariaPct: 50,
      extraAcima2hPct: 50,
      adicionalNoturnoPct: 20,
      horaNoturnaReduzida: false,
      extraDomingoFeriadoPct: 100,
      vtDiarioPadrao: 13.0,
      vaDiarioPadrao: 14.0,
    },
    Jaboatão: {
      unidade: 'Jaboatão',
      extraOrdinariaPct: 65,
      extraAcima2hPct: 70,
      adicionalNoturnoPct: 30,
      horaNoturnaReduzida: true,
      extraDomingoFeriadoPct: 100,
      vtDiarioPadrao: 9.0,
      vaDiarioPadrao: 14.0,
    },
  },
  localizacoes: {
    Recife: {
      unidade: 'Recife',
      nomeLoja: 'Loja Recife · Boa Vista',
      endereco: 'Av. Conde da Boa Vista, Recife - PE',
      latitude: -8.0616,
      longitude: -34.8856,
      raioMetros: 250,
    },
    Jaboatão: {
      unidade: 'Jaboatão',
      nomeLoja: 'Loja Jaboatão · Piedade',
      endereco: 'Av. Bernardo Vieira de Melo, Jaboatão dos Guararapes - PE',
      latitude: -8.1753,
      longitude: -34.9189,
      raioMetros: 250,
    },
  },
  notificacoes: {
    lembretesAtivos: true,
    horarioEntrada: '09:00',
    horarioAlmoco: '13:00',
    horarioRetorno: '14:00',
    horarioSaida: '18:00',
    toleranciaAvisoMin: 5,
  },
};

function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJSON<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value));
}

export const storage = {
  getSession(): { colaboradorId: string; unidadeAtiva: Unidade } | null {
    return readJSON<{ colaboradorId: string; unidadeAtiva: Unidade } | null>(KEYS.SESSION, null);
  },
  saveSession(session: { colaboradorId: string; unidadeAtiva: Unidade } | null): void {
    writeJSON(KEYS.SESSION, session);
  },

  getDarkMode(): boolean {
    return readJSON<boolean>(KEYS.THEME, false);
  },
  saveDarkMode(dark: boolean): void {
    writeJSON(KEYS.THEME, dark);
  },
};

export async function sha256Hex(input: string): Promise<string> {
  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(input);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  } catch {
    let h = 2166136261;
    for (let i = 0; i < input.length; i++) {
      h ^= input.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return Math.abs(h).toString(16).padStart(16, '0');
  }
}

export function haversineDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}
