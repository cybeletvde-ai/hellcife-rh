import React, { useMemo, useState } from 'react';
import {
  CalendarCog,
  Camera,
  Check,
  CheckSquare,
  Download,
  FileText,
  Lock,
  MapPin,
  PieChart,
  Receipt,
  ShieldCheck,
  Trash2,
  Unlock,
  UserCheck,
  X,
} from 'lucide-react';
import { DemonstrativoHoleriteCard } from '../DemonstrativoHoleriteCard';
import { sha256Hex } from '../../services/storage';
import { formatRecifeDateTimeBR } from '../../services/serverTime';
import {
  AjusteEscala,
  Atestado,
  Colaborador,
  ConfiguracaoEmpresa,
  FechamentoMensal,
  Feriado,
  HoleriteConfigurado,
  JornadaTemplate,
  RegistroPonto,
  StatusAtestado,
  TipoMarcacao,
  Unidade,
  getDadosEmpresaUnidade,
  temPermissaoGestao,
} from '../../types/rh';
import {
  calcularEspelhoMensal,
  calcularHoleriteMensal,
  calcularRetribuicaoSimplesNacional,
  formatBRL,
  formatDateBR,
  formatMinutesDecimal,
  formatMinutesToHHMM,
  getCurrentMonthStr,
  getTodayStr,
} from '../../utils/cltCalculations';

interface RHCommonProps {
  colaboradorAtual: Colaborador;
  colaboradores: Colaborador[];
  unidadeAtiva: Unidade;
  pontos: RegistroPonto[];
  jornadas: JornadaTemplate[];
  ajustes: AjusteEscala[];
  feriados: Feriado[];
  atestados: Atestado[];
  fechamentos: FechamentoMensal[];
  config: ConfiguracaoEmpresa;
  holeritesConfigurados?: HoleriteConfigurado[];
}

interface FechamentoViewProps extends RHCommonProps {
  onAtualizarAtestado: (id: string, status: StatusAtestado) => Promise<boolean>;
  onSalvarAjuste: (ajuste: AjusteEscala) => Promise<boolean>;
  onRemoverAjuste: (id: string) => Promise<boolean>;
  onAlternarFechamento: (mes: string, unidade: 'Todas' | Unidade) => Promise<boolean>;
  onRegistrarPonto: (registro: RegistroPonto) => Promise<RegistroPonto | null>;
}

const LABELS_TIPO_PONTO: Record<TipoMarcacao, string> = {
  entrada: 'Entrada',
  saida_almoco: 'Saída Almoço',
  retorno_almoco: 'Retorno Almoço',
  saida: 'Saída',
};

export const FechamentoView: React.FC<FechamentoViewProps> = ({
  colaboradorAtual,
  colaboradores,
  unidadeAtiva,
  pontos,
  atestados,
  ajustes,
  fechamentos,
  config,
  onAtualizarAtestado,
  onSalvarAjuste,
  onRemoverAjuste,
  onAlternarFechamento,
  onRegistrarPonto,
}) => {
  const isGestor = temPermissaoGestao(colaboradorAtual.funcao);
  const [mes, setMes] = useState(getCurrentMonthStr);
  const [colabId, setColabId] = useState(colaboradores[0]?.id || '');
  const [dataAjuste, setDataAjuste] = useState(getTodayStr);
  const [tipoAjuste, setTipoAjuste] = useState<'normal' | 'folga' | 'horario_proprio'>('folga');
  const [entradaCustom, setEntradaCustom] = useState('09:00');
  const [saidaCustom, setSaidaCustom] = useState('15:00');
  const [cargaHorasCustom, setCargaHorasCustom] = useState('6');
  const [motivoAjuste, setMotivoAjuste] = useState('Feriado municipal / Ajuste de escala');

  // Registo Manual / Deslocamento de Unidade (exclusivo Administradora / Diretor)
  const [colabManualId, setColabManualId] = useState(colaboradores[0]?.id || '');
  const [unidadeManual, setUnidadeManual] = useState<Unidade>(unidadeAtiva);
  const [tipoManual, setTipoManual] = useState<TipoMarcacao>('entrada');
  const [dataManual, setDataManual] = useState(getTodayStr);
  const [horaManual, setHoraManual] = useState('09:00');
  const [justificativaManual, setJustificativaManual] = useState('');
  const [erroManual, setErroManual] = useState('');
  const [sucessoManual, setSucessoManual] = useState('');
  const [salvandoManual, setSalvandoManual] = useState(false);

  // Auditoria Visual (Selfies & Deslocamentos)
  const [filtroAuditoriaColab, setFiltroAuditoriaColab] = useState<string>('Todos');
  const [selfieAmpliada, setSelfieAmpliada] = useState<{
    nome: string;
    detalhe: string;
    src: string;
  } | null>(null);

  const pendentes = atestados.filter((a) => a.status === 'Pendente');
  const isFechado = fechamentos.some(
    (f) => f.mes === mes && (f.unidade === 'Todas' || f.unidade === unidadeAtiva)
  );

  const pontosAuditoria = useMemo(() => {
    return pontos
      .filter((p) => p.data.startsWith(mes))
      .filter((p) => filtroAuditoriaColab === 'Todos' || p.colaboradorId === filtroAuditoriaColab)
      .sort((a, b) => `${b.data}T${b.hora}`.localeCompare(`${a.data}T${a.hora}`));
  }, [pontos, mes, filtroAuditoriaColab]);

  const handleAddAjuste = (e: React.FormEvent) => {
    e.preventDefault();
    if (!colabId || !dataAjuste) return;
    const cargaMin = Math.round((parseFloat(cargaHorasCustom.replace(',', '.')) || 0) * 60);
    onSalvarAjuste({
      id: `aj-${Date.now()}`,
      colaboradorId: colabId,
      data: dataAjuste,
      tipo: tipoAjuste,
      entradaCustom: tipoAjuste === 'horario_proprio' ? entradaCustom : undefined,
      saidaCustom: tipoAjuste === 'horario_proprio' ? saidaCustom : undefined,
      cargaMinCustom: tipoAjuste === 'horario_proprio' ? cargaMin : undefined,
      motivo: motivoAjuste.trim() || 'Ajuste de escala',
    });
  };

  const handleRegistrarDeslocamentoManual = async (e: React.FormEvent) => {
    e.preventDefault();
    setErroManual('');
    setSucessoManual('');

    if (!isGestor) {
      setErroManual('Apenas Administradora e Diretor podem lançar marcações manuais.');
      return;
    }

    const colabAlvo = colaboradores.find((c) => c.id === colabManualId);
    if (!colabAlvo) {
      setErroManual('Selecione um colaborador válido.');
      return;
    }
    if (!dataManual || !horaManual) {
      setErroManual('Informe a data e a hora da marcação.');
      return;
    }
    const justTrim = justificativaManual.trim();
    if (justTrim.length < 5) {
      setErroManual('Informe uma justificativa obrigatória (mínimo 5 caracteres).');
      return;
    }

    setSalvandoManual(true);
    try {
      const horaCompleta = horaManual.length === 5 ? `${horaManual}:00` : horaManual;
      const empresaUnidade = getDadosEmpresaUnidade(config, unidadeManual);
      const nsr = Math.floor(Date.now() / 1000) % 1000000;
      const payload = `${nsr}|${empresaUnidade.cnpj || config.cnpj}|${colabAlvo.id}|${dataManual}|${horaCompleta}|${unidadeManual}|${tipoManual}|MANUAL:${colaboradorAtual.nome}`;
      const hashComprovante = await sha256Hex(payload);

      const novoPonto: RegistroPonto = {
        id: `pt-manual-${Date.now()}`,
        nsr,
        colaboradorId: colabAlvo.id,
        unidade: unidadeManual,
        data: dataManual,
        hora: horaCompleta,
        timestamp: new Date(`${dataManual}T${horaCompleta}-03:00`).toISOString(),
        tipo: tipoManual,
        latitude: null,
        longitude: null,
        distanciaMetros: null,
        localizacaoVerificada: true,
        registradoPor: colaboradorAtual.nome,
        justificativaDeslocamento: justTrim,
        origemRegistro: 'manual_gestor',
        hashComprovante,
      };

      const gravado = await onRegistrarPonto(novoPonto);
      if (gravado) {
        setJustificativaManual('');
        setSucessoManual(
          `Marcação registada para ${colabAlvo.nome} na unidade ${unidadeManual} (Responsável: ${colaboradorAtual.nome}).`
        );
      }
    } finally {
      setSalvandoManual(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* Status do Fechamento */}
      <section className="bg-white dark:bg-[#1C1C20] text-[#111827] dark:text-zinc-100 rounded-xl p-3 shadow-sm border border-zinc-200/80 dark:border-zinc-800">
        <div className="flex items-center justify-between gap-2 mb-2.5">
          <div className="flex items-center gap-2 min-w-0">
            <CheckSquare className="w-4 h-4 text-[#DC2626] shrink-0" />
            <h1 className="text-sm font-bold truncate">Fechamento do Mês</h1>
          </div>
          <input
            type="month"
            value={mes}
            onChange={(e) => setMes(e.target.value)}
            className="text-xs font-medium px-2 py-1 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900"
          />
        </div>

        <div className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-200/70 dark:border-zinc-800">
          <div className="text-xs">
            <div className="font-bold">
              Competência {mes} · {unidadeAtiva}
            </div>
            <div className="text-zinc-500 dark:text-zinc-400">
              {isFechado ? 'Competência fechada na folha' : 'Competência aberta para ajustes'}
            </div>
          </div>
          <button
            type="button"
            onClick={() => onAlternarFechamento(mes, unidadeAtiva)}
            className={`px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer shrink-0 ${
              isFechado
                ? 'bg-zinc-200 dark:bg-zinc-800 text-[#111827] dark:text-white'
                : 'bg-[#DC2626] text-white hover:bg-red-700'
            }`}
          >
            {isFechado ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
            <span>{isFechado ? 'Reabrir' : 'Fechar Mês'}</span>
          </button>
        </div>
      </section>

      {/* Aprovação de Atestados com 1 clique */}
      <section className="bg-white dark:bg-[#1C1C20] text-[#111827] dark:text-zinc-100 rounded-xl p-3 shadow-sm border border-zinc-200/80 dark:border-zinc-800">
        <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2">
          Atestados & Justificativas Pendentes ({pendentes.length})
        </h2>
        {pendentes.length === 0 ? (
          <p className="text-xs text-zinc-500 dark:text-zinc-400 py-1">
            Nenhuma solicitação pendente de análise.
          </p>
        ) : (
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800 space-y-2.5">
            {pendentes.map((at) => {
              const col = colaboradores.find((c) => c.id === at.colaboradorId);
              return (
                <div key={at.id} className="pt-2.5 first:pt-0 text-xs space-y-1.5">
                  <div className="flex justify-between gap-2">
                    <span className="font-bold">{col?.nome || 'Colaborador'}</span>
                    <span className="text-zinc-500 dark:text-zinc-400">{at.tipo}</span>
                  </div>
                  <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                    {formatDateBR(at.dataInicio)}
                    {at.dataFim !== at.dataInicio ? ` até ${formatDateBR(at.dataFim)}` : ''}
                    {at.minutosAbonados ? ` · ${at.minutosAbonados} min` : ''}
                  </div>
                  <p className="text-zinc-700 dark:text-zinc-300">{at.motivo}</p>
                  {at.anexoDataUrl && at.anexoDataUrl.startsWith('data:image') && (
                    <img
                      src={at.anexoDataUrl}
                      alt="Anexo"
                      className="max-h-24 rounded-lg border border-zinc-200 dark:border-zinc-700"
                    />
                  )}
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => onAtualizarAtestado(at.id, 'Aprovado')}
                      className="py-1.5 px-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Aprovar</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onAtualizarAtestado(at.id, 'Recusado')}
                      className="py-1.5 px-2 rounded-lg bg-zinc-200 dark:bg-zinc-800 hover:bg-red-600 hover:text-white text-[#111827] dark:text-zinc-200 font-semibold flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>Recusar</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Ajustes Individuais de Escala / Feriados */}
      <section className="bg-white dark:bg-[#1C1C20] text-[#111827] dark:text-zinc-100 rounded-xl p-3 shadow-sm border border-zinc-200/80 dark:border-zinc-800 space-y-2.5">
        <div className="flex items-center gap-2">
          <CalendarCog className="w-4 h-4 text-[#DC2626] shrink-0" />
          <h2 className="text-sm font-bold">Ajustar Escala / Feriado Individual</h2>
        </div>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Defina Folga (dia sem jornada) ou Horário próprio para diferenciar feriados municipais (ex.: 08/12 em Recife vs. Jaboatão).
        </p>

        <form onSubmit={handleAddAjuste} className="space-y-2">
          <select
            value={colabId}
            onChange={(e) => setColabId(e.target.value)}
            className="w-full px-2.5 py-2 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900"
          >
            {colaboradores.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome} ({c.lotacao})
              </option>
            ))}
          </select>

          <div className="grid grid-cols-2 gap-2">
            <input
              type="date"
              value={dataAjuste}
              onChange={(e) => setDataAjuste(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900"
            />
            <select
              value={tipoAjuste}
              onChange={(e) =>
                setTipoAjuste(e.target.value as 'normal' | 'folga' | 'horario_proprio')
              }
              className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900"
            >
              <option value="folga">Folga (dia sem jornada)</option>
              <option value="horario_proprio">Horário próprio</option>
              <option value="normal">Normal (Escala)</option>
            </select>
          </div>

          {tipoAjuste === 'horario_proprio' && (
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-[10px] text-zinc-500 mb-0.5">Entrada</label>
                <input
                  type="time"
                  value={entradaCustom}
                  onChange={(e) => setEntradaCustom(e.target.value)}
                  className="w-full px-2 py-1 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900"
                />
              </div>
              <div>
                <label className="block text-[10px] text-zinc-500 mb-0.5">Saída</label>
                <input
                  type="time"
                  value={saidaCustom}
                  onChange={(e) => setSaidaCustom(e.target.value)}
                  className="w-full px-2 py-1 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900"
                />
              </div>
              <div>
                <label className="block text-[10px] text-zinc-500 mb-0.5">Carga (h)</label>
                <input
                  type="text"
                  value={cargaHorasCustom}
                  onChange={(e) => setCargaHorasCustom(e.target.value)}
                  className="w-full px-2 py-1 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900"
                />
              </div>
            </div>
          )}

          <input
            type="text"
            value={motivoAjuste}
            onChange={(e) => setMotivoAjuste(e.target.value)}
            placeholder="Motivo do ajuste..."
            className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900"
          />

          <button
            type="submit"
            disabled={colaboradores.length === 0}
            className="w-full py-2 px-3 rounded-lg bg-[#DC2626] hover:bg-red-700 text-white text-xs font-bold cursor-pointer disabled:opacity-50"
          >
            SALVAR AJUSTE DE ESCALA
          </button>
        </form>

        {ajustes.length > 0 && (
          <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800 divide-y divide-zinc-100 dark:divide-zinc-800 text-xs">
            {ajustes.map((aj) => {
              const col = colaboradores.find((c) => c.id === aj.colaboradorId);
              return (
                <div key={aj.id} className="py-1.5 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-semibold truncate">
                      {col?.nome} · {formatDateBR(aj.data)}
                    </div>
                    <div className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
                      {aj.tipo === 'folga'
                        ? 'Folga (sem jornada)'
                        : aj.tipo === 'horario_proprio'
                          ? `Horário próprio (${aj.entradaCustom}–${aj.saidaCustom})`
                          : 'Normal'}{' '}
                      · {aj.motivo}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onRemoverAjuste(aj.id)}
                    className="p-1 text-zinc-400 hover:text-red-600 cursor-pointer shrink-0"
                    aria-label="Remover ajuste"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Registo Manual / Deslocamento de Unidade (Exclusivo Administradora e Diretor) */}
      {isGestor && (
        <section className="bg-white dark:bg-[#1C1C20] text-[#111827] dark:text-zinc-100 rounded-xl p-3 md:p-4 shadow-sm border border-zinc-200/80 dark:border-zinc-800 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <UserCheck className="w-4 h-4 text-[#DC2626] shrink-0" />
              <h2 className="text-sm font-bold truncate">
                Registo Manual / Deslocamento de Unidade
              </h2>
            </div>
            <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-red-50 dark:bg-red-950/40 text-[#DC2626] shrink-0">
              Gestão
            </span>
          </div>

          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Exclusivo para Administradora e Diretor. Utilize quando um colaborador estiver deslocado temporariamente noutra unidade ou precisar de validação manual.
          </p>

          {erroManual && (
            <div className="p-2 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300">
              {erroManual}
            </div>
          )}

          {sucessoManual && (
            <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 text-xs text-emerald-700 dark:text-emerald-300">
              {sucessoManual}
            </div>
          )}

          <form onSubmit={handleRegistrarDeslocamentoManual} className="space-y-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] text-zinc-500 mb-0.5">Colaborador</label>
                <select
                  value={colabManualId}
                  onChange={(e) => setColabManualId(e.target.value)}
                  className="w-full px-2.5 py-2 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900"
                >
                  {colaboradores
                    .filter((c) => c.ativo)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nome} (Lotação: {c.lotacao})
                      </option>
                    ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] text-zinc-500 mb-0.5">
                    Unidade da Marcação
                  </label>
                  <select
                    value={unidadeManual}
                    onChange={(e) => setUnidadeManual(e.target.value as Unidade)}
                    className="w-full px-2.5 py-2 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900"
                  >
                    <option value="Recife">Recife</option>
                    <option value="Jaboatão">Jaboatão</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] text-zinc-500 mb-0.5">Tipo de Batida</label>
                  <select
                    value={tipoManual}
                    onChange={(e) => setTipoManual(e.target.value as TipoMarcacao)}
                    className="w-full px-2.5 py-2 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900"
                  >
                    <option value="entrada">Entrada</option>
                    <option value="saida_almoco">Saída Almoço</option>
                    <option value="retorno_almoco">Retorno Almoço</option>
                    <option value="saida">Saída</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              <div>
                <label className="block text-[10px] text-zinc-500 mb-0.5">Data</label>
                <input
                  type="date"
                  required
                  value={dataManual}
                  onChange={(e) => setDataManual(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900"
                />
              </div>
              <div>
                <label className="block text-[10px] text-zinc-500 mb-0.5">Hora</label>
                <input
                  type="time"
                  required
                  value={horaManual}
                  onChange={(e) => setHoraManual(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 font-mono"
                />
              </div>
              <div className="col-span-2 md:col-span-1">
                <label className="block text-[10px] text-zinc-500 mb-0.5">
                  Gestor Responsável (registrado_por)
                </label>
                <input
                  type="text"
                  readOnly
                  value={colaboradorAtual.nome}
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-950 text-zinc-600 dark:text-zinc-300 font-semibold"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] text-zinc-500 mb-0.5">
                Justificativa Obrigatória
              </label>
              <textarea
                rows={2}
                required
                value={justificativaManual}
                onChange={(e) => setJustificativaManual(e.target.value)}
                placeholder="Ex.: Deslocamento temporário da loja Recife para cobertura na loja Jaboatão..."
                className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900"
              />
            </div>

            <button
              type="submit"
              disabled={salvandoManual || colaboradores.length === 0}
              className="w-full py-2 px-3 rounded-lg bg-[#DC2626] hover:bg-red-700 text-white text-xs font-bold cursor-pointer disabled:opacity-50"
            >
              {salvandoManual
                ? 'GRAVANDO NO SUPABASE...'
                : 'VALIDAR E GRAVAR MARCAÇÃO DE DESLOCAMENTO'}
            </button>
          </form>
        </section>
      )}

      {/* Auditoria de Marcações: Selfies, GPS, Hora Servidor & Deslocamentos */}
      {isGestor && (
        <section className="bg-white dark:bg-[#1C1C20] text-[#111827] dark:text-zinc-100 rounded-xl p-3 md:p-4 shadow-sm border border-zinc-200/80 dark:border-zinc-800 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <Camera className="w-4 h-4 text-[#DC2626] shrink-0" />
              <h2 className="text-sm font-bold truncate">
                Auditoria de Marcações ({pontosAuditoria.length})
              </h2>
            </div>

            <select
              value={filtroAuditoriaColab}
              onChange={(e) => setFiltroAuditoriaColab(e.target.value)}
              className="text-xs px-2 py-1 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900"
            >
              <option value="Todos">Todos os colaboradores</option>
              {colaboradores.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </div>

          {pontosAuditoria.length === 0 ? (
            <p className="text-xs text-zinc-500 dark:text-zinc-400 py-1">
              Nenhuma marcação registada nesta competência ({mes}).
            </p>
          ) : (
            <div className="divide-y divide-zinc-100 dark:divide-zinc-800 max-h-[420px] overflow-y-auto pr-1">
              {pontosAuditoria.slice(0, 60).map((p) => {
                const col = colaboradores.find((c) => c.id === p.colaboradorId);
                return (
                  <div key={p.id} className="py-2.5 flex items-start gap-2.5 text-xs">
                    {p.selfieDataUrl ? (
                      <button
                        type="button"
                        onClick={() =>
                          setSelfieAmpliada({
                            nome: col?.nome || 'Colaborador',
                            detalhe: `${formatDateBR(p.data)} ${p.hora.slice(0, 5)} · ${LABELS_TIPO_PONTO[p.tipo]} · Loja ${p.unidade}`,
                            src: p.selfieDataUrl!,
                          })
                        }
                        className="w-12 h-12 rounded-lg overflow-hidden border border-zinc-200 dark:border-zinc-700 shrink-0 cursor-pointer hover:opacity-90"
                        title="Ampliar selfie de auditoria"
                      >
                        <img
                          src={p.selfieDataUrl}
                          alt={`Selfie ${col?.nome || ''}`}
                          className="w-full h-full object-cover"
                        />
                      </button>
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex items-center justify-center shrink-0 text-zinc-400">
                        {p.origemRegistro === 'manual_gestor' ? (
                          <UserCheck className="w-5 h-5 text-[#DC2626]" />
                        ) : (
                          <Camera className="w-4 h-4" />
                        )}
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-1">
                        <span className="font-bold truncate">{col?.nome || 'Colaborador'}</span>
                        <span className="font-mono tabular-nums font-semibold text-[11px]">
                          {formatDateBR(p.data)} {p.hora.slice(0, 5)}
                        </span>
                      </div>

                      <div className="text-[11px] text-zinc-600 dark:text-zinc-300 flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
                        <span className="font-semibold text-[#DC2626]">
                          {LABELS_TIPO_PONTO[p.tipo]}
                        </span>
                        <span>· Loja {p.unidade}</span>
                        {p.origemRegistro === 'manual_gestor' ? (
                          <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-400 font-semibold">
                            · Registrado por: {p.registradoPor || 'Gestão'}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
                            <MapPin className="w-3 h-3" />
                            <span>
                              GPS {p.distanciaMetros ?? 0}m{' '}
                              {p.localizacaoVerificada ? '(Validado)' : ''}
                            </span>
                          </span>
                        )}
                      </div>

                      {p.criadoEmServidor && (
                        <div className="text-[10px] font-mono text-zinc-500 dark:text-zinc-400 mt-0.5">
                          <ShieldCheck className="w-3 h-3 inline mr-1 text-emerald-600" />
                          Servidor (America/Recife): {formatRecifeDateTimeBR(p.criadoEmServidor)}
                        </div>
                      )}

                      {p.justificativaDeslocamento && (
                        <div className="mt-1 text-[11px] text-zinc-600 dark:text-zinc-300 bg-zinc-50 dark:bg-zinc-900 px-2 py-1 rounded border border-zinc-200/70 dark:border-zinc-800">
                          Justificativa: {p.justificativaDeslocamento}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* Modal Selfie Ampliada (Auditoria) */}
      {selfieAmpliada && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 no-print"
          onClick={() => setSelfieAmpliada(null)}
        >
          <div
            className="w-full max-w-[340px] rounded-xl bg-white dark:bg-[#1C1C20] p-3 border border-zinc-200 dark:border-zinc-800 shadow-2xl space-y-2"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="text-xs font-bold truncate">{selfieAmpliada.nome}</div>
                <div className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
                  {selfieAmpliada.detalhe}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelfieAmpliada(null)}
                className="p-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
                aria-label="Fechar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <img
              src={selfieAmpliada.src}
              alt={selfieAmpliada.nome}
              className="w-full aspect-square rounded-lg object-cover border border-zinc-200 dark:border-zinc-700"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export const RelatorioView: React.FC<RHCommonProps> = ({
  colaboradores,
  unidadeAtiva,
  pontos,
  jornadas,
  ajustes,
  feriados,
  atestados,
  config,
}) => {
  const [mes, setMes] = useState(getCurrentMonthStr);
  const [filtroUnidade, setFiltroUnidade] = useState<'Todas' | Unidade>('Todas');

  const linhas = useMemo(() => {
    return colaboradores
      .filter((c) => {
        if (filtroUnidade === 'Todas') return true;
        return c.lotacao === filtroUnidade || c.lotacao === 'Ambas';
      })
      .map((c) => {
        const jornada = jornadas.find((j) => j.id === c.jornadaId) || jornadas[0];
        const unid = c.lotacao === 'Ambas' ? unidadeAtiva : (c.lotacao as Unidade);
        const resumo = calcularEspelhoMensal(
          c,
          mes,
          jornada,
          pontos,
          ajustes,
          feriados,
          atestados,
          config,
          unid
        );
        return { colab: c, resumo };
      });
  }, [colaboradores, filtroUnidade, jornadas, unidadeAtiva, mes, pontos, ajustes, feriados, atestados, config]);

  const exportarCSV = () => {
    const header = [
      'Colaborador',
      'Funcao',
      'Lotacao',
      'Competencia',
      'Dias Trabalhados',
      'Horas Trabalhadas (Dec)',
      'Horas Extras (Dec)',
      'Atrasos (Dec)',
    ].join(';');

    const body = linhas
      .map(({ colab, resumo }) =>
        [
          `"${colab.nome}"`,
          `"${colab.funcao}"`,
          colab.lotacao,
          mes,
          resumo.diasTrabalhados,
          formatMinutesDecimal(resumo.totalMinTrabalhados),
          formatMinutesDecimal(resumo.totalMinExtrasGeral),
          formatMinutesDecimal(resumo.totalMinAtraso),
        ].join(';')
      )
      .join('\n');

    const blob = new Blob(['\ufeff' + header + '\n' + body], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `relatorio-ponto-${mes}-${filtroUnidade.toLowerCase()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-3">
      <section className="bg-white dark:bg-[#1C1C20] text-[#111827] dark:text-zinc-100 rounded-xl p-3 shadow-sm border border-zinc-200/80 dark:border-zinc-800 space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <FileText className="w-4 h-4 text-[#DC2626] shrink-0" />
            <h1 className="text-sm font-bold truncate">Relatório Mensal</h1>
          </div>
          <input
            type="month"
            value={mes}
            onChange={(e) => setMes(e.target.value)}
            className="text-xs font-medium px-2 py-1 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900"
          />
        </div>

        <div className="flex items-center justify-between gap-2">
          <div className="flex gap-1 bg-zinc-100 dark:bg-zinc-900 p-1 rounded-lg">
            {(['Todas', 'Recife', 'Jaboatão'] as const).map((u) => (
              <button
                key={u}
                type="button"
                onClick={() => setFiltroUnidade(u)}
                className={`px-2 py-1 text-[11px] font-semibold rounded-md cursor-pointer ${
                  filtroUnidade === u
                    ? 'bg-white dark:bg-zinc-800 text-[#111827] dark:text-white shadow-xs'
                    : 'text-zinc-500 dark:text-zinc-400'
                }`}
              >
                {u}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={exportarCSV}
            disabled={linhas.length === 0}
            className="px-2.5 py-1.5 rounded-lg bg-[#DC2626] hover:bg-red-700 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Exportar CSV</span>
          </button>
        </div>
      </section>

      <section className="bg-white dark:bg-[#1C1C20] text-[#111827] dark:text-zinc-100 rounded-xl p-3 md:p-4 shadow-sm border border-zinc-200/80 dark:border-zinc-800">
        {linhas.length === 0 ? (
          <p className="text-xs text-zinc-500 dark:text-zinc-400 py-2">
            Nenhum colaborador encontrado para este filtro.
          </p>
        ) : (
          <>
            <div className="divide-y divide-zinc-100 dark:divide-zinc-800 space-y-2.5 md:hidden">
              {linhas.map(({ colab, resumo }) => (
                <div key={colab.id} className="pt-2.5 first:pt-0 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold truncate">{colab.nome}</span>
                    <span className="text-[11px] text-zinc-500 dark:text-zinc-400 shrink-0">
                      {colab.lotacao} · {resumo.diasTrabalhados}d
                    </span>
                  </div>
                  <div className="mt-1 grid grid-cols-3 gap-1.5 text-[11px] bg-zinc-50 dark:bg-zinc-900 rounded-lg p-2">
                    <div>
                      <div className="text-zinc-500 dark:text-zinc-400">Trab. (dec)</div>
                      <div className="font-mono tabular-nums font-bold">
                        {formatMinutesDecimal(resumo.totalMinTrabalhados)}h (
                        {formatMinutesToHHMM(resumo.totalMinTrabalhados)})
                      </div>
                    </div>
                    <div>
                      <div className="text-zinc-500 dark:text-zinc-400">Extras (dec)</div>
                      <div className="font-mono tabular-nums font-bold text-[#DC2626]">
                        {formatMinutesDecimal(resumo.totalMinExtrasGeral)}h
                      </div>
                    </div>
                    <div>
                      <div className="text-zinc-500 dark:text-zinc-400">Atrasos (dec)</div>
                      <div className="font-mono tabular-nums font-bold text-amber-600">
                        {formatMinutesDecimal(resumo.totalMinAtraso)}h
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-zinc-200 dark:border-zinc-800 text-[11px] uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    <th className="py-2 pr-3 font-semibold">Colaborador</th>
                    <th className="py-2 px-2 font-semibold">Função</th>
                    <th className="py-2 px-2 font-semibold">Lotação</th>
                    <th className="py-2 px-2 font-semibold text-center">Dias</th>
                    <th className="py-2 px-2 font-semibold text-right">Trabalhadas</th>
                    <th className="py-2 px-2 font-semibold text-right">Extras (dec)</th>
                    <th className="py-2 pl-2 font-semibold text-right">Atrasos (dec)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {linhas.map(({ colab, resumo }) => (
                    <tr key={colab.id} className="hover:bg-zinc-50/70 dark:hover:bg-zinc-900/50">
                      <td className="py-2 pr-3 font-bold">{colab.nome}</td>
                      <td className="py-2 px-2 text-zinc-500 dark:text-zinc-400">{colab.funcao}</td>
                      <td className="py-2 px-2">{colab.lotacao}</td>
                      <td className="py-2 px-2 text-center font-mono tabular-nums">
                        {resumo.diasTrabalhados}d
                      </td>
                      <td className="py-2 px-2 text-right font-mono tabular-nums font-semibold">
                        {formatMinutesDecimal(resumo.totalMinTrabalhados)}h (
                        {formatMinutesToHHMM(resumo.totalMinTrabalhados)})
                      </td>
                      <td className="py-2 px-2 text-right font-mono tabular-nums font-bold text-[#DC2626]">
                        {formatMinutesDecimal(resumo.totalMinExtrasGeral)}h
                      </td>
                      <td className="py-2 pl-2 text-right font-mono tabular-nums font-bold text-amber-600">
                        {formatMinutesDecimal(resumo.totalMinAtraso)}h
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </div>
  );
};

export const RetribuicaoView: React.FC<RHCommonProps> = ({
  colaboradores,
  unidadeAtiva,
  pontos,
  jornadas,
  ajustes,
  feriados,
  atestados,
  config,
  holeritesConfigurados = [],
}) => {
  const [mes, setMes] = useState(getCurrentMonthStr);
  const ativos = useMemo(() => colaboradores.filter((c) => c.ativo), [colaboradores]);
  const [previewColabId, setPreviewColabId] = useState<string>(() => ativos[0]?.id || '');

  const itens = useMemo(() => {
    return ativos.map((c) => {
      const jornada = jornadas.find((j) => j.id === c.jornadaId) || jornadas[0];
      const unid = c.lotacao === 'Ambas' ? unidadeAtiva : (c.lotacao as Unidade);
      const resumo = calcularEspelhoMensal(
        c,
        mes,
        jornada,
        pontos,
        ajustes,
        feriados,
        atestados,
        config,
        unid
      );
      const holerite = calcularHoleriteMensal(c, resumo, jornada, config);
      const retribuicao = calcularRetribuicaoSimplesNacional(c, holerite);
      return {
        ...retribuicao,
        resumo,
        holerite,
      };
    });
  }, [ativos, jornadas, unidadeAtiva, mes, pontos, ajustes, feriados, atestados, config]);

  const totais = useMemo(() => {
    return itens.reduce(
      (acc, i) => ({
        bruto: acc.bruto + i.remuneracaoBruta,
        fgts: acc.fgts + i.fgts8Pct,
        ferias: acc.ferias + i.provisaoFerias1_12,
        terco: acc.terco + i.provisaoTercoFerias,
        decimo: acc.decimo + i.provisaoDecimoTerceiro1_12,
        fgtsProv: acc.fgtsProv + i.fgtsSobreProvisoes,
        benef: acc.benef + i.beneficiosExternos,
        total: acc.total + i.custoTotalEmpresa,
      }),
      { bruto: 0, fgts: 0, ferias: 0, terco: 0, decimo: 0, fgtsProv: 0, benef: 0, total: 0 }
    );
  }, [itens]);

  const itemPreview = useMemo(() => {
    if (itens.length === 0) return null;
    return itens.find((i) => i.colaborador.id === previewColabId) || itens[0];
  }, [itens, previewColabId]);

  return (
    <div className="space-y-3">
      <section className="no-print bg-white dark:bg-[#1C1C20] text-[#111827] dark:text-zinc-100 rounded-xl p-3 shadow-sm border border-zinc-200/80 dark:border-zinc-800 space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <PieChart className="w-4 h-4 text-[#DC2626] shrink-0" />
            <h1 className="text-sm font-bold truncate">Retribuição · Simples Nacional</h1>
          </div>
          <input
            type="month"
            value={mes}
            onChange={(e) => setMes(e.target.value)}
            className="text-xs font-medium px-2 py-1 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900"
          />
        </div>

        <div className="p-2.5 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-200/70 dark:border-zinc-800 text-xs">
          <div className="font-bold text-emerald-700 dark:text-emerald-400">
            Regime: Simples Nacional (Isento de INSS Patronal 20%)
          </div>
          <div className="text-zinc-500 dark:text-zinc-400 mt-0.5">
            Inclui FGTS (8%), Provisão de Férias (1/12), 1/3 Férias, 13º Salário (1/12), FGTS sobre provisões e benefícios líquidos.
          </div>
        </div>

        <div className="divide-y divide-zinc-100 dark:divide-zinc-800 text-xs">
          <div className="py-1.5 flex justify-between">
            <span className="text-zinc-500 dark:text-zinc-400">Remuneração Bruta Total</span>
            <span className="font-mono tabular-nums font-semibold">{formatBRL(totais.bruto)}</span>
          </div>
          <div className="py-1.5 flex justify-between">
            <span className="text-zinc-500 dark:text-zinc-400">INSS Patronal (20%)</span>
            <span className="font-mono tabular-nums font-semibold text-emerald-600">
              R$ 0,00 (Isento)
            </span>
          </div>
          <div className="py-1.5 flex justify-between">
            <span className="text-zinc-500 dark:text-zinc-400">FGTS (8%)</span>
            <span className="font-mono tabular-nums">{formatBRL(totais.fgts)}</span>
          </div>
          <div className="py-1.5 flex justify-between">
            <span className="text-zinc-500 dark:text-zinc-400">Provisão Férias (1/12)</span>
            <span className="font-mono tabular-nums">{formatBRL(totais.ferias)}</span>
          </div>
          <div className="py-1.5 flex justify-between">
            <span className="text-zinc-500 dark:text-zinc-400">Provisão 1/3 Férias</span>
            <span className="font-mono tabular-nums">{formatBRL(totais.terco)}</span>
          </div>
          <div className="py-1.5 flex justify-between">
            <span className="text-zinc-500 dark:text-zinc-400">Provisão 13º Salário (1/12)</span>
            <span className="font-mono tabular-nums">{formatBRL(totais.decimo)}</span>
          </div>
          <div className="py-1.5 flex justify-between">
            <span className="text-zinc-500 dark:text-zinc-400">FGTS s/ Provisões + Benefícios</span>
            <span className="font-mono tabular-nums">
              {formatBRL(totais.fgtsProv + totais.benef)}
            </span>
          </div>
          <div className="py-2 flex justify-between font-bold text-sm">
            <span>Custo Total Empresa</span>
            <span className="font-mono tabular-nums text-[#DC2626]">{formatBRL(totais.total)}</span>
          </div>
        </div>
      </section>

      {/* Detalhamento por Colaborador */}
      <section className="no-print bg-white dark:bg-[#1C1C20] text-[#111827] dark:text-zinc-100 rounded-xl p-3 md:p-4 shadow-sm border border-zinc-200/80 dark:border-zinc-800">
        <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2">
          Custo por Colaborador
        </h2>

        <div className="divide-y divide-zinc-100 dark:divide-zinc-800 space-y-2 md:hidden">
          {itens.map((it) => {
            const selecionado = itemPreview?.colaborador.id === it.colaborador.id;
            return (
              <div key={it.colaborador.id} className="pt-2 first:pt-0 text-xs">
                <div className="flex items-center justify-between gap-2 font-bold">
                  <span className="truncate">{it.colaborador.nome}</span>
                  <span className="font-mono tabular-nums text-[#DC2626] shrink-0">
                    {formatBRL(it.custoTotalEmpresa)}
                  </span>
                </div>
                <div className="text-[11px] text-zinc-500 dark:text-zinc-400 flex flex-wrap gap-x-2">
                  <span>Bruto: {formatBRL(it.remuneracaoBruta)}</span>
                  <span>· FGTS: {formatBRL(it.fgts8Pct)}</span>
                  <span>· Férias+1/3: {formatBRL(it.provisaoFerias1_12 + it.provisaoTercoFerias)}</span>
                  <span>· 13º: {formatBRL(it.provisaoDecimoTerceiro1_12)}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setPreviewColabId(it.colaborador.id)}
                  className={`mt-1.5 text-[11px] font-semibold flex items-center gap-1 cursor-pointer ${
                    selecionado
                      ? 'text-[#DC2626]'
                      : 'text-zinc-600 dark:text-zinc-300 hover:text-[#DC2626]'
                  }`}
                >
                  <Receipt className="w-3.5 h-3.5 shrink-0" />
                  <span>{selecionado ? 'Holerite selecionado abaixo' : 'Pré-visualizar holerite'}</span>
                </button>
              </div>
            );
          })}
        </div>

        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-800 text-[11px] uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                <th className="py-2 pr-3 font-semibold">Colaborador</th>
                <th className="py-2 px-2 font-semibold text-right">Bruto</th>
                <th className="py-2 px-2 font-semibold text-right">FGTS (8%)</th>
                <th className="py-2 px-2 font-semibold text-right">Férias + 1/3</th>
                <th className="py-2 px-2 font-semibold text-right">13º</th>
                <th className="py-2 px-2 font-semibold text-right">Benefícios</th>
                <th className="py-2 px-2 font-semibold text-right">Custo Total</th>
                <th className="py-2 pl-2 font-semibold text-right">Holerite</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {itens.map((it) => {
                const selecionado = itemPreview?.colaborador.id === it.colaborador.id;
                return (
                  <tr
                    key={it.colaborador.id}
                    className={
                      selecionado
                        ? 'bg-red-50/50 dark:bg-red-950/20'
                        : 'hover:bg-zinc-50/70 dark:hover:bg-zinc-900/50'
                    }
                  >
                    <td className="py-2 pr-3 font-bold">
                      <div>{it.colaborador.nome}</div>
                      <div className="text-[11px] font-normal text-zinc-500 dark:text-zinc-400">
                        {it.colaborador.funcao} · {it.colaborador.lotacao}
                      </div>
                    </td>
                    <td className="py-2 px-2 text-right font-mono tabular-nums">
                      {formatBRL(it.remuneracaoBruta)}
                    </td>
                    <td className="py-2 px-2 text-right font-mono tabular-nums">
                      {formatBRL(it.fgts8Pct)}
                    </td>
                    <td className="py-2 px-2 text-right font-mono tabular-nums">
                      {formatBRL(it.provisaoFerias1_12 + it.provisaoTercoFerias)}
                    </td>
                    <td className="py-2 px-2 text-right font-mono tabular-nums">
                      {formatBRL(it.provisaoDecimoTerceiro1_12)}
                    </td>
                    <td className="py-2 px-2 text-right font-mono tabular-nums">
                      {formatBRL(it.beneficiosExternos)}
                    </td>
                    <td className="py-2 px-2 text-right font-mono tabular-nums font-bold text-[#DC2626]">
                      {formatBRL(it.custoTotalEmpresa)}
                    </td>
                    <td className="py-2 pl-2 text-right">
                      <button
                        type="button"
                        onClick={() => setPreviewColabId(it.colaborador.id)}
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold cursor-pointer ${
                          selecionado
                            ? 'bg-[#DC2626] text-white'
                            : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 hover:bg-[#DC2626] hover:text-white'
                        }`}
                      >
                        <Receipt className="w-3 h-3" />
                        <span>{selecionado ? 'Ativo' : 'Ver'}</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Pré-visualização de Holerite do Colaborador */}
      {itemPreview && (
        <div className="space-y-2">
          <div className="no-print bg-white dark:bg-[#1C1C20] text-[#111827] dark:text-zinc-100 rounded-xl p-3 shadow-sm border border-zinc-200/80 dark:border-zinc-800 space-y-2">
            <div className="flex items-center gap-2">
              <Receipt className="w-4 h-4 text-[#DC2626] shrink-0" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Pré-visualização do Holerite
              </h2>
            </div>
            <select
              value={itemPreview.colaborador.id}
              onChange={(e) => setPreviewColabId(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900"
            >
              {itens.map((it) => (
                <option key={it.colaborador.id} value={it.colaborador.id}>
                  {it.colaborador.nome} ({it.colaborador.funcao} · {it.colaborador.lotacao})
                </option>
              ))}
            </select>
          </div>

          <DemonstrativoHoleriteCard
            colaborador={itemPreview.colaborador}
            unidadeAtiva={unidadeAtiva}
            mes={mes}
            resumo={itemPreview.resumo}
            holerite={itemPreview.holerite}
            holeriteConfigurado={holeritesConfigurados.find(
              (h) => h.colaboradorId === itemPreview.colaborador.id && h.mes === mes
            )}
            config={config}
          />
        </div>
      )}
    </div>
  );
};
