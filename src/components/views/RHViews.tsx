import React, { useMemo, useState } from 'react';
import {
  CalendarCog,
  Check,
  CheckSquare,
  Download,
  FileText,
  Lock,
  PieChart,
  Trash2,
  Unlock,
  X,
} from 'lucide-react';
import {
  AjusteEscala,
  Atestado,
  Colaborador,
  ConfiguracaoEmpresa,
  FechamentoMensal,
  Feriado,
  JornadaTemplate,
  RegistroPonto,
  StatusAtestado,
  Unidade,
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
}

interface FechamentoViewProps extends RHCommonProps {
  onAtualizarAtestado: (id: string, status: StatusAtestado) => Promise<boolean>;
  onSalvarAjuste: (ajuste: AjusteEscala) => Promise<boolean>;
  onRemoverAjuste: (id: string) => Promise<boolean>;
  onAlternarFechamento: (mes: string, unidade: 'Todas' | Unidade) => Promise<boolean>;
}

export const FechamentoView: React.FC<FechamentoViewProps> = ({
  colaboradores,
  unidadeAtiva,
  atestados,
  ajustes,
  fechamentos,
  onAtualizarAtestado,
  onSalvarAjuste,
  onRemoverAjuste,
  onAlternarFechamento,
}) => {
  const [mes, setMes] = useState(getCurrentMonthStr);
  const [colabId, setColabId] = useState(colaboradores[0]?.id || '');
  const [dataAjuste, setDataAjuste] = useState(getTodayStr);
  const [tipoAjuste, setTipoAjuste] = useState<'normal' | 'folga' | 'horario_proprio'>('folga');
  const [entradaCustom, setEntradaCustom] = useState('09:00');
  const [saidaCustom, setSaidaCustom] = useState('15:00');
  const [cargaHorasCustom, setCargaHorasCustom] = useState('6');
  const [motivoAjuste, setMotivoAjuste] = useState('Feriado municipal / Ajuste de escala');

  const pendentes = atestados.filter((a) => a.status === 'Pendente');
  const isFechado = fechamentos.some(
    (f) => f.mes === mes && (f.unidade === 'Todas' || f.unidade === unidadeAtiva)
  );

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

      <section className="bg-white dark:bg-[#1C1C20] text-[#111827] dark:text-zinc-100 rounded-xl p-3 shadow-sm border border-zinc-200/80 dark:border-zinc-800">
        {linhas.length === 0 ? (
          <p className="text-xs text-zinc-500 dark:text-zinc-400 py-2">
            Nenhum colaborador encontrado para este filtro.
          </p>
        ) : (
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800 space-y-2.5">
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
}) => {
  const [mes, setMes] = useState(getCurrentMonthStr);

  const itens = useMemo(() => {
    return colaboradores
      .filter((c) => c.ativo)
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
        const holerite = calcularHoleriteMensal(c, resumo, jornada, config);
        return calcularRetribuicaoSimplesNacional(c, holerite);
      });
  }, [colaboradores, jornadas, unidadeAtiva, mes, pontos, ajustes, feriados, atestados, config]);

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

  return (
    <div className="space-y-3">
      <section className="bg-white dark:bg-[#1C1C20] text-[#111827] dark:text-zinc-100 rounded-xl p-3 shadow-sm border border-zinc-200/80 dark:border-zinc-800 space-y-2.5">
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
      <section className="bg-white dark:bg-[#1C1C20] text-[#111827] dark:text-zinc-100 rounded-xl p-3 shadow-sm border border-zinc-200/80 dark:border-zinc-800">
        <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2">
          Custo por Colaborador
        </h2>
        <div className="divide-y divide-zinc-100 dark:divide-zinc-800 space-y-2">
          {itens.map((it) => (
            <div key={it.colaborador.id} className="pt-2 first:pt-0 text-xs">
              <div className="flex justify-between font-bold">
                <span className="truncate">{it.colaborador.nome}</span>
                <span className="font-mono tabular-nums text-[#DC2626]">
                  {formatBRL(it.custoTotalEmpresa)}
                </span>
              </div>
              <div className="text-[11px] text-zinc-500 dark:text-zinc-400 flex flex-wrap gap-x-2">
                <span>Bruto: {formatBRL(it.remuneracaoBruta)}</span>
                <span>· FGTS: {formatBRL(it.fgts8Pct)}</span>
                <span>· Férias+1/3: {formatBRL(it.provisaoFerias1_12 + it.provisaoTercoFerias)}</span>
                <span>· 13º: {formatBRL(it.provisaoDecimoTerceiro1_12)}</span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
