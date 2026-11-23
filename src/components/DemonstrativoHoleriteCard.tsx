import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Download } from 'lucide-react';
import {
  Colaborador,
  ConfiguracaoEmpresa,
  HoleriteCalculado,
  HoleriteConfigurado,
  ResumoMensalColaborador,
  Unidade,
  getDadosEmpresaUnidade,
} from '../types/rh';
import {
  calcularINSS2026,
  formatBRL,
  formatDateBR,
  formatMinutesToHHMM,
} from '../utils/cltCalculations';
import { gerarHoleritePDF } from '../utils/holeritePdf';

const MESES_PT = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

function formatCompetenciaBR(mesYYYYMM: string): string {
  const [ano, mesStr] = mesYYYYMM.split('-');
  const idx = parseInt(mesStr, 10) - 1;
  if (!ano || isNaN(idx) || idx < 0 || idx > 11) return mesYYYYMM;
  return `${mesStr}/${ano} (${MESES_PT[idx]})`;
}

interface DemonstrativoHoleriteCardProps {
  colaborador: Colaborador;
  unidadeAtiva: Unidade;
  mes: string;
  resumo: ResumoMensalColaborador;
  holerite: HoleriteCalculado;
  holeriteConfigurado?: HoleriteConfigurado;
  config: ConfiguracaoEmpresa;
}

export const DemonstrativoHoleriteCard: React.FC<DemonstrativoHoleriteCardProps> = ({
  colaborador,
  unidadeAtiva,
  mes,
  resumo,
  holerite,
  holeriteConfigurado,
  config,
}) => {
  const [mostrarFaixas, setMostrarFaixas] = useState(false);
  const [pdfFeedback, setPdfFeedback] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

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

  const recSelecionados = holeriteConfigurado
    ? holeriteConfigurado.recebiveis.filter((r) => r.selecionado)
    : [];
  const descSelecionados = holeriteConfigurado
    ? holeriteConfigurado.descontaveis.filter((d) => d.selecionado)
    : [];

  const totalVencimentos = holeriteConfigurado
    ? holeriteConfigurado.totalRecebiveis
    : holerite.totalProventos;
  const totalDescontosFinal = holeriteConfigurado
    ? holeriteConfigurado.totalDescontaveis
    : holerite.totalDescontos;
  const salarioLiquidoFinal = holeriteConfigurado
    ? holeriteConfigurado.salarioLiquido
    : holerite.salarioLiquido;

  const atrasosConfig = holeriteConfigurado
    ? descSelecionados.find((d) => d.id === 'atrasos')?.valor || 0
    : holerite.descontoAtrasos;
  const baseInssFinal = holeriteConfigurado
    ? Math.max(0, Number((totalVencimentos - atrasosConfig).toFixed(2)))
    : holerite.baseInss;
  const inssFinal = holeriteConfigurado
    ? descSelecionados.find((d) => d.id === 'inss')?.valor || 0
    : holerite.inssValor;
  const faixasInssDisplay = holeriteConfigurado
    ? calcularINSS2026(baseInssFinal).faixas
    : holerite.inssFaixas;

  const fgtsMes = Number((baseInssFinal * 0.08).toFixed(2));
  const baseIrrf = Math.max(0, Number((baseInssFinal - inssFinal).toFixed(2)));
  const competenciaLabel = formatCompetenciaBR(mes);

  const handleBaixarPdf = () => {
    gerarHoleritePDF({
      colaborador,
      unidadeAtiva,
      mes,
      resumo,
      holerite,
      holeriteConfigurado,
      config,
    });
    setPdfFeedback('Holerite PDF gerado com sucesso!');
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setPdfFeedback(null), 3500);
  };

  return (
    <div className="space-y-3">
      {/* Botão de Download Direto em PDF (jsPDF) */}
      <button
        type="button"
        onClick={handleBaixarPdf}
        className="no-print w-full py-2.5 px-4 rounded-xl bg-[#DC2626] hover:bg-red-700 text-white text-xs font-bold tracking-wide flex items-center justify-center gap-2 shadow-sm transition-colors cursor-pointer min-h-[44px]"
      >
        <Download className="w-4 h-4 shrink-0" />
        <span>Baixar PDF</span>
      </button>

      {pdfFeedback && (
        <div
          role="status"
          className="no-print flex items-center gap-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 px-3 py-2 text-xs font-medium text-emerald-700 dark:text-emerald-300"
        >
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{pdfFeedback}</span>
        </div>
      )}

      {/* Folha Oficial do Demonstrativo de Pagamento */}
      <section className="bg-white dark:bg-[#1C1C20] text-[#111827] dark:text-zinc-100 rounded-xl p-3 shadow-sm border border-zinc-200/80 dark:border-zinc-800 print-card">
        {/* Título Oficial */}
        <div className="flex items-start justify-between gap-2 pb-2 mb-2.5 border-b border-zinc-200 dark:border-zinc-800 print-border">
          <div>
            <h2 className="text-xs font-extrabold uppercase tracking-wider text-[#111827] dark:text-white print-text-strong">
              Demonstrativo de Pagamento
            </h2>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 print-text-muted">
              Recibo de Pagamento de Salário · CLT
            </p>
          </div>
          <div className="text-right shrink-0">
            <div className="text-[10px] uppercase tracking-wider text-zinc-500 dark:text-zinc-400 print-text-muted">
              Competência
            </div>
            <div className="text-xs font-mono font-bold text-[#111827] dark:text-white print-text-strong">
              {competenciaLabel}
            </div>
          </div>
        </div>

        {/* Cabeçalho da Empresa (empresas_unidades) */}
        <div className="p-2.5 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 text-xs space-y-0.5 mb-2.5 print-box">
          <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 print-text-muted">
            Empregador · Unidade {unidadeEmpresa}
          </div>
          <div className="font-bold text-[#111827] dark:text-white print-text-strong">
            {empresaHeader.razaoSocial || config.razaoSocial}
          </div>
          <div className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 print-text-body">
            {empresaHeader.nomeFantasia || config.nomeFantasia || 'Hellcife Tattoo Supply'}
          </div>
          <div className="text-[11px] text-zinc-600 dark:text-zinc-400 font-mono print-text-body">
            CNPJ {empresaHeader.cnpj || config.cnpj}
            {empresaHeader.inscricaoEstadual
              ? ` · IE ${empresaHeader.inscricaoEstadual}`
              : ''}
          </div>
          {enderecoEmpresa && (
            <div className="text-[11px] text-zinc-600 dark:text-zinc-400 print-text-body">
              {enderecoEmpresa}
            </div>
          )}
          {(empresaHeader.telefone || empresaHeader.email || empresaHeader.site) && (
            <div className="text-[11px] text-zinc-500 dark:text-zinc-400 print-text-muted">
              {[empresaHeader.telefone, empresaHeader.email, empresaHeader.site]
                .filter(Boolean)
                .join(' · ')}
            </div>
          )}
        </div>

        {/* Cabeçalho Completo do Colaborador */}
        <div className="p-2.5 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 text-xs mb-3 print-box">
          <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5 print-text-muted">
            Dados do Colaborador
          </div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px]">
            <div className="col-span-2">
              <span className="text-zinc-500 dark:text-zinc-400 print-text-muted block text-[10px]">
                Nome Completo
              </span>
              <span className="font-bold text-[#111827] dark:text-white print-text-strong">
                {colaborador.nome}
              </span>
            </div>
            <div>
              <span className="text-zinc-500 dark:text-zinc-400 print-text-muted block text-[10px]">
                Função / Cargo
              </span>
              <span className="font-semibold text-[#111827] dark:text-zinc-100 print-text-body">
                {colaborador.funcao || 'Não informada'}
              </span>
            </div>
            <div>
              <span className="text-zinc-500 dark:text-zinc-400 print-text-muted block text-[10px]">
                CPF
              </span>
              <span className="font-mono font-semibold text-[#111827] dark:text-zinc-100 print-text-body">
                {colaborador.cpf || 'Não informado'}
              </span>
            </div>
            <div>
              <span className="text-zinc-500 dark:text-zinc-400 print-text-muted block text-[10px]">
                Data de Admissão
              </span>
              <span className="font-mono text-[#111827] dark:text-zinc-100 print-text-body">
                {formatDateBR(colaborador.dataAdmissao)}
              </span>
            </div>
            <div>
              <span className="text-zinc-500 dark:text-zinc-400 print-text-muted block text-[10px]">
                Lotação / Unidade
              </span>
              <span className="font-semibold text-[#111827] dark:text-zinc-100 print-text-body">
                {colaborador.lotacao}
              </span>
            </div>
          </div>
        </div>

        {/* Tabela de Vencimentos e Descontos */}
        <div className="overflow-x-auto mb-3">
          <table className="w-full border-collapse text-[11px]">
            <thead>
              <tr className="border-y border-zinc-300 dark:border-zinc-700 bg-zinc-100/80 dark:bg-zinc-900 print-table-head text-left">
                <th className="py-1.5 px-1.5 font-bold">Descrição</th>
                <th className="py-1.5 px-1 font-bold text-right">Ref.</th>
                <th className="py-1.5 px-1.5 font-bold text-right">Vencimentos</th>
                <th className="py-1.5 px-1.5 font-bold text-right">Descontos</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 print-divide">
              {holeriteConfigurado ? (
                <>
                  {recSelecionados.map((item) => (
                    <tr key={`rec-${item.id}`}>
                      <td className="py-1.5 px-1.5 font-medium">{item.descricao}</td>
                      <td className="py-1.5 px-1 text-right font-mono tabular-nums text-zinc-500 print-text-muted">
                        {item.referencia || '-'}
                      </td>
                      <td className="py-1.5 px-1.5 text-right font-mono tabular-nums font-semibold">
                        {formatBRL(item.valor)}
                      </td>
                      <td className="py-1.5 px-1.5 text-right font-mono tabular-nums text-zinc-400">
                        —
                      </td>
                    </tr>
                  ))}

                  {descSelecionados.map((item) => (
                    <tr key={`desc-${item.id}`}>
                      <td className="py-1.5 px-1.5">
                        <span>{item.descricao}</span>
                        {item.id === 'inss' && (
                          <button
                            type="button"
                            onClick={() => setMostrarFaixas((v) => !v)}
                            className="no-print ml-1.5 text-[10px] text-[#DC2626] hover:underline cursor-pointer"
                          >
                            (ver faixas)
                          </button>
                        )}
                      </td>
                      <td className="py-1.5 px-1 text-right font-mono tabular-nums text-zinc-500 print-text-muted">
                        {item.referencia || '-'}
                      </td>
                      <td className="py-1.5 px-1.5 text-right font-mono tabular-nums text-zinc-400">
                        —
                      </td>
                      <td className="py-1.5 px-1.5 text-right font-mono tabular-nums">
                        {formatBRL(item.valor)}
                      </td>
                    </tr>
                  ))}
                </>
              ) : (
                <>
                  <tr>
                    <td className="py-1.5 px-1.5 font-medium">Salário Base</td>
                    <td className="py-1.5 px-1 text-right font-mono tabular-nums text-zinc-500 print-text-muted">
                      30d
                    </td>
                    <td className="py-1.5 px-1.5 text-right font-mono tabular-nums font-semibold">
                      {formatBRL(holerite.salarioBase)}
                    </td>
                    <td className="py-1.5 px-1.5 text-right font-mono tabular-nums text-zinc-400">
                      —
                    </td>
                  </tr>

                  {holerite.valorExtra50 > 0 && (
                    <tr>
                      <td className="py-1.5 px-1.5">Horas Extras +50%</td>
                      <td className="py-1.5 px-1 text-right font-mono tabular-nums text-zinc-500 print-text-muted">
                        {formatMinutesToHHMM(resumo.totalMinExtra50)}
                      </td>
                      <td className="py-1.5 px-1.5 text-right font-mono tabular-nums">
                        {formatBRL(holerite.valorExtra50)}
                      </td>
                      <td className="py-1.5 px-1.5 text-right font-mono tabular-nums text-zinc-400">
                        —
                      </td>
                    </tr>
                  )}

                  {holerite.valorExtra65 > 0 && (
                    <tr>
                      <td className="py-1.5 px-1.5">Horas Extras +65%</td>
                      <td className="py-1.5 px-1 text-right font-mono tabular-nums text-zinc-500 print-text-muted">
                        {formatMinutesToHHMM(resumo.totalMinExtra65)}
                      </td>
                      <td className="py-1.5 px-1.5 text-right font-mono tabular-nums">
                        {formatBRL(holerite.valorExtra65)}
                      </td>
                      <td className="py-1.5 px-1.5 text-right font-mono tabular-nums text-zinc-400">
                        —
                      </td>
                    </tr>
                  )}

                  {holerite.valorExtra70 > 0 && (
                    <tr>
                      <td className="py-1.5 px-1.5">Horas Extras +70%</td>
                      <td className="py-1.5 px-1 text-right font-mono tabular-nums text-zinc-500 print-text-muted">
                        {formatMinutesToHHMM(resumo.totalMinExtra70)}
                      </td>
                      <td className="py-1.5 px-1.5 text-right font-mono tabular-nums">
                        {formatBRL(holerite.valorExtra70)}
                      </td>
                      <td className="py-1.5 px-1.5 text-right font-mono tabular-nums text-zinc-400">
                        —
                      </td>
                    </tr>
                  )}

                  {holerite.valorExtra100 > 0 && (
                    <tr>
                      <td className="py-1.5 px-1.5">Domingos / Feriados +100%</td>
                      <td className="py-1.5 px-1 text-right font-mono tabular-nums text-zinc-500 print-text-muted">
                        {formatMinutesToHHMM(resumo.totalMinExtra100)}
                      </td>
                      <td className="py-1.5 px-1.5 text-right font-mono tabular-nums">
                        {formatBRL(holerite.valorExtra100)}
                      </td>
                      <td className="py-1.5 px-1.5 text-right font-mono tabular-nums text-zinc-400">
                        —
                      </td>
                    </tr>
                  )}

                  {holerite.valorAdicionalNoturno > 0 && (
                    <tr>
                      <td className="py-1.5 px-1.5">Adicional Noturno</td>
                      <td className="py-1.5 px-1 text-right font-mono tabular-nums text-zinc-500 print-text-muted">
                        {formatMinutesToHHMM(resumo.totalMinNoturnos)}
                      </td>
                      <td className="py-1.5 px-1.5 text-right font-mono tabular-nums">
                        {formatBRL(holerite.valorAdicionalNoturno)}
                      </td>
                      <td className="py-1.5 px-1.5 text-right font-mono tabular-nums text-zinc-400">
                        —
                      </td>
                    </tr>
                  )}

                  <tr>
                    <td className="py-1.5 px-1.5">DSR sobre Horas Extras</td>
                    <td className="py-1.5 px-1 text-right font-mono tabular-nums text-zinc-500 print-text-muted">
                      {resumo.domingosFeriadosMes}d
                    </td>
                    <td className="py-1.5 px-1.5 text-right font-mono tabular-nums">
                      {formatBRL(holerite.dsrSobreExtras)}
                    </td>
                    <td className="py-1.5 px-1.5 text-right font-mono tabular-nums text-zinc-400">
                      —
                    </td>
                  </tr>

                  <tr>
                    <td className="py-1.5 px-1.5">Atrasos (&gt;10 min/dia)</td>
                    <td className="py-1.5 px-1 text-right font-mono tabular-nums text-zinc-500 print-text-muted">
                      {formatMinutesToHHMM(resumo.totalMinAtraso)}
                    </td>
                    <td className="py-1.5 px-1.5 text-right font-mono tabular-nums text-zinc-400">
                      —
                    </td>
                    <td className="py-1.5 px-1.5 text-right font-mono tabular-nums">
                      {formatBRL(holerite.descontoAtrasos)}
                    </td>
                  </tr>

                  <tr>
                    <td className="py-1.5 px-1.5">
                      <span>INSS 2026</span>
                      <button
                        type="button"
                        onClick={() => setMostrarFaixas((v) => !v)}
                        className="no-print ml-1.5 text-[10px] text-[#DC2626] hover:underline cursor-pointer"
                      >
                        (ver faixas)
                      </button>
                    </td>
                    <td className="py-1.5 px-1 text-right font-mono tabular-nums text-zinc-500 print-text-muted">
                      {holerite.inssAliquotaEfetiva.toFixed(1).replace('.', ',')}%
                    </td>
                    <td className="py-1.5 px-1.5 text-right font-mono tabular-nums text-zinc-400">
                      —
                    </td>
                    <td className="py-1.5 px-1.5 text-right font-mono tabular-nums">
                      {formatBRL(holerite.inssValor)}
                    </td>
                  </tr>

                  <tr>
                    <td className="py-1.5 px-1.5">
                      {colaborador.vtDiario > 0
                        ? 'Vale-Transporte (6%)'
                        : 'Vale-Transporte (Não optante)'}
                    </td>
                    <td className="py-1.5 px-1 text-right font-mono tabular-nums text-zinc-500 print-text-muted">
                      {colaborador.vtDiario > 0 ? '6%' : '0%'}
                    </td>
                    <td className="py-1.5 px-1.5 text-right font-mono tabular-nums text-zinc-400">
                      —
                    </td>
                    <td className="py-1.5 px-1.5 text-right font-mono tabular-nums">
                      {formatBRL(holerite.descontoVt6Pct)}
                    </td>
                  </tr>
                </>
              )}
            </tbody>
            <tfoot>
              <tr className="border-y border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/70 print-table-head font-bold">
                <td colSpan={2} className="py-1.5 px-1.5">
                  Totais (Vencimentos / Descontos)
                </td>
                <td className="py-1.5 px-1.5 text-right font-mono tabular-nums">
                  {formatBRL(totalVencimentos)}
                </td>
                <td className="py-1.5 px-1.5 text-right font-mono tabular-nums text-red-700 dark:text-red-400 print-text-strong">
                  {formatBRL(totalDescontosFinal)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Detalhamento Faixas INSS (apenas tela quando expandido) */}
        {mostrarFaixas && (
          <div className="no-print mb-3 py-2 px-2.5 bg-zinc-50 dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 space-y-1 text-[11px]">
            <div className="font-semibold text-zinc-600 dark:text-zinc-300">
              Tabela Progressiva INSS 2026 (Mínimo R$ 1.621,00)
            </div>
            {faixasInssDisplay.map((f) => (
              <div key={f.faixa} className="flex justify-between text-zinc-500 dark:text-zinc-400">
                <span>
                  {f.faixa} ({f.aliquota})
                </span>
                <span className="font-mono tabular-nums">{formatBRL(f.contribuicao)}</span>
              </div>
            ))}
          </div>
        )}

        {/* Valor Líquido a Receber */}
        <div className="p-2.5 rounded-lg bg-[#09090B] text-white flex items-center justify-between mb-3 print-liquido-box">
          <span className="text-xs font-bold uppercase tracking-wide">
            Valor Líquido a Receber
          </span>
          <span className="font-mono tabular-nums text-base font-extrabold">
            {formatBRL(salarioLiquidoFinal)}
          </span>
        </div>

        {/* Bases de Cálculo (INSS, FGTS, IRRF) */}
        <div className="p-2.5 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 mb-3 print-box">
          <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5 print-text-muted">
            Bases de Cálculo &amp; Encargos
          </div>
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div>
              <span className="block text-[10px] text-zinc-500 dark:text-zinc-400 print-text-muted">
                Base Cálc. INSS
              </span>
              <span className="font-mono tabular-nums font-semibold">
                {formatBRL(baseInssFinal)}
              </span>
            </div>
            <div>
              <span className="block text-[10px] text-zinc-500 dark:text-zinc-400 print-text-muted">
                Base Cálc. FGTS
              </span>
              <span className="font-mono tabular-nums font-semibold">
                {formatBRL(baseInssFinal)}
              </span>
            </div>
            <div>
              <span className="block text-[10px] text-zinc-500 dark:text-zinc-400 print-text-muted">
                FGTS do Mês (8%)
              </span>
              <span className="font-mono tabular-nums font-semibold">{formatBRL(fgtsMes)}</span>
            </div>
            <div>
              <span className="block text-[10px] text-zinc-500 dark:text-zinc-400 print-text-muted">
                Base Cálc. IRRF
              </span>
              <span className="font-mono tabular-nums font-semibold">
                {formatBRL(baseIrrf)}
              </span>
            </div>
          </div>
        </div>

        {/* Benefícios Externos */}
        <div className="mb-3">
          <h3 className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1 print-text-muted">
            Benefícios Externos ({resumo.diasTrabalhados} dias trabalhados)
          </h3>
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800 text-xs print-divide">
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
        </div>

        {/* Rodapé Oficial: Data e Assinatura do Colaborador */}
        <div className="pt-3 mt-3 border-t border-zinc-200 dark:border-zinc-800 print-border space-y-4">
          <p className="text-[10px] text-zinc-500 dark:text-zinc-400 print-text-muted leading-snug">
            Declaro ter recebido a importância líquida discriminada neste demonstrativo de pagamento.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 text-[11px]">
            <div>
              <div className="border-b border-zinc-400 dark:border-zinc-600 h-5 print-sig-line" />
              <div className="mt-1 text-[10px] text-zinc-500 dark:text-zinc-400 print-text-muted">
                Data: ____ / ____ / ________
              </div>
            </div>
            <div>
              <div className="border-b border-zinc-400 dark:border-zinc-600 h-5 print-sig-line" />
              <div className="mt-1 text-[10px] text-zinc-500 dark:text-zinc-400 print-text-muted truncate">
                Assinatura: {colaborador.nome}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
