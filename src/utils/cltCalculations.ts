import {
  AjusteEscala,
  Atestado,
  Colaborador,
  ConfiguracaoEmpresa,
  DiaEspelho,
  FaixaINSSDetalhe,
  Feriado,
  HoleriteCalculado,
  JornadaTemplate,
  RegistroPonto,
  ResumoMensalColaborador,
  RetribuicaoEmpresa,
  TipoMarcacao,
  Unidade,
} from '../types/rh';

export function getTodayStr(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function getCurrentMonthStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function parseTimeToMinutes(hhmm: string): number {
  const parts = hhmm.split(':').map((n) => parseInt(n, 10));
  if (parts.length < 2 || isNaN(parts[0]) || isNaN(parts[1])) return 0;
  return parts[0] * 60 + parts[1];
}

export function formatMinutesToHHMM(totalMin: number): string {
  const sign = totalMin < 0 ? '-' : '';
  const abs = Math.round(Math.abs(totalMin));
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `${sign}${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function formatMinutesDecimal(totalMin: number): string {
  return (totalMin / 60).toFixed(2).replace('.', ',');
}

export function formatBRL(value: number): string {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatDateBR(yyyyMmDd: string): string {
  if (!yyyyMmDd) return '—';
  const [y, m, d] = yyyyMmDd.split('-');
  if (!y || !m || !d) return yyyyMmDd;
  return `${d}/${m}/${y}`;
}

const DIAS_SEMANA_CURTO = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

/**
 * Calcula quantos minutos de um intervalo [inicioMin, fimMin] caem na janela noturna (22:00 às 05:00).
 */
export function calcularMinutosNoturnos(inicioMin: number, fimMin: number): number {
  if (fimMin <= inicioMin) return 0;
  let noturno = 0;
  for (let m = inicioMin; m < fimMin; m++) {
    const mod = ((m % 1440) + 1440) % 1440;
    if (mod >= 22 * 60 || mod < 5 * 60) {
      noturno++;
    }
  }
  return noturno;
}

export function getUnidadeEfetivaColaborador(
  colab: Colaborador,
  pontosDia: RegistroPonto[],
  unidadeFallback: Unidade = 'Recife'
): Unidade {
  if (pontosDia.length > 0) return pontosDia[0].unidade;
  if (colab.lotacao === 'Recife' || colab.lotacao === 'Jaboatão') return colab.lotacao;
  return unidadeFallback;
}

export function isFeriadoParaUnidade(feriado: Feriado, unidade: Unidade): boolean {
  if (feriado.abrangencia === 'Nacional' || feriado.abrangencia === 'Estadual') return true;
  return feriado.abrangencia === unidade;
}

export function getDaysInMonth(mesYYYYMM: string): string[] {
  const [yStr, mStr] = mesYYYYMM.split('-');
  const y = parseInt(yStr, 10);
  const m = parseInt(mStr, 10);
  if (!y || !m) return [];
  const total = new Date(y, m, 0).getDate();
  const res: string[] = [];
  for (let d = 1; d <= total; d++) {
    res.push(`${yStr}-${mStr}-${String(d).padStart(2, '0')}`);
  }
  return res;
}

export function calcularDiaPonto(
  colab: Colaborador,
  dataStr: string,
  jornada: JornadaTemplate,
  pontosDia: RegistroPonto[],
  ajuste: AjusteEscala | undefined,
  feriados: Feriado[],
  atestadosAprovados: Atestado[],
  config: ConfiguracaoEmpresa,
  unidadeVisualizacao: Unidade,
  now: Date = new Date()
): DiaEspelho {
  const [y, m, d] = dataStr.split('-').map((n) => parseInt(n, 10));
  const dateObj = new Date(y, m - 1, d);
  const diaSemanaIdx = dateObj.getDay();
  const labelDia = `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')} · ${DIAS_SEMANA_CURTO[diaSemanaIdx]}`;
  const unidadeEfetiva = getUnidadeEfetivaColaborador(colab, pontosDia, unidadeVisualizacao);
  const regraUnidade = config.regrasUnidade[unidadeEfetiva];

  const marcacoes: Partial<Record<TipoMarcacao, RegistroPonto>> = {};
  for (const p of pontosDia) {
    marcacoes[p.tipo] = p;
  }

  const feriadoMatch = feriados.find(
    (f) => f.data === dataStr && isFeriadoParaUnidade(f, unidadeEfetiva)
  );
  const ehDomingo = diaSemanaIdx === 0;
  const ehFeriado = Boolean(feriadoMatch);

  // Regra 1: Dias anteriores à admissão não contabilizam faltas/atrasos
  if (colab.dataAdmissao && dataStr < colab.dataAdmissao) {
    return {
      data: dataStr,
      diaSemanaIdx,
      labelDia,
      unidadeEfetiva,
      ehDomingo,
      ehFeriado,
      nomeFeriado: feriadoMatch?.nome,
      ajusteAplicado: ajuste,
      status: 'anterior_admissao',
      marcacoes,
      minutosPrevistos: 0,
      minutosTrabalhados: 0,
      minutosNoturnosRelogio: 0,
      minutosNoturnosComputados: 0,
      minutosAtraso: 0,
      minutosExtra50: 0,
      minutosExtra65: 0,
      minutosExtra70: 0,
      minutosExtra100: 0,
      toleranciaAplicada: false,
    };
  }

  // Determinar carga horária prevista e horário fim do turno
  let minutosPrevistos = 0;
  let inicioPrevistoStr = jornada.segSexEntrada;
  let fimPrevistoStr = jornada.segSexSaida;

  if (ajuste?.tipo === 'folga') {
    minutosPrevistos = 0;
  } else if (ajuste?.tipo === 'horario_proprio') {
    minutosPrevistos = ajuste.cargaMinCustom ?? jornada.segSexCargaMin;
    inicioPrevistoStr = ajuste.entradaCustom || jornada.segSexEntrada;
    fimPrevistoStr = ajuste.saidaCustom || jornada.segSexSaida;
  } else if (ehDomingo || ehFeriado) {
    minutosPrevistos = 0;
  } else if (diaSemanaIdx === 6) {
    minutosPrevistos = jornada.sabadoAtivo ? jornada.sabadoCargaMin : 0;
    inicioPrevistoStr = jornada.sabadoEntrada;
    fimPrevistoStr = jornada.sabadoSaida;
  } else {
    minutosPrevistos = jornada.segSexCargaMin;
  }

  // Calcular minutos trabalhados a partir das marcações
  let minutosTrabalhados = 0;
  let minutosNoturnosRelogio = 0;

  const ent = marcacoes.entrada ? parseTimeToMinutes(marcacoes.entrada.hora) : null;
  const saiAlm = marcacoes.saida_almoco ? parseTimeToMinutes(marcacoes.saida_almoco.hora) : null;
  const retAlm = marcacoes.retorno_almoco ? parseTimeToMinutes(marcacoes.retorno_almoco.hora) : null;
  const sai = marcacoes.saida ? parseTimeToMinutes(marcacoes.saida.hora) : null;

  if (ent !== null && saiAlm !== null) {
    const fim1 = saiAlm < ent ? saiAlm + 1440 : saiAlm;
    minutosTrabalhados += Math.max(0, fim1 - ent);
    minutosNoturnosRelogio += calcularMinutosNoturnos(ent, fim1);
    if (retAlm !== null && sai !== null) {
      const ini2 = retAlm < fim1 ? retAlm + 1440 : retAlm;
      const fim2 = sai < ini2 ? sai + 1440 : sai;
      minutosTrabalhados += Math.max(0, fim2 - ini2);
      minutosNoturnosRelogio += calcularMinutosNoturnos(ini2, fim2);
    }
  } else if (ent !== null && sai !== null) {
    const fim = sai < ent ? sai + 1440 : sai;
    const bruto = Math.max(0, fim - ent);
    // Se trabalhou direto sem bater almoço em dia com intervalo > 0 e jornada > 6h
    const descontoIntervalo = bruto > 360 && minutosPrevistos > 360 ? jornada.intervaloMin : 0;
    minutosTrabalhados += Math.max(0, bruto - descontoIntervalo);
    minutosNoturnosRelogio += calcularMinutosNoturnos(ent, fim);
  }

  // Hora noturna reduzida (52m30s -> fator 60 / 52.5 = 8/7)
  const minutosNoturnosComputados = regraUnidade.horaNoturnaReduzida
    ? Math.round((minutosNoturnosRelogio * 60) / 52.5)
    : minutosNoturnosRelogio;

  const extraReducaoNoturna = Math.max(0, minutosNoturnosComputados - minutosNoturnosRelogio);
  const minutosComputadosTotais = minutosTrabalhados + extraReducaoNoturna;

  const todayStr = getTodayStr();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const fimTurnoMin = parseTimeToMinutes(fimPrevistoStr);
  const turnoEncerrado =
    dataStr < todayStr || (dataStr === todayStr && (sai !== null || nowMinutes >= fimTurnoMin));

  // Atestado médico aprovado para a data
  const atestadoDia = atestadosAprovados.find(
    (a) => a.status === 'Aprovado' && dataStr >= a.dataInicio && dataStr <= a.dataFim
  );

  let minutosAtraso = 0;
  let minutosExtra50 = 0;
  let minutosExtra65 = 0;
  let minutosExtra70 = 0;
  let minutosExtra100 = 0;
  let toleranciaAplicada = false;

  if (minutosPrevistos === 0) {
    // Folga, Domingo ou Feriado
    if (minutosComputadosTotais > 10) {
      if (ehDomingo || ehFeriado) {
        minutosExtra100 = minutosComputadosTotais;
      } else {
        // Dia de folga trabalhado sem ser domingo/feriado
        if (unidadeEfetiva === 'Jaboatão') {
          minutosExtra65 = Math.min(120, minutosComputadosTotais);
          minutosExtra70 = Math.max(0, minutosComputadosTotais - 120);
        } else {
          minutosExtra50 = minutosComputadosTotais;
        }
      }
    } else if (minutosComputadosTotais > 0) {
      toleranciaAplicada = true;
    }
  } else {
    // Dia útil com jornada prevista
    const diff = minutosComputadosTotais - minutosPrevistos;

    // Verificar tolerância individual (5 min por marcação) e diária (10 min CLT Art. 58 §1º)
    if (pontosDia.length > 0 && Math.abs(diff) <= 10) {
      // Verifica se entrada/saída individuais também estão dentro da tolerância ou soma <= 10
      const desvioEnt = ent !== null ? Math.abs(ent - parseTimeToMinutes(inicioPrevistoStr)) : 0;
      const desvioSai = sai !== null ? Math.abs(sai - fimTurnoMin) : 0;
      if (desvioEnt <= 10 && desvioSai <= 10) {
        toleranciaAplicada = diff !== 0;
      } else if (Math.abs(diff) <= 10) {
        toleranciaAplicada = true;
      }
    } else if (diff > 10) {
      // Horas extras válidas
      if (unidadeEfetiva === 'Jaboatão') {
        minutosExtra65 = Math.min(120, diff);
        minutosExtra70 = Math.max(0, diff - 120);
      } else {
        minutosExtra50 = diff;
      }
    } else if (diff < -10) {
      // Contabilizar atraso apenas após o fim do turno do dia!
      if (turnoEncerrado) {
        const atrasoBruto = Math.abs(diff);
        if (atestadoDia) {
          if (atestadoDia.tipo === 'Atestado Médico') {
            minutosAtraso = 0;
          } else {
            const abonado = atestadoDia.minutosAbonados ?? atrasoBruto;
            minutosAtraso = Math.max(0, atrasoBruto - abonado);
          }
        } else {
          minutosAtraso = atrasoBruto;
        }
      }
    }
  }

  let status: DiaEspelho['status'] = 'regular';
  if (atestadoDia && minutosAtraso === 0 && minutosPrevistos > 0 && minutosTrabalhados < minutosPrevistos) {
    status = 'abonado';
  } else if (minutosPrevistos === 0 && minutosComputadosTotais <= 10) {
    status = ehFeriado ? 'feriado' : 'folga';
  } else if (!turnoEncerrado && dataStr >= todayStr && minutosAtraso === 0 && minutosExtra50 + minutosExtra65 + minutosExtra70 + minutosExtra100 === 0) {
    status = dataStr > todayStr ? 'folga' : 'em_andamento';
    if (dataStr === todayStr) status = 'em_andamento';
  } else if (minutosExtra50 + minutosExtra65 + minutosExtra70 + minutosExtra100 > 0) {
    status = 'hora_extra';
  } else if (minutosAtraso > 0) {
    status = pontosDia.length === 0 ? 'falta' : 'atraso';
  }

  return {
    data: dataStr,
    diaSemanaIdx,
    labelDia,
    unidadeEfetiva,
    ehDomingo,
    ehFeriado,
    nomeFeriado: feriadoMatch?.nome,
    ajusteAplicado: ajuste,
    status,
    marcacoes,
    minutosPrevistos,
    minutosTrabalhados,
    minutosNoturnosRelogio,
    minutosNoturnosComputados,
    minutosAtraso,
    minutosExtra50,
    minutosExtra65,
    minutosExtra70,
    minutosExtra100,
    toleranciaAplicada,
  };
}

export function calcularEspelhoMensal(
  colab: Colaborador,
  mesYYYYMM: string,
  jornada: JornadaTemplate,
  pontos: RegistroPonto[],
  ajustes: AjusteEscala[],
  feriados: Feriado[],
  atestados: Atestado[],
  config: ConfiguracaoEmpresa,
  unidadeVisualizacao: Unidade
): ResumoMensalColaborador {
  const diasStr = getDaysInMonth(mesYYYYMM);
  const pontosColab = pontos.filter((p) => p.colaboradorId === colab.id);
  const ajustesColab = ajustes.filter((a) => a.colaboradorId === colab.id);
  const atestadosColab = atestados.filter(
    (a) => a.colaboradorId === colab.id && a.status === 'Aprovado'
  );

  const dias: DiaEspelho[] = diasStr.map((dataStr) => {
    const pDia = pontosColab.filter((p) => p.data === dataStr);
    const ajDia = ajustesColab.find((a) => a.data === dataStr);
    return calcularDiaPonto(
      colab,
      dataStr,
      jornada,
      pDia,
      ajDia,
      feriados,
      atestadosColab,
      config,
      unidadeVisualizacao
    );
  });

  let diasTrabalhados = 0;
  let diasUteisMes = 0;
  let domingosFeriadosMes = 0;
  let totalMinTrabalhados = 0;
  let totalMinPrevistos = 0;
  let totalMinAtraso = 0;
  let totalMinExtra50 = 0;
  let totalMinExtra65 = 0;
  let totalMinExtra70 = 0;
  let totalMinExtra100 = 0;
  let totalMinNoturnos = 0;

  for (const d of dias) {
    if (d.status !== 'anterior_admissao') {
      if (d.ehDomingo || d.ehFeriado) {
        domingosFeriadosMes++;
      } else if (d.minutosPrevistos > 0) {
        diasUteisMes++;
      }
    }
    if (d.minutosTrabalhados > 0) {
      diasTrabalhados++;
    }
    totalMinTrabalhados += d.minutosTrabalhados;
    totalMinPrevistos += d.minutosPrevistos;
    totalMinAtraso += d.minutosAtraso;
    totalMinExtra50 += d.minutosExtra50;
    totalMinExtra65 += d.minutosExtra65;
    totalMinExtra70 += d.minutosExtra70;
    totalMinExtra100 += d.minutosExtra100;
    totalMinNoturnos += d.minutosNoturnosComputados;
  }

  return {
    mes: mesYYYYMM,
    dias,
    diasTrabalhados,
    diasUteisMes: Math.max(1, diasUteisMes),
    domingosFeriadosMes,
    totalMinTrabalhados,
    totalMinPrevistos,
    totalMinAtraso,
    totalMinExtra50,
    totalMinExtra65,
    totalMinExtra70,
    totalMinExtra100,
    totalMinExtrasGeral: totalMinExtra50 + totalMinExtra65 + totalMinExtra70 + totalMinExtra100,
    totalMinNoturnos,
  };
}

/**
 * Tabela Progressiva INSS 2026 (base salário mínimo R$ 1.621,00).
 */
export function calcularINSS2026(baseCalculo: number): {
  valor: number;
  aliquotaEfetiva: number;
  faixas: FaixaINSSDetalhe[];
} {
  if (baseCalculo <= 0) {
    return { valor: 0, aliquotaEfetiva: 0, faixas: [] };
  }

  const brackets = [
    { label: 'Até R$ 1.621,00', min: 0, max: 1621.0, rate: 0.075 },
    { label: 'R$ 1.621,01 a R$ 2.902,84', min: 1621.0, max: 2902.84, rate: 0.09 },
    { label: 'R$ 2.902,85 a R$ 4.354,27', min: 2902.84, max: 4354.27, rate: 0.12 },
    { label: 'R$ 4.354,28 a R$ 8.475,55', min: 4354.27, max: 8475.55, rate: 0.14 },
  ];

  const teto = 8475.55;
  const baseLimitada = Math.min(baseCalculo, teto);
  let total = 0;
  const faixas: FaixaINSSDetalhe[] = [];

  for (const b of brackets) {
    if (baseLimitada > b.min) {
      const parcela = Math.min(baseLimitada, b.max) - b.min;
      const contrib = parcela * b.rate;
      total += contrib;
      faixas.push({
        faixa: b.label,
        aliquota: `${(b.rate * 100).toFixed(1).replace('.', ',')}%`,
        baseNaFaixa: Number(parcela.toFixed(2)),
        contribuicao: Number(contrib.toFixed(2)),
      });
    }
  }

  const valor = Number(total.toFixed(2));
  const aliquotaEfetiva = Number(((valor / baseCalculo) * 100).toFixed(2));
  return { valor, aliquotaEfetiva, faixas };
}

export function calcularHoleriteMensal(
  colab: Colaborador,
  resumo: ResumoMensalColaborador,
  jornada: JornadaTemplate,
  config: ConfiguracaoEmpresa
): HoleriteCalculado {
  const divisorHoras = Math.round((jornada.horasSemanais / 6) * 30) || 220;
  const valorHoraNormal = colab.salarioBase / divisorHoras;

  const valorExtra50 = Number(((resumo.totalMinExtra50 / 60) * valorHoraNormal * 1.5).toFixed(2));
  const valorExtra65 = Number(((resumo.totalMinExtra65 / 60) * valorHoraNormal * 1.65).toFixed(2));
  const valorExtra70 = Number(((resumo.totalMinExtra70 / 60) * valorHoraNormal * 1.7).toFixed(2));
  const valorExtra100 = Number(((resumo.totalMinExtra100 / 60) * valorHoraNormal * 2.0).toFixed(2));

  const unidadeBase: Unidade = colab.lotacao === 'Jaboatão' ? 'Jaboatão' : 'Recife';
  const pctNoturno = config.regrasUnidade[unidadeBase].adicionalNoturnoPct / 100;
  const valorAdicionalNoturno = Number(
    ((resumo.totalMinNoturnos / 60) * valorHoraNormal * pctNoturno).toFixed(2)
  );

  const totalHorasExtras = Number(
    (valorExtra50 + valorExtra65 + valorExtra70 + valorExtra100).toFixed(2)
  );

  const dsrSobreExtras =
    totalHorasExtras + valorAdicionalNoturno > 0 && resumo.diasUteisMes > 0
      ? Number(
          (
            ((totalHorasExtras + valorAdicionalNoturno) / resumo.diasUteisMes) *
            resumo.domingosFeriadosMes
          ).toFixed(2)
        )
      : 0;

  const totalProventos = Number(
    (colab.salarioBase + totalHorasExtras + valorAdicionalNoturno + dsrSobreExtras).toFixed(2)
  );

  const descontoAtrasos = Number(((resumo.totalMinAtraso / 60) * valorHoraNormal).toFixed(2));
  const baseInss = Math.max(0, Number((totalProventos - descontoAtrasos).toFixed(2)));
  const inss = calcularINSS2026(baseInss);

  const beneficioVaMes = Number((resumo.diasTrabalhados * colab.vaDiario).toFixed(2));
  const beneficioVtMes = Number((resumo.diasTrabalhados * colab.vtDiario).toFixed(2));

  // Lei 7.418/85: Desconto VT até 6% do salário base, limitado ao valor concedido
  const vt6PctTeorico = Number((colab.salarioBase * 0.06).toFixed(2));
  const descontoVt6Pct = Math.min(vt6PctTeorico, beneficioVtMes);

  const totalDescontos = Number((descontoAtrasos + inss.valor + descontoVt6Pct).toFixed(2));
  const salarioLiquido = Math.max(0, Number((totalProventos - totalDescontos).toFixed(2)));

  return {
    mes: resumo.mes,
    colaborador: colab,
    resumo,
    valorHoraNormal,
    salarioBase: colab.salarioBase,
    valorExtra50,
    valorExtra65,
    valorExtra70,
    valorExtra100,
    valorAdicionalNoturno,
    totalHorasExtras,
    dsrSobreExtras,
    totalProventos,
    descontoAtrasos,
    baseInss,
    inssValor: inss.valor,
    inssAliquotaEfetiva: inss.aliquotaEfetiva,
    inssFaixas: inss.faixas,
    vtConcedidoMes: beneficioVtMes,
    descontoVt6Pct,
    totalDescontos,
    salarioLiquido,
    beneficioVaMes,
    beneficioVtMes,
  };
}

export function calcularRetribuicaoSimplesNacional(
  colab: Colaborador,
  holerite: HoleriteCalculado
): RetribuicaoEmpresa {
  const remuneracaoBruta = holerite.baseInss; // proventos líquidos de atrasos
  const inssPatronal = 0; // Simples Nacional isento de 20% patronal
  const fgts8Pct = Number((remuneracaoBruta * 0.08).toFixed(2));
  const provisaoFerias1_12 = Number((remuneracaoBruta / 12).toFixed(2));
  const provisaoTercoFerias = Number((provisaoFerias1_12 / 3).toFixed(2));
  const provisaoDecimoTerceiro1_12 = Number((remuneracaoBruta / 12).toFixed(2));
  const fgtsSobreProvisoes = Number(
    ((provisaoFerias1_12 + provisaoTercoFerias + provisaoDecimoTerceiro1_12) * 0.08).toFixed(2)
  );
  const beneficiosExternos = Number(
    (holerite.beneficioVaMes + Math.max(0, holerite.beneficioVtMes - holerite.descontoVt6Pct)).toFixed(2)
  );

  const custoTotalEmpresa = Number(
    (
      remuneracaoBruta +
      fgts8Pct +
      provisaoFerias1_12 +
      provisaoTercoFerias +
      provisaoDecimoTerceiro1_12 +
      fgtsSobreProvisoes +
      beneficiosExternos
    ).toFixed(2)
  );

  return {
    colaborador: colab,
    remuneracaoBruta,
    inssPatronal,
    fgts8Pct,
    provisaoFerias1_12,
    provisaoTercoFerias,
    provisaoDecimoTerceiro1_12,
    fgtsSobreProvisoes,
    beneficiosExternos,
    custoTotalEmpresa,
  };
}
