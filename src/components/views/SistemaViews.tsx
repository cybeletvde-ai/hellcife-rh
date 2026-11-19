import React, { useState } from 'react';
import {
  Bell,
  Building2,
  Clock,
  Copy,
  Edit3,
  MapPin,
  Plus,
  Trash2,
  Upload,
  UserCheck,
  UserCog,
  UserX,
} from 'lucide-react';
import {
  Colaborador,
  ConfiguracaoEmpresa,
  DEFAULT_GRADE_SEMANAL,
  DiaSemanaKey,
  Feriado,
  GradeSemanal,
  HorarioDiaSemana,
  JornadaTemplate,
  Lotacao,
  ORDEM_DIAS_SEMANA,
  Unidade,
  calcularMinutosDiaGrade,
  calcularMinutosSemanaGrade,
  cloneGradeSemanal,
  temPermissaoGestao,
} from '../../types/rh';
import {
  formatBRL,
  formatDateBR,
  formatMinutesToHHMM,
  getTodayStr,
} from '../../utils/cltCalculations';

interface ColaboradoresCrudProps {
  colaboradores: Colaborador[];
  jornadas: JornadaTemplate[];
  onSalvarColaborador: (colab: Colaborador) => Promise<boolean>;
  onAlternarAtivo: (id: string) => Promise<boolean>;
}

export const ColaboradoresCrudView: React.FC<ColaboradoresCrudProps> = ({
  colaboradores,
  jornadas,
  onSalvarColaborador,
  onAlternarAtivo,
}) => {
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [formAberto, setFormAberto] = useState(false);

  const [nome, setNome] = useState('');
  const [cpf, setCpf] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [telefone, setTelefone] = useState('');
  const [endereco, setEndereco] = useState('');
  const [funcao, setFuncao] = useState('');
  const [lotacao, setLotacao] = useState<Lotacao>('Recife');
  const [dataAdmissao, setDataAdmissao] = useState(getTodayStr);
  const [salarioBase, setSalarioBase] = useState('1621.00');
  const [vaDiario, setVaDiario] = useState('');
  const [vtDiario, setVtDiario] = useState('');
  const [gradeSemanal, setGradeSemanal] = useState<GradeSemanal>(() =>
    cloneGradeSemanal(DEFAULT_GRADE_SEMANAL)
  );
  const [replicadoMsg, setReplicadoMsg] = useState(false);
  const [erro, setErro] = useState('');

  const gradeFromJornadaTemplate = (j?: JornadaTemplate): GradeSemanal => {
    if (!j) return cloneGradeSemanal(DEFAULT_GRADE_SEMANAL);
    const diaSegSex: HorarioDiaSemana = {
      ativo: true,
      entrada: j.segSexEntrada || '09:00',
      saidaAlmoco: j.intervaloMin > 0 ? '13:00' : '',
      retornoAlmoco: j.intervaloMin > 0 ? '14:00' : '',
      saida: j.segSexSaida || '18:00',
    };
    return {
      seg: { ...diaSegSex },
      ter: { ...diaSegSex },
      qua: { ...diaSegSex },
      qui: { ...diaSegSex },
      sex: { ...diaSegSex },
      sab: {
        ativo: j.sabadoAtivo,
        entrada: j.sabadoEntrada || '09:00',
        saidaAlmoco: '',
        retornoAlmoco: '',
        saida: j.sabadoSaida || '13:00',
      },
      dom: { ...DEFAULT_GRADE_SEMANAL.dom, ativo: false },
    };
  };

  const abrirNovo = () => {
    setEditandoId(null);
    setNome('');
    setCpf('');
    setEmail('');
    setSenha('');
    setTelefone('');
    setEndereco('');
    setFuncao('');
    setLotacao('Recife');
    setDataAdmissao(getTodayStr());
    setSalarioBase('1621.00');
    setVaDiario('');
    setVtDiario('');
    setGradeSemanal(cloneGradeSemanal(DEFAULT_GRADE_SEMANAL));
    setReplicadoMsg(false);
    setErro('');
    setFormAberto(true);
  };

  const abrirEditar = (c: Colaborador) => {
    setEditandoId(c.id);
    setNome(c.nome);
    setCpf(c.cpf);
    setEmail(c.email);
    setSenha(c.senha);
    setTelefone(c.telefone || '');
    setEndereco(c.endereco || '');
    setFuncao(c.funcao);
    setLotacao(c.lotacao);
    setDataAdmissao(c.dataAdmissao);
    setSalarioBase(String(c.salarioBase));
    setVaDiario(c.vaDiario !== undefined && c.vaDiario !== null ? String(c.vaDiario) : '0');
    setVtDiario(c.vtDiario !== undefined && c.vtDiario !== null ? String(c.vtDiario) : '0');
    if (c.gradeSemanal) {
      setGradeSemanal(cloneGradeSemanal(c.gradeSemanal));
    } else {
      const tpl = jornadas.find((j) => j.id === c.jornadaId) || jornadas[0];
      setGradeSemanal(gradeFromJornadaTemplate(tpl));
    }
    setReplicadoMsg(false);
    setErro('');
    setFormAberto(true);
  };

  const handleLotacaoChange = (nova: Lotacao) => {
    setLotacao(nova);
  };

  const atualizarDiaGrade = (
    diaKey: DiaSemanaKey,
    patch: Partial<HorarioDiaSemana>
  ) => {
    setGradeSemanal((prev) => ({
      ...prev,
      [diaKey]: {
        ...prev[diaKey],
        ...patch,
      },
    }));
  };

  const replicarSegundaParaTercaSexta = () => {
    setGradeSemanal((prev) => ({
      ...prev,
      ter: { ...prev.seg },
      qua: { ...prev.seg },
      qui: { ...prev.seg },
      sex: { ...prev.seg },
    }));
    setReplicadoMsg(true);
    setTimeout(() => setReplicadoMsg(false), 2000);
  };

  const cargaSemanalMin = calcularMinutosSemanaGrade(gradeSemanal);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');
    const emailNorm = email.trim().toLowerCase();
    const duplicado = colaboradores.some(
      (c) => c.email.trim().toLowerCase() === emailNorm && c.id !== editandoId
    );
    if (duplicado) {
      setErro('Já existe outro colaborador cadastrado com este e-mail.');
      return;
    }

    const parseBeneficio = (raw: string): number | null => {
      const norm = raw.trim().replace(',', '.');
      if (!norm) return 0;
      const n = parseFloat(norm);
      if (!Number.isFinite(n) || n < 0 || n > 100) return null;
      return Number(n.toFixed(2));
    };

    const vaParsed = parseBeneficio(vaDiario);
    const vtParsed = parseBeneficio(vtDiario);
    if (vaParsed === null || vtParsed === null) {
      setErro('Vale-Alimentação e Vale-Transporte devem estar entre R$ 0,00 e R$ 100,00.');
      return;
    }

    const existente = colaboradores.find((c) => c.id === editandoId);
    const horasSemanais = cargaSemanalMin / 60;
    const jornadaDerivada =
      horasSemanais <= 36
        ? jornadas.find((j) => j.horasSemanais <= 36)?.id || 'jornada-36h'
        : jornadas.find((j) => j.horasSemanais > 36)?.id || 'jornada-44h';

    const registro: Colaborador = {
      id: editandoId || `col-${Date.now()}`,
      nome: nome.trim(),
      cpf: cpf.trim(),
      email: emailNorm,
      senha,
      telefone: telefone.trim(),
      endereco: endereco.trim(),
      funcao: funcao.trim(),
      lotacao,
      dataAdmissao,
      salarioBase: parseFloat(salarioBase.replace(',', '.')) || 1621,
      vaDiario: vaParsed,
      vtDiario: vtParsed,
      jornadaId: existente?.jornadaId || jornadaDerivada,
      gradeSemanal: cloneGradeSemanal(gradeSemanal),
      ativo: existente ? existente.ativo : true,
      criadoEm: existente?.criadoEm || new Date().toISOString(),
    };

    const ok = await onSalvarColaborador(registro);
    if (ok) {
      setFormAberto(false);
    }
  };

  return (
    <div className="space-y-3">
      <section className="bg-white dark:bg-[#1C1C20] text-[#111827] dark:text-zinc-100 rounded-xl p-3 shadow-sm border border-zinc-200/80 dark:border-zinc-800">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <UserCog className="w-4 h-4 text-[#DC2626] shrink-0" />
            <h1 className="text-sm font-bold truncate">Cadastro do Colaborador</h1>
          </div>
          <button
            type="button"
            onClick={abrirNovo}
            className="px-2.5 py-1.5 rounded-lg bg-[#DC2626] hover:bg-red-700 text-white text-xs font-semibold flex items-center gap-1 cursor-pointer shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Novo</span>
          </button>
        </div>

        {formAberto && (
          <form onSubmit={handleSubmit} className="mt-3 pt-3 border-t border-zinc-200 dark:border-zinc-800 space-y-2 text-xs">
            {erro && (
              <div className="p-2 rounded-lg bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300">
                {erro}
              </div>
            )}
            <div>
              <label className="block text-[10px] text-zinc-500 mb-0.5">Nome completo</label>
              <input
                type="text"
                required
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Nome completo"
                className="w-full px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] text-zinc-500 mb-0.5">CPF</label>
                <input
                  type="text"
                  value={cpf}
                  onChange={(e) => setCpf(e.target.value)}
                  placeholder="000.000.000-00"
                  className="w-full px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 font-mono"
                />
              </div>
              <div>
                <label className="block text-[10px] text-zinc-500 mb-0.5">Função / Cargo</label>
                <input
                  type="text"
                  required
                  value={funcao}
                  onChange={(e) => setFuncao(e.target.value)}
                  placeholder="Ex.: Vendedor, Estoque"
                  className="w-full px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] text-zinc-500 mb-0.5">E-mail</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="email@empresa.com.br"
                  className="w-full px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900"
                />
              </div>
              <div>
                <label className="block text-[10px] text-zinc-500 mb-0.5">Senha</label>
                <input
                  type="password"
                  required
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  placeholder="Senha de acesso"
                  className="w-full px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] text-zinc-500 mb-0.5">Telefone</label>
                <input
                  type="tel"
                  value={telefone}
                  onChange={(e) => setTelefone(e.target.value)}
                  placeholder="(81) 99999-9999"
                  className="w-full px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 font-mono"
                />
              </div>
              <div>
                <label className="block text-[10px] text-zinc-500 mb-0.5">Lotação</label>
                <select
                  value={lotacao}
                  onChange={(e) => handleLotacaoChange(e.target.value as Lotacao)}
                  className="w-full px-2 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900"
                >
                  <option value="Recife">Recife</option>
                  <option value="Jaboatão">Jaboatão</option>
                  <option value="Ambas">Ambas</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[10px] text-zinc-500 mb-0.5">Endereço</label>
              <input
                type="text"
                value={endereco}
                onChange={(e) => setEndereco(e.target.value)}
                placeholder="Rua, nº, bairro, cidade"
                className="w-full px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] text-zinc-500 mb-0.5">Data de Admissão</label>
                <input
                  type="date"
                  required
                  value={dataAdmissao}
                  onChange={(e) => setDataAdmissao(e.target.value)}
                  className="w-full px-2 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900"
                />
              </div>
              <div>
                <label className="block text-[10px] text-zinc-500 mb-0.5">Salário Base (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={salarioBase}
                  onChange={(e) => setSalarioBase(e.target.value)}
                  className="w-full px-2 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] text-zinc-500 mb-0.5">
                  Vale-Alimentação diário (R$)
                </label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                  value={vaDiario}
                  onChange={(e) => setVaDiario(e.target.value)}
                  placeholder="0,00 (opcional)"
                  className="w-full px-2 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 font-mono"
                />
              </div>
              <div>
                <label className="block text-[10px] text-zinc-500 mb-0.5">
                  Vale-Transporte diário (R$)
                </label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                  value={vtDiario}
                  onChange={(e) => setVtDiario(e.target.value)}
                  placeholder="0,00 (opcional)"
                  className="w-full px-2 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 font-mono"
                />
              </div>
            </div>
            <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
              VA e VT diários são opcionais (de R$ 0,00 até R$ 100,00). Se VT for 0,00, não há desconto de 6% no holerite.
            </p>

            {/* Grade Completa de Horários (Segunda a Domingo) */}
            <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <Clock className="w-3.5 h-3.5 text-[#DC2626] shrink-0" />
                  <span className="font-bold text-xs truncate">Grade de Horários</span>
                </div>
                <span className="font-mono tabular-nums text-[11px] font-bold text-[#DC2626] shrink-0">
                  {formatMinutesToHHMM(cargaSemanalMin)} / sem
                </span>
              </div>

              <button
                type="button"
                onClick={replicarSegundaParaTercaSexta}
                className="w-full py-1.5 px-2.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-900 hover:border-[#DC2626] text-[11px] font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
              >
                <Copy className="w-3.5 h-3.5 text-[#DC2626] shrink-0" />
                <span>
                  {replicadoMsg
                    ? 'Horário de Segunda replicado para Terça a Sexta!'
                    : 'Replicar Segunda para Terça a Sexta'}
                </span>
              </button>

              <div className="space-y-1.5">
                {ORDEM_DIAS_SEMANA.map(({ key, label }) => {
                  const dia = gradeSemanal[key];
                  const cargaDiaMin = calcularMinutosDiaGrade(dia);

                  return (
                    <div
                      key={key}
                      className={`rounded-lg border p-2 transition-colors ${
                        dia.ativo
                          ? 'border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/90'
                          : 'border-zinc-200/60 dark:border-zinc-800 bg-zinc-100/60 dark:bg-zinc-950/60 opacity-85'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <label className="flex items-center gap-2 cursor-pointer min-w-0">
                          <input
                            type="checkbox"
                            checked={dia.ativo}
                            onChange={(e) =>
                              atualizarDiaGrade(key, { ativo: e.target.checked })
                            }
                            className="accent-[#DC2626] w-3.5 h-3.5 shrink-0 cursor-pointer"
                          />
                          <span className="font-bold text-xs truncate">{label}</span>
                        </label>

                        <span
                          className={`text-[10px] font-mono tabular-nums font-bold shrink-0 ${
                            dia.ativo ? 'text-[#111827] dark:text-zinc-200' : 'text-zinc-500'
                          }`}
                        >
                          {dia.ativo ? `${formatMinutesToHHMM(cargaDiaMin)}/dia` : 'Folga'}
                        </span>
                      </div>

                      {dia.ativo && (
                        <div className="grid grid-cols-2 gap-1.5 mt-2">
                          <div>
                            <label className="block text-[10px] text-zinc-500 mb-0.5">
                              Entrada
                            </label>
                            <input
                              type="time"
                              required
                              value={dia.entrada}
                              onChange={(e) =>
                                atualizarDiaGrade(key, { entrada: e.target.value })
                              }
                              className="w-full px-1.5 py-1 rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 font-mono text-[11px]"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] text-zinc-500 mb-0.5">
                              Saída Almoço
                            </label>
                            <input
                              type="time"
                              value={dia.saidaAlmoco}
                              onChange={(e) =>
                                atualizarDiaGrade(key, { saidaAlmoco: e.target.value })
                              }
                              className="w-full px-1.5 py-1 rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 font-mono text-[11px]"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] text-zinc-500 mb-0.5">
                              Retorno Almoço
                            </label>
                            <input
                              type="time"
                              value={dia.retornoAlmoco}
                              onChange={(e) =>
                                atualizarDiaGrade(key, { retornoAlmoco: e.target.value })
                              }
                              className="w-full px-1.5 py-1 rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 font-mono text-[11px]"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] text-zinc-500 mb-0.5">
                              Saída
                            </label>
                            <input
                              type="time"
                              required
                              value={dia.saida}
                              onChange={(e) =>
                                atualizarDiaGrade(key, { saida: e.target.value })
                              }
                              className="w-full px-1.5 py-1 rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 font-mono text-[11px]"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => setFormAberto(false)}
                className="py-2 rounded-lg bg-zinc-200 dark:bg-zinc-800 font-semibold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="py-2 rounded-lg bg-[#DC2626] text-white font-bold cursor-pointer"
              >
                {editandoId ? 'Atualizar' : 'Cadastrar'}
              </button>
            </div>
          </form>
        )}
      </section>

      <section className="bg-white dark:bg-[#1C1C20] text-[#111827] dark:text-zinc-100 rounded-xl p-3 shadow-sm border border-zinc-200/80 dark:border-zinc-800">
        <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2">
          Colaboradores ({colaboradores.length})
        </h2>
        <div className="divide-y divide-zinc-100 dark:divide-zinc-800 space-y-2">
          {colaboradores.map((c) => {
            const minSem = c.gradeSemanal
              ? calcularMinutosSemanaGrade(c.gradeSemanal)
              : null;
            return (
              <div key={c.id} className="pt-2 first:pt-0 text-xs">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-bold truncate">
                      {c.nome}{' '}
                      {!c.ativo && <span className="text-red-600 font-semibold">(Inativo)</span>}
                    </div>
                    <div className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
                      {c.funcao} · {c.lotacao}
                      {temPermissaoGestao(c.funcao) ? ' · Gestão' : ''}
                    </div>
                    <div className="text-[11px] text-zinc-500 dark:text-zinc-400 font-mono">
                      Adm: {formatDateBR(c.dataAdmissao)} · {formatBRL(c.salarioBase)}
                      {minSem !== null ? ` · ${formatMinutesToHHMM(minSem)}/sem` : ''}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => abrirEditar(c)}
                      className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 cursor-pointer"
                      title="Editar colaborador"
                      aria-label="Editar colaborador"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onAlternarAtivo(c.id)}
                      className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 cursor-pointer"
                      title={c.ativo ? 'Desativar' : 'Ativar'}
                      aria-label={c.ativo ? 'Desativar' : 'Ativar'}
                    >
                      {c.ativo ? (
                        <UserX className="w-3.5 h-3.5 text-amber-600" />
                      ) : (
                        <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};

interface ConfiguracoesViewProps {
  config: ConfiguracaoEmpresa;
  feriados: Feriado[];
  onSalvarConfig: (cfg: ConfiguracaoEmpresa) => Promise<boolean>;
  onSalvarFeriados: (list: Feriado[]) => Promise<boolean>;
}

export const ConfiguracoesView: React.FC<ConfiguracoesViewProps> = ({
  config,
  feriados,
  onSalvarConfig,
  onSalvarFeriados,
}) => {
  const [razaoSocial, setRazaoSocial] = useState(config.razaoSocial);
  const [cnpj, setCnpj] = useState(config.cnpj);
  const [recExtra, setRecExtra] = useState(String(config.regrasUnidade.Recife.extraOrdinariaPct));
  const [recNot, setRecNot] = useState(String(config.regrasUnidade.Recife.adicionalNoturnoPct));
  const [jabExtra1, setJabExtra1] = useState(
    String(config.regrasUnidade['Jaboatão'].extraOrdinariaPct)
  );
  const [jabExtra2, setJabExtra2] = useState(
    String(config.regrasUnidade['Jaboatão'].extraAcima2hPct)
  );
  const [jabNot, setJabNot] = useState(
    String(config.regrasUnidade['Jaboatão'].adicionalNoturnoPct)
  );
  const [salvo, setSalvo] = useState(false);

  const [ferData, setFerData] = useState('');
  const [ferNome, setFerNome] = useState('');
  const [ferAbrangencia, setFerAbrangencia] = useState<Feriado['abrangencia']>('Recife');

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await onSalvarConfig({
      ...config,
      razaoSocial,
      cnpj,
      regrasUnidade: {
        Recife: {
          ...config.regrasUnidade.Recife,
          extraOrdinariaPct: Number(recExtra) || 50,
          adicionalNoturnoPct: Number(recNot) || 20,
        },
        Jaboatão: {
          ...config.regrasUnidade['Jaboatão'],
          extraOrdinariaPct: Number(jabExtra1) || 65,
          extraAcima2hPct: Number(jabExtra2) || 70,
          adicionalNoturnoPct: Number(jabNot) || 30,
        },
      },
    });
    if (ok) {
      setSalvo(true);
      setTimeout(() => setSalvo(false), 2500);
    }
  };

  const handleAddFeriado = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ferData || !ferNome.trim()) return;
    const novo: Feriado = {
      id: `fer-${Date.now()}`,
      data: ferData,
      nome: ferNome.trim(),
      abrangencia: ferAbrangencia,
    };
    const ok = await onSalvarFeriados(
      [...feriados, novo].sort((a, b) => a.data.localeCompare(b.data))
    );
    if (ok) {
      setFerData('');
      setFerNome('');
    }
  };

  return (
    <div className="space-y-3">
      <section className="bg-white dark:bg-[#1C1C20] text-[#111827] dark:text-zinc-100 rounded-xl p-3 shadow-sm border border-zinc-200/80 dark:border-zinc-800 space-y-2.5">
        <div className="flex items-center gap-2">
          <Building2 className="w-4 h-4 text-[#DC2626] shrink-0" />
          <h1 className="text-sm font-bold">Configurações da Empresa</h1>
        </div>

        {salvo && (
          <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-xs text-emerald-700 dark:text-emerald-300">
            Configurações atualizadas com sucesso.
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-2 text-xs">
          <div>
            <label className="block text-[10px] text-zinc-500 mb-0.5">Razão Social</label>
            <input
              type="text"
              value={razaoSocial}
              onChange={(e) => setRazaoSocial(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900"
            />
          </div>
          <div>
            <label className="block text-[10px] text-zinc-500 mb-0.5">CNPJ</label>
            <input
              type="text"
              value={cnpj}
              onChange={(e) => setCnpj(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 font-mono"
            />
          </div>

          <div className="pt-1 border-t border-zinc-100 dark:border-zinc-800 font-bold">
            Percentuais Recife
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] text-zinc-500 mb-0.5">Extra Ordinária (%)</label>
              <input
                type="number"
                value={recExtra}
                onChange={(e) => setRecExtra(e.target.value)}
                className="w-full px-2 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 font-mono"
              />
            </div>
            <div>
              <label className="block text-[10px] text-zinc-500 mb-0.5">Noturna (%)</label>
              <input
                type="number"
                value={recNot}
                onChange={(e) => setRecNot(e.target.value)}
                className="w-full px-2 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 font-mono"
              />
            </div>
          </div>

          <div className="pt-1 border-t border-zinc-100 dark:border-zinc-800 font-bold">
            Percentuais Jaboatão (hora noturna 52m30s)
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-[10px] text-zinc-500 mb-0.5">Até 2h (%)</label>
              <input
                type="number"
                value={jabExtra1}
                onChange={(e) => setJabExtra1(e.target.value)}
                className="w-full px-2 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 font-mono"
              />
            </div>
            <div>
              <label className="block text-[10px] text-zinc-500 mb-0.5">&gt; 2h (%)</label>
              <input
                type="number"
                value={jabExtra2}
                onChange={(e) => setJabExtra2(e.target.value)}
                className="w-full px-2 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 font-mono"
              />
            </div>
            <div>
              <label className="block text-[10px] text-zinc-500 mb-0.5">Noturna (%)</label>
              <input
                type="number"
                value={jabNot}
                onChange={(e) => setJabNot(e.target.value)}
                className="w-full px-2 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 font-mono"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-2 rounded-lg bg-[#DC2626] hover:bg-red-700 text-white font-bold cursor-pointer"
          >
            SALVAR CONFIGURAÇÕES
          </button>
        </form>
      </section>

      {/* Calendário de Feriados Municipais */}
      <section className="bg-white dark:bg-[#1C1C20] text-[#111827] dark:text-zinc-100 rounded-xl p-3 shadow-sm border border-zinc-200/80 dark:border-zinc-800 space-y-2.5">
        <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          Feriados Municipais & Nacionais
        </h2>
        <form onSubmit={handleAddFeriado} className="grid grid-cols-2 gap-2 text-xs">
          <input
            type="date"
            required
            value={ferData}
            onChange={(e) => setFerData(e.target.value)}
            className="px-2 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900"
          />
          <select
            value={ferAbrangencia}
            onChange={(e) => setFerAbrangencia(e.target.value as Feriado['abrangencia'])}
            className="px-2 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900"
          >
            <option value="Recife">Recife</option>
            <option value="Jaboatão">Jaboatão</option>
            <option value="Estadual">Estadual (PE)</option>
            <option value="Nacional">Nacional</option>
          </select>
          <input
            type="text"
            required
            value={ferNome}
            onChange={(e) => setFerNome(e.target.value)}
            placeholder="Nome do feriado"
            className="col-span-2 px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900"
          />
          <button
            type="submit"
            className="col-span-2 py-1.5 rounded-lg bg-zinc-900 dark:bg-zinc-800 text-white font-semibold cursor-pointer"
          >
            Adicionar Feriado
          </button>
        </form>

        <div className="divide-y divide-zinc-100 dark:divide-zinc-800 max-h-60 overflow-y-auto text-xs">
          {feriados.map((f) => (
            <div key={f.id} className="py-1.5 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <span className="font-mono font-bold mr-1.5">{formatDateBR(f.data)}</span>
                <span className="font-medium">{f.nome}</span>
                <span className="text-[11px] text-zinc-500 ml-1">· {f.abrangencia}</span>
              </div>
              <button
                type="button"
                onClick={() => onSalvarFeriados(feriados.filter((x) => x.id !== f.id))}
                className="p-1 text-zinc-400 hover:text-red-600 cursor-pointer shrink-0"
                aria-label="Remover feriado"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

interface LocalizacaoViewProps {
  config: ConfiguracaoEmpresa;
  onSalvarConfig: (cfg: ConfiguracaoEmpresa) => Promise<boolean>;
}

export const LocalizacaoView: React.FC<LocalizacaoViewProps> = ({ config, onSalvarConfig }) => {
  const [locRec, setLocRec] = useState(config.localizacoes.Recife);
  const [locJab, setLocJab] = useState(config.localizacoes['Jaboatão']);
  const [msg, setMsg] = useState('');

  const capturarAtual = (unidade: Unidade) => {
    if (!navigator.geolocation) {
      setMsg('Geolocalização não suportada neste navegador.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = Number(pos.coords.latitude.toFixed(6));
        const lng = Number(pos.coords.longitude.toFixed(6));
        if (unidade === 'Recife') {
          setLocRec((p) => ({ ...p, latitude: lat, longitude: lng }));
        } else {
          setLocJab((p) => ({ ...p, latitude: lat, longitude: lng }));
        }
        setMsg(`Coordenadas capturadas para ${unidade}. Salve para aplicar.`);
      },
      () => setMsg('Permissão de localização negada.')
    );
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await onSalvarConfig({
      ...config,
      localizacoes: {
        Recife: locRec,
        Jaboatão: locJab,
      },
    });
    if (ok) {
      setMsg('Cercas geográficas atualizadas.');
      setTimeout(() => setMsg(''), 3000);
    }
  };

  const renderBloco = (
    titulo: string,
    unidade: Unidade,
    loc: typeof locRec,
    setLoc: React.Dispatch<React.SetStateAction<typeof locRec>>
  ) => (
    <div className="p-2.5 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-200/70 dark:border-zinc-800 space-y-2 text-xs">
      <div className="flex items-center justify-between gap-2">
        <span className="font-bold">{titulo}</span>
        <button
          type="button"
          onClick={() => capturarAtual(unidade)}
          className="text-[11px] font-semibold text-[#DC2626] hover:underline cursor-pointer"
        >
          Usar GPS atual
        </button>
      </div>
      <input
        type="text"
        value={loc.endereco}
        onChange={(e) => setLoc((p) => ({ ...p, endereco: e.target.value }))}
        placeholder="Endereço"
        className="w-full px-2 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950"
      />
      <div className="grid grid-cols-3 gap-1.5">
        <div>
          <label className="block text-[10px] text-zinc-500">Latitude</label>
          <input
            type="number"
            step="0.000001"
            value={loc.latitude}
            onChange={(e) => setLoc((p) => ({ ...p, latitude: parseFloat(e.target.value) || 0 }))}
            className="w-full px-2 py-1 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 font-mono"
          />
        </div>
        <div>
          <label className="block text-[10px] text-zinc-500">Longitude</label>
          <input
            type="number"
            step="0.000001"
            value={loc.longitude}
            onChange={(e) => setLoc((p) => ({ ...p, longitude: parseFloat(e.target.value) || 0 }))}
            className="w-full px-2 py-1 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 font-mono"
          />
        </div>
        <div>
          <label className="block text-[10px] text-zinc-500">Raio (m)</label>
          <input
            type="number"
            min={20}
            value={loc.raioMetros}
            onChange={(e) => setLoc((p) => ({ ...p, raioMetros: parseInt(e.target.value, 10) || 100 }))}
            className="w-full px-2 py-1 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 font-mono"
          />
        </div>
      </div>
    </div>
  );

  return (
    <form onSubmit={handleSave} className="space-y-3">
      <section className="bg-white dark:bg-[#1C1C20] text-[#111827] dark:text-zinc-100 rounded-xl p-3 shadow-sm border border-zinc-200/80 dark:border-zinc-800 space-y-2.5">
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-[#DC2626] shrink-0" />
          <h1 className="text-sm font-bold">Localização GPS das Lojas</h1>
        </div>
        {msg && (
          <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-xs text-emerald-700 dark:text-emerald-300">
            {msg}
          </div>
        )}
        {renderBloco('Loja Recife', 'Recife', locRec, setLocRec)}
        {renderBloco('Loja Jaboatão', 'Jaboatão', locJab, setLocJab)}
        <button
          type="submit"
          className="w-full py-2 rounded-lg bg-[#DC2626] hover:bg-red-700 text-white text-xs font-bold cursor-pointer"
        >
          SALVAR COORDENADAS GPS
        </button>
      </section>
    </form>
  );
};

interface ImportarNotificacoesProps {
  colaboradores: Colaborador[];
  config: ConfiguracaoEmpresa;
  onImportarColaboradores: (novos: Colaborador[]) => Promise<boolean>;
  onSalvarConfig: (cfg: ConfiguracaoEmpresa) => Promise<boolean>;
}

export const ImportarNotificacoesView: React.FC<ImportarNotificacoesProps> = ({
  colaboradores,
  config,
  onImportarColaboradores,
  onSalvarConfig,
}) => {
  const [notif, setNotif] = useState(config.notificacoes);
  const [csvFeedback, setCsvFeedback] = useState('');
  const [notifFeedback, setNotifFeedback] = useState('');

  const baixarModeloCSV = () => {
    const modelo =
      'nome;cpf;email;senha;funcao;lotacao;dataAdmissao;salarioBase;vaDiario;vtDiario\n' +
      'Nome Exemplo;000.000.000-00;exemplo@hellcife.com.br;123456;Vendedor;Recife;2026-01-10;1800.00;14.00;13.00\n';
    const blob = new Blob(['\ufeff' + modelo], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'modelo-colaboradores-hellciferh.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const text = String(reader.result || '');
      const lines = text
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);
      if (lines.length < 2) {
        setCsvFeedback('Arquivo CSV sem linhas de dados.');
        return;
      }
      const sep = lines[0].includes(';') ? ';' : ',';
      const novos: Colaborador[] = [];
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(sep).map((v) => v.replace(/^"|"$/g, '').trim());
        const [nome, cpf, email, senha, funcao, lotacao, dataAdm, sal, va, vt] = cols;
        if (!nome || !email) continue;
        if (colaboradores.some((c) => c.email.toLowerCase() === email.toLowerCase())) continue;

        const lotVal: Lotacao =
          lotacao === 'Jaboatão'
            ? 'Jaboatão'
            : lotacao === 'Ambas' || lotacao === 'Geral'
              ? 'Ambas'
              : 'Recife';

        novos.push({
          id: `col-${Date.now()}-${i}`,
          nome,
          cpf: cpf || '',
          email: email.toLowerCase(),
          senha: senha || '123456',
          telefone: '',
          endereco: '',
          funcao: funcao || '',
          lotacao: lotVal,
          dataAdmissao: dataAdm || getTodayStr(),
          salarioBase: parseFloat((sal || '1621').replace(',', '.')) || 1621,
          vaDiario: Math.min(100, Math.max(0, parseFloat((va || '0').replace(',', '.')) || 0)),
          vtDiario: Math.min(100, Math.max(0, parseFloat((vt || '0').replace(',', '.')) || 0)),
          jornadaId: 'jornada-44h',
          gradeSemanal: cloneGradeSemanal(DEFAULT_GRADE_SEMANAL),
          ativo: true,
          criadoEm: new Date().toISOString(),
        });
      }
      if (novos.length > 0) {
        const ok = await onImportarColaboradores(novos);
        if (ok) {
          setCsvFeedback(`${novos.length} colaborador(es) importado(s) com sucesso.`);
        }
      } else {
        setCsvFeedback('Nenhum novo colaborador importado (verifique e-mails duplicados).');
      }
    };
    reader.readAsText(file, 'utf-8');
  };

  const handleSaveNotif = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await onSalvarConfig({ ...config, notificacoes: notif });
    if (ok) {
      setNotifFeedback('Preferências de lembretes salvas.');
      setTimeout(() => setNotifFeedback(''), 2500);
    }
  };

  const testarNotificacao = async () => {
    if (!('Notification' in window)) {
      setNotifFeedback('Este navegador não suporta notificações push.');
      return;
    }
    const perm = await Notification.requestPermission();
    if (perm === 'granted') {
      new Notification('HELLCIFE RH+ · Lembrete de Ponto', {
        body: 'Lembrete configurado: não esqueça de registrar seu ponto.',
        icon: '/icon-192x192.png',
      });
      setNotifFeedback('Notificação de teste enviada.');
    } else {
      setNotifFeedback('Permissão de notificação não concedida.');
    }
  };

  return (
    <div className="space-y-3">
      {/* Importação CSV */}
      <section className="bg-white dark:bg-[#1C1C20] text-[#111827] dark:text-zinc-100 rounded-xl p-3 shadow-sm border border-zinc-200/80 dark:border-zinc-800 space-y-2.5 text-xs">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Upload className="w-4 h-4 text-[#DC2626] shrink-0" />
            <h1 className="text-sm font-bold">Importar Dados (CSV)</h1>
          </div>
          <button
            type="button"
            onClick={baixarModeloCSV}
            className="text-xs font-semibold text-[#DC2626] hover:underline cursor-pointer"
          >
            Baixar modelo
          </button>
        </div>

        <p className="text-zinc-500 dark:text-zinc-400">
          Importe colaboradores em lote utilizando arquivo CSV separado por ponto e vírgula (;).
        </p>

        {csvFeedback && (
          <div className="p-2 rounded-lg bg-zinc-100 dark:bg-zinc-900 font-medium">
            {csvFeedback}
          </div>
        )}

        <label className="flex items-center justify-center gap-2 w-full py-2.5 px-3 rounded-lg border border-dashed border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 font-semibold cursor-pointer hover:border-[#DC2626]">
          <Upload className="w-4 h-4" />
          <span>Selecionar arquivo CSV</span>
          <input type="file" accept=".csv,text/csv" onChange={handleImportCSV} className="hidden" />
        </label>
      </section>

      {/* Notificações & Lembretes */}
      <section className="bg-white dark:bg-[#1C1C20] text-[#111827] dark:text-zinc-100 rounded-xl p-3 shadow-sm border border-zinc-200/80 dark:border-zinc-800 space-y-2.5 text-xs">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-[#DC2626] shrink-0" />
            <h2 className="text-sm font-bold">Lembretes de Ponto</h2>
          </div>
          <button
            type="button"
            onClick={testarNotificacao}
            className="text-xs font-semibold text-[#DC2626] hover:underline cursor-pointer"
          >
            Testar alerta
          </button>
        </div>

        {notifFeedback && (
          <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300">
            {notifFeedback}
          </div>
        )}

        <form onSubmit={handleSaveNotif} className="space-y-2">
          <label className="flex items-center justify-between py-1 cursor-pointer">
            <span className="font-semibold">Ativar lembretes automáticos</span>
            <input
              type="checkbox"
              checked={notif.lembretesAtivos}
              onChange={(e) => setNotif((p) => ({ ...p, lembretesAtivos: e.target.checked }))}
              className="accent-[#DC2626] w-4 h-4"
            />
          </label>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] text-zinc-500">Entrada</label>
              <input
                type="time"
                value={notif.horarioEntrada}
                onChange={(e) => setNotif((p) => ({ ...p, horarioEntrada: e.target.value }))}
                className="w-full px-2 py-1 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900"
              />
            </div>
            <div>
              <label className="block text-[10px] text-zinc-500">Saída Almoço</label>
              <input
                type="time"
                value={notif.horarioAlmoco}
                onChange={(e) => setNotif((p) => ({ ...p, horarioAlmoco: e.target.value }))}
                className="w-full px-2 py-1 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900"
              />
            </div>
            <div>
              <label className="block text-[10px] text-zinc-500">Retorno Almoço</label>
              <input
                type="time"
                value={notif.horarioRetorno}
                onChange={(e) => setNotif((p) => ({ ...p, horarioRetorno: e.target.value }))}
                className="w-full px-2 py-1 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900"
              />
            </div>
            <div>
              <label className="block text-[10px] text-zinc-500">Saída</label>
              <input
                type="time"
                value={notif.horarioSaida}
                onChange={(e) => setNotif((p) => ({ ...p, horarioSaida: e.target.value }))}
                className="w-full px-2 py-1 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-2 rounded-lg bg-[#DC2626] hover:bg-red-700 text-white font-bold cursor-pointer"
          >
            SALVAR LEMBRETES
          </button>
        </form>
      </section>
    </div>
  );
};
