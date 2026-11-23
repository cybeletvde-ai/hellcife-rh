export type Unidade = 'Recife' | 'Jaboatão';
export type Lotacao = 'Recife' | 'Jaboatão' | 'Ambas';
export type TipoMarcacao = 'entrada' | 'saida_almoco' | 'retorno_almoco' | 'saida';
export type StatusAtestado = 'Pendente' | 'Aprovado' | 'Recusado';

export type MenuRoute =
  | 'ponto'
  | 'espelho'
  | 'jornadas'
  | 'escalas'
  | 'horas-extras'
  | 'banco-horas'
  | 'holerite'
  | 'atestados'
  | 'informacoes'
  | 'rh-fechamento'
  | 'rh-relatorio'
  | 'rh-retribuicao'
  | 'rh-holerite-config'
  | 'sys-colaboradores'
  | 'sys-empresa'
  | 'sys-configuracoes'
  | 'sys-localizacao'
  | 'sys-importar';

export type DiaSemanaKey = 'seg' | 'ter' | 'qua' | 'qui' | 'sex' | 'sab' | 'dom';

export interface HorarioDiaSemana {
  ativo: boolean;
  entrada: string; // HH:MM
  saidaAlmoco: string; // HH:MM
  retornoAlmoco: string; // HH:MM
  saida: string; // HH:MM
}

export type GradeSemanal = Record<DiaSemanaKey, HorarioDiaSemana>;

export const ORDEM_DIAS_SEMANA: {
  key: DiaSemanaKey;
  label: string;
  curto: string;
  jsDay: number;
}[] = [
  { key: 'seg', label: 'Segunda-feira', curto: 'Seg', jsDay: 1 },
  { key: 'ter', label: 'Terça-feira', curto: 'Ter', jsDay: 2 },
  { key: 'qua', label: 'Quarta-feira', curto: 'Qua', jsDay: 3 },
  { key: 'qui', label: 'Quinta-feira', curto: 'Qui', jsDay: 4 },
  { key: 'sex', label: 'Sexta-feira', curto: 'Sex', jsDay: 5 },
  { key: 'sab', label: 'Sábado', curto: 'Sáb', jsDay: 6 },
  { key: 'dom', label: 'Domingo', curto: 'Dom', jsDay: 0 },
];

export const DEFAULT_GRADE_SEMANAL: GradeSemanal = {
  seg: { ativo: true, entrada: '09:00', saidaAlmoco: '13:00', retornoAlmoco: '14:00', saida: '18:00' },
  ter: { ativo: true, entrada: '09:00', saidaAlmoco: '13:00', retornoAlmoco: '14:00', saida: '18:00' },
  qua: { ativo: true, entrada: '09:00', saidaAlmoco: '13:00', retornoAlmoco: '14:00', saida: '18:00' },
  qui: { ativo: true, entrada: '09:00', saidaAlmoco: '13:00', retornoAlmoco: '14:00', saida: '18:00' },
  sex: { ativo: true, entrada: '09:00', saidaAlmoco: '13:00', retornoAlmoco: '14:00', saida: '18:00' },
  sab: { ativo: true, entrada: '09:00', saidaAlmoco: '', retornoAlmoco: '', saida: '13:00' },
  dom: { ativo: false, entrada: '09:00', saidaAlmoco: '13:00', retornoAlmoco: '14:00', saida: '18:00' },
};

function hhmmToMin(hhmm: string): number | null {
  if (!hhmm || !hhmm.includes(':')) return null;
  const [hStr, mStr] = hhmm.split(':');
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  if (isNaN(h) || isNaN(m)) return null;
  return h * 60 + m;
}

export function calcularMinutosDiaGrade(dia: HorarioDiaSemana): number {
  if (!dia.ativo) return 0;
  const ent = hhmmToMin(dia.entrada);
  const sai = hhmmToMin(dia.saida);
  if (ent === null || sai === null) return 0;

  const saiAlm = hhmmToMin(dia.saidaAlmoco);
  const retAlm = hhmmToMin(dia.retornoAlmoco);

  if (saiAlm !== null && retAlm !== null) {
    const fimManha = saiAlm < ent ? saiAlm + 1440 : saiAlm;
    const iniTarde = retAlm < fimManha ? retAlm + 1440 : retAlm;
    const fimTarde = sai < iniTarde ? sai + 1440 : sai;
    return Math.max(0, fimManha - ent) + Math.max(0, fimTarde - iniTarde);
  }

  const fimDireto = sai < ent ? sai + 1440 : sai;
  return Math.max(0, fimDireto - ent);
}

export function calcularIntervaloDiaGradeMin(dia: HorarioDiaSemana): number {
  if (!dia.ativo) return 0;
  const saiAlm = hhmmToMin(dia.saidaAlmoco);
  const retAlm = hhmmToMin(dia.retornoAlmoco);
  if (saiAlm === null || retAlm === null) return 0;
  const fim = retAlm < saiAlm ? retAlm + 1440 : retAlm;
  return Math.max(0, fim - saiAlm);
}

export function calcularMinutosSemanaGrade(grade: GradeSemanal): number {
  return ORDEM_DIAS_SEMANA.reduce((acc, d) => acc + calcularMinutosDiaGrade(grade[d.key]), 0);
}

export function getDiaGradePorDataIdx(grade: GradeSemanal, diaSemanaIdx: number): HorarioDiaSemana {
  const match = ORDEM_DIAS_SEMANA.find((d) => d.jsDay === diaSemanaIdx) || ORDEM_DIAS_SEMANA[0];
  return grade[match.key] || DEFAULT_GRADE_SEMANAL[match.key];
}

export function cloneGradeSemanal(grade?: Partial<GradeSemanal> | null): GradeSemanal {
  return {
    seg: { ...DEFAULT_GRADE_SEMANAL.seg, ...(grade?.seg || {}) },
    ter: { ...DEFAULT_GRADE_SEMANAL.ter, ...(grade?.ter || {}) },
    qua: { ...DEFAULT_GRADE_SEMANAL.qua, ...(grade?.qua || {}) },
    qui: { ...DEFAULT_GRADE_SEMANAL.qui, ...(grade?.qui || {}) },
    sex: { ...DEFAULT_GRADE_SEMANAL.sex, ...(grade?.sex || {}) },
    sab: { ...DEFAULT_GRADE_SEMANAL.sab, ...(grade?.sab || {}) },
    dom: { ...DEFAULT_GRADE_SEMANAL.dom, ...(grade?.dom || {}) },
  };
}

export interface JornadaTemplate {
  id: string;
  nome: string;
  horasSemanais: number;
  segSexEntrada: string; // HH:MM
  segSexSaida: string;   // HH:MM
  segSexCargaMin: number; // 480 (8h)
  intervaloMin: number;  // 60 (1h flexível)
  sabadoAtivo: boolean;
  sabadoEntrada: string; // HH:MM
  sabadoSaida: string;   // HH:MM
  sabadoCargaMin: number; // 240 (4h)
}

export interface Colaborador {
  id: string;
  nome: string;
  cpf: string;
  email: string;
  senha: string;
  telefone?: string;
  endereco?: string;
  funcao: string;
  lotacao: Lotacao;
  dataAdmissao: string; // YYYY-MM-DD
  salarioBase: number;
  vaDiario: number; // R$ 14,00 padrão
  vtDiario: number; // R$ 13,00 Recife ou R$ 9,00 Jaboatão
  jornadaId: string;
  gradeSemanal?: GradeSemanal;
  ativo: boolean;
  criadoEm: string;
}

export function temPermissaoGestao(funcao: string | undefined | null): boolean {
  const norm = (funcao || '').trim().toLowerCase();
  return (
    norm === 'administradora' ||
    norm === 'administrador' ||
    norm === 'diretor' ||
    norm === 'diretora'
  );
}

export interface RegistroPonto {
  id: string;
  nsr: number;
  colaboradorId: string;
  unidade: Unidade;
  data: string; // YYYY-MM-DD (America/Recife)
  hora: string; // HH:MM:SS (America/Recife)
  timestamp: string; // ISO
  criadoEmServidor?: string; // ISO timestamptz oficial gravado no servidor
  tipo: TipoMarcacao;
  latitude: number | null;
  longitude: number | null;
  distanciaMetros: number | null;
  localizacaoVerificada: boolean;
  selfieDataUrl?: string;
  registradoPor?: string;
  justificativaDeslocamento?: string;
  origemRegistro?: 'colaborador_gps' | 'manual_gestor';
  hashComprovante: string;
}

export interface AjusteEscala {
  id: string;
  colaboradorId: string;
  data: string; // YYYY-MM-DD
  tipo: 'normal' | 'folga' | 'horario_proprio';
  entradaCustom?: string; // HH:MM
  saidaCustom?: string;   // HH:MM
  cargaMinCustom?: number;
  motivo: string;
}

export interface Feriado {
  id: string;
  data: string; // YYYY-MM-DD
  nome: string;
  abrangencia: 'Nacional' | 'Estadual' | 'Recife' | 'Jaboatão';
}

export interface Atestado {
  id: string;
  colaboradorId: string;
  tipo: 'Atestado Médico' | 'Justificativa de Atraso';
  dataInicio: string; // YYYY-MM-DD
  dataFim: string;    // YYYY-MM-DD
  minutosAbonados?: number;
  motivo: string;
  anexoNome?: string;
  anexoDataUrl?: string;
  status: StatusAtestado;
  observacaoRh?: string;
  criadoEm: string;
}

export interface AvisoEmpresa {
  id: string;
  titulo: string;
  mensagem: string;
  unidadeAlvo: 'Todas' | Unidade;
  criadoEm: string;
  autorNome: string;
}

export interface FechamentoMensal {
  mes: string; // YYYY-MM
  unidade: 'Todas' | Unidade;
  fechadoEm: string;
  fechadoPor: string;
}

export interface LocalizacaoUnidade {
  unidade: Unidade;
  nomeLoja: string;
  endereco: string;
  latitude: number;
  longitude: number;
  raioMetros: number;
}

export interface RegraUnidadeConfig {
  unidade: Unidade;
  extraOrdinariaPct: number;     // Recife: 50 | Jaboatão: 65 (até 2h)
  extraAcima2hPct: number;       // Recife: 50 | Jaboatão: 70 (> 2h)
  adicionalNoturnoPct: number;   // Recife: 20 | Jaboatão: 30
  horaNoturnaReduzida: boolean;  // 52m30s
  extraDomingoFeriadoPct: number; // 100
  vtDiarioPadrao: number;        // Recife: 13 | Jaboatão: 9
  vaDiarioPadrao: number;        // 14
}

export interface ConfigNotificacoes {
  lembretesAtivos: boolean;
  horarioEntrada: string;
  horarioAlmoco: string;
  horarioRetorno: string;
  horarioSaida: string;
  toleranciaAvisoMin: number;
}

export interface DadosEmpresaUnidade {
  unidade: Unidade;
  razaoSocial: string;
  nomeFantasia: string;
  cnpj: string;
  inscricaoEstadual: string;
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  uf: string;
  telefone: string;
  email: string;
  site: string;
}

export interface ConfiguracaoEmpresa {
  razaoSocial: string;
  nomeFantasia: string;
  cnpj: string;
  regimeTributario: 'Simples Nacional';
  bancoHorasModo: 'Pagamento Mensal (Sem Acúmulo)';
  empresasUnidade?: Record<Unidade, DadosEmpresaUnidade>;
  regrasUnidade: Record<Unidade, RegraUnidadeConfig>;
  localizacoes: Record<Unidade, LocalizacaoUnidade>;
  notificacoes: ConfigNotificacoes;
}

export function getDadosEmpresaUnidade(
  config: ConfiguracaoEmpresa,
  unidade: Unidade
): DadosEmpresaUnidade {
  const cadastrado = config.empresasUnidade?.[unidade];
  if (cadastrado) {
    return cadastrado;
  }
  return {
    unidade,
    razaoSocial: config.razaoSocial,
    nomeFantasia: config.nomeFantasia,
    cnpj: config.cnpj,
    inscricaoEstadual: '',
    cep: '',
    logradouro: '',
    numero: '',
    complemento: '',
    bairro: '',
    cidade: unidade === 'Recife' ? 'Recife' : 'Jaboatão dos Guararapes',
    uf: 'PE',
    telefone: '',
    email: '',
    site: '',
  };
}

export interface DiaEspelho {
  data: string; // YYYY-MM-DD
  diaSemanaIdx: number;
  labelDia: string;
  unidadeEfetiva: Unidade;
  ehDomingo: boolean;
  ehFeriado: boolean;
  nomeFeriado?: string;
  ajusteAplicado?: AjusteEscala;
  status:
    | 'anterior_admissao'
    | 'folga'
    | 'feriado'
    | 'em_andamento'
    | 'regular'
    | 'atraso'
    | 'falta'
    | 'hora_extra'
    | 'abonado';
  marcacoes: Partial<Record<TipoMarcacao, RegistroPonto>>;
  minutosPrevistos: number;
  minutosTrabalhados: number;
  minutosNoturnosRelogio: number;
  minutosNoturnosComputados: number;
  minutosAtraso: number; // após tolerância 5/10 min
  minutosExtra50: number;
  minutosExtra65: number;
  minutosExtra70: number;
  minutosExtra100: number;
  toleranciaAplicada: boolean;
}

export interface ResumoMensalColaborador {
  mes: string;
  dias: DiaEspelho[];
  diasTrabalhados: number;
  diasUteisMes: number;
  domingosFeriadosMes: number;
  totalMinTrabalhados: number;
  totalMinPrevistos: number;
  totalMinAtraso: number;
  totalMinExtra50: number;
  totalMinExtra65: number;
  totalMinExtra70: number;
  totalMinExtra100: number;
  totalMinExtrasGeral: number;
  totalMinNoturnos: number;
}

export interface FaixaINSSDetalhe {
  faixa: string;
  aliquota: string;
  baseNaFaixa: number;
  contribuicao: number;
}

export interface HoleriteCalculado {
  mes: string;
  colaborador: Colaborador;
  resumo: ResumoMensalColaborador;
  valorHoraNormal: number;
  salarioBase: number;
  valorExtra50: number;
  valorExtra65: number;
  valorExtra70: number;
  valorExtra100: number;
  valorAdicionalNoturno: number;
  totalHorasExtras: number;
  dsrSobreExtras: number;
  totalProventos: number;
  descontoAtrasos: number;
  baseInss: number;
  inssValor: number;
  inssAliquotaEfetiva: number;
  inssFaixas: FaixaINSSDetalhe[];
  vtConcedidoMes: number;
  descontoVt6Pct: number;
  totalDescontos: number;
  salarioLiquido: number;
  beneficioVaMes: number;
  beneficioVtMes: number;
}

export interface RetribuicaoEmpresa {
  colaborador: Colaborador;
  remuneracaoBruta: number;
  inssPatronal: number; // R$ 0,00 (Simples Nacional)
  fgts8Pct: number;
  provisaoFerias1_12: number;
  provisaoTercoFerias: number;
  provisaoDecimoTerceiro1_12: number;
  fgtsSobreProvisoes: number;
  beneficiosExternos: number;
  custoTotalEmpresa: number;
}

export interface RubricaHoleriteItem {
  id: string;
  descricao: string;
  referencia?: string;
  valor: number;
  selecionado: boolean;
  custom?: boolean;
}

export interface HoleriteConfigurado {
  id: string; // `${colaboradorId}__${mes}`
  colaboradorId: string;
  mes: string; // YYYY-MM
  recebiveis: RubricaHoleriteItem[];
  descontaveis: RubricaHoleriteItem[];
  totalRecebiveis: number;
  totalDescontaveis: number;
  salarioLiquido: number;
  liberado: boolean;
  configuradoPor?: string;
  atualizadoEm: string;
}
