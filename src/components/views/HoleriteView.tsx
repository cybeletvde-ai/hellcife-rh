import React, { useMemo, useState } from 'react';
import { Printer, Receipt } from 'lucide-react';
import {
  AjusteEscala,
  Atestado,
  Colaborador,
  ConfiguracaoEmpresa,
  Feriado,
  JornadaTemplate,
  RegistroPonto,
  Unidade,
  getDadosEmpresaUnidade,
} from '../../types/rh';
import {
  calcularEspelhoMensal,
  calcularHoleriteMensal,
  formatBRL,
  formatDateBR,
  formatMinutesToHHMM,
  getCurrentMonthStr,
} from '../../utils/cltCalculations';

interface HoleriteViewProps {
  colaborador: Colaborador;
  unidadeAtiva: Unidade;
  pontos: RegistroPonto[];
  jornada: JornadaTemplate;
  ajustes: AjusteEscala[];
  feriados: Feriado[];
  atestados: Atestado[];
  config: ConfiguracaoEmpresa;
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
}) => {
  const [mes, setMes] = useState(getCurrentMonthStr);
  const [mostrarFaixas, setMostrarFaixas] = useState(false);

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

  const unidadeEmpresa: Unidade =
    colaborador.lotacao === 'Ambas' ? unidadeAtiva : colaborador.lotacao;
  const empresaHeader = getDadosEmpresaUnidade(config, unidadeEmpresa);
  const enderecoEmpresa = [
    empresaHeader.logradouro &&
      `${empresaHeader.logradouro}${empresaHeader.numero ? `, ${empresaHeader.numero}` : ''}`,
    empresaHeader.complemento,
    empresaHeader.bairro,
    empresaHeader.cidade &&
      `${empresaHeader.cidade}${empresaHeader.uf ? `/${empresaHeader.uf}` : ''}`,
    empresaHeader.cep && `CEP ${empresaHeader.cep}`,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="space-y-3">
      {/* Cabeçalho Holerite */}
      <section className="bg-white dark:bg-[#1C1C20] text-[#111827] dark:text-zinc-100 rounded-xl p-3 shadow-sm border border-zinc-200/80 dark:border-zinc-800 print-card">
        <div className="flex items-center justify-between gap-2 mb-2.5 no-print">
          <div className="flex items-center gap-2 min-w-0">
            <Receipt className="w-4 h-4 text-[#DC2626] shrink-0" />
            <h1 className="text-sm font-bold truncate">Holerite · INSS 2026</h1>
          </div>
          <div className="flex items-center gap-1.5">
            <input
              type="month"
              value={mes}
              onChange={(e) => setMes(e.target.value)}
              className="text-xs font-medium px-2 py-1 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900"
            />
            <button
              type="button"
              onClick={() => window.print()}
              className="p-1.5 rounded-lg bg-zinc-900 dark:bg-zinc-800 text-white hover:bg-zinc-800 cursor-pointer"
              title="Imprimir / Gerar PDF"
              aria-label="Imprimir / PDF"
            >
              <Printer className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Cabeçalho do Demonstrativo */}
        <div className="p-2.5 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-200/70 dark:border-zinc-800 text-xs space-y-0.5 mb-3">
          <div className="flex justify-between gap-2 font-bold">
            <span className="truncate">{empresaHeader.razaoSocial}</span>
            <span className="font-mono shrink-0">{mes}</span>
          </div>
          {empresaHeader.nomeFantasia &&
            empresaHeader.nomeFantasia !== empresaHeader.razaoSocial && (
              <div className="text-[11px] font-medium text-zinc-600 dark:text-zinc-300">
                {empresaHeader.nomeFantasia}
              </div>
            )}
          <div className="text-zinc-500 dark:text-zinc-400">
            CNPJ {empresaHeader.cnpj}
            {empresaHeader.inscricaoEstadual ? ` · IE ${empresaHeader.inscricaoEstadual}` : ''} ·{' '}
            {config.regimeTributario}
          </div>
          {enderecoEmpresa && (
            <div className="text-[11px] text-zinc-500 dark:text-zinc-400">{enderecoEmpresa}</div>
          )}
          {(empresaHeader.telefone || empresaHeader.email || empresaHeader.site) && (
            <div className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
              {[empresaHeader.telefone, empresaHeader.email, empresaHeader.site]
                .filter(Boolean)
                .join(' · ')}
            </div>
          )}
          <div className="pt-1 border-t border-zinc-200/70 dark:border-zinc-800 flex justify-between">
            <span className="font-semibold">{colaborador.nome}</span>
            <span className="text-zinc-500 dark:text-zinc-400">{colaborador.funcao}</span>
          </div>
          <div className="text-zinc-500 dark:text-zinc-400">
            Admissão: {formatDateBR(colaborador.dataAdmissao)} · Lotação: {colaborador.lotacao}
          </div>
        </div>

        {/* Proventos */}
        <h2 className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1">
          Proventos
        </h2>
        <div className="divide-y divide-zinc-100 dark:divide-zinc-800 text-xs mb-3">
          <div className="py-1.5 flex justify-between">
            <span>Salário Base</span>
            <span className="font-mono tabular-nums font-semibold">
              {formatBRL(holerite.salarioBase)}
            </span>
          </div>
          {holerite.valorExtra50 > 0 && (
            <div className="py-1.5 flex justify-between">
              <span>Horas Extras +50% ({formatMinutesToHHMM(resumo.totalMinExtra50)})</span>
              <span className="font-mono tabular-nums">{formatBRL(holerite.valorExtra50)}</span>
            </div>
          )}
          {holerite.valorExtra65 > 0 && (
            <div className="py-1.5 flex justify-between">
              <span>Horas Extras +65% ({formatMinutesToHHMM(resumo.totalMinExtra65)})</span>
              <span className="font-mono tabular-nums">{formatBRL(holerite.valorExtra65)}</span>
            </div>
          )}
          {holerite.valorExtra70 > 0 && (
            <div className="py-1.5 flex justify-between">
              <span>Horas Extras +70% ({formatMinutesToHHMM(resumo.totalMinExtra70)})</span>
              <span className="font-mono tabular-nums">{formatBRL(holerite.valorExtra70)}</span>
            </div>
          )}
          {holerite.valorExtra100 > 0 && (
            <div className="py-1.5 flex justify-between">
              <span>Domingos / Feriados +100% ({formatMinutesToHHMM(resumo.totalMinExtra100)})</span>
              <span className="font-mono tabular-nums">{formatBRL(holerite.valorExtra100)}</span>
            </div>
          )}
          {holerite.valorAdicionalNoturno > 0 && (
            <div className="py-1.5 flex justify-between">
              <span>Adicional Noturno ({formatMinutesToHHMM(resumo.totalMinNoturnos)})</span>
              <span className="font-mono tabular-nums">
                {formatBRL(holerite.valorAdicionalNoturno)}
              </span>
            </div>
          )}
          <div className="py-1.5 flex justify-between">
            <span>DSR sobre Horas Extras</span>
            <span className="font-mono tabular-nums">{formatBRL(holerite.dsrSobreExtras)}</span>
          </div>
          <div className="py-1.5 flex justify-between font-bold">
            <span>Total de Proventos</span>
            <span className="font-mono tabular-nums">{formatBRL(holerite.totalProventos)}</span>
          </div>
        </div>

        {/* Descontos */}
        <h2 className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1">
          Descontos
        </h2>
        <div className="divide-y divide-zinc-100 dark:divide-zinc-800 text-xs mb-3">
          <div className="py-1.5 flex justify-between">
            <span>Atrasos &gt;10 min/dia ({formatMinutesToHHMM(resumo.totalMinAtraso)})</span>
            <span className="font-mono tabular-nums text-amber-700 dark:text-amber-400">
              -{formatBRL(holerite.descontoAtrasos)}
            </span>
          </div>
          <div className="py-1.5 flex justify-between items-center">
            <button
              type="button"
              onClick={() => setMostrarFaixas((v) => !v)}
              className="text-left hover:underline cursor-pointer"
            >
              INSS 2026 (Efet. {holerite.inssAliquotaEfetiva.toFixed(2).replace('.', ',')}%) · ver faixas
            </button>
            <span className="font-mono tabular-nums">-{formatBRL(holerite.inssValor)}</span>
          </div>
          {mostrarFaixas && (
            <div className="py-2 px-2 bg-zinc-50 dark:bg-zinc-900 rounded-lg space-y-1 text-[11px]">
              <div className="font-semibold text-zinc-600 dark:text-zinc-300">
                Tabela Progressiva INSS 2026 (Mínimo R$ 1.621,00)
              </div>
              {holerite.inssFaixas.map((f) => (
                <div key={f.faixa} className="flex justify-between text-zinc-500 dark:text-zinc-400">
                  <span>
                    {f.faixa} ({f.aliquota})
                  </span>
                  <span className="font-mono tabular-nums">{formatBRL(f.contribuicao)}</span>
                </div>
              ))}
            </div>
          )}
          <div className="py-1.5 flex justify-between">
            <span>Vale-Transporte (6% limitado ao concedido)</span>
            <span className="font-mono tabular-nums">-{formatBRL(holerite.descontoVt6Pct)}</span>
          </div>
          <div className="py-1.5 flex justify-between font-bold">
            <span>Total de Descontos</span>
            <span className="font-mono tabular-nums text-red-700 dark:text-red-400">
              -{formatBRL(holerite.totalDescontos)}
            </span>
          </div>
        </div>

        {/* Salário Líquido */}
        <div className="p-2.5 rounded-lg bg-[#09090B] text-white flex items-center justify-between mb-3">
          <span className="text-xs font-bold uppercase tracking-wide">Salário Líquido</span>
          <span className="font-mono tabular-nums text-base font-extrabold text-white">
            {formatBRL(holerite.salarioLiquido)}
          </span>
        </div>

        {/* Benefícios Externos */}
        <h2 className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1">
          Benefícios Externos ({resumo.diasTrabalhados} dias trabalhados)
        </h2>
        <div className="divide-y divide-zinc-100 dark:divide-zinc-800 text-xs">
          <div className="py-1.5 flex justify-between">
            <span>Vale-Alimentação ({formatBRL(colaborador.vaDiario)}/dia)</span>
            <span className="font-mono tabular-nums font-semibold">
              {formatBRL(holerite.beneficioVaMes)}
            </span>
          </div>
          <div className="py-1.5 flex justify-between">
            <span>Vale-Transporte ({formatBRL(colaborador.vtDiario)}/dia)</span>
            <span className="font-mono tabular-nums font-semibold">
              {formatBRL(holerite.beneficioVtMes)}
            </span>
          </div>
        </div>
      </section>
    </div>
  );
};
