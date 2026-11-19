import React, { useMemo, useState } from 'react';
import { Clock } from 'lucide-react';
import {
  AjusteEscala,
  Atestado,
  Colaborador,
  ConfiguracaoEmpresa,
  DiaEspelho,
  Feriado,
  JornadaTemplate,
  RegistroPonto,
  Unidade,
} from '../../types/rh';
import {
  calcularEspelhoMensal,
  formatDateBR,
  formatMinutesToHHMM,
  getCurrentMonthStr,
} from '../../utils/cltCalculations';

interface EspelhoViewProps {
  colaborador: Colaborador;
  unidadeAtiva: Unidade;
  pontos: RegistroPonto[];
  jornada: JornadaTemplate;
  ajustes: AjusteEscala[];
  feriados: Feriado[];
  atestados: Atestado[];
  config: ConfiguracaoEmpresa;
}

const STATUS_LABELS: Record<DiaEspelho['status'], { label: string; cls: string }> = {
  anterior_admissao: { label: 'Pré-admissão', cls: 'text-zinc-400' },
  folga: { label: 'Folga', cls: 'text-zinc-500 dark:text-zinc-400' },
  feriado: { label: 'Feriado', cls: 'text-sky-600 dark:text-sky-400' },
  em_andamento: { label: 'Em andamento', cls: 'text-amber-600 dark:text-amber-400' },
  regular: { label: 'Regular', cls: 'text-emerald-600 dark:text-emerald-400' },
  hora_extra: { label: 'Hora Extra', cls: 'text-[#DC2626]' },
  atraso: { label: 'Atraso (>10m)', cls: 'text-amber-700 dark:text-amber-400' },
  falta: { label: 'Falta', cls: 'text-red-700 dark:text-red-400' },
  abonado: { label: 'Abonado', cls: 'text-emerald-600 dark:text-emerald-400' },
};

export const EspelhoView: React.FC<EspelhoViewProps> = ({
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

  return (
    <div className="space-y-3">
      {/* Cabeçalho e filtro do mês */}
      <section className="bg-white dark:bg-[#1C1C20] text-[#111827] dark:text-zinc-100 rounded-xl p-3 shadow-sm border border-zinc-200/80 dark:border-zinc-800">
        <div className="flex items-center justify-between gap-2 mb-2.5">
          <div className="flex items-center gap-2 min-w-0">
            <Clock className="w-4 h-4 text-[#DC2626] shrink-0" />
            <h1 className="text-sm font-bold truncate">Espelho de Ponto</h1>
          </div>
          <input
            type="month"
            value={mes}
            onChange={(e) => setMes(e.target.value)}
            className="text-xs font-medium px-2 py-1 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 focus:outline-none focus:border-[#DC2626]"
          />
        </div>

        <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-2.5">
          Lotação: <strong className="text-[#111827] dark:text-zinc-200">{colaborador.lotacao}</strong> · Tolerância CLT (5 min/marcação · 10 min/dia). Atrasos computados a partir da admissão ({formatDateBR(colaborador.dataAdmissao)}) e após o término do turno.
        </p>

        <div className="grid grid-cols-3 gap-2 text-center bg-zinc-50 dark:bg-zinc-900 rounded-lg p-2 border border-zinc-200/60 dark:border-zinc-800">
          <div>
            <div className="text-[11px] text-zinc-500 dark:text-zinc-400">Trabalhadas</div>
            <div className="font-mono tabular-nums text-xs font-bold">
              {formatMinutesToHHMM(resumo.totalMinTrabalhados)}
            </div>
          </div>
          <div>
            <div className="text-[11px] text-zinc-500 dark:text-zinc-400">Extras</div>
            <div className="font-mono tabular-nums text-xs font-bold text-[#DC2626]">
              +{formatMinutesToHHMM(resumo.totalMinExtrasGeral)}
            </div>
          </div>
          <div>
            <div className="text-[11px] text-zinc-500 dark:text-zinc-400">Atrasos</div>
            <div className="font-mono tabular-nums text-xs font-bold text-amber-600">
              -{formatMinutesToHHMM(resumo.totalMinAtraso)}
            </div>
          </div>
        </div>
      </section>

      {/* Lista diária (Telemóvel) + Tabela completa (Tablet/Desktop) */}
      <section className="bg-white dark:bg-[#1C1C20] text-[#111827] dark:text-zinc-100 rounded-xl p-3 md:p-4 shadow-sm border border-zinc-200/80 dark:border-zinc-800">
        <div className="divide-y divide-zinc-100 dark:divide-zinc-800 md:hidden">
          {resumo.dias.map((dia) => {
            const st = STATUS_LABELS[dia.status];
            const extrasDia =
              dia.minutosExtra50 + dia.minutosExtra65 + dia.minutosExtra70 + dia.minutosExtra100;
            const ent = dia.marcacoes.entrada?.hora.slice(0, 5) || '—';
            const saiA = dia.marcacoes.saida_almoco?.hora.slice(0, 5) || '—';
            const retA = dia.marcacoes.retorno_almoco?.hora.slice(0, 5) || '—';
            const sai = dia.marcacoes.saida?.hora.slice(0, 5) || '—';

            return (
              <div key={dia.data} className="py-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-mono tabular-nums text-xs font-bold">{dia.labelDia}</span>
                    {dia.nomeFeriado && (
                      <span className="text-[11px] text-sky-600 dark:text-sky-400 truncate">
                        · {dia.nomeFeriado}
                      </span>
                    )}
                  </div>
                  <span className={`text-[11px] font-semibold shrink-0 ${st.cls}`}>
                    {st.label}
                  </span>
                </div>

                {dia.status !== 'anterior_admissao' && (
                  <div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-zinc-500 dark:text-zinc-400">
                    <span className="font-mono tabular-nums">
                      {ent} / {saiA} / {retA} / {sai}
                    </span>
                    <span className="font-mono tabular-nums shrink-0">
                      {dia.minutosTrabalhados > 0 && `Trab: ${formatMinutesToHHMM(dia.minutosTrabalhados)}`}
                      {extrasDia > 0 && ` · +${formatMinutesToHHMM(extrasDia)}`}
                      {dia.minutosAtraso > 0 && ` · -${formatMinutesToHHMM(dia.minutosAtraso)}`}
                      {dia.toleranciaAplicada && ' · Tol. CLT'}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-800 text-[11px] uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                <th className="py-2 pr-3 font-semibold">Data</th>
                <th className="py-2 px-2 font-semibold">Status</th>
                <th className="py-2 px-2 font-semibold text-center">Entrada</th>
                <th className="py-2 px-2 font-semibold text-center">Saída Almoço</th>
                <th className="py-2 px-2 font-semibold text-center">Ret. Almoço</th>
                <th className="py-2 px-2 font-semibold text-center">Saída</th>
                <th className="py-2 px-2 font-semibold text-right">Trabalhadas</th>
                <th className="py-2 px-2 font-semibold text-right">Extras</th>
                <th className="py-2 pl-2 font-semibold text-right">Atrasos</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {resumo.dias.map((dia) => {
                const st = STATUS_LABELS[dia.status];
                const extrasDia =
                  dia.minutosExtra50 + dia.minutosExtra65 + dia.minutosExtra70 + dia.minutosExtra100;
                const ent = dia.marcacoes.entrada?.hora.slice(0, 5) || '—';
                const saiA = dia.marcacoes.saida_almoco?.hora.slice(0, 5) || '—';
                const retA = dia.marcacoes.retorno_almoco?.hora.slice(0, 5) || '—';
                const sai = dia.marcacoes.saida?.hora.slice(0, 5) || '—';

                return (
                  <tr key={dia.data} className="hover:bg-zinc-50/70 dark:hover:bg-zinc-900/50">
                    <td className="py-2 pr-3 font-mono tabular-nums font-semibold whitespace-nowrap">
                      <span>{dia.labelDia}</span>
                      {dia.nomeFeriado && (
                        <span className="ml-1.5 font-sans text-[11px] font-normal text-sky-600 dark:text-sky-400">
                          · {dia.nomeFeriado}
                        </span>
                      )}
                    </td>
                    <td className={`py-2 px-2 text-[11px] font-semibold whitespace-nowrap ${st.cls}`}>
                      {st.label}
                      {dia.toleranciaAplicada && (
                        <span className="ml-1 text-zinc-400 font-normal">(Tol. CLT)</span>
                      )}
                    </td>
                    <td className="py-2 px-2 font-mono tabular-nums text-center text-zinc-600 dark:text-zinc-300">
                      {dia.status === 'anterior_admissao' ? '—' : ent}
                    </td>
                    <td className="py-2 px-2 font-mono tabular-nums text-center text-zinc-600 dark:text-zinc-300">
                      {dia.status === 'anterior_admissao' ? '—' : saiA}
                    </td>
                    <td className="py-2 px-2 font-mono tabular-nums text-center text-zinc-600 dark:text-zinc-300">
                      {dia.status === 'anterior_admissao' ? '—' : retA}
                    </td>
                    <td className="py-2 px-2 font-mono tabular-nums text-center text-zinc-600 dark:text-zinc-300">
                      {dia.status === 'anterior_admissao' ? '—' : sai}
                    </td>
                    <td className="py-2 px-2 font-mono tabular-nums text-right font-medium">
                      {dia.minutosTrabalhados > 0 ? formatMinutesToHHMM(dia.minutosTrabalhados) : '—'}
                    </td>
                    <td className="py-2 px-2 font-mono tabular-nums text-right font-semibold text-[#DC2626]">
                      {extrasDia > 0 ? `+${formatMinutesToHHMM(extrasDia)}` : '—'}
                    </td>
                    <td className="py-2 pl-2 font-mono tabular-nums text-right font-semibold text-amber-600">
                      {dia.minutosAtraso > 0 ? `-${formatMinutesToHHMM(dia.minutosAtraso)}` : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
