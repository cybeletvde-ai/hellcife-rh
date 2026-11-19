import React, { useMemo, useState } from 'react';
import { FileSpreadsheet, Wallet } from 'lucide-react';
import {
  AjusteEscala,
  Atestado,
  Colaborador,
  ConfiguracaoEmpresa,
  FechamentoMensal,
  Feriado,
  JornadaTemplate,
  RegistroPonto,
  Unidade,
} from '../../types/rh';
import {
  calcularEspelhoMensal,
  calcularHoleriteMensal,
  formatBRL,
  formatMinutesToHHMM,
  getCurrentMonthStr,
} from '../../utils/cltCalculations';

interface ExtrasBancoProps {
  colaborador: Colaborador;
  unidadeAtiva: Unidade;
  pontos: RegistroPonto[];
  jornada: JornadaTemplate;
  ajustes: AjusteEscala[];
  feriados: Feriado[];
  atestados: Atestado[];
  fechamentos: FechamentoMensal[];
  config: ConfiguracaoEmpresa;
}

export const HorasExtrasView: React.FC<ExtrasBancoProps> = ({
  colaborador,
  unidadeAtiva,
  pontos,
  jornada,
  ajustes,
  feriados,
  atestados,
  config,
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

  const diasComExtras = resumo.dias.filter(
    (d) =>
      d.minutosExtra50 + d.minutosExtra65 + d.minutosExtra70 + d.minutosExtra100 + d.minutosNoturnosComputados >
      0
  );

  const regraRecife = config.regrasUnidade.Recife;
  const regraJaboatao = config.regrasUnidade['Jaboatão'];

  return (
    <div className="space-y-3">
      <section className="bg-white dark:bg-[#1C1C20] text-[#111827] dark:text-zinc-100 rounded-xl p-3 shadow-sm border border-zinc-200/80 dark:border-zinc-800 space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <FileSpreadsheet className="w-4 h-4 text-[#DC2626] shrink-0" />
            <h1 className="text-sm font-bold truncate">Horas Extras · Regra Sindical</h1>
          </div>
          <input
            type="month"
            value={mes}
            onChange={(e) => setMes(e.target.value)}
            className="text-xs font-medium px-2 py-1 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900"
          />
        </div>

        <div className="p-2.5 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-200/70 dark:border-zinc-800 text-xs space-y-1">
          <div className="font-semibold">
            Recife: +{regraRecife.extraOrdinariaPct}% ordinária · +{regraRecife.adicionalNoturnoPct}% noturna
          </div>
          <div className="font-semibold">
            Jaboatão: +{regraJaboatao.extraOrdinariaPct}% (2h/dia) · +{regraJaboatao.extraAcima2hPct}% (&gt;2h) · +{regraJaboatao.adicionalNoturnoPct}% noturna (52m30s)
          </div>
          <div className="text-zinc-500 dark:text-zinc-400">
            Domingos e Feriados: +100% em ambas as unidades.
          </div>
        </div>

        <div className="divide-y divide-zinc-100 dark:divide-zinc-800 text-xs">
          <div className="py-2 flex justify-between">
            <span className="text-zinc-500 dark:text-zinc-400">Recife (+50%)</span>
            <span className="font-mono tabular-nums font-semibold">
              {formatMinutesToHHMM(resumo.totalMinExtra50)} · {formatBRL(holerite.valorExtra50)}
            </span>
          </div>
          <div className="py-2 flex justify-between">
            <span className="text-zinc-500 dark:text-zinc-400">Jaboatão até 2h (+65%)</span>
            <span className="font-mono tabular-nums font-semibold">
              {formatMinutesToHHMM(resumo.totalMinExtra65)} · {formatBRL(holerite.valorExtra65)}
            </span>
          </div>
          <div className="py-2 flex justify-between">
            <span className="text-zinc-500 dark:text-zinc-400">Jaboatão acima 2h (+70%)</span>
            <span className="font-mono tabular-nums font-semibold">
              {formatMinutesToHHMM(resumo.totalMinExtra70)} · {formatBRL(holerite.valorExtra70)}
            </span>
          </div>
          <div className="py-2 flex justify-between">
            <span className="text-zinc-500 dark:text-zinc-400">Domingos / Feriados (+100%)</span>
            <span className="font-mono tabular-nums font-semibold">
              {formatMinutesToHHMM(resumo.totalMinExtra100)} · {formatBRL(holerite.valorExtra100)}
            </span>
          </div>
          <div className="py-2 flex justify-between">
            <span className="text-zinc-500 dark:text-zinc-400">Adicional Noturno</span>
            <span className="font-mono tabular-nums font-semibold">
              {formatMinutesToHHMM(resumo.totalMinNoturnos)} · {formatBRL(holerite.valorAdicionalNoturno)}
            </span>
          </div>
          <div className="py-2 flex justify-between font-bold">
            <span>Total Extras + Noturno</span>
            <span className="font-mono tabular-nums text-[#DC2626]">
              {formatBRL(holerite.totalHorasExtras + holerite.valorAdicionalNoturno)}
            </span>
          </div>
        </div>
      </section>

      <section className="bg-white dark:bg-[#1C1C20] text-[#111827] dark:text-zinc-100 rounded-xl p-3 shadow-sm border border-zinc-200/80 dark:border-zinc-800">
        <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2">
          Ocorrências no Mês
        </h2>
        {diasComExtras.length === 0 ? (
          <p className="text-xs text-zinc-500 dark:text-zinc-400 py-2">
            Nenhuma hora extra apurada nesta competência.
          </p>
        ) : (
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800 text-xs">
            {diasComExtras.map((d) => (
              <div key={d.data} className="py-2 flex items-center justify-between gap-2">
                <div>
                  <span className="font-mono tabular-nums font-bold">{d.labelDia}</span>
                  <span className="text-zinc-500 dark:text-zinc-400 ml-1.5">
                    · {colaborador.lotacao === 'Ambas' ? 'Ambas' : d.unidadeEfetiva}
                  </span>
                </div>
                <span className="font-mono tabular-nums font-semibold text-[#DC2626]">
                  +{formatMinutesToHHMM(d.minutosExtra50 + d.minutosExtra65 + d.minutosExtra70 + d.minutosExtra100)}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export const BancoHorasView: React.FC<ExtrasBancoProps> = ({
  colaborador,
  unidadeAtiva,
  pontos,
  jornada,
  ajustes,
  feriados,
  atestados,
  fechamentos,
  config,
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

  const fechado = fechamentos.some(
    (f) => f.mes === mes && (f.unidade === 'Todas' || f.unidade === unidadeAtiva)
  );

  return (
    <div className="space-y-3">
      <section className="bg-white dark:bg-[#1C1C20] text-[#111827] dark:text-zinc-100 rounded-xl p-3 shadow-sm border border-zinc-200/80 dark:border-zinc-800 space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Wallet className="w-4 h-4 text-[#DC2626] shrink-0" />
            <h1 className="text-sm font-bold truncate">Banco de Horas</h1>
          </div>
          <input
            type="month"
            value={mes}
            onChange={(e) => setMes(e.target.value)}
            className="text-xs font-medium px-2 py-1 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900"
          />
        </div>

        <div className="p-2.5 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-200/70 dark:border-zinc-800">
          <div className="text-xs font-bold text-[#DC2626]">
            Regime: {config.bancoHorasModo}
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            Todo saldo positivo de horas extras apurado na competência é liquidado diretamente no holerite do mês, sem acúmulo para períodos futuros.
          </p>
        </div>

        <div className="divide-y divide-zinc-100 dark:divide-zinc-800 text-xs">
          <div className="py-2 flex justify-between">
            <span className="text-zinc-500 dark:text-zinc-400">Saldo acumulado anterior</span>
            <span className="font-mono tabular-nums font-semibold">00:00</span>
          </div>
          <div className="py-2 flex justify-between">
            <span className="text-zinc-500 dark:text-zinc-400">Extras apuradas no mês</span>
            <span className="font-mono tabular-nums font-semibold text-[#DC2626]">
              +{formatMinutesToHHMM(resumo.totalMinExtrasGeral)}
            </span>
          </div>
          <div className="py-2 flex justify-between">
            <span className="text-zinc-500 dark:text-zinc-400">Atrasos acima da tolerância</span>
            <span className="font-mono tabular-nums font-semibold text-amber-600">
              -{formatMinutesToHHMM(resumo.totalMinAtraso)}
            </span>
          </div>
          <div className="py-2 flex justify-between">
            <span className="text-zinc-500 dark:text-zinc-400">Valor liquidado em folha (com DSR)</span>
            <span className="font-mono tabular-nums font-bold">
              {formatBRL(holerite.totalHorasExtras + holerite.valorAdicionalNoturno + holerite.dsrSobreExtras)}
            </span>
          </div>
          <div className="py-2 flex justify-between">
            <span className="text-zinc-500 dark:text-zinc-400">Status da competência</span>
            <span className="font-semibold">
              {fechado ? 'Fechada / Liquidada' : 'Em aberto (prévia)'}
            </span>
          </div>
        </div>
      </section>
    </div>
  );
};
