import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Calculator,
  CheckCircle2,
  Eye,
  EyeOff,
  FileSliders,
  Plus,
  RefreshCw,
  Save,
  Trash2,
} from 'lucide-react';
import {
  AjusteEscala,
  Atestado,
  Colaborador,
  ConfiguracaoEmpresa,
  Feriado,
  HoleriteConfigurado,
  JornadaTemplate,
  RegistroPonto,
  RubricaHoleriteItem,
  Unidade,
} from '../../types/rh';
import {
  calcularEspelhoMensal,
  calcularHoleriteMensal,
  calcularINSS2026,
  calcularIRRF2026,
  formatBRL,
  formatMinutesToHHMM,
  getCurrentMonthStr,
} from '../../utils/cltCalculations';

interface ConfiguracaoHoleriteViewProps {
  colaboradorAtual: Colaborador;
  colaboradores: Colaborador[];
  unidadeAtiva: Unidade;
  pontos: RegistroPonto[];
  jornadas: JornadaTemplate[];
  ajustes: AjusteEscala[];
  feriados: Feriado[];
  atestados: Atestado[];
  config: ConfiguracaoEmpresa;
  holeritesConfigurados: HoleriteConfigurado[];
  onSalvarHoleriteConfigurado: (cfg: HoleriteConfigurado) => Promise<boolean>;
}

function roundMoney(v: number): number {
  if (!Number.isFinite(v) || v < 0) return 0;
  return Number(v.toFixed(2));
}

function buildSugestoesRubricas(
  colab: Colaborador,
  mes: string,
  jornada: JornadaTemplate,
  pontos: RegistroPonto[],
  ajustes: AjusteEscala[],
  feriados: Feriado[],
  atestados: Atestado[],
  config: ConfiguracaoEmpresa,
  unidadeAtiva: Unidade
): {
  recebiveis: RubricaHoleriteItem[];
  descontaveis: RubricaHoleriteItem[];
} {
  const unidEfetiva: Unidade = colab.lotacao === 'Ambas' ? unidadeAtiva : colab.lotacao;
  const resumo = calcularEspelhoMensal(
    colab,
    mes,
    jornada,
    pontos,
    ajustes,
    feriados,
    atestados,
    config,
    unidEfetiva
  );
  const holeriteBase = calcularHoleriteMensal(colab, resumo, jornada, config);

  const inssBaseInicial = colab.salarioBase;
  const inssSugerido = calcularINSS2026(inssBaseInicial);
  const baseIrrfInicial = Math.max(0, inssBaseInicial - inssSugerido.valor);
  const irrfSugerido = calcularIRRF2026(baseIrrfInicial);

  const recebiveis: RubricaHoleriteItem[] = [
    {
      id: 'salario_base',
      descricao: 'Salário Base',
      referencia: '30d',
      valor: roundMoney(holeriteBase.salarioBase),
      selecionado: true,
      custom: false,
    },
    {
      id: 'horas_extras',
      descricao: 'Horas Extras',
      referencia: formatMinutesToHHMM(resumo.totalMinExtrasGeral),
      valor: roundMoney(holeriteBase.totalHorasExtras),
      selecionado: false,
      custom: false,
    },
    {
      id: 'dsr',
      descricao: 'DSR sobre Horas Extras',
      referencia: `${resumo.domingosFeriadosMes}d`,
      valor: roundMoney(holeriteBase.dsrSobreExtras),
      selecionado: false,
      custom: false,
    },
    {
      id: 'adicional_noturno',
      descricao: 'Adicional Noturno',
      referencia: formatMinutesToHHMM(resumo.totalMinNoturnos),
      valor: roundMoney(holeriteBase.valorAdicionalNoturno),
      selecionado: false,
      custom: false,
    },
  ];

  const descontaveis: RubricaHoleriteItem[] = [
    {
      id: 'inss',
      descricao: 'INSS (Tabela 2026)',
      referencia: `${inssSugerido.aliquotaEfetiva.toFixed(1).replace('.', ',')}%`,
      valor: roundMoney(inssSugerido.valor),
      selecionado: true,
      custom: false,
    },
    {
      id: 'irrf',
      descricao: 'IRRF (Tabela 2026)',
      referencia: 'IRRF',
      valor: roundMoney(irrfSugerido),
      selecionado: irrfSugerido > 0,
      custom: false,
    },
    {
      id: 'vt',
      descricao:
        colab.vtDiario > 0
          ? 'Vale-Transporte (6%)'
          : 'Vale-Transporte (Não optante)',
      referencia: colab.vtDiario > 0 ? '6%' : '0%',
      valor: roundMoney(holeriteBase.descontoVt6Pct),
      selecionado: colab.vtDiario > 0 && holeriteBase.descontoVt6Pct > 0,
      custom: false,
    },
    {
      id: 'atrasos',
      descricao: 'Atrasos / Faltas',
      referencia: formatMinutesToHHMM(resumo.totalMinAtraso),
      valor: roundMoney(holeriteBase.descontoAtrasos),
      selecionado: false,
      custom: false,
    },
  ];

  return { recebiveis, descontaveis };
}

export const ConfiguracaoHoleriteView: React.FC<ConfiguracaoHoleriteViewProps> = ({
  colaboradorAtual,
  colaboradores,
  unidadeAtiva,
  pontos,
  jornadas,
  ajustes,
  feriados,
  atestados,
  config,
  holeritesConfigurados,
  onSalvarHoleriteConfigurado,
}) => {
  const [mes, setMes] = useState(getCurrentMonthStr);
  const listaColaboradores = useMemo(() => {
    const ativos = colaboradores.filter((c) => c.ativo);
    return ativos.length > 0 ? ativos : colaboradores;
  }, [colaboradores]);

  const [colabId, setColabId] = useState<string>(() => listaColaboradores[0]?.id || '');

  useEffect(() => {
    if (!colabId && listaColaboradores.length > 0) {
      setColabId(listaColaboradores[0].id);
    } else if (
      colabId &&
      listaColaboradores.length > 0 &&
      !listaColaboradores.some((c) => c.id === colabId)
    ) {
      setColabId(listaColaboradores[0].id);
    }
  }, [colabId, listaColaboradores]);

  const colabSelecionado = useMemo(
    () => listaColaboradores.find((c) => c.id === colabId) || null,
    [listaColaboradores, colabId]
  );

  const jornadaColab = useMemo(() => {
    if (!colabSelecionado) return jornadas[0];
    return jornadas.find((j) => j.id === colabSelecionado.jornadaId) || jornadas[0];
  }, [colabSelecionado, jornadas]);

  const configSalvaExistente = useMemo(() => {
    if (!colabSelecionado) return null;
    return (
      holeritesConfigurados.find(
        (h) => h.colaboradorId === colabSelecionado.id && h.mes === mes
      ) || null
    );
  }, [holeritesConfigurados, colabSelecionado, mes]);

  const sugestoesPonto = useMemo(() => {
    if (!colabSelecionado || !jornadaColab) return null;
    return buildSugestoesRubricas(
      colabSelecionado,
      mes,
      jornadaColab,
      pontos,
      ajustes,
      feriados,
      atestados,
      config,
      unidadeAtiva
    );
  }, [
    colabSelecionado,
    mes,
    jornadaColab,
    pontos,
    ajustes,
    feriados,
    atestados,
    config,
    unidadeAtiva,
  ]);

  const [recebiveis, setRecebiveis] = useState<RubricaHoleriteItem[]>([]);
  const [descontaveis, setDescontaveis] = useState<RubricaHoleriteItem[]>([]);
  const [liberado, setLiberado] = useState<boolean>(false);
  const [salvando, setSalvando] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const loadedContextRef = useRef<string>('');
  const lastLoadedUpdatedAtRef = useRef<string>('');

  // Carrega configuração salva no Supabase ou gera sugestões iniciais quando muda colaborador/competência
  useEffect(() => {
    if (!colabSelecionado) {
      setRecebiveis([]);
      setDescontaveis([]);
      setLiberado(false);
      loadedContextRef.current = '';
      lastLoadedUpdatedAtRef.current = '';
      return;
    }

    const contextKey = `${colabSelecionado.id}__${mes}`;
    const savedUpdatedAt = configSalvaExistente?.atualizadoEm || '';
    const contextChanged = loadedContextRef.current !== contextKey;
    const savedAppearedFirstTime =
      !contextChanged && Boolean(configSalvaExistente) && lastLoadedUpdatedAtRef.current === '';

    if (contextChanged || savedAppearedFirstTime) {
      if (configSalvaExistente) {
        setRecebiveis(configSalvaExistente.recebiveis.map((r) => ({ ...r })));
        setDescontaveis(configSalvaExistente.descontaveis.map((d) => ({ ...d })));
        setLiberado(Boolean(configSalvaExistente.liberado));
        lastLoadedUpdatedAtRef.current = savedUpdatedAt;
      } else if (sugestoesPonto) {
        setRecebiveis(sugestoesPonto.recebiveis.map((r) => ({ ...r })));
        setDescontaveis(sugestoesPonto.descontaveis.map((d) => ({ ...d })));
        setLiberado(false);
        lastLoadedUpdatedAtRef.current = '';
      }
      loadedContextRef.current = contextKey;
      if (contextChanged) {
        setFeedback(null);
      }
    }
  }, [colabSelecionado?.id, mes, configSalvaExistente?.atualizadoEm]);

  const totalRecebiveis = useMemo(
    () =>
      roundMoney(
        recebiveis.reduce((acc, item) => acc + (item.selecionado ? Number(item.valor) || 0 : 0), 0)
      ),
    [recebiveis]
  );

  const totalDescontaveis = useMemo(
    () =>
      roundMoney(
        descontaveis.reduce(
          (acc, item) => acc + (item.selecionado ? Number(item.valor) || 0 : 0),
          0
        )
      ),
    [descontaveis]
  );

  const salarioLiquido = useMemo(
    () => Math.max(0, roundMoney(totalRecebiveis - totalDescontaveis)),
    [totalRecebiveis, totalDescontaveis]
  );

  const updateRecebivel = (id: string, patch: Partial<RubricaHoleriteItem>) => {
    setRecebiveis((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
    setFeedback(null);
  };

  const updateDescontavel = (id: string, patch: Partial<RubricaHoleriteItem>) => {
    setDescontaveis((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
    setFeedback(null);
  };

  const handleAddRecebivelCustom = () => {
    const novo: RubricaHoleriteItem = {
      id: `rec-custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      descricao: '',
      referencia: '-',
      valor: 0,
      selecionado: true,
      custom: true,
    };
    setRecebiveis((prev) => [...prev, novo]);
    setFeedback(null);
  };

  const handleAddDescontavelCustom = () => {
    const novo: RubricaHoleriteItem = {
      id: `desc-custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      descricao: '',
      referencia: '-',
      valor: 0,
      selecionado: true,
      custom: true,
    };
    setDescontaveis((prev) => [...prev, novo]);
    setFeedback(null);
  };

  const handleRemoverRecebivel = (id: string) => {
    setRecebiveis((prev) => prev.filter((item) => item.id !== id));
    setFeedback(null);
  };

  const handleRemoverDescontavel = (id: string) => {
    setDescontaveis((prev) => prev.filter((item) => item.id !== id));
    setFeedback(null);
  };

  const handleRecalcularPonto = () => {
    if (!sugestoesPonto) return;
    setRecebiveis((prev) => {
      const customs = prev.filter((r) => r.custom);
      const padroesAtualizados = sugestoesPonto.recebiveis.map((sug) => {
        const atual = prev.find((p) => p.id === sug.id);
        return atual
          ? { ...sug, selecionado: atual.selecionado }
          : { ...sug };
      });
      return [...padroesAtualizados, ...customs];
    });
    setDescontaveis((prev) => {
      const customs = prev.filter((d) => d.custom);
      const padroesAtualizados = sugestoesPonto.descontaveis.map((sug) => {
        const atual = prev.find((p) => p.id === sug.id);
        return atual
          ? { ...sug, selecionado: atual.selecionado }
          : { ...sug };
      });
      return [...padroesAtualizados, ...customs];
    });
    setFeedback('Sugestões do ponto recalculadas para esta competência.');
  };

  const handleRecalcularImpostos = () => {
    const atrasosMarcados =
      descontaveis.find((d) => d.id === 'atrasos' && d.selecionado)?.valor || 0;
    const baseInss = Math.max(0, totalRecebiveis - atrasosMarcados);
    const inss = calcularINSS2026(baseInss);
    const baseIrrf = Math.max(0, baseInss - inss.valor);
    const irrf = calcularIRRF2026(baseIrrf);

    setDescontaveis((prev) =>
      prev.map((d) => {
        if (d.id === 'inss') {
          return {
            ...d,
            valor: roundMoney(inss.valor),
            referencia: `${inss.aliquotaEfetiva.toFixed(1).replace('.', ',')}%`,
          };
        }
        if (d.id === 'irrf') {
          return {
            ...d,
            valor: roundMoney(irrf),
          };
        }
        return d;
      })
    );
    setFeedback('INSS e IRRF (Tabela 2026) recalculados sobre os recebíveis marcados.');
  };

  const handleSalvar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!colabSelecionado) return;

    setSalvando(true);
    setFeedback(null);
    try {
      const recebiveisLimpos = recebiveis
        .filter((r) => !r.custom || r.descricao.trim().length > 0)
        .map((r) => ({
          ...r,
          descricao: r.descricao.trim() || 'Recebível adicional',
          valor: roundMoney(Number(r.valor) || 0),
        }));

      const descontaveisLimpos = descontaveis
        .filter((d) => !d.custom || d.descricao.trim().length > 0)
        .map((d) => ({
          ...d,
          descricao: d.descricao.trim() || 'Desconto adicional',
          valor: roundMoney(Number(d.valor) || 0),
        }));

      const totalRecFinal = roundMoney(
        recebiveisLimpos.reduce((acc, i) => acc + (i.selecionado ? i.valor : 0), 0)
      );
      const totalDescFinal = roundMoney(
        descontaveisLimpos.reduce((acc, i) => acc + (i.selecionado ? i.valor : 0), 0)
      );
      const liquidoFinal = Math.max(0, roundMoney(totalRecFinal - totalDescFinal));

      const registro: HoleriteConfigurado = {
        id: `${colabSelecionado.id}__${mes}`,
        colaboradorId: colabSelecionado.id,
        mes,
        recebiveis: recebiveisLimpos,
        descontaveis: descontaveisLimpos,
        totalRecebiveis: totalRecFinal,
        totalDescontaveis: totalDescFinal,
        salarioLiquido: liquidoFinal,
        liberado: Boolean(liberado),
        configuradoPor: colaboradorAtual.nome,
        atualizadoEm: new Date().toISOString(),
      };

      const ok = await onSalvarHoleriteConfigurado(registro);
      if (ok) {
        lastLoadedUpdatedAtRef.current = registro.atualizadoEm;
        setRecebiveis(recebiveisLimpos);
        setDescontaveis(descontaveisLimpos);
        setLiberado(Boolean(registro.liberado));
        setFeedback(
          registro.liberado
            ? `Holerite de ${colabSelecionado.nome} (${mes}) salvo e LIBERADO para visualização do colaborador.`
            : `Configuração de ${colabSelecionado.nome} (${mes}) salva com sucesso (visualização do colaborador BLOQUEADA).`
        );
      }
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* Cabeçalho e Filtros no Topo */}
      <section className="bg-white dark:bg-[#1C1C20] text-[#111827] dark:text-zinc-100 rounded-xl p-3 md:p-4 shadow-sm border border-zinc-200/80 dark:border-zinc-800 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <FileSliders className="w-4 h-4 text-[#DC2626] shrink-0" />
            <h1 className="text-sm font-bold truncate">Configuração do Holerite</h1>
          </div>

          {colabSelecionado && (
            <span
              className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-lg border ${
                configSalvaExistente?.liberado
                  ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-300'
                  : configSalvaExistente
                    ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900 text-amber-700 dark:text-amber-300'
                    : 'bg-zinc-100 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400'
              }`}
            >
              {configSalvaExistente?.liberado ? (
                <>
                  <Eye className="w-3.5 h-3.5" />
                  <span>Liberado ao Colaborador</span>
                </>
              ) : configSalvaExistente ? (
                <>
                  <EyeOff className="w-3.5 h-3.5" />
                  <span>Salvo (Em processamento)</span>
                </>
              ) : (
                <span>Não configurado ainda</span>
              )}
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          <div>
            <label className="block text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 mb-1">
              Competência (Mês/Ano)
            </label>
            <input
              type="month"
              value={mes}
              onChange={(e) => setMes(e.target.value)}
              className="w-full px-2.5 py-2 text-xs font-medium rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 mb-1">
              Colaborador
            </label>
            <select
              value={colabId}
              onChange={(e) => setColabId(e.target.value)}
              className="w-full px-2.5 py-2 text-xs font-medium rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900"
            >
              {listaColaboradores.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome} ({c.funcao} · {c.lotacao})
                </option>
              ))}
            </select>
          </div>
        </div>

        {colabSelecionado && (
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-zinc-100 dark:border-zinc-800 text-[11px] text-zinc-500 dark:text-zinc-400">
            <div>
              Salário Cadastro:{' '}
              <strong className="text-[#111827] dark:text-zinc-200 font-mono">
                {formatBRL(colabSelecionado.salarioBase)}
              </strong>{' '}
              · VT diário:{' '}
              <strong className="text-[#111827] dark:text-zinc-200 font-mono">
                {formatBRL(colabSelecionado.vtDiario)}
              </strong>
            </div>

            <button
              type="button"
              onClick={handleRecalcularPonto}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-200 font-semibold cursor-pointer"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Puxar sugestões do ponto</span>
            </button>
          </div>
        )}
      </section>

      {!colabSelecionado ? (
        <section className="bg-white dark:bg-[#1C1C20] rounded-xl p-4 text-xs text-zinc-500 dark:text-zinc-400 border border-zinc-200/80 dark:border-zinc-800">
          Nenhum colaborador cadastrado para configurar holerite.
        </section>
      ) : (
        <form onSubmit={handleSalvar} className="space-y-3">
          {/* Bloco 1: Recebíveis (Vencimentos) */}
          <section className="bg-white dark:bg-[#1C1C20] text-[#111827] dark:text-zinc-100 rounded-xl p-3 md:p-4 shadow-sm border border-zinc-200/80 dark:border-zinc-800 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                  Recebíveis (Vencimentos)
                </h2>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  Marque apenas os vencimentos que devem aparecer no holerite e no PDF do colaborador.
                </p>
              </div>
              <button
                type="button"
                onClick={handleAddRecebivelCustom}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-900 hover:bg-emerald-600 hover:text-white text-xs font-semibold text-zinc-700 dark:text-zinc-200 transition-colors cursor-pointer shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Adicionar Recebível</span>
              </button>
            </div>

            <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {recebiveis.map((item) => (
                <div
                  key={item.id}
                  className={`py-2.5 first:pt-1 last:pb-1 flex flex-col sm:flex-row sm:items-center gap-2 transition-opacity ${
                    item.selecionado ? 'opacity-100' : 'opacity-65'
                  }`}
                >
                  <label className="flex items-center gap-2.5 flex-1 min-w-0 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={item.selecionado}
                      onChange={(e) => updateRecebivel(item.id, { selecionado: e.target.checked })}
                      className="w-4 h-4 accent-[#DC2626] rounded cursor-pointer shrink-0"
                    />

                    {item.custom ? (
                      <input
                        type="text"
                        value={item.descricao}
                        onChange={(e) => updateRecebivel(item.id, { descricao: e.target.value })}
                        placeholder="Descrição do recebível (ex.: Comissão, Bônus)"
                        className="flex-1 min-w-0 px-2.5 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900"
                      />
                    ) : (
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-semibold truncate">{item.descricao}</div>
                        {item.referencia && item.referencia !== '-' && (
                          <div className="text-[10px] font-mono text-zinc-500 dark:text-zinc-400">
                            Ref. ponto/cadastro: {item.referencia}
                          </div>
                        )}
                      </div>
                    )}
                  </label>

                  <div className="flex items-center gap-2 pl-6 sm:pl-0 shrink-0">
                    <div className="relative w-32">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[11px] font-mono text-zinc-400">
                        R$
                      </span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={item.valor}
                        onChange={(e) =>
                          updateRecebivel(item.id, {
                            valor: Math.max(0, parseFloat(e.target.value) || 0),
                          })
                        }
                        className="w-full pl-8 pr-2 py-1.5 text-right font-mono tabular-nums text-xs font-semibold rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900"
                      />
                    </div>

                    {item.custom && (
                      <button
                        type="button"
                        onClick={() => handleRemoverRecebivel(item.id)}
                        className="p-1.5 rounded-lg text-zinc-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 cursor-pointer"
                        aria-label="Remover recebível"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Bloco 2: Descontáveis (Descontos) */}
          <section className="bg-white dark:bg-[#1C1C20] text-[#111827] dark:text-zinc-100 rounded-xl p-3 md:p-4 shadow-sm border border-zinc-200/80 dark:border-zinc-800 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-xs font-bold uppercase tracking-wider text-red-600 dark:text-red-400">
                  Descontáveis (Descontos)
                </h2>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  Rubricas desmarcadas (como Atrasos / Faltas) não entram nem aparecem no holerite.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleRecalcularImpostos}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 text-[11px] font-semibold text-zinc-700 dark:text-zinc-200 cursor-pointer"
                  title="Recalcular INSS e IRRF 2026 com base nos recebíveis marcados"
                >
                  <Calculator className="w-3.5 h-3.5" />
                  <span>Recalcular INSS/IRRF</span>
                </button>
                <button
                  type="button"
                  onClick={handleAddDescontavelCustom}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-900 hover:bg-[#DC2626] hover:text-white text-xs font-semibold text-zinc-700 dark:text-zinc-200 transition-colors cursor-pointer shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Adicionar Descontável</span>
                </button>
              </div>
            </div>

            <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {descontaveis.map((item) => (
                <div
                  key={item.id}
                  className={`py-2.5 first:pt-1 last:pb-1 flex flex-col sm:flex-row sm:items-center gap-2 transition-opacity ${
                    item.selecionado ? 'opacity-100' : 'opacity-65'
                  }`}
                >
                  <label className="flex items-center gap-2.5 flex-1 min-w-0 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={item.selecionado}
                      onChange={(e) =>
                        updateDescontavel(item.id, { selecionado: e.target.checked })
                      }
                      className="w-4 h-4 accent-[#DC2626] rounded cursor-pointer shrink-0"
                    />

                    {item.custom ? (
                      <input
                        type="text"
                        value={item.descricao}
                        onChange={(e) =>
                          updateDescontavel(item.id, { descricao: e.target.value })
                        }
                        placeholder="Descrição (ex.: Adiantamento Salarial / Vale, Outros Descontos)"
                        className="flex-1 min-w-0 px-2.5 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900"
                      />
                    ) : (
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-semibold truncate">{item.descricao}</div>
                        {item.referencia && item.referencia !== '-' && (
                          <div className="text-[10px] font-mono text-zinc-500 dark:text-zinc-400">
                            Ref.: {item.referencia}
                          </div>
                        )}
                      </div>
                    )}
                  </label>

                  <div className="flex items-center gap-2 pl-6 sm:pl-0 shrink-0">
                    <div className="relative w-32">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[11px] font-mono text-zinc-400">
                        R$
                      </span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={item.valor}
                        onChange={(e) =>
                          updateDescontavel(item.id, {
                            valor: Math.max(0, parseFloat(e.target.value) || 0),
                          })
                        }
                        className="w-full pl-8 pr-2 py-1.5 text-right font-mono tabular-nums text-xs font-semibold rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900"
                      />
                    </div>

                    {item.custom && (
                      <button
                        type="button"
                        onClick={() => handleRemoverDescontavel(item.id)}
                        className="p-1.5 rounded-lg text-zinc-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 cursor-pointer"
                        aria-label="Remover descontável"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Resumo em Tempo Real, Liberação e Botão Salvar */}
          <section className="bg-white dark:bg-[#1C1C20] text-[#111827] dark:text-zinc-100 rounded-xl p-3 md:p-4 shadow-sm border border-zinc-200/80 dark:border-zinc-800 space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Resumo em Tempo Real
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div className="p-2.5 rounded-lg bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-900/60">
                <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                  Total Recebíveis
                </div>
                <div className="text-base font-mono tabular-nums font-extrabold text-emerald-700 dark:text-emerald-300 mt-0.5">
                  {formatBRL(totalRecebiveis)}
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-red-50/70 dark:bg-red-950/20 border border-red-200/80 dark:border-red-900/60">
                <div className="text-[10px] font-bold uppercase tracking-wider text-red-700 dark:text-red-400">
                  Total Descontáveis
                </div>
                <div className="text-base font-mono tabular-nums font-extrabold text-red-700 dark:text-red-300 mt-0.5">
                  {formatBRL(totalDescontaveis)}
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-[#09090B] text-white border border-zinc-800">
                <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                  Salário Líquido
                </div>
                <div className="text-base font-mono tabular-nums font-extrabold text-white mt-0.5">
                  {formatBRL(salarioLiquido)}
                </div>
              </div>
            </div>

            {/* Caixa de permissão: Liberar visualização para o Colaborador */}
            <label className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 flex items-center justify-between gap-3 cursor-pointer">
              <div className="flex items-start gap-2.5 min-w-0">
                <input
                  type="checkbox"
                  checked={liberado}
                  onChange={(e) => {
                    setLiberado(e.target.checked);
                    setFeedback(null);
                  }}
                  className="mt-0.5 w-4 h-4 accent-emerald-600 rounded cursor-pointer shrink-0"
                />
                <div className="min-w-0">
                  <div className="text-xs font-bold">
                    Liberar visualização para o Colaborador
                  </div>
                  <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                    {liberado
                      ? 'Marcado: após salvar, o colaborador poderá visualizar os valores e baixar o PDF oficial.'
                      : 'Desmarcado: o colaborador verá apenas "Holerite em processamento pelo RH. Aguarde a liberação pela gestão.".'}
                  </div>
                </div>
              </div>

              <span
                className={`text-[10px] font-bold uppercase px-2 py-1 rounded-md shrink-0 ${
                  liberado
                    ? 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300'
                    : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
                }`}
              >
                {liberado ? 'Liberado' : 'Oculto'}
              </span>
            </label>

            {feedback && (
              <div
                role="status"
                className="flex items-center gap-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 px-3 py-2 text-xs font-medium text-emerald-700 dark:text-emerald-300"
              >
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{feedback}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={salvando}
              className="w-full py-3 px-4 rounded-xl bg-[#DC2626] hover:bg-red-700 text-white text-xs font-bold tracking-wide flex items-center justify-center gap-2 shadow-sm transition-colors cursor-pointer disabled:opacity-60 min-h-[44px]"
            >
              <Save className="w-4 h-4 shrink-0" />
              <span>
                {salvando
                  ? 'SALVANDO NO SUPABASE...'
                  : 'SALVAR CONFIGURAÇÃO DO HOLERITE'}
              </span>
            </button>
          </section>
        </form>
      )}
    </div>
  );
};
