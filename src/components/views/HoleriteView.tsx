import React, { useMemo, useState } from 'react';
import { Clock, Receipt } from 'lucide-react';
import {
  AjusteEscala,
  Atestado,
  Colaborador,
  ConfiguracaoEmpresa,
  Feriado,
  HoleriteConfigurado,
  JornadaTemplate,
  RegistroPonto,
  Unidade,
} from '../../types/rh';
import {
  calcularEspelhoMensal,
  calcularHoleriteMensal,
  getCurrentMonthStr,
} from '../../utils/cltCalculations';
import { DemonstrativoHoleriteCard } from '../DemonstrativoHoleriteCard';

interface HoleriteViewProps {
  colaborador: Colaborador;
  unidadeAtiva: Unidade;
  pontos: RegistroPonto[];
  jornada: JornadaTemplate;
  ajustes: AjusteEscala[];
  feriados: Feriado[];
  atestados: Atestado[];
  config: ConfiguracaoEmpresa;
  holeritesConfigurados: HoleriteConfigurado[];
}

export const HoleriteView: React.FC<HoleriteViewProps> = ({
  colaborador,
  unidadeAtiva,
  pontos,
  jornada,
  ajustes,
  feriados,
  atestados,
  config,
  holeritesConfigurados,
}) => {
  const [mes, setMes] = useState(getCurrentMonthStr);

  const resumo = useMemo(
    () =>
      calcularEspelhoMensal(
        colaborador,
        mes,
        jornada,
        pontos,
        ajustes,
        feriados,
        atestados,
        config,
        unidadeAtiva
      ),
    [colaborador, mes, jornada, pontos, ajustes, feriados, atestados, config, unidadeAtiva]
  );

  const holerite = useMemo(
    () => calcularHoleriteMensal(colaborador, resumo, jornada, config),
    [colaborador, resumo, jornada, config]
  );

  const configSalva = useMemo(
    () =>
      holeritesConfigurados.find(
        (h) => h.colaboradorId === colaborador.id && h.mes === mes
      ) || null,
    [holeritesConfigurados, colaborador.id, mes]
  );

  const holeriteLiberado = Boolean(configSalva && configSalva.liberado);

  return (
    <div className="space-y-3">
      <section className="no-print bg-white dark:bg-[#1C1C20] text-[#111827] dark:text-zinc-100 rounded-xl p-3 shadow-sm border border-zinc-200/80 dark:border-zinc-800">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Receipt className="w-4 h-4 text-[#DC2626] shrink-0" />
            <h1 className="text-sm font-bold truncate">Holerite · INSS 2026</h1>
          </div>
          <input
            type="month"
            value={mes}
            onChange={(e) => setMes(e.target.value)}
            className="text-xs font-medium px-2 py-1 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900"
          />
        </div>
      </section>

      {holeriteLiberado && configSalva ? (
        <DemonstrativoHoleriteCard
          colaborador={colaborador}
          unidadeAtiva={unidadeAtiva}
          mes={mes}
          resumo={resumo}
          holerite={holerite}
          holeriteConfigurado={configSalva}
          config={config}
        />
      ) : (
        <section className="bg-white dark:bg-[#1C1C20] text-[#111827] dark:text-zinc-100 rounded-xl p-6 shadow-sm border border-zinc-200/80 dark:border-zinc-800 text-center space-y-2.5">
          <div className="w-11 h-11 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex items-center justify-center mx-auto text-[#DC2626]">
            <Clock className="w-5 h-5" />
          </div>
          <h2 className="text-sm font-bold text-[#111827] dark:text-white">
            Holerite desta competência em processamento pelo RH
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-sm mx-auto leading-relaxed">
            O demonstrativo referente a <strong className="font-mono">{mes.split('-').reverse().join('/')}</strong> será exibido aqui com download em PDF assim que for conferido e liberado pelo RH.
          </p>
        </section>
      )}
    </div>
  );
};
