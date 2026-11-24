import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Edit3,
  Filter,
  MapPin,
  Plus,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import {
  AjusteEscala,
  Atestado,
  Colaborador,
  ConfiguracaoEmpresa,
  Feriado,
  JornadaTemplate,
  RegistroPonto,
  TipoMarcacao,
  Unidade,
  calcularMinutosDiaGrade,
  getDadosEmpresaUnidade,
  getDiaGradePorDataIdx,
  temPermissaoGestao,
} from '../types/rh';
import { sha256Hex } from '../services/storage';
import { getEstimatedRecifeClock } from '../services/serverTime';
import {
  calcularDiaPonto,
  formatDateBR,
  getUnidadeEfetivaColaborador,
  isFeriadoParaUnidade,
  parseTimeToMinutes,
} from '../utils/cltCalculations';
import { MapaMarcacoesLeaflet, MarcacaoMapaItem } from './MapaMarcacoesLeaflet';

interface MarcacoesAoVivoPanelProps {
  colaboradorAtual: Colaborador;
  colaboradores: Colaborador[];
  unidadeAtiva: Unidade;
  pontos: RegistroPonto[];
  jornadas: JornadaTemplate[];
  ajustes: AjusteEscala[];
  feriados: Feriado[];
  atestados: Atestado[];
  config: ConfiguracaoEmpresa;
  onRegistrarPonto: (registro: RegistroPonto) => Promise<RegistroPonto | null>;
  onAtualizarPonto: (registro: RegistroPonto) => Promise<boolean>;
  onRemoverPonto: (id: string) => Promise<boolean>;
  onAdicionarAtestado: (atestado: Atestado) => Promise<boolean>;
}

type StatusLinha = 'Confirmada' | 'Atrasado' | 'Fora do local';

interface LinhaMarcacaoDia {
  colaborador: Colaborador;
  pontosDia: RegistroPonto[];
  mapaSlots: Partial<Record<TipoMarcacao, RegistroPonto>>;
  unidadeIdentificada: Unidade;
  localCurto: string;
  localCompleto: string;
  status: StatusLinha;
  minutosAtrasoDetectado: number;
  todosFacialGps: boolean;
  possuiManualGestor: boolean;
  localizacaoVerificadaGeral: boolean;
  distanciaPrincipal: number | null;
}

const SLOTS_MARCACAO: { key: TipoMarcacao; sigla: 'E1' | 'S1' | 'E2' | 'S2'; label: string }[] = [
  { key: 'entrada', sigla: 'E1', label: 'Entrada' },
  { key: 'saida_almoco', sigla: 'S1', label: 'Saída Almoço' },
  { key: 'retorno_almoco', sigla: 'E2', label: 'Retorno Almoço' },
  { key: 'saida', sigla: 'S2', label: 'Saída' },
];

function shiftDateStr(yyyyMmDd: string, deltaDays: number): string {
  const [y, m, d] = yyyyMmDd.split('-').map(Number);
  if (!y || !m || !d) return yyyyMmDd;
  const dt = new Date(Date.UTC(y, m - 1, d + deltaDays, 12, 0, 0));
  return dt.toISOString().slice(0, 10);
}

function getLocalCurto(unidade: Unidade): string {
  return unidade === 'Recife' ? 'Loja Caxangá' : 'Av. Bernardo Vieira de Melo';
}

function getLocalCompleto(unidade: Unidade): string {
  return unidade === 'Recife'
    ? 'Loja Caxangá - Recife'
    : 'Av. Bernardo Vieira de Melo - Jaboatão';
}

function getShiftInfoForDay(
  colab: Colaborador,
  dataStr: string,
  jornada: JornadaTemplate,
  ajuste: AjusteEscala | undefined,
  feriados: Feriado[],
  unidadeEfetiva: Unidade
): { minutosPrevistos: number; inicioPrevistoMin: number } {
  const [y, m, d] = dataStr.split('-').map(Number);
  const diaSemanaIdx = new Date(y, m - 1, d).getDay();
  const ehDomingo = diaSemanaIdx === 0;
  const ehFeriado = feriados.some(
    (f) => f.data === dataStr && isFeriadoParaUnidade(f, unidadeEfetiva)
  );

  if (colab.dataAdmissao && dataStr < colab.dataAdmissao) {
    return { minutosPrevistos: 0, inicioPrevistoMin: 0 };
  }
  if (ajuste?.tipo === 'folga') {
    return { minutosPrevistos: 0, inicioPrevistoMin: 0 };
  }
  if (ajuste?.tipo === 'horario_proprio') {
    return {
      minutosPrevistos: ajuste.cargaMinCustom ?? jornada.segSexCargaMin,
      inicioPrevistoMin: parseTimeToMinutes(ajuste.entradaCustom || jornada.segSexEntrada),
    };
  }
  if (ehFeriado) {
    return { minutosPrevistos: 0, inicioPrevistoMin: 0 };
  }
  if (colab.gradeSemanal) {
    const diaCfg = getDiaGradePorDataIdx(colab.gradeSemanal, diaSemanaIdx);
    if (!diaCfg.ativo) return { minutosPrevistos: 0, inicioPrevistoMin: 0 };
    return {
      minutosPrevistos: calcularMinutosDiaGrade(diaCfg),
      inicioPrevistoMin: parseTimeToMinutes(diaCfg.entrada || jornada.segSexEntrada),
    };
  }
  if (ehDomingo) return { minutosPrevistos: 0, inicioPrevistoMin: 0 };
  if (diaSemanaIdx === 6) {
    return {
      minutosPrevistos: jornada.sabadoAtivo ? jornada.sabadoCargaMin : 0,
      inicioPrevistoMin: parseTimeToMinutes(jornada.sabadoEntrada),
    };
  }
  return {
    minutosPrevistos: jornada.segSexCargaMin,
    inicioPrevistoMin: parseTimeToMinutes(jornada.segSexEntrada),
  };
}

export const MarcacoesAoVivoPanel: React.FC<MarcacoesAoVivoPanelProps> = ({
  colaboradorAtual,
  colaboradores,
  unidadeAtiva,
  pontos,
  jornadas,
  ajustes,
  feriados,
  atestados,
  config,
  onRegistrarPonto,
  onAtualizarPonto,
  onRemoverPonto,
  onAdicionarAtestado,
}) => {
  const isGestor = temPermissaoGestao(colaboradorAtual.funcao);
  const hojeStr = getEstimatedRecifeClock().data;
  const ontemStr = shiftDateStr(hojeStr, -1);

  const [dataSelecionada, setDataSelecionada] = useState<string>(hojeStr);
  const [filtroColabId, setFiltroColabId] = useState<string>('Todos');
  const [filtroUnidade, setFiltroUnidade] = useState<'Todas' | Unidade>('Todas');
  const [filtroStatus, setFiltroStatus] = useState<'Todos' | StatusLinha>('Todos');

  // Modal Selfie
  const [selfieModal, setSelfieModal] = useState<{
    colaboradorNome: string;
    colaboradorFuncao: string;
    sigla: string;
    ponto: RegistroPonto;
  } | null>(null);

  // Modal + Incluir horário
  const [modalIncluirAberto, setModalIncluirAberto] = useState(false);
  const [incluirColabId, setIncluirColabId] = useState<string>(
    () => colaboradores.find((c) => c.ativo)?.id || ''
  );
  const [incluirUnidade, setIncluirUnidade] = useState<Unidade>(unidadeAtiva);
  const [incluirTipo, setIncluirTipo] = useState<TipoMarcacao>('entrada');
  const [incluirData, setIncluirData] = useState<string>(hojeStr);
  const [incluirHora, setIncluirHora] = useState<string>('09:00');
  const [incluirJustificativa, setIncluirJustificativa] = useState<string>('');
  const [incluirErro, setIncluirErro] = useState<string>('');
  const [salvandoIncluir, setSalvandoIncluir] = useState(false);

  // Modal Revisar (Editar/Remover batidas ou Abonar atraso)
  const [revisarColabId, setRevisarColabId] = useState<string | null>(null);
  const [edicoesHora, setEdicoesHora] = useState<Record<string, string>>({});
  const [edicoesUnidade, setEdicoesUnidade] = useState<Record<string, Unidade>>({});
  const [motivoRevisao, setMotivoRevisao] = useState<string>('');
  const [abonoMinutos, setAbonoMinutos] = useState<string>('30');
  const [abonoMotivo, setAbonoMotivo] = useState<string>('Atraso abonado pela gestão');
  const [revisarErro, setRevisarErro] = useState<string>('');
  const [revisarSucesso, setRevisarSucesso] = useState<string>('');
  const [salvandoRevisao, setSalvandoRevisao] = useState(false);

  const colaboradoresAtivos = useMemo(
    () =>
      colaboradores
        .filter((c) => c.ativo)
        .filter((c) => !c.dataAdmissao || c.dataAdmissao <= dataSelecionada),
    [colaboradores, dataSelecionada]
  );

  const analiseDia = useMemo(() => {
    const linhasComPonto: LinhaMarcacaoDia[] = [];
    let presentesCount = 0;
    let ausentesCount = 0;
    let atrasadosCount = 0;
    let foraLocalCount = 0;

    for (const colab of colaboradoresAtivos) {
      const pontosDia = pontos
        .filter((p) => p.colaboradorId === colab.id && p.data === dataSelecionada)
        .sort((a, b) => a.hora.localeCompare(b.hora));

      const jornadaColab = jornadas.find((j) => j.id === colab.jornadaId) || jornadas[0];
      const ajusteDia = ajustes.find(
        (a) => a.colaboradorId === colab.id && a.data === dataSelecionada
      );
      const atestadosAprov = atestados.filter(
        (a) => a.colaboradorId === colab.id && a.status === 'Aprovado'
      );
      const atestadoDia = atestadosAprov.find(
        (a) => dataSelecionada >= a.dataInicio && dataSelecionada <= a.dataFim
      );

      const unidadeEfetiva = getUnidadeEfetivaColaborador(colab, pontosDia, unidadeAtiva);
      const shiftInfo = getShiftInfoForDay(
        colab,
        dataSelecionada,
        jornadaColab,
        ajusteDia,
        feriados,
        unidadeEfetiva
      );

      if (pontosDia.length === 0) {
        if (shiftInfo.minutosPrevistos > 0 && !atestadoDia) {
          ausentesCount++;
        }
        continue;
      }

      presentesCount++;

      const mapaSlots: Partial<Record<TipoMarcacao, RegistroPonto>> = {};
      for (const p of pontosDia) {
        mapaSlots[p.tipo] = p;
      }

      const diaCalculado = calcularDiaPonto(
        colab,
        dataSelecionada,
        jornadaColab,
        pontosDia,
        ajusteDia,
        feriados,
        atestadosAprov,
        config,
        unidadeAtiva
      );

      const foraDoLocal = pontosDia.some((p) => {
        if (p.origemRegistro === 'manual_gestor') return false;
        if (!p.localizacaoVerificada) return true;
        const raio = config.localizacoes[p.unidade]?.raioMetros ?? 250;
        return p.distanciaMetros !== null && p.distanciaMetros > raio;
      });

      const entradaReg = mapaSlots.entrada;
      let atrasoEntradaMin = 0;
      if (entradaReg && shiftInfo.minutosPrevistos > 0 && !atestadoDia) {
        const diffEnt = parseTimeToMinutes(entradaReg.hora) - shiftInfo.inicioPrevistoMin;
        if (diffEnt > 10) {
          atrasoEntradaMin = diffEnt;
        }
      }

      const atrasoFinalMin =
        atestadoDia?.tipo === 'Atestado Médico'
          ? 0
          : Math.max(diaCalculado.minutosAtraso, atrasoEntradaMin);
      const ehAtrasado = atrasoFinalMin > 0;

      if (foraDoLocal) foraLocalCount++;
      if (ehAtrasado) atrasadosCount++;

      const status: StatusLinha = foraDoLocal
        ? 'Fora do local'
        : ehAtrasado
          ? 'Atrasado'
          : 'Confirmada';

      const primeiraBatida = pontosDia[0];
      const unidadeIdentificada = primeiraBatida.unidade;
      const possuiManualGestor = pontosDia.some((p) => p.origemRegistro === 'manual_gestor');
      const todosFacialGps = pontosDia.every(
        (p) => p.origemRegistro !== 'manual_gestor' && Boolean(p.selfieDataUrl)
      );
      const localizacaoVerificadaGeral = !foraDoLocal;
      const gpsComDist = pontosDia.find((p) => p.distanciaMetros !== null);

      linhasComPonto.push({
        colaborador: colab,
        pontosDia,
        mapaSlots,
        unidadeIdentificada,
        localCurto: getLocalCurto(unidadeIdentificada),
        localCompleto: getLocalCompleto(unidadeIdentificada),
        status,
        minutosAtrasoDetectado: atrasoFinalMin,
        todosFacialGps,
        possuiManualGestor,
        localizacaoVerificadaGeral,
        distanciaPrincipal: gpsComDist?.distanciaMetros ?? null,
      });
    }

    // Ordenar: Fora do local / Atrasado primeiro, depois horário da primeira batida
    linhasComPonto.sort((a, b) => {
      const horaA = a.pontosDia[0]?.hora || '';
      const horaB = b.pontosDia[0]?.hora || '';
      return horaA.localeCompare(horaB);
    });

    const totalAtivos = colaboradoresAtivos.length;
    const pctPresentes = totalAtivos > 0 ? Math.round((presentesCount / totalAtivos) * 100) : 0;

    return {
      linhasComPonto,
      presentesCount,
      totalAtivos,
      pctPresentes,
      ausentesCount,
      atrasadosCount,
      foraLocalCount,
    };
  }, [colaboradoresAtivos, pontos, dataSelecionada, jornadas, ajustes, atestados, feriados, config, unidadeAtiva]);

  const linhasFiltradas = useMemo(() => {
    return analiseDia.linhasComPonto.filter((linha) => {
      if (filtroColabId !== 'Todos' && linha.colaborador.id !== filtroColabId) return false;
      if (filtroUnidade !== 'Todas') {
        const bateUnidade = linha.pontosDia.some((p) => p.unidade === filtroUnidade);
        if (!bateUnidade) return false;
      }
      if (filtroStatus !== 'Todos' && linha.status !== filtroStatus) return false;
      return true;
    });
  }, [analiseDia.linhasComPonto, filtroColabId, filtroUnidade, filtroStatus]);

  const marcacoesMapa: MarcacaoMapaItem[] = useMemo(() => {
    const items: MarcacaoMapaItem[] = [];
    for (const linha of linhasFiltradas) {
      for (const p of linha.pontosDia) {
        if (filtroUnidade !== 'Todas' && p.unidade !== filtroUnidade) continue;
        const fora =
          p.origemRegistro !== 'manual_gestor' &&
          (!p.localizacaoVerificada ||
            (p.distanciaMetros !== null &&
              p.distanciaMetros > (config.localizacoes[p.unidade]?.raioMetros ?? 250)));

        const statusPonto: StatusLinha = fora
          ? 'Fora do local'
          : linha.status === 'Atrasado'
            ? 'Atrasado'
            : 'Confirmada';

        items.push({
          ponto: p,
          colaboradorNome: linha.colaborador.nome,
          colaboradorFuncao: linha.colaborador.funcao,
          localLabel: getLocalCompleto(p.unidade),
          status: statusPonto,
        });
      }
    }
    return items;
  }, [linhasFiltradas, filtroUnidade, config]);

  const linhaRevisao = useMemo(() => {
    if (!revisarColabId) return null;
    return analiseDia.linhasComPonto.find((l) => l.colaborador.id === revisarColabId) || null;
  }, [revisarColabId, analiseDia.linhasComPonto]);

  if (!isGestor) {
    return null;
  }

  const abrirModalIncluir = () => {
    setIncluirColabId(
      filtroColabId !== 'Todos'
        ? filtroColabId
        : colaboradoresAtivos[0]?.id || colaboradores[0]?.id || ''
    );
    setIncluirUnidade(filtroUnidade !== 'Todas' ? filtroUnidade : unidadeAtiva);
    setIncluirData(dataSelecionada);
    setIncluirHora('09:00');
    setIncluirTipo('entrada');
    setIncluirJustificativa('');
    setIncluirErro('');
    setModalIncluirAberto(true);
  };

  const handleConfirmarIncluir = async (e: React.FormEvent) => {
    e.preventDefault();
    setIncluirErro('');

    const colabAlvo = colaboradores.find((c) => c.id === incluirColabId);
    if (!colabAlvo) {
      setIncluirErro('Selecione um colaborador.');
      return;
    }
    if (!incluirData || !incluirHora) {
      setIncluirErro('Informe data e horário.');
      return;
    }
    const just = incluirJustificativa.trim() || 'Lançamento manual pela gestão';

    setSalvandoIncluir(true);
    try {
      const horaCompleta = incluirHora.length === 5 ? `${incluirHora}:00` : incluirHora;
      const empUnidade = getDadosEmpresaUnidade(config, incluirUnidade);
      const nsr = Math.floor(Date.now() / 1000) % 1000000;
      const payload = `${nsr}|${empUnidade.cnpj || config.cnpj}|${colabAlvo.id}|${incluirData}|${horaCompleta}|${incluirUnidade}|${incluirTipo}|MANUAL:${colaboradorAtual.nome}`;
      const hashComprovante = await sha256Hex(payload);

      const novoPonto: RegistroPonto = {
        id: `pt-manual-${Date.now()}`,
        nsr,
        colaboradorId: colabAlvo.id,
        unidade: incluirUnidade,
        data: incluirData,
        hora: horaCompleta,
        timestamp: new Date(`${incluirData}T${horaCompleta}-03:00`).toISOString(),
        tipo: incluirTipo,
        latitude: null,
        longitude: null,
        distanciaMetros: null,
        localizacaoVerificada: true,
        registradoPor: colaboradorAtual.nome,
        justificativaDeslocamento: just,
        origemRegistro: 'manual_gestor',
        hashComprovante,
      };

      const gravado = await onRegistrarPonto(novoPonto);
      if (gravado) {
        setDataSelecionada(incluirData);
        setModalIncluirAberto(false);
      } else {
        setIncluirErro('Não foi possível gravar no Supabase. Tente novamente.');
      }
    } finally {
      setSalvandoIncluir(false);
    }
  };

  const abrirModalRevisar = (linha: LinhaMarcacaoDia) => {
    const horasMap: Record<string, string> = {};
    const unidadesMap: Record<string, Unidade> = {};
    linha.pontosDia.forEach((p) => {
      horasMap[p.id] = p.hora.slice(0, 5);
      unidadesMap[p.id] = p.unidade;
    });
    setEdicoesHora(horasMap);
    setEdicoesUnidade(unidadesMap);
    setMotivoRevisao('Revisão direta pela gestão');
    setAbonoMinutos(String(Math.max(15, linha.minutosAtrasoDetectado || 30)));
    setAbonoMotivo('Atraso abonado pela gestão');
    setRevisarErro('');
    setRevisarSucesso('');
    setRevisarColabId(linha.colaborador.id);
  };

  const handleSalvarEdicaoPonto = async (ponto: RegistroPonto) => {
    setRevisarErro('');
    setRevisarSucesso('');
    const novaHora = edicoesHora[ponto.id] || ponto.hora.slice(0, 5);
    const novaUnidade = edicoesUnidade[ponto.id] || ponto.unidade;
    const horaCompleta = novaHora.length === 5 ? `${novaHora}:00` : novaHora;

    setSalvandoRevisao(true);
    try {
      const emp = getDadosEmpresaUnidade(config, novaUnidade);
      const payload = `${ponto.nsr}|${emp.cnpj || config.cnpj}|${ponto.colaboradorId}|${ponto.data}|${horaCompleta}|${novaUnidade}|${ponto.tipo}|REV:${colaboradorAtual.nome}`;
      const hashComprovante = await sha256Hex(payload);

      const atualizado: RegistroPonto = {
        ...ponto,
        hora: horaCompleta,
        unidade: novaUnidade,
        timestamp: new Date(`${ponto.data}T${horaCompleta}-03:00`).toISOString(),
        localizacaoVerificada: true,
        registradoPor: colaboradorAtual.nome,
        justificativaDeslocamento: motivoRevisao.trim() || 'Revisado pela gestão',
        origemRegistro: 'manual_gestor',
        hashComprovante,
      };

      const ok = await onAtualizarPonto(atualizado);
      if (ok) {
        setRevisarSucesso(`Batida atualizada para ${horaCompleta.slice(0, 5)} (${novaUnidade}).`);
      } else {
        setRevisarErro('Erro ao atualizar batida no Supabase.');
      }
    } finally {
      setSalvandoRevisao(false);
    }
  };

  const handleExcluirPonto = async (pontoId: string) => {
    setRevisarErro('');
    setRevisarSucesso('');
    setSalvandoRevisao(true);
    try {
      const ok = await onRemoverPonto(pontoId);
      if (ok) {
        setRevisarSucesso('Marcação removida.');
      } else {
        setRevisarErro('Erro ao remover marcação no Supabase.');
      }
    } finally {
      setSalvandoRevisao(false);
    }
  };

  const handleAbonarAtrasoDia = async () => {
    if (!linhaRevisao) return;
    setRevisarErro('');
    setRevisarSucesso('');
    const min = Math.max(1, parseInt(abonoMinutos, 10) || 30);

    setSalvandoRevisao(true);
    try {
      const novoAbono: Atestado = {
        id: `at-abono-${Date.now()}`,
        colaboradorId: linhaRevisao.colaborador.id,
        tipo: 'Justificativa de Atraso',
        dataInicio: dataSelecionada,
        dataFim: dataSelecionada,
        minutosAbonados: min,
        motivo: abonoMotivo.trim() || 'Atraso abonado pela gestão',
        status: 'Aprovado',
        observacaoRh: `Abonado por ${colaboradorAtual.nome}`,
        criadoEm: new Date().toISOString(),
      };
      const ok = await onAdicionarAtestado(novoAbono);
      if (ok) {
        setRevisarSucesso(`Atraso abonado (${min} min) para ${formatDateBR(dataSelecionada)}.`);
      } else {
        setRevisarErro('Erro ao registrar abono no Supabase.');
      }
    } finally {
      setSalvandoRevisao(false);
    }
  };

  return (
    <section
      aria-label="Marcações do dia (Ao vivo)"
      className="bg-white dark:bg-[#1C1C20] text-[#111827] dark:text-zinc-100 rounded-xl p-3 md:p-4 shadow-sm border border-zinc-200/80 dark:border-zinc-800 space-y-4"
    >
      {/* Cabeçalho com Navegação de Data e Botão + Incluir horário */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 pb-3 border-b border-zinc-200/80 dark:border-zinc-800">
        <div className="flex flex-wrap items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#09090B] text-white flex items-center justify-center shrink-0 border border-zinc-700">
            <Users className="w-4 h-4 text-[#DC2626]" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm sm:text-base font-extrabold text-[#111827] dark:text-white tracking-tight">
                Marcações do dia
              </h2>
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/40 text-emerald-700 dark:text-emerald-400 text-[11px] font-bold">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                Ao vivo
              </span>
            </div>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
              Monitoramento gerencial em tempo real · {formatDateBR(dataSelecionada)}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          <div className="inline-flex items-center rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 p-0.5">
            <button
              type="button"
              onClick={() => setDataSelecionada((d) => shiftDateStr(d, -1))}
              className="p-1.5 rounded-md hover:bg-zinc-200/70 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-200 cursor-pointer"
              title="Dia anterior"
              aria-label="Dia anterior"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setDataSelecionada(ontemStr)}
              className={`px-2 py-1 rounded-md text-[11px] font-semibold cursor-pointer transition-colors ${
                dataSelecionada === ontemStr
                  ? 'bg-[#09090B] text-white'
                  : 'text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200/60 dark:hover:bg-zinc-800'
              }`}
            >
              Ontem
            </button>
            <button
              type="button"
              onClick={() => setDataSelecionada(hojeStr)}
              className={`px-2 py-1 rounded-md text-[11px] font-semibold cursor-pointer transition-colors ${
                dataSelecionada === hojeStr
                  ? 'bg-[#09090B] text-white'
                  : 'text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200/60 dark:hover:bg-zinc-800'
              }`}
            >
              Hoje
            </button>
            <button
              type="button"
              onClick={() => setDataSelecionada((d) => shiftDateStr(d, 1))}
              className="p-1.5 rounded-md hover:bg-zinc-200/70 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-200 cursor-pointer"
              title="Próximo dia"
              aria-label="Próximo dia"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <input
            type="date"
            value={dataSelecionada}
            onChange={(e) => {
              if (e.target.value) setDataSelecionada(e.target.value);
            }}
            aria-label="Selecionar data das marcações"
            className="text-xs font-medium px-2 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-[#111827] dark:text-zinc-100"
          />

          <button
            type="button"
            onClick={abrirModalIncluir}
            className="px-3 py-1.5 rounded-lg bg-[#DC2626] hover:bg-red-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm cursor-pointer whitespace-nowrap min-h-[34px]"
          >
            <Plus className="w-3.5 h-3.5 shrink-0" />
            <span>Incluir horário</span>
          </button>
        </div>
      </div>

      {/* 4 Cartões de Indicadores (KPIs do Dia) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        <div className="rounded-xl p-3 bg-emerald-50/80 dark:bg-emerald-950/25 border border-emerald-200 dark:border-emerald-900/60">
          <div className="flex items-center justify-between text-emerald-700 dark:text-emerald-400 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wide">Presentes</span>
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          </div>
          <div className="font-mono tabular-nums text-base sm:text-lg font-extrabold text-emerald-800 dark:text-emerald-300">
            {analiseDia.presentesCount} de {analiseDia.totalAtivos} ({analiseDia.pctPresentes}%)
          </div>
          <div className="text-[11px] text-emerald-700/80 dark:text-emerald-400/80 truncate">
            Com marcação registada
          </div>
        </div>

        <div className="rounded-xl p-3 bg-red-50/75 dark:bg-red-950/25 border border-red-200/80 dark:border-red-900/50">
          <div className="flex items-center justify-between text-red-700 dark:text-red-400 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wide">Ausentes</span>
            <AlertTriangle className="w-4 h-4 shrink-0" />
          </div>
          <div className="font-mono tabular-nums text-base sm:text-lg font-extrabold text-red-700 dark:text-red-300">
            {analiseDia.ausentesCount}
          </div>
          <div className="text-[11px] text-red-600/80 dark:text-red-400/80 truncate">
            Escalados sem batida no dia
          </div>
        </div>

        <div className="rounded-xl p-3 bg-amber-50/80 dark:bg-amber-950/25 border border-amber-200 dark:border-amber-900/60">
          <div className="flex items-center justify-between text-amber-700 dark:text-amber-400 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wide">Atrasados</span>
            <Clock className="w-4 h-4 shrink-0" />
          </div>
          <div className="font-mono tabular-nums text-base sm:text-lg font-extrabold text-amber-800 dark:text-amber-300">
            {analiseDia.atrasadosCount}
          </div>
          <div className="text-[11px] text-amber-700/80 dark:text-amber-400/80 truncate">
            Acima da tolerância (10 min)
          </div>
        </div>

        <div className="rounded-xl p-3 bg-zinc-100 dark:bg-[#27292E] border border-zinc-300/80 dark:border-zinc-700">
          <div className="flex items-center justify-between text-[#474A51] dark:text-zinc-300 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wide">Fora do local</span>
            <ShieldAlert className="w-4 h-4 shrink-0 text-[#DC2626]" />
          </div>
          <div className="font-mono tabular-nums text-base sm:text-lg font-extrabold text-[#111827] dark:text-white">
            {analiseDia.foraLocalCount}
          </div>
          <div className="text-[11px] text-zinc-600 dark:text-zinc-400 truncate">
            GPS fora do perímetro da loja
          </div>
        </div>
      </div>

      {/* Barra de Filtros Rápidos */}
      <div className="rounded-xl bg-zinc-50 dark:bg-zinc-900/80 border border-zinc-200/80 dark:border-zinc-800 p-2.5">
        <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2">
          <Filter className="w-3.5 h-3.5 text-[#DC2626]" />
          <span>Filtros Rápidos</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <div>
            <label className="block text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 mb-0.5">
              Colaborador
            </label>
            <select
              value={filtroColabId}
              onChange={(e) => setFiltroColabId(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-[#111827] dark:text-zinc-100"
            >
              <option value="Todos">Todos os funcionários</option>
              {colaboradores
                .filter((c) => c.ativo)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome} ({c.funcao})
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 mb-0.5">
              Unidade
            </label>
            <select
              value={filtroUnidade}
              onChange={(e) => setFiltroUnidade(e.target.value as 'Todas' | Unidade)}
              className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-[#111827] dark:text-zinc-100"
            >
              <option value="Todas">Todos os locais</option>
              <option value="Recife">Loja Caxangá - Recife</option>
              <option value="Jaboatão">Av. Bernardo Vieira de Melo - Jaboatão</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 mb-0.5">
              Status
            </label>
            <select
              value={filtroStatus}
              onChange={(e) => setFiltroStatus(e.target.value as 'Todos' | StatusLinha)}
              className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-[#111827] dark:text-zinc-100"
            >
              <option value="Todos">Todos</option>
              <option value="Confirmada">Confirmada</option>
              <option value="Atrasado">Atrasado</option>
              <option value="Fora do local">Fora do local</option>
            </select>
          </div>
        </div>
      </div>

      {/* Lista / Tabela Detalhada de Marcações */}
      {linhasFiltradas.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 p-6 text-center text-xs text-zinc-500 dark:text-zinc-400">
          Nenhuma marcação encontrada para {formatDateBR(dataSelecionada)} com os filtros selecionados.
        </div>
      ) : (
        <>
          {/* Mobile Cards */}
          <div className="space-y-2.5 md:hidden">
            {linhasFiltradas.map((linha) => (
              <div
                key={linha.colaborador.id}
                className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/70 p-3 space-y-2.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-[#111827] dark:text-white truncate">
                      {linha.colaborador.nome}
                    </div>
                    <div className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
                      {linha.colaborador.funcao}
                    </div>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                      linha.status === 'Confirmada'
                        ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                        : linha.status === 'Atrasado'
                          ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300'
                          : 'bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300'
                    }`}
                  >
                    {linha.status}
                  </span>
                </div>

                {/* Marcações E1, S1, E2, S2 */}
                <div className="grid grid-cols-2 gap-1.5">
                  {SLOTS_MARCACAO.map((slot) => {
                    const reg = linha.mapaSlots[slot.key];
                    return (
                      <div
                        key={slot.key}
                        className="flex items-center justify-between gap-1 px-2 py-1.5 rounded-lg bg-white dark:bg-zinc-950 border border-zinc-200/80 dark:border-zinc-800 text-[11px]"
                      >
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="font-bold text-[#474A51] dark:text-zinc-400">
                            {slot.sigla}
                          </span>
                          <span className="font-mono tabular-nums font-semibold text-[#111827] dark:text-white">
                            {reg ? reg.hora.slice(0, 5) : '—:—'}
                          </span>
                        </div>
                        {reg && (
                          <button
                            type="button"
                            onClick={() =>
                              setSelfieModal({
                                colaboradorNome: linha.colaborador.nome,
                                colaboradorFuncao: linha.colaborador.funcao,
                                sigla: `${slot.sigla} · ${slot.label}`,
                                ponto: reg,
                              })
                            }
                            className={`p-1 rounded-md cursor-pointer shrink-0 ${
                              reg.selfieDataUrl
                                ? 'text-[#DC2626] hover:bg-red-50 dark:hover:bg-red-950/40'
                                : 'text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                            }`}
                            title={
                              reg.selfieDataUrl
                                ? `Ver selfie da batida ${slot.sigla}`
                                : `Detalhes da batida ${slot.sigla}`
                            }
                            aria-label={`Ver foto da batida ${slot.sigla}`}
                          >
                            <Camera className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1.5 border-t border-zinc-200/70 dark:border-zinc-800 text-[11px]">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {linha.possuiManualGestor && !linha.todosFacialGps ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-zinc-200 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 font-semibold">
                        <UserCheck className="w-3 h-3 text-[#DC2626]" />
                        Manual · Gestão
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-900 text-emerald-700 dark:text-emerald-300 font-semibold">
                        {linha.localizacaoVerificadaGeral ? (
                          <ShieldCheck className="w-3 h-3 shrink-0" />
                        ) : (
                          <ShieldAlert className="w-3 h-3 text-[#DC2626] shrink-0" />
                        )}
                        Facial + GPS
                      </span>
                    )}
                    <span className="text-zinc-600 dark:text-zinc-300 font-medium inline-flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-[#DC2626] shrink-0" />
                      {linha.localCurto}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => abrirModalRevisar(linha)}
                    className="px-2.5 py-1 rounded-lg bg-[#09090B] hover:bg-[#474A51] text-white font-semibold inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Edit3 className="w-3 h-3" />
                    <span>Revisar</span>
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop / Tablet Table */}
          <div className="hidden md:block overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#09090B] text-white text-[11px] uppercase tracking-wider">
                  <th className="py-2.5 px-3 font-bold">Colaborador</th>
                  <th className="py-2.5 px-3 font-bold">Marcações do Dia (E1 · S1 · E2 · S2)</th>
                  <th className="py-2.5 px-3 font-bold">Método & GPS</th>
                  <th className="py-2.5 px-3 font-bold">Local</th>
                  <th className="py-2.5 px-3 font-bold text-right">Status & Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200/80 dark:divide-zinc-800 bg-white dark:bg-[#1C1C20]">
                {linhasFiltradas.map((linha) => (
                  <tr
                    key={linha.colaborador.id}
                    className="hover:bg-zinc-50/90 dark:hover:bg-zinc-900/50 transition-colors"
                  >
                    <td className="py-2.5 px-3 align-middle">
                      <div className="font-bold text-[#111827] dark:text-white">
                        {linha.colaborador.nome}
                      </div>
                      <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                        {linha.colaborador.funcao}
                      </div>
                    </td>

                    <td className="py-2.5 px-3 align-middle">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {SLOTS_MARCACAO.map((slot) => {
                          const reg = linha.mapaSlots[slot.key];
                          return (
                            <div
                              key={slot.key}
                              className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg border text-[11px] ${
                                reg
                                  ? 'bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700'
                                  : 'bg-zinc-50/40 dark:bg-zinc-950/40 border-zinc-100 dark:border-zinc-800/70 text-zinc-400'
                              }`}
                            >
                              <span className="font-bold text-[#474A51] dark:text-zinc-400">
                                {slot.sigla}
                              </span>
                              <span className="font-mono tabular-nums font-semibold">
                                {reg ? reg.hora.slice(0, 5) : '—:—'}
                              </span>
                              {reg && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setSelfieModal({
                                      colaboradorNome: linha.colaborador.nome,
                                      colaboradorFuncao: linha.colaborador.funcao,
                                      sigla: `${slot.sigla} · ${slot.label}`,
                                      ponto: reg,
                                    })
                                  }
                                  className={`p-0.5 rounded cursor-pointer transition-colors ${
                                    reg.selfieDataUrl
                                      ? 'text-[#DC2626] hover:bg-red-100/70 dark:hover:bg-red-950/50'
                                      : 'text-zinc-400 hover:bg-zinc-200/70 dark:hover:bg-zinc-800'
                                  }`}
                                  title={
                                    reg.selfieDataUrl
                                      ? `Ver selfie capturada (${slot.sigla})`
                                      : `Ver detalhes da batida (${slot.sigla})`
                                  }
                                  aria-label={`Ver selfie da batida ${slot.sigla} de ${linha.colaborador.nome}`}
                                >
                                  <Camera className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </td>

                    <td className="py-2.5 px-3 align-middle">
                      <div className="flex flex-col items-start gap-1">
                        {linha.possuiManualGestor && !linha.todosFacialGps ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 text-[11px] font-semibold">
                            <UserCheck className="w-3.5 h-3.5 text-[#DC2626]" />
                            <span>Manual · Gestão</span>
                          </span>
                        ) : (
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border ${
                              linha.localizacaoVerificadaGeral
                                ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-300'
                                : 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-900 text-red-700 dark:text-red-300'
                            }`}
                          >
                            {linha.localizacaoVerificadaGeral ? (
                              <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                            ) : (
                              <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                            )}
                            <span>Facial + GPS</span>
                          </span>
                        )}
                        {linha.distanciaPrincipal !== null && (
                          <span className="text-[10px] font-mono text-zinc-500 dark:text-zinc-400">
                            Raio: {linha.distanciaPrincipal}m
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="py-2.5 px-3 align-middle">
                      <div className="flex items-center gap-1.5 font-semibold text-[#111827] dark:text-zinc-200">
                        <MapPin className="w-3.5 h-3.5 text-[#DC2626] shrink-0" />
                        <span>{linha.localCurto}</span>
                      </div>
                      <div className="text-[10px] text-zinc-500 dark:text-zinc-400 pl-5">
                        {linha.unidadeIdentificada}
                      </div>
                    </td>

                    <td className="py-2.5 px-3 align-middle text-right">
                      <div className="inline-flex items-center justify-end gap-2">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                            linha.status === 'Confirmada'
                              ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                              : linha.status === 'Atrasado'
                                ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300'
                                : 'bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300'
                          }`}
                        >
                          {linha.status}
                        </span>
                        <button
                          type="button"
                          onClick={() => abrirModalRevisar(linha)}
                          className="px-2.5 py-1 rounded-lg bg-[#09090B] hover:bg-[#474A51] text-white text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer transition-colors"
                        >
                          <Edit3 className="w-3 h-3" />
                          <span>Revisar</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Mapa Interativo Inferior ("Localização das marcações") */}
      <MapaMarcacoesLeaflet marcacoes={marcacoesMapa} config={config} />

      {/* Modal Selfie da Batida */}
      {selfieModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3">
          <div className="w-full max-w-[380px] rounded-xl bg-white dark:bg-[#1C1C20] text-[#111827] dark:text-zinc-100 p-4 shadow-2xl border border-zinc-200 dark:border-zinc-800 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="text-sm font-bold truncate">{selfieModal.colaboradorNome}</h3>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  {selfieModal.sigla} · {selfieModal.ponto.hora} ·{' '}
                  {getLocalCompleto(selfieModal.ponto.unidade)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelfieModal(null)}
                className="p-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer shrink-0"
                aria-label="Fechar foto"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {selfieModal.ponto.selfieDataUrl ? (
              <img
                src={selfieModal.ponto.selfieDataUrl}
                alt={`Selfie de ${selfieModal.colaboradorNome}`}
                className="w-full aspect-square object-cover rounded-xl border border-zinc-200 dark:border-zinc-700"
              />
            ) : (
              <div className="rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 text-center text-xs text-zinc-500 dark:text-zinc-400 space-y-1.5">
                <UserCheck className="w-7 h-7 mx-auto text-[#DC2626]" />
                <div className="font-semibold text-[#111827] dark:text-white">
                  Batida lançada manualmente pela gestão
                </div>
                {selfieModal.ponto.registradoPor && (
                  <div>Responsável: {selfieModal.ponto.registradoPor}</div>
                )}
                {selfieModal.ponto.justificativaDeslocamento && (
                  <div className="italic">"{selfieModal.ponto.justificativaDeslocamento}"</div>
                )}
              </div>
            )}

            <div className="text-[11px] text-zinc-500 dark:text-zinc-400 flex items-center justify-between pt-1 border-t border-zinc-200 dark:border-zinc-800">
              <span>NSR #{selfieModal.ponto.nsr}</span>
              <span>
                {selfieModal.ponto.latitude !== null
                  ? `GPS: ${selfieModal.ponto.latitude.toFixed(5)}, ${selfieModal.ponto.longitude?.toFixed(5)} (${selfieModal.ponto.distanciaMetros ?? 0}m)`
                  : 'Sem coordenada GPS'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Modal + Incluir horário */}
      {modalIncluirAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3">
          <div className="w-full max-w-[420px] max-h-[92vh] overflow-y-auto rounded-xl bg-white dark:bg-[#1C1C20] text-[#111827] dark:text-zinc-100 p-4 shadow-2xl border border-zinc-200 dark:border-zinc-800 space-y-3">
            <div className="flex items-center justify-between gap-2 pb-2 border-b border-zinc-200 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <Plus className="w-4 h-4 text-[#DC2626]" />
                <h3 className="text-sm font-bold">Incluir Horário / Deslocamento</h3>
              </div>
              <button
                type="button"
                onClick={() => setModalIncluirAberto(false)}
                className="p-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
                aria-label="Fechar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {incluirErro && (
              <div className="p-2 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300">
                {incluirErro}
              </div>
            )}

            <form onSubmit={handleConfirmarIncluir} className="space-y-2.5 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-zinc-600 dark:text-zinc-300 mb-1">
                  Colaborador
                </label>
                <select
                  value={incluirColabId}
                  onChange={(e) => setIncluirColabId(e.target.value)}
                  className="w-full px-2.5 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900"
                >
                  {colaboradores
                    .filter((c) => c.ativo)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nome} · {c.funcao}
                      </option>
                    ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold text-zinc-600 dark:text-zinc-300 mb-1">
                    Unidade
                  </label>
                  <select
                    value={incluirUnidade}
                    onChange={(e) => setIncluirUnidade(e.target.value as Unidade)}
                    className="w-full px-2.5 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900"
                  >
                    <option value="Recife">Loja Caxangá - Recife</option>
                    <option value="Jaboatão">Av. Bernardo Vieira de Melo - Jaboatão</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-zinc-600 dark:text-zinc-300 mb-1">
                    Marcação
                  </label>
                  <select
                    value={incluirTipo}
                    onChange={(e) => setIncluirTipo(e.target.value as TipoMarcacao)}
                    className="w-full px-2.5 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900"
                  >
                    {SLOTS_MARCACAO.map((s) => (
                      <option key={s.key} value={s.key}>
                        {s.sigla} · {s.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold text-zinc-600 dark:text-zinc-300 mb-1">
                    Data
                  </label>
                  <input
                    type="date"
                    required
                    value={incluirData}
                    onChange={(e) => setIncluirData(e.target.value)}
                    className="w-full px-2.5 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-zinc-600 dark:text-zinc-300 mb-1">
                    Horário
                  </label>
                  <input
                    type="time"
                    required
                    value={incluirHora}
                    onChange={(e) => setIncluirHora(e.target.value)}
                    className="w-full px-2.5 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-zinc-600 dark:text-zinc-300 mb-1">
                  Motivo / Deslocamento de Unidade
                </label>
                <textarea
                  rows={2}
                  value={incluirJustificativa}
                  onChange={(e) => setIncluirJustificativa(e.target.value)}
                  placeholder="Ex.: Deslocamento para apoio na Loja Jaboatão ou esquecimento de batida..."
                  className="w-full px-2.5 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900"
                />
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setModalIncluirAberto(false)}
                  className="flex-1 py-2 px-3 rounded-lg border border-zinc-300 dark:border-zinc-700 font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={salvandoIncluir}
                  className="flex-1 py-2 px-3 rounded-lg bg-[#DC2626] hover:bg-red-700 text-white font-bold cursor-pointer disabled:opacity-60"
                >
                  {salvandoIncluir ? 'SALVANDO...' : 'GRAVAR HORÁRIO'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Revisar (Editar horários ou Abonar atraso) */}
      {linhaRevisao && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3">
          <div className="w-full max-w-[460px] max-h-[92vh] overflow-y-auto rounded-xl bg-white dark:bg-[#1C1C20] text-[#111827] dark:text-zinc-100 p-4 shadow-2xl border border-zinc-200 dark:border-zinc-800 space-y-3 text-xs">
            <div className="flex items-start justify-between gap-2 pb-2 border-b border-zinc-200 dark:border-zinc-800">
              <div>
                <h3 className="text-sm font-bold">
                  Revisar Marcações · {linhaRevisao.colaborador.nome}
                </h3>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  {linhaRevisao.colaborador.funcao} · {formatDateBR(dataSelecionada)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRevisarColabId(null)}
                className="p-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
                aria-label="Fechar revisão"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {revisarErro && (
              <div className="p-2 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300">
                {revisarErro}
              </div>
            )}

            {revisarSucesso && (
              <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-300">
                {revisarSucesso}
              </div>
            )}

            <div className="space-y-2">
              <div className="font-bold text-[11px] uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Editar horários registados
              </div>
              <input
                type="text"
                value={motivoRevisao}
                onChange={(e) => setMotivoRevisao(e.target.value)}
                placeholder="Motivo da revisão..."
                className="w-full px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900"
              />

              <div className="space-y-2">
                {linhaRevisao.pontosDia.map((p) => {
                  const slot = SLOTS_MARCACAO.find((s) => s.key === p.tipo);
                  return (
                    <div
                      key={p.id}
                      className="p-2 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex flex-wrap items-center gap-2"
                    >
                      <span className="font-bold w-16 shrink-0">
                        {slot?.sigla || ''} {slot?.label || p.tipo}
                      </span>
                      <input
                        type="time"
                        value={edicoesHora[p.id] ?? p.hora.slice(0, 5)}
                        onChange={(e) =>
                          setEdicoesHora((prev) => ({ ...prev, [p.id]: e.target.value }))
                        }
                        className="px-2 py-1 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 font-mono"
                      />
                      <select
                        value={edicoesUnidade[p.id] ?? p.unidade}
                        onChange={(e) =>
                          setEdicoesUnidade((prev) => ({
                            ...prev,
                            [p.id]: e.target.value as Unidade,
                          }))
                        }
                        className="flex-1 min-w-[120px] px-2 py-1 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950"
                      >
                        <option value="Recife">Recife</option>
                        <option value="Jaboatão">Jaboatão</option>
                      </select>
                      <button
                        type="button"
                        disabled={salvandoRevisao}
                        onClick={() => void handleSalvarEdicaoPonto(p)}
                        className="px-2.5 py-1 rounded bg-[#DC2626] hover:bg-red-700 text-white font-semibold cursor-pointer disabled:opacity-60"
                      >
                        Salvar
                      </button>
                      <button
                        type="button"
                        disabled={salvandoRevisao}
                        onClick={() => void handleExcluirPonto(p.id)}
                        className="p-1.5 rounded text-zinc-400 hover:text-red-600 cursor-pointer disabled:opacity-60"
                        title="Remover marcação"
                        aria-label="Remover marcação"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800 space-y-2">
              <div className="font-bold text-[11px] uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Abonar atraso / justificativa do dia
              </div>
              <div className="grid grid-cols-[110px_1fr] gap-2">
                <div>
                  <label className="block text-[10px] text-zinc-500 mb-0.5">Minutos</label>
                  <input
                    type="number"
                    min={1}
                    max={600}
                    value={abonoMinutos}
                    onChange={(e) => setAbonoMinutos(e.target.value)}
                    className="w-full px-2 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-zinc-500 mb-0.5">Justificativa</label>
                  <input
                    type="text"
                    value={abonoMotivo}
                    onChange={(e) => setAbonoMotivo(e.target.value)}
                    className="w-full px-2 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900"
                  />
                </div>
              </div>
              <button
                type="button"
                disabled={salvandoRevisao}
                onClick={() => void handleAbonarAtrasoDia()}
                className="w-full py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer disabled:opacity-60"
              >
                ABONAR ATRASO / JUSTIFICAR DIA
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
