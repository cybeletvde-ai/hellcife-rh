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
  | 'sys-colaboradores'
  | 'sys-empresa'
  | 'sys-configuracoes'
  | 'sys-localizacao'
  | 'sys-importar';

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
  funcao: string;
  lotacao: Lotacao;
  dataAdmissao: string; // YYYY-MM-DD
  salarioBase: number;
  vaDiario: number; // R$ 14,00 padrão
  vtDiario: number; // R$ 13,00 Recife ou R$ 9,00 Jaboatão
  jornadaId: string;
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
  data: string; // YYYY-MM-DD
  hora: string; // HH:MM:SS
  timestamp: string; // ISO
  tipo: TipoMarcacao;
  latitude: number | null;
  longitude: number | null;
  distanciaMetros: number | null;
  localizacaoVerificada: boolean;
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
