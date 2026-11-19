import React, { useMemo, useState } from 'react';
import { CalendarDays, Timer } from 'lucide-react';
import {
  AjusteEscala,
  Atestado,
  Colaborador,
  ConfiguracaoEmpresa,
  DEFAULT_GRADE_SEMANAL,
  Feriado,
  JornadaTemplate,
  ORDEM_DIAS_SEMANA,
  RegistroPonto,
  Unidade,
  calcularMinutosDiaGrade,
  calcularMinutosSemanaGrade,
} from '../../types/rh';
import {
  calcularEspelhoMensal,
  formatMinutesToHHMM,
  getCurrentMonthStr,
} from '../../utils/cltCalculations';

interface JornadasViewProps {
  colaborador: Colaborador;
  jornada: JornadaTemplate;
}

export const JornadasView: React.FC<JornadasViewProps> = ({ colaborador, jornada }) => {
  const grade = colaborador.gradeSemanal || {
    ...DEFAULT_GRADE_SEMANAL,
    seg: {
      ativo: true,
      entrada: jornada.segSexEntrada,
      saidaAlmoco: jornada.intervaloMin > 0 ? '13:00' : '',
      retornoAlmoco: jornada.intervaloMin > 0 ? '14:00' : '',
      saida: jornada.segSexSaida,
    },
    ter: {
      ativo: true,
      entrada: jornada.segSexEntrada,
      saidaAlmoco: jornada.intervaloMin > 0 ? '13:00' : '',
      retornoAlmoco: jornada.intervaloMin > 0 ? '14:00' : '',
      saida: jornada.segSexSaida,
    },
    qua: {
      ativo: true,
      entrada: jornada.segSexEntrada,
      saidaAlmoco: jornada.intervaloMin > 0 ? '13:00' : '',
      retornoAlmoco: jornada.intervaloMin > 0 ? '14:00' : '',
      saida: jornada.segSexSaida,
    },
    qui: {
      ativo: true,
      entrada: jornada.segSexEntrada,
      saidaAlmoco: jornada.intervaloMin > 0 ? '13:00' : '',
      retornoAlmoco: jornada.intervaloMin > 0 ? '14:00' : '',
      saida: jornada.segSexSaida,
    },
    sex: {
      ativo: true,
      entrada: jornada.segSexEntrada,
      saidaAlmoco: jornada.intervaloMin > 0 ? '13:00' : '',
      retornoAlmoco: jornada.intervaloMin > 0 ? '14:00' : '',
      saida: jornada.segSexSaida,
    },
    sab: {
      ativo: jornada.sabadoAtivo,
      entrada: jornada.sabadoEntrada,
      saidaAlmoco: '',
      retornoAlmoco: '',
      saida: jornada.sabadoSaida,
    },
    dom: {
      ...DEFAULT_GRADE_SEMANAL.dom,
      ativo: false,
    },
  };

  const cargaSemanalMin = calcularMinutosSemanaGrade(grade);

  return (
    <div className="space-y-3">
      <section className="bg-white dark:bg-[#1C1C20] text-[#111827] dark:text-zinc-100 rounded-xl p-3 shadow-sm border border-zinc-200/80 dark:border-zinc-800 space-y-2.5">
        <div className="flex items-center gap-2">
          <Timer className="w-4 h-4 text-[#DC2626] shrink-0" />
          <h1 className="text-sm font-bold">Minha Jornada de Trabalho</h1>
        </div>

        <div className="p-2.5 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-200/70 dark:border-zinc-800 flex items-center justify-between gap-2">
          <div>
            <div className="text-xs font-bold">Grade Semanal Personalizada</div>
            <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
              Lotação: {colaborador.lotacao}
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-[10px] text-zinc-500 dark:text-zinc-400">Carga Semanal</div>
            <div className="text-xs font-mono tabular-nums font-bold text-[#DC2626]">
              {formatMinutesToHHMM(cargaSemanalMin)}
            </div>
          </div>
        </div>

        <div className="divide-y divide-zinc-100 dark:divide-zinc-800 text-xs">
          {ORDEM_DIAS_SEMANA.map(({ key, label }) => {
            const dia = grade[key];
            const minDia = calcularMinutosDiaGrade(dia);
            return (
              <div key={key} className="py-2 flex items-center justify-between gap-2">
                <span className="font-medium text-zinc-700 dark:text-zinc-200">{label}</span>
                {dia.ativo ? (
                  <div className="text-right font-mono tabular-nums">
                    <div className="font-semibold text-[11px]">
                      {dia.entrada}–{dia.saida}
                      {dia.saidaAlmoco && dia.retornoAlmoco
                        ? ` (Alm: ${dia.saidaAlmoco}–${dia.retornoAlmoco})`
                        : ''}
                    </div>
                    <div className="text-[10px] text-zinc-500 dark:text-zinc-400">
                      {formatMinutesToHHMM(minDia)}/dia
                    </div>
                  </div>
                ) : (
                  <span className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">
                    Folga
                  </span>
                )}
              </div>
            );
          })}
          <div className="py-2 flex items-center justify-between gap-2">
            <span className="text-zinc-500 dark:text-zinc-400">Tolerância CLT (Art. 58 §1º)</span>
            <span className="font-mono tabular-nums font-semibold text-[11px]">
              5 min/batida · 10 min/dia
            </span>
          </div>
        </div>
      </section>
    </div>
  );
};

interface EscalasViewProps {
  colaborador: Colaborador;
  unidadeAtiva: Unidade;
  pontos: RegistroPonto[];
  jornada: JornadaTemplate;
  ajustes: AjusteEscala[];
  feriados: Feriado[];
  atestados: Atestado[];
  config: ConfiguracaoEmpresa;
}

export const EscalasView: React.FC<EscalasViewProps> = ({
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

  const primeiroDiaSemana = resumo.dias[0]?.diaSemanaIdx ?? 0;

  return (
    <div className="space-y-3">
      <section className="bg-white dark:bg-[#1C1C20] text-[#111827] dark:text-zinc-100 rounded-xl p-3 shadow-sm border border-zinc-200/80 dark:border-zinc-800">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-[#DC2626] shrink-0" />
            <h1 className="text-sm font-bold">Escala Mensal</h1>
          </div>
          <input
            type="month"
            value={mes}
            onChange={(e) => setMes(e.target.value)}
            className="text-xs font-medium px-2 py-1 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900"
          />
        </div>

        {/* Grade calendário */}
        <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 mb-1">
          <span>D</span>
          <span>S</span>
          <span>T</span>
          <span>Q</span>
          <span>Q</span>
          <span>S</span>
          <span>S</span>
        </div>
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: primeiroDiaSemana }).map((_, idx) => (
            <div key={`empty-${idx}`} className="h-11" />
          ))}
          {resumo.dias.map((d) => {
            const numDia = d.data.split('-')[2];
            const isFeriado = d.ehFeriado;
            const isFolga = d.minutosPrevistos === 0 && !isFeriado;
            const isCustom = d.ajusteAplicado?.tipo === 'horario_proprio';

            let boxCls =
              'bg-zinc-50 dark:bg-zinc-900 border-zinc-200/70 dark:border-zinc-800 text-[#111827] dark:text-zinc-100';
            let tag = `${Math.round(d.minutosPrevistos / 60)}h`;

            if (d.status === 'anterior_admissao') {
              boxCls = 'bg-zinc-100/60 dark:bg-zinc-950 border-zinc-200/40 dark:border-zinc-900 text-zinc-400';
              tag = '—';
            } else if (isFeriado) {
              boxCls = 'bg-sky-50 dark:bg-sky-950/40 border-sky-200 dark:border-sky-800 text-sky-700 dark:text-sky-300';
              tag = 'Fer.';
            } else if (isFolga) {
              boxCls = 'bg-zinc-100 dark:bg-zinc-800/70 border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400';
              tag = 'Folga';
            } else if (isCustom) {
              boxCls = 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900 text-[#DC2626]';
              tag = `${Math.round(d.minutosPrevistos / 60)}h*`;
            }

            return (
              <div
                key={d.data}
                title={d.nomeFeriado || d.ajusteAplicado?.motivo || d.labelDia}
                className={`h-11 rounded-lg border flex flex-col items-center justify-center ${boxCls}`}
              >
                <span className="font-mono tabular-nums text-xs font-bold leading-none">{numDia}</span>
                <span className="text-[10px] font-medium mt-0.5 leading-none">{tag}</span>
              </div>
            );
          })}
        </div>

        <div className="mt-3 pt-2 border-t border-zinc-100 dark:border-zinc-800 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-zinc-500 dark:text-zinc-400">
          <span>Trabalho: {resumo.diasUteisMes}d</span>
          <span>·</span>
          <span>Domingos/Feriados: {resumo.domingosFeriadosMes}d</span>
          <span>·</span>
          <span>Lotação: {colaborador.lotacao}</span>
        </div>
      </section>
    </div>
  );
};
