import { jsPDF } from 'jspdf';
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
  formatBRL,
  formatDateBR,
  formatMinutesToHHMM,
} from './cltCalculations';

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

function formatCompetenciaExtenso(mesYYYYMM: string): string {
  const [ano, mesStr] = mesYYYYMM.split('-');
  const idx = parseInt(mesStr, 10) - 1;
  if (!ano || isNaN(idx) || idx < 0 || idx > 11) return mesYYYYMM;
  return `${mesStr}/${ano} (${MESES_PT[idx]})`;
}

function formatMesAnoArquivo(mesYYYYMM: string): string {
  const [ano, mesStr] = mesYYYYMM.split('-');
  if (!ano || !mesStr) return mesYYYYMM.replace(/[^a-zA-Z0-9]+/g, '_');
  return `${mesStr}_${ano}`;
}

function sanitizeFileSegment(text: string): string {
  const clean = (text || 'Colaborador')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return clean || 'Colaborador';
}

export interface GerarHoleritePdfParams {
  colaborador: Colaborador;
  unidadeAtiva: Unidade;
  mes: string;
  resumo: ResumoMensalColaborador;
  holerite: HoleriteCalculado;
  holeriteConfigurado?: HoleriteConfigurado;
  config: ConfiguracaoEmpresa;
}

export function gerarHoleritePDF({
  colaborador,
  unidadeAtiva,
  mes,
  resumo,
  holerite,
  holeriteConfigurado,
  config,
}: GerarHoleritePdfParams): string {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = 210;
  const margin = 14;
  const contentWidth = pageWidth - margin * 2; // 182 mm
  let y = 14;

  const unidadeEmpresa: Unidade =
    colaborador.lotacao === 'Ambas' ? unidadeAtiva : colaborador.lotacao;
  const empresa = getDadosEmpresaUnidade(config, unidadeEmpresa);

  const enderecoEmpresa = [
    empresa.logradouro &&
      `${empresa.logradouro}${empresa.numero ? `, ${empresa.numero}` : ''}`,
    empresa.complemento,
    empresa.bairro,
    empresa.cidade && `${empresa.cidade}${empresa.uf ? `/${empresa.uf}` : ''}`,
    empresa.cep && `CEP ${empresa.cep}`,
  ]
    .filter(Boolean)
    .join(' · ');

  const contatosEmpresa = [empresa.telefone, empresa.email, empresa.site]
    .filter(Boolean)
    .join(' · ');

  const competenciaLabel = formatCompetenciaExtenso(mes);

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

  const fgtsMes = Number((baseInssFinal * 0.08).toFixed(2));
  const baseIrrf = Math.max(0, Number((baseInssFinal - inssFinal).toFixed(2)));

  // -------------------------------------------------------------------------
  // 1. Cabeçalho Superior do Demonstrativo
  // -------------------------------------------------------------------------
  doc.setDrawColor(180, 180, 185);
  doc.setFillColor(244, 244, 245);
  doc.rect(margin, y, contentWidth, 14, 'FD');

  doc.setTextColor(17, 24, 39);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('DEMONSTRATIVO DE PAGAMENTO MENSAL', margin + 3, y + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(75, 85, 99);
  doc.text('Recibo de Pagamento de Salário · CLT', margin + 3, y + 10.8);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(17, 24, 39);
  doc.text(`Competência: ${competenciaLabel}`, pageWidth - margin - 3, y + 8.5, {
    align: 'right',
  });

  y += 17;

  // -------------------------------------------------------------------------
  // 2. Cabeçalho da Empresa (empresas_unidades)
  // -------------------------------------------------------------------------
  const razaoSocial = empresa.razaoSocial || config.razaoSocial;
  const nomeFantasia =
    empresa.nomeFantasia || config.nomeFantasia || 'Hellcife Tattoo Supply';
  const cnpjLinha = `CNPJ: ${empresa.cnpj || config.cnpj}${
    empresa.inscricaoEstadual ? `   |   IE: ${empresa.inscricaoEstadual}` : ''
  }   |   ${config.regimeTributario}`;

  const endLines: string[] = enderecoEmpresa
    ? doc.splitTextToSize(enderecoEmpresa, contentWidth - 6)
    : [];
  const contatoLines: string[] = contatosEmpresa
    ? doc.splitTextToSize(contatosEmpresa, contentWidth - 6)
    : [];

  const empBoxHeight =
    17 + endLines.length * 4 + contatoLines.length * 4 + 2;

  doc.setDrawColor(200, 200, 205);
  doc.setFillColor(255, 255, 255);
  doc.rect(margin, y, contentWidth, empBoxHeight, 'FD');

  let ey = y + 4.5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text(`EMPREGADOR · UNIDADE ${unidadeEmpresa.toUpperCase()}`, margin + 3, ey);

  ey += 4.5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(17, 24, 39);
  doc.text(razaoSocial, margin + 3, ey);

  ey += 4.2;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(55, 65, 81);
  doc.text(nomeFantasia, margin + 3, ey);

  ey += 4.2;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(55, 65, 81);
  doc.text(cnpjLinha, margin + 3, ey);

  if (endLines.length > 0) {
    ey += 4.2;
    doc.text(endLines, margin + 3, ey);
    ey += (endLines.length - 1) * 4;
  }

  if (contatoLines.length > 0) {
    ey += 4.2;
    doc.setTextColor(107, 114, 128);
    doc.text(contatoLines, margin + 3, ey);
  }

  y += empBoxHeight + 3;

  // -------------------------------------------------------------------------
  // 3. Dados Completos do Colaborador
  // -------------------------------------------------------------------------
  const colBoxHeight = 26;
  doc.setDrawColor(200, 200, 205);
  doc.setFillColor(250, 250, 251);
  doc.rect(margin, y, contentWidth, colBoxHeight, 'FD');

  let cy = y + 4.5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('DADOS DO COLABORADOR', margin + 3, cy);

  cy += 4.8;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(107, 114, 128);
  doc.text('Nome Completo', margin + 3, cy);
  doc.text('Função / Cargo', margin + 105, cy);

  cy += 3.8;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(17, 24, 39);
  doc.text(colaborador.nome, margin + 3, cy);
  doc.setFontSize(8.5);
  doc.text(colaborador.funcao || 'Não informada', margin + 105, cy);

  cy += 5.2;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(107, 114, 128);
  doc.text('CPF', margin + 3, cy);
  doc.text('Data de Admissão', margin + 52, cy);
  doc.text('Lotação / Unidade', margin + 105, cy);
  doc.text('Competência', margin + 148, cy);

  cy += 3.8;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(17, 24, 39);
  doc.text(colaborador.cpf || 'Não informado', margin + 3, cy);
  doc.text(formatDateBR(colaborador.dataAdmissao), margin + 52, cy);
  doc.text(colaborador.lotacao, margin + 105, cy);
  doc.text(mes.split('-').reverse().join('/'), margin + 148, cy);

  y += colBoxHeight + 4;

  // -------------------------------------------------------------------------
  // 4. Tabela Estruturada de Vencimentos e Descontos
  // -------------------------------------------------------------------------
  const colDescX = margin + 3;
  const colRefX = margin + 114;
  const colVencX = margin + 146;
  const colDescValX = pageWidth - margin - 3;

  // Cabeçalho da Tabela
  doc.setDrawColor(160, 160, 168);
  doc.setFillColor(238, 238, 240);
  doc.rect(margin, y, contentWidth, 7, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(17, 24, 39);
  doc.text('Descrição do Evento', colDescX, y + 4.7);
  doc.text('Ref.', colRefX, y + 4.7, { align: 'right' });
  doc.text('Vencimentos', colVencX, y + 4.7, { align: 'right' });
  doc.text('Descontos', colDescValX, y + 4.7, { align: 'right' });
  y += 7;

  interface LinhaTabela {
    descricao: string;
    ref: string;
    vencimento?: string;
    desconto?: string;
  }

  const linhas: LinhaTabela[] = [];

  if (holeriteConfigurado) {
    for (const item of recSelecionados) {
      linhas.push({
        descricao: item.descricao,
        ref: item.referencia || '-',
        vencimento: formatBRL(item.valor),
      });
    }
    for (const item of descSelecionados) {
      linhas.push({
        descricao: item.descricao,
        ref: item.referencia || '-',
        desconto: formatBRL(item.valor),
      });
    }
  } else {
    linhas.push({
      descricao: 'Salário Base',
      ref: '30d',
      vencimento: formatBRL(holerite.salarioBase),
    });

    if (holerite.valorExtra50 > 0) {
      linhas.push({
        descricao: 'Horas Extras +50%',
        ref: formatMinutesToHHMM(resumo.totalMinExtra50),
        vencimento: formatBRL(holerite.valorExtra50),
      });
    }
    if (holerite.valorExtra65 > 0) {
      linhas.push({
        descricao: 'Horas Extras +65%',
        ref: formatMinutesToHHMM(resumo.totalMinExtra65),
        vencimento: formatBRL(holerite.valorExtra65),
      });
    }
    if (holerite.valorExtra70 > 0) {
      linhas.push({
        descricao: 'Horas Extras +70%',
        ref: formatMinutesToHHMM(resumo.totalMinExtra70),
        vencimento: formatBRL(holerite.valorExtra70),
      });
    }
    if (holerite.valorExtra100 > 0) {
      linhas.push({
        descricao: 'Domingos / Feriados +100%',
        ref: formatMinutesToHHMM(resumo.totalMinExtra100),
        vencimento: formatBRL(holerite.valorExtra100),
      });
    }
    if (holerite.valorAdicionalNoturno > 0) {
      linhas.push({
        descricao: 'Adicional Noturno',
        ref: formatMinutesToHHMM(resumo.totalMinNoturnos),
        vencimento: formatBRL(holerite.valorAdicionalNoturno),
      });
    }

    linhas.push({
      descricao: 'DSR sobre Horas Extras',
      ref: `${resumo.domingosFeriadosMes}d`,
      vencimento: formatBRL(holerite.dsrSobreExtras),
    });

    linhas.push({
      descricao: 'Atrasos (>10 min/dia)',
      ref: formatMinutesToHHMM(resumo.totalMinAtraso),
      desconto: formatBRL(holerite.descontoAtrasos),
    });

    linhas.push({
      descricao: 'INSS 2026',
      ref: `${holerite.inssAliquotaEfetiva.toFixed(1).replace('.', ',')}%`,
      desconto: formatBRL(holerite.inssValor),
    });

    linhas.push({
      descricao:
        colaborador.vtDiario > 0
          ? 'Vale-Transporte (6%)'
          : 'Vale-Transporte (Não optante)',
      ref: colaborador.vtDiario > 0 ? '6%' : '0%',
      desconto: formatBRL(holerite.descontoVt6Pct),
    });
  }

  const rowH = 6.5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.2);

  for (const ln of linhas) {
    doc.setDrawColor(225, 225, 230);
    doc.line(margin, y + rowH, pageWidth - margin, y + rowH);
    doc.line(margin, y, margin, y + rowH);
    doc.line(pageWidth - margin, y, pageWidth - margin, y + rowH);

    doc.setTextColor(17, 24, 39);
    doc.text(ln.descricao, colDescX, y + 4.4);

    doc.setTextColor(82, 82, 91);
    doc.text(ln.ref, colRefX, y + 4.4, { align: 'right' });

    doc.setTextColor(17, 24, 39);
    doc.text(ln.vencimento || '-', colVencX, y + 4.4, { align: 'right' });
    doc.text(ln.desconto || '-', colDescValX, y + 4.4, { align: 'right' });

    y += rowH;
  }

  // Linha de Totais (Total Bruto e Total Descontos)
  doc.setDrawColor(160, 160, 168);
  doc.setFillColor(244, 244, 245);
  doc.rect(margin, y, contentWidth, 7.5, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(17, 24, 39);
  doc.text('TOTAIS (VENCIMENTOS / DESCONTOS)', colDescX, y + 5);
  doc.text(formatBRL(totalVencimentos), colVencX, y + 5, { align: 'right' });
  doc.text(formatBRL(totalDescontosFinal), colDescValX, y + 5, { align: 'right' });
  y += 7.5;

  // Linha Destaque Salário Líquido
  doc.setDrawColor(17, 24, 39);
  doc.setFillColor(249, 250, 251);
  doc.rect(margin, y, contentWidth, 9.5, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(17, 24, 39);
  doc.text('SALÁRIO LÍQUIDO A RECEBER', colDescX, y + 6.2);
  doc.setFontSize(10.5);
  doc.text(formatBRL(salarioLiquidoFinal), colDescValX, y + 6.2, { align: 'right' });
  y += 13;

  // -------------------------------------------------------------------------
  // 5. Resumo de Bases / Encargos e Benefícios Externos
  // -------------------------------------------------------------------------
  const baseBoxH = 26;
  doc.setDrawColor(200, 200, 205);
  doc.setFillColor(255, 255, 255);
  doc.rect(margin, y, contentWidth, baseBoxH, 'FD');

  let by = y + 4.5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('BASES DE CÁLCULO, ENCARGOS E BENEFÍCIOS EXTERNOS', margin + 3, by);

  by += 4.8;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(107, 114, 128);
  doc.text('Base Cálc. INSS', margin + 3, by);
  doc.text('Base Cálc. FGTS', margin + 48, by);
  doc.text('FGTS do Mês (8%)', margin + 93, by);
  doc.text('Base Cálc. IRRF', margin + 138, by);

  by += 3.8;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(17, 24, 39);
  doc.text(formatBRL(baseInssFinal), margin + 3, by);
  doc.text(formatBRL(baseInssFinal), margin + 48, by);
  doc.text(formatBRL(fgtsMes), margin + 93, by);
  doc.text(formatBRL(baseIrrf), margin + 138, by);

  by += 5.2;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(55, 65, 81);
  doc.text(
    `Benefícios Externos (${resumo.diasTrabalhados} dias trabalhados):`,
    margin + 3,
    by
  );

  by += 4.2;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.2);
  doc.setTextColor(17, 24, 39);
  doc.text(
    `Vale-Alimentação (${formatBRL(colaborador.vaDiario)}/dia): ${formatBRL(
      holerite.beneficioVaMes
    )}`,
    margin + 3,
    by
  );
  doc.text(
    `Vale-Transporte (${formatBRL(colaborador.vtDiario)}/dia): ${formatBRL(
      holerite.beneficioVtMes
    )}`,
    margin + 93,
    by
  );

  y += baseBoxH + 8;

  // -------------------------------------------------------------------------
  // 6. Rodapé: Data e Assinatura do Colaborador
  // -------------------------------------------------------------------------
  doc.setDrawColor(200, 200, 205);
  doc.line(margin, y, pageWidth - margin, y);
  y += 5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(75, 85, 99);
  doc.text(
    'Declaro ter recebido a importância líquida discriminada neste demonstrativo de pagamento.',
    margin,
    y
  );

  y += 14;
  doc.setDrawColor(75, 85, 99);
  doc.line(margin, y, margin + 55, y);
  doc.line(margin + 72, y, pageWidth - margin, y);

  y += 4;
  doc.setFontSize(8);
  doc.setTextColor(55, 65, 81);
  doc.text('Data: ____ / ____ / ________', margin, y);
  doc.text(`Assinatura: ${colaborador.nome}`, margin + 72, y);

  // -------------------------------------------------------------------------
  // Download direto via Blob (compatível com iframes, mobile e desktop)
  // -------------------------------------------------------------------------
  const nomeArquivo = `Holerite_${sanitizeFileSegment(
    colaborador.nome
  )}_${formatMesAnoArquivo(mes)}.pdf`;

  const blob = doc.output('blob');
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = nomeArquivo;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1500);

  return nomeArquivo;
}
