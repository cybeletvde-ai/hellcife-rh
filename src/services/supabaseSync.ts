import {
  AjusteEscala,
  Atestado,
  AvisoEmpresa,
  Colaborador,
  ConfiguracaoEmpresa,
  DadosEmpresaUnidade,
  FechamentoMensal,
  Feriado,
  GradeSemanal,
  HoleriteConfigurado,
  JornadaTemplate,
  LocalizacaoUnidade,
  Lotacao,
  RegistroPonto,
  RubricaHoleriteItem,
  StatusAtestado,
  Unidade,
  cloneGradeSemanal,
} from '../types/rh';
import { DEFAULT_CONFIG, DEFAULT_FERIADOS, DEFAULT_JORNADAS } from './storage';
import { supabase } from './supabaseClient';

export interface CloudSnapshot {
  colaboradores: Colaborador[];
  pontos: RegistroPonto[];
  atestados: Atestado[];
  ajustes: AjusteEscala[];
  fechamentos: FechamentoMensal[];
  feriados: Feriado[];
  jornadas: JornadaTemplate[];
  avisos: AvisoEmpresa[];
  holeritesConfigurados: HoleriteConfigurado[];
  config: ConfiguracaoEmpresa;
}

export interface CloudFetchResult {
  snapshot: CloudSnapshot;
  errorMessage: string | null;
}

function formatSupabaseError(
  err: { message?: string; details?: string | null; hint?: string | null; code?: string } | null | undefined,
  contexto: string
): string {
  if (!err) return `${contexto}: Erro desconhecido no Supabase.`;
  const partes = [err.message || 'Erro de comunicação com o Supabase'];
  if (err.code) partes.push(`Código: ${err.code}`);
  if (err.details) partes.push(err.details);
  if (err.hint) partes.push(err.hint);
  return `${contexto} — ${partes.join(' | ')}`;
}

function throwIfError(
  err: { message?: string; details?: string | null; hint?: string | null; code?: string } | null | undefined,
  contexto: string
): void {
  if (err) {
    throw new Error(formatSupabaseError(err, contexto));
  }
}

// ============================================================================
// Mappers (SQL snake_case <-> App camelCase)
// ============================================================================

function normLotacao(v: string): Lotacao {
  if (v === 'Jaboatão') return 'Jaboatão';
  if (v === 'Recife') return 'Recife';
  return 'Ambas';
}

function normUnidade(v: string): Unidade {
  return v === 'Jaboatão' ? 'Jaboatão' : 'Recife';
}

function parseGradeSemanal(raw: unknown): GradeSemanal | undefined {
  if (!raw) return undefined;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw) as Partial<GradeSemanal>;
      return cloneGradeSemanal(parsed);
    } catch {
      return undefined;
    }
  }
  if (typeof raw === 'object') {
    return cloneGradeSemanal(raw as Partial<GradeSemanal>);
  }
  return undefined;
}

function rowToColaborador(r: Record<string, any>): Colaborador {
  return {
    id: String(r.id),
    nome: String(r.nome || ''),
    cpf: String(r.cpf || ''),
    email: String(r.email || '').toLowerCase(),
    senha: String(r.senha || ''),
    telefone: r.telefone ? String(r.telefone) : '',
    endereco: r.endereco ? String(r.endereco) : '',
    funcao: String(r.funcao || ''),
    lotacao: normLotacao(String(r.lotacao || 'Recife')),
    dataAdmissao: String(r.data_admissao || ''),
    salarioBase: Number(r.salario_base ?? 1621),
    vaDiario: Number(r.va_diario ?? 0),
    vtDiario: Number(r.vt_diario ?? 0),
    jornadaId: String(r.jornada_id || 'jornada-44h'),
    gradeSemanal: parseGradeSemanal(r.grade_semanal),
    ativo: Boolean(r.ativo ?? true),
    criadoEm: String(r.criado_em || new Date().toISOString()),
  };
}

function colaboradorToRow(c: Colaborador) {
  return {
    id: c.id,
    nome: c.nome,
    cpf: c.cpf,
    email: c.email.trim().toLowerCase(),
    senha: c.senha,
    telefone: c.telefone || '',
    endereco: c.endereco || '',
    funcao: c.funcao,
    lotacao: c.lotacao,
    data_admissao: c.dataAdmissao,
    salario_base: c.salarioBase,
    va_diario: c.vaDiario,
    vt_diario: c.vtDiario,
    jornada_id: c.jornadaId,
    grade_semanal: c.gradeSemanal ?? null,
    ativo: c.ativo,
    criado_em: c.criadoEm,
  };
}

function rowToPonto(r: Record<string, any>): RegistroPonto {
  return {
    id: String(r.id),
    nsr: Number(r.nsr || 0),
    colaboradorId: String(r.colaborador_id),
    unidade: normUnidade(String(r.unidade)),
    data: String(r.data),
    hora: String(r.hora),
    timestamp: String(r.timestamp),
    criadoEmServidor: r.criado_em_servidor ? String(r.criado_em_servidor) : undefined,
    tipo: r.tipo,
    latitude: r.latitude !== null && r.latitude !== undefined ? Number(r.latitude) : null,
    longitude: r.longitude !== null && r.longitude !== undefined ? Number(r.longitude) : null,
    distanciaMetros:
      r.distancia_metros !== null && r.distancia_metros !== undefined
        ? Number(r.distancia_metros)
        : null,
    localizacaoVerificada: Boolean(r.localizacao_verificada),
    selfieDataUrl: r.selfie_data_url ? String(r.selfie_data_url) : undefined,
    registradoPor: r.registrado_por ? String(r.registrado_por) : undefined,
    justificativaDeslocamento: r.justificativa_deslocamento
      ? String(r.justificativa_deslocamento)
      : undefined,
    origemRegistro:
      r.origem_registro === 'manual_gestor' ? 'manual_gestor' : 'colaborador_gps',
    hashComprovante: String(r.hash_comprovante || ''),
  };
}

function pontoToRow(p: RegistroPonto) {
  return {
    id: p.id,
    nsr: p.nsr,
    colaborador_id: p.colaboradorId,
    unidade: p.unidade,
    data: p.data,
    hora: p.hora,
    timestamp: p.timestamp,
    tipo: p.tipo,
    latitude: p.latitude,
    longitude: p.longitude,
    distancia_metros: p.distanciaMetros,
    localizacao_verificada: p.localizacaoVerificada,
    selfie_data_url: p.selfieDataUrl ?? null,
    registrado_por: p.registradoPor ?? null,
    justificativa_deslocamento: p.justificativaDeslocamento ?? null,
    origem_registro: p.origemRegistro ?? (p.registradoPor ? 'manual_gestor' : 'colaborador_gps'),
    hash_comprovante: p.hashComprovante,
  };
}

function rowToAtestado(r: Record<string, any>): Atestado {
  return {
    id: String(r.id),
    colaboradorId: String(r.colaborador_id),
    tipo: r.tipo,
    dataInicio: String(r.data_inicio),
    dataFim: String(r.data_fim),
    minutosAbonados:
      r.minutos_abonados !== null && r.minutos_abonados !== undefined
        ? Number(r.minutos_abonados)
        : undefined,
    motivo: String(r.motivo || ''),
    anexoNome: r.anexo_nome ?? undefined,
    anexoDataUrl: r.anexo_data_url ?? undefined,
    status: r.status as StatusAtestado,
    observacaoRh: r.observacao_rh ?? undefined,
    criadoEm: String(r.criado_em || new Date().toISOString()),
  };
}

function atestadoToRow(a: Atestado) {
  return {
    id: a.id,
    colaborador_id: a.colaboradorId,
    tipo: a.tipo,
    data_inicio: a.dataInicio,
    data_fim: a.dataFim,
    minutos_abonados: a.minutosAbonados ?? null,
    motivo: a.motivo,
    anexo_nome: a.anexoNome ?? null,
    anexo_data_url: a.anexoDataUrl ?? null,
    status: a.status,
    observacao_rh: a.observacaoRh ?? null,
    criado_em: a.criadoEm,
  };
}

function rowToAjuste(r: Record<string, any>): AjusteEscala {
  return {
    id: String(r.id),
    colaboradorId: String(r.colaborador_id),
    data: String(r.data),
    tipo: r.tipo,
    entradaCustom: r.entrada_custom ?? undefined,
    saidaCustom: r.saida_custom ?? undefined,
    cargaMinCustom:
      r.carga_min_custom !== null && r.carga_min_custom !== undefined
        ? Number(r.carga_min_custom)
        : undefined,
    motivo: String(r.motivo || ''),
  };
}

function ajusteToRow(a: AjusteEscala) {
  return {
    id: a.id,
    colaborador_id: a.colaboradorId,
    data: a.data,
    tipo: a.tipo,
    entrada_custom: a.entradaCustom ?? null,
    saida_custom: a.saidaCustom ?? null,
    carga_min_custom: a.cargaMinCustom ?? null,
    motivo: a.motivo,
  };
}

function rowToFeriado(r: Record<string, any>): Feriado {
  return {
    id: String(r.id),
    data: String(r.data),
    nome: String(r.nome),
    abrangencia: r.abrangencia,
  };
}

function feriadoToRow(f: Feriado) {
  return {
    id: f.id,
    data: f.data,
    nome: f.nome,
    abrangencia: f.abrangencia,
  };
}

function rowToJornada(r: Record<string, any>): JornadaTemplate {
  return {
    id: String(r.id),
    nome: String(r.nome),
    horasSemanais: Number(r.horas_semanais),
    segSexEntrada: String(r.seg_sex_entrada),
    segSexSaida: String(r.seg_sex_saida),
    segSexCargaMin: Number(r.seg_sex_carga_min),
    intervaloMin: Number(r.intervalo_min),
    sabadoAtivo: Boolean(r.sabado_ativo),
    sabadoEntrada: String(r.sabado_entrada),
    sabadoSaida: String(r.sabado_saida),
    sabadoCargaMin: Number(r.sabado_carga_min),
  };
}

function jornadaToRow(j: JornadaTemplate) {
  return {
    id: j.id,
    nome: j.nome,
    horas_semanais: j.horasSemanais,
    seg_sex_entrada: j.segSexEntrada,
    seg_sex_saida: j.segSexSaida,
    seg_sex_carga_min: j.segSexCargaMin,
    intervalo_min: j.intervaloMin,
    sabado_ativo: j.sabadoAtivo,
    sabado_entrada: j.sabadoEntrada,
    sabado_saida: j.sabadoSaida,
    sabado_carga_min: j.sabadoCargaMin,
  };
}

function rowToEmpresaUnidade(r: Record<string, any>): DadosEmpresaUnidade {
  return {
    unidade: normUnidade(String(r.unidade)),
    razaoSocial: String(r.razao_social || ''),
    nomeFantasia: String(r.nome_fantasia || ''),
    cnpj: String(r.cnpj || ''),
    inscricaoEstadual: String(r.inscricao_estadual || ''),
    cep: String(r.cep || ''),
    logradouro: String(r.logradouro || ''),
    numero: String(r.numero || ''),
    complemento: String(r.complemento || ''),
    bairro: String(r.bairro || ''),
    cidade: String(r.cidade || ''),
    uf: String(r.uf || 'PE'),
    telefone: String(r.telefone || ''),
    email: String(r.email || ''),
    site: String(r.site || ''),
  };
}

function empresaUnidadeToRow(e: DadosEmpresaUnidade) {
  return {
    unidade: e.unidade,
    razao_social: e.razaoSocial,
    nome_fantasia: e.nomeFantasia,
    cnpj: e.cnpj,
    inscricao_estadual: e.inscricaoEstadual,
    cep: e.cep,
    logradouro: e.logradouro,
    numero: e.numero,
    complemento: e.complemento,
    bairro: e.bairro,
    cidade: e.cidade,
    uf: e.uf,
    telefone: e.telefone,
    email: e.email,
    site: e.site,
    atualizado_em: new Date().toISOString(),
  };
}

function rowToLocalizacao(r: Record<string, any>): LocalizacaoUnidade {
  return {
    unidade: normUnidade(String(r.unidade)),
    nomeLoja: String(r.nome_loja || ''),
    endereco: String(r.endereco || ''),
    latitude: Number(r.latitude),
    longitude: Number(r.longitude),
    raioMetros: Number(r.raio_metros ?? 250),
  };
}

function localizacaoToRow(l: LocalizacaoUnidade) {
  return {
    unidade: l.unidade,
    nome_loja: l.nomeLoja,
    endereco: l.endereco,
    latitude: l.latitude,
    longitude: l.longitude,
    raio_metros: l.raioMetros,
    atualizado_em: new Date().toISOString(),
  };
}

function rowToFechamento(r: Record<string, any>): FechamentoMensal {
  return {
    mes: String(r.mes),
    unidade: r.unidade === 'Todas' ? 'Todas' : normUnidade(String(r.unidade)),
    fechadoEm: String(r.fechado_em),
    fechadoPor: String(r.fechado_por || 'RH'),
  };
}

function fechamentoId(mes: string, unidade: 'Todas' | Unidade): string {
  return `${mes}__${unidade}`;
}

function rowToAviso(r: Record<string, any>): AvisoEmpresa {
  return {
    id: String(r.id),
    titulo: String(r.titulo),
    mensagem: String(r.mensagem),
    unidadeAlvo: r.unidade_alvo === 'Todas' ? 'Todas' : normUnidade(String(r.unidade_alvo)),
    criadoEm: String(r.criado_em),
    autorNome: String(r.autor_nome),
  };
}

function avisoToRow(a: AvisoEmpresa) {
  return {
    id: a.id,
    titulo: a.titulo,
    mensagem: a.mensagem,
    unidade_alvo: a.unidadeAlvo,
    criado_em: a.criadoEm,
    autor_nome: a.autorNome,
  };
}

function parseRubricas(raw: unknown): RubricaHoleriteItem[] {
  let arr: unknown[] = [];
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) arr = parsed;
    } catch {
      arr = [];
    }
  } else if (Array.isArray(raw)) {
    arr = raw;
  }
  return arr
    .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
    .map((item, idx) => ({
      id: String(item.id || `rubrica-${idx}`),
      descricao: String(item.descricao || ''),
      referencia: item.referencia ? String(item.referencia) : undefined,
      valor: Number(item.valor ?? 0),
      selecionado: Boolean(item.selecionado ?? true),
      custom: Boolean(item.custom ?? false),
    }));
}

function rowToHoleriteConfigurado(r: Record<string, any>): HoleriteConfigurado {
  return {
    id: String(r.id),
    colaboradorId: String(r.colaborador_id),
    mes: String(r.mes),
    recebiveis: parseRubricas(r.recebiveis),
    descontaveis: parseRubricas(r.descontaveis),
    totalRecebiveis: Number(r.total_recebiveis ?? 0),
    totalDescontaveis: Number(r.total_descontaveis ?? 0),
    salarioLiquido: Number(r.salario_liquido ?? 0),
    liberado: r.liberado === true || r.liberado === 'true',
    configuradoPor: r.configurado_por ? String(r.configurado_por) : undefined,
    atualizadoEm: String(r.atualizado_em || new Date().toISOString()),
  };
}

function holeriteConfiguradoToRow(h: HoleriteConfigurado) {
  return {
    id: h.id,
    colaborador_id: h.colaboradorId,
    mes: h.mes,
    recebiveis: h.recebiveis,
    descontaveis: h.descontaveis,
    total_recebiveis: h.totalRecebiveis,
    total_descontaveis: h.totalDescontaveis,
    salario_liquido: h.salarioLiquido,
    liberado: Boolean(h.liberado),
    configurado_por: h.configuradoPor ?? null,
    atualizado_em: h.atualizadoEm || new Date().toISOString(),
  };
}

// ============================================================================
// Leitura Inicial Direta do Supabase (select('*'))
// ============================================================================

export async function fetchAllCloudData(): Promise<CloudFetchResult> {
  const snapshot: CloudSnapshot = {
    colaboradores: [],
    pontos: [],
    atestados: [],
    ajustes: [],
    fechamentos: [],
    feriados: [],
    jornadas: DEFAULT_JORNADAS,
    avisos: [],
    holeritesConfigurados: [],
    config: DEFAULT_CONFIG,
  };

  try {
    const [
      colabsRes,
      pontosRes,
      atestadosRes,
      ajustesRes,
      feriadosRes,
      fechamentosRes,
      avisosRes,
      jornadasRes,
      configRes,
      empresasRes,
      locRes,
      holeritesRes,
    ] = await Promise.all([
      supabase.from('colaboradores').select('*').order('criado_em', { ascending: true }),
      supabase.from('registros_ponto').select('*').order('timestamp', { ascending: true }),
      supabase.from('atestados').select('*').order('criado_em', { ascending: false }),
      supabase.from('ajustes_escala').select('*'),
      supabase.from('feriados').select('*').order('data', { ascending: true }),
      supabase.from('fechamentos_mensais').select('*'),
      supabase.from('avisos_empresa').select('*').order('criado_em', { ascending: false }),
      supabase.from('jornadas_template').select('*'),
      supabase.from('configuracoes_sistema').select('*'),
      supabase.from('empresas_unidades').select('*'),
      supabase.from('localizacoes_gps').select('*'),
      supabase.from('holerites_configurados').select('*').order('atualizado_em', { ascending: false }),
    ]);

    const erros: string[] = [];

    if (colabsRes.error) {
      erros.push(formatSupabaseError(colabsRes.error, 'Leitura de colaboradores'));
    } else if (Array.isArray(colabsRes.data)) {
      snapshot.colaboradores = colabsRes.data.map(rowToColaborador);
    }

    if (pontosRes.error) {
      erros.push(formatSupabaseError(pontosRes.error, 'Leitura de registros de ponto'));
    } else if (Array.isArray(pontosRes.data)) {
      snapshot.pontos = pontosRes.data.map(rowToPonto);
    }

    if (atestadosRes.error) {
      erros.push(formatSupabaseError(atestadosRes.error, 'Leitura de atestados'));
    } else if (Array.isArray(atestadosRes.data)) {
      snapshot.atestados = atestadosRes.data.map(rowToAtestado);
    }

    if (ajustesRes.error) {
      erros.push(formatSupabaseError(ajustesRes.error, 'Leitura de ajustes de escala'));
    } else if (Array.isArray(ajustesRes.data)) {
      snapshot.ajustes = ajustesRes.data.map(rowToAjuste);
    }

    if (fechamentosRes.error) {
      erros.push(formatSupabaseError(fechamentosRes.error, 'Leitura de fechamentos'));
    } else if (Array.isArray(fechamentosRes.data)) {
      snapshot.fechamentos = fechamentosRes.data.map(rowToFechamento);
    }

    if (avisosRes.error) {
      erros.push(formatSupabaseError(avisosRes.error, 'Leitura de avisos'));
    } else if (Array.isArray(avisosRes.data)) {
      snapshot.avisos = avisosRes.data.map(rowToAviso);
    }

    if (holeritesRes.error) {
      erros.push(formatSupabaseError(holeritesRes.error, 'Leitura de holerites configurados'));
    } else if (Array.isArray(holeritesRes.data)) {
      const vistos = new Set<string>();
      const unicos: HoleriteConfigurado[] = [];
      for (const row of holeritesRes.data) {
        const mapped = rowToHoleriteConfigurado(row);
        const key = `${mapped.colaboradorId}__${mapped.mes}`;
        if (!vistos.has(key)) {
          vistos.add(key);
          unicos.push(mapped);
        }
      }
      snapshot.holeritesConfigurados = unicos;
    }

    if (feriadosRes.error) {
      erros.push(formatSupabaseError(feriadosRes.error, 'Leitura de feriados'));
    } else if (Array.isArray(feriadosRes.data)) {
      if (feriadosRes.data.length === 0) {
        const seedRes = await supabase
          .from('feriados')
          .upsert(DEFAULT_FERIADOS.map(feriadoToRow), { onConflict: 'id' });
        if (seedRes.error) {
          erros.push(formatSupabaseError(seedRes.error, 'Inicialização de feriados'));
        } else {
          snapshot.feriados = DEFAULT_FERIADOS;
        }
      } else {
        snapshot.feriados = feriadosRes.data.map(rowToFeriado);
      }
    }

    if (jornadasRes.error) {
      erros.push(formatSupabaseError(jornadasRes.error, 'Leitura de jornadas'));
    } else if (Array.isArray(jornadasRes.data)) {
      if (jornadasRes.data.length === 0) {
        const seedRes = await supabase
          .from('jornadas_template')
          .upsert(DEFAULT_JORNADAS.map(jornadaToRow), { onConflict: 'id' });
        if (seedRes.error) {
          erros.push(formatSupabaseError(seedRes.error, 'Inicialização de jornadas'));
        } else {
          snapshot.jornadas = DEFAULT_JORNADAS;
        }
      } else {
        snapshot.jornadas = jornadasRes.data.map(rowToJornada);
      }
    }

    const cfgFinal: ConfiguracaoEmpresa = {
      ...DEFAULT_CONFIG,
      empresasUnidade: {
        Recife: { ...DEFAULT_CONFIG.empresasUnidade!.Recife },
        Jaboatão: { ...DEFAULT_CONFIG.empresasUnidade!['Jaboatão'] },
      },
      localizacoes: {
        Recife: { ...DEFAULT_CONFIG.localizacoes.Recife },
        Jaboatão: { ...DEFAULT_CONFIG.localizacoes['Jaboatão'] },
      },
    };

    if (configRes.error) {
      erros.push(formatSupabaseError(configRes.error, 'Leitura de configurações'));
    } else if (Array.isArray(configRes.data)) {
      const row = configRes.data.find((r) => r.id === 'default') || configRes.data[0];
      if (row) {
        cfgFinal.razaoSocial = String(row.razao_social || cfgFinal.razaoSocial);
        cfgFinal.nomeFantasia = String(row.nome_fantasia || cfgFinal.nomeFantasia);
        cfgFinal.cnpj = String(row.cnpj || cfgFinal.cnpj);
        cfgFinal.regimeTributario = 'Simples Nacional';
        cfgFinal.bancoHorasModo = 'Pagamento Mensal (Sem Acúmulo)';
        cfgFinal.regrasUnidade = row.regras_unidade || cfgFinal.regrasUnidade;
        cfgFinal.notificacoes = row.notificacoes || cfgFinal.notificacoes;
      } else {
        const seedRes = await supabase.from('configuracoes_sistema').upsert(
          {
            id: 'default',
            razao_social: cfgFinal.razaoSocial,
            nome_fantasia: cfgFinal.nomeFantasia,
            cnpj: cfgFinal.cnpj,
            regime_tributario: cfgFinal.regimeTributario,
            banco_horas_modo: cfgFinal.bancoHorasModo,
            regras_unidade: cfgFinal.regrasUnidade,
            notificacoes: cfgFinal.notificacoes,
            atualizado_em: new Date().toISOString(),
          },
          { onConflict: 'id' }
        );
        if (seedRes.error) {
          erros.push(formatSupabaseError(seedRes.error, 'Inicialização de configurações'));
        }
      }
    }

    if (empresasRes.error) {
      erros.push(formatSupabaseError(empresasRes.error, 'Leitura de empresas/unidades'));
    } else if (Array.isArray(empresasRes.data)) {
      if (empresasRes.data.length === 0) {
        const recDefault = DEFAULT_CONFIG.empresasUnidade!.Recife;
        const jabDefault = DEFAULT_CONFIG.empresasUnidade!['Jaboatão'];
        const seedRes = await supabase
          .from('empresas_unidades')
          .upsert([empresaUnidadeToRow(recDefault), empresaUnidadeToRow(jabDefault)], {
            onConflict: 'unidade',
          });
        if (seedRes.error) {
          erros.push(formatSupabaseError(seedRes.error, 'Inicialização de empresas/unidades'));
        }
      } else {
        for (const row of empresasRes.data) {
          const emp = rowToEmpresaUnidade(row);
          cfgFinal.empresasUnidade![emp.unidade] = emp;
        }
      }
    }

    if (locRes.error) {
      erros.push(formatSupabaseError(locRes.error, 'Leitura de localizações GPS'));
    } else if (Array.isArray(locRes.data)) {
      if (locRes.data.length === 0) {
        const seedRes = await supabase.from('localizacoes_gps').upsert(
          [
            localizacaoToRow(DEFAULT_CONFIG.localizacoes.Recife),
            localizacaoToRow(DEFAULT_CONFIG.localizacoes['Jaboatão']),
          ],
          { onConflict: 'unidade' }
        );
        if (seedRes.error) {
          erros.push(formatSupabaseError(seedRes.error, 'Inicialização de localizações GPS'));
        }
      } else {
        for (const row of locRes.data) {
          const loc = rowToLocalizacao(row);
          cfgFinal.localizacoes[loc.unidade] = loc;
        }
      }
    }

    snapshot.config = cfgFinal;

    return {
      snapshot,
      errorMessage: erros.length > 0 ? erros[0] : null,
    };
  } catch (err) {
    const msg =
      err instanceof Error ? err.message : 'Falha de conexão com o banco de dados Supabase.';
    return {
      snapshot,
      errorMessage: `Erro ao conectar no Supabase: ${msg}`,
    };
  }
}

// ============================================================================
// Operações Diretas de Gravação no Supabase (upsert / insert / update / delete)
// ============================================================================

export const cloudSync = {
  async insertColaborador(colab: Colaborador): Promise<void> {
    const { error } = await supabase
      .from('colaboradores')
      .insert(colaboradorToRow(colab));
    throwIfError(error, 'Erro ao cadastrar colaborador');
  },

  async upsertColaborador(colab: Colaborador): Promise<void> {
    const { error } = await supabase
      .from('colaboradores')
      .upsert(colaboradorToRow(colab), { onConflict: 'id' });
    throwIfError(error, 'Erro ao salvar colaborador');
  },

  async insertColaboradoresBatch(novos: Colaborador[]): Promise<void> {
    if (novos.length === 0) return;
    const { error } = await supabase
      .from('colaboradores')
      .upsert(novos.map(colaboradorToRow), { onConflict: 'id' });
    throwIfError(error, 'Erro ao importar colaboradores');
  },

  async toggleColaboradorAtivo(id: string, ativo: boolean): Promise<void> {
    const { error } = await supabase
      .from('colaboradores')
      .update({ ativo })
      .eq('id', id);
    throwIfError(error, 'Erro ao atualizar status do colaborador');
  },

  async insertPonto(reg: RegistroPonto): Promise<RegistroPonto> {
    const { data, error } = await supabase
      .from('registros_ponto')
      .insert(pontoToRow(reg))
      .select('*')
      .single();
    throwIfError(error, 'Erro ao registrar ponto');
    return data ? rowToPonto(data as Record<string, any>) : reg;
  },

  async insertAtestado(atestado: Atestado): Promise<void> {
    const { error } = await supabase
      .from('atestados')
      .insert(atestadoToRow(atestado));
    throwIfError(error, 'Erro ao enviar atestado/justificativa');
  },

  async updateAtestadoStatus(id: string, status: StatusAtestado): Promise<void> {
    const { error } = await supabase
      .from('atestados')
      .update({ status })
      .eq('id', id);
    throwIfError(error, 'Erro ao atualizar status do atestado');
  },

  async upsertAjuste(ajuste: AjusteEscala): Promise<void> {
    const { error } = await supabase
      .from('ajustes_escala')
      .upsert(ajusteToRow(ajuste), { onConflict: 'colaborador_id,data' });
    throwIfError(error, 'Erro ao salvar ajuste de escala');
  },

  async deleteAjuste(id: string): Promise<void> {
    const { error } = await supabase
      .from('ajustes_escala')
      .delete()
      .eq('id', id);
    throwIfError(error, 'Erro ao remover ajuste de escala');
  },

  async toggleFechamento(
    mes: string,
    unidade: 'Todas' | Unidade,
    fechamento?: FechamentoMensal
  ): Promise<void> {
    const id = fechamentoId(mes, unidade);
    if (fechamento) {
      const { error } = await supabase.from('fechamentos_mensais').upsert(
        {
          id,
          mes: fechamento.mes,
          unidade: fechamento.unidade,
          fechado_em: fechamento.fechadoEm,
          fechado_por: fechamento.fechadoPor,
        },
        { onConflict: 'id' }
      );
      throwIfError(error, 'Erro ao fechar competência');
    } else {
      const { error } = await supabase
        .from('fechamentos_mensais')
        .delete()
        .eq('id', id);
      throwIfError(error, 'Erro ao reabrir competência');
    }
  },

  async saveConfig(cfg: ConfiguracaoEmpresa): Promise<void> {
    const [cfgRes, locRes, empRes] = await Promise.all([
      supabase.from('configuracoes_sistema').upsert(
        {
          id: 'default',
          razao_social: cfg.razaoSocial,
          nome_fantasia: cfg.nomeFantasia,
          cnpj: cfg.cnpj,
          regime_tributario: cfg.regimeTributario,
          banco_horas_modo: cfg.bancoHorasModo,
          regras_unidade: cfg.regrasUnidade,
          notificacoes: cfg.notificacoes,
          atualizado_em: new Date().toISOString(),
        },
        { onConflict: 'id' }
      ),
      supabase.from('localizacoes_gps').upsert(
        [
          localizacaoToRow(cfg.localizacoes.Recife),
          localizacaoToRow(cfg.localizacoes['Jaboatão']),
        ],
        { onConflict: 'unidade' }
      ),
      cfg.empresasUnidade
        ? supabase.from('empresas_unidades').upsert(
            [
              empresaUnidadeToRow(cfg.empresasUnidade.Recife),
              empresaUnidadeToRow(cfg.empresasUnidade['Jaboatão']),
            ],
            { onConflict: 'unidade' }
          )
        : Promise.resolve({ error: null }),
    ]);

    throwIfError(cfgRes.error, 'Erro ao salvar configurações');
    throwIfError(locRes.error, 'Erro ao salvar localizações GPS');
    throwIfError(empRes.error, 'Erro ao salvar dados da empresa');
  },

  async syncFeriados(prev: Feriado[], next: Feriado[]): Promise<void> {
    const nextIds = new Set(next.map((f) => f.id));
    const removidos = prev.filter((f) => !nextIds.has(f.id)).map((f) => f.id);
    if (removidos.length > 0) {
      const { error } = await supabase.from('feriados').delete().in('id', removidos);
      throwIfError(error, 'Erro ao remover feriado');
    }
    if (next.length > 0) {
      const { error } = await supabase
        .from('feriados')
        .upsert(next.map(feriadoToRow), { onConflict: 'id' });
      throwIfError(error, 'Erro ao salvar feriados');
    }
  },

  async insertAviso(aviso: AvisoEmpresa): Promise<void> {
    const { error } = await supabase
      .from('avisos_empresa')
      .insert(avisoToRow(aviso));
    throwIfError(error, 'Erro ao publicar aviso');
  },

  async getHoleriteConfigurado(
    colaboradorId: string,
    mes: string
  ): Promise<HoleriteConfigurado | null> {
    const { data, error } = await supabase
      .from('holerites_configurados')
      .select('*')
      .eq('colaborador_id', colaboradorId)
      .eq('mes', mes)
      .order('atualizado_em', { ascending: false })
      .limit(1);
    throwIfError(error, 'Erro ao consultar configuração do holerite');
    if (!Array.isArray(data) || data.length === 0) return null;
    return rowToHoleriteConfigurado(data[0] as Record<string, any>);
  },

  async upsertHoleriteConfigurado(cfg: HoleriteConfigurado): Promise<HoleriteConfigurado> {
    const cfgNormalizado: HoleriteConfigurado = {
      ...cfg,
      liberado: Boolean(cfg.liberado),
      atualizadoEm: cfg.atualizadoEm || new Date().toISOString(),
    };
    const row = holeriteConfiguradoToRow(cfgNormalizado);

    const { data: existentes, error: buscaError } = await supabase
      .from('holerites_configurados')
      .select('id')
      .eq('colaborador_id', cfgNormalizado.colaboradorId)
      .eq('mes', cfgNormalizado.mes);
    throwIfError(buscaError, 'Erro ao localizar configuração do holerite');

    if (Array.isArray(existentes) && existentes.length > 0) {
      const { data: atualizados, error: updateError } = await supabase
        .from('holerites_configurados')
        .update({
          recebiveis: row.recebiveis,
          descontaveis: row.descontaveis,
          total_recebiveis: row.total_recebiveis,
          total_descontaveis: row.total_descontaveis,
          salario_liquido: row.salario_liquido,
          liberado: Boolean(cfgNormalizado.liberado),
          configurado_por: row.configurado_por,
          atualizado_em: row.atualizado_em,
        })
        .eq('colaborador_id', cfgNormalizado.colaboradorId)
        .eq('mes', cfgNormalizado.mes)
        .select('*');
      throwIfError(updateError, 'Erro ao atualizar configuração do holerite');
      if (Array.isArray(atualizados) && atualizados.length > 0) {
        return rowToHoleriteConfigurado(atualizados[0] as Record<string, any>);
      }
      return cfgNormalizado;
    }

    const { data: inserido, error: insertError } = await supabase
      .from('holerites_configurados')
      .insert(row)
      .select('*')
      .single();
    throwIfError(insertError, 'Erro ao salvar configuração do holerite');
    return inserido ? rowToHoleriteConfigurado(inserido as Record<string, any>) : cfgNormalizado;
  },
};

// ============================================================================
// Assinatura Realtime (Sincronização automática entre dispositivos)
// ============================================================================

export function subscribeCloudRealtime(onRemoteChange: () => void): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const triggerDebounced = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      onRemoteChange();
    }, 250);
  };

  const channel = supabase
    .channel('hellciferh-cloud-sync')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'colaboradores' },
      triggerDebounced
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'registros_ponto' },
      triggerDebounced
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'atestados' },
      triggerDebounced
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'ajustes_escala' },
      triggerDebounced
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'feriados' },
      triggerDebounced
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'fechamentos_mensais' },
      triggerDebounced
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'avisos_empresa' },
      triggerDebounced
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'configuracoes_sistema' },
      triggerDebounced
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'empresas_unidades' },
      triggerDebounced
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'localizacoes_gps' },
      triggerDebounced
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'jornadas_template' },
      triggerDebounced
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'holerites_configurados' },
      triggerDebounced
    )
    .subscribe();

  return () => {
    if (timer) clearTimeout(timer);
    supabase.removeChannel(channel);
  };
}
