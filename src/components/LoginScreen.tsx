import React, { useEffect, useRef, useState } from 'react';
import { Eye, EyeOff, Lock, Mail, MapPin, UserPlus, LogIn, Briefcase, User } from 'lucide-react';
import { Colaborador, DEFAULT_GRADE_SEMANAL, Lotacao, Unidade, cloneGradeSemanal } from '../types/rh';
import { getTodayStr } from '../utils/cltCalculations';
import { PWAInstallBannerCard } from './PWAInstallBannerCard';
import { BrandLogo } from './BrandLogo';

interface LoginScreenProps {
  colaboradores: Colaborador[];
  defaultUnidade: Unidade;
  onLogin: (colab: Colaborador, unidadeAtiva: Unidade) => void;
  onPrimeiroAcesso: (novoColab: Colaborador, unidadeAtiva: Unidade) => Promise<boolean>;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({
  colaboradores,
  defaultUnidade,
  onLogin,
  onPrimeiroAcesso,
}) => {
  const [modo, setModo] = useState<'login' | 'primeiro_acesso'>(
    colaboradores.length === 0 ? 'primeiro_acesso' : 'login'
  );
  const [unidadeLogin, setUnidadeLogin] = useState<Lotacao>(defaultUnidade);

  // Login state
  const [emailLogin, setEmailLogin] = useState('');
  const [senhaLogin, setSenhaLogin] = useState('');
  const [showPassLogin, setShowPassLogin] = useState(false);

  // Primeiro Acesso state
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [showPassCadastro, setShowPassCadastro] = useState(false);
  const [funcao, setFuncao] = useState('');
  const [lotacao, setLotacao] = useState<Lotacao>('Recife');

  const [erro, setErro] = useState('');
  const [salvandoCadastro, setSalvandoCadastro] = useState(false);
  const prevColabCountRef = useRef(colaboradores.length);

  useEffect(() => {
    if (
      prevColabCountRef.current === 0 &&
      colaboradores.length > 0 &&
      !nome &&
      !email &&
      !senha &&
      !funcao
    ) {
      setModo('login');
    }
    prevColabCountRef.current = colaboradores.length;
  }, [colaboradores.length, nome, email, senha, funcao]);

  const handleSubmitLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');
    const emailNorm = emailLogin.trim().toLowerCase();
    const colab = colaboradores.find((c) => c.email.trim().toLowerCase() === emailNorm);

    if (!colab) {
      setErro('Colaborador não encontrado. Verifique o e-mail ou utilize o Primeiro Acesso.');
      return;
    }
    if (!colab.ativo) {
      setErro('Cadastro inativo. Procure o RH da sua unidade.');
      return;
    }
    if (colab.senha !== senhaLogin) {
      setErro('Senha incorreta.');
      return;
    }

    if (colab.lotacao !== 'Ambas' && colab.lotacao !== unidadeLogin) {
      setErro(`Sua lotação cadastrada é ${colab.lotacao}. Selecione a unidade correta.`);
      return;
    }

    const unidadeEfetiva: Unidade =
      colab.lotacao === 'Ambas'
        ? unidadeLogin === 'Ambas'
          ? defaultUnidade
          : unidadeLogin
        : colab.lotacao;
    onLogin(colab, unidadeEfetiva);
  };

  const handleSubmitCadastro = async (e: React.FormEvent) => {
    e.preventDefault();
    if (salvandoCadastro) return;
    setErro('');

    if (!nome.trim() || !email.trim() || !senha.trim() || !funcao.trim()) {
      setErro('Preencha todos os campos obrigatórios.');
      return;
    }

    const emailNorm = email.trim().toLowerCase();
    if (colaboradores.some((c) => c.email.trim().toLowerCase() === emailNorm)) {
      setErro('Já existe um colaborador cadastrado com este e-mail.');
      return;
    }

    const unidadeInicial: Unidade =
      lotacao === 'Ambas'
        ? unidadeLogin === 'Ambas'
          ? defaultUnidade
          : unidadeLogin
        : lotacao;

    const novo: Colaborador = {
      id: `col-${Date.now()}`,
      nome: nome.trim(),
      cpf: '',
      email: emailNorm,
      senha,
      telefone: '',
      endereco: '',
      funcao: funcao.trim(),
      lotacao,
      dataAdmissao: getTodayStr(),
      salarioBase: 1621.0,
      vaDiario: 0,
      vtDiario: 0,
      jornadaId: 'jornada-44h',
      gradeSemanal: cloneGradeSemanal(DEFAULT_GRADE_SEMANAL),
      ativo: true,
      criadoEm: new Date().toISOString(),
    };

    setSalvandoCadastro(true);
    try {
      await onPrimeiroAcesso(novo, unidadeInicial);
    } finally {
      setSalvandoCadastro(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#121214] text-zinc-100 flex flex-col">
      {/* Top Bar */}
      <header className="bg-[#09090B] border-b border-zinc-800/80">
        <div className="w-full max-w-[430px] md:max-w-3xl lg:max-w-5xl mx-auto px-3 md:px-6 py-3 flex justify-center md:justify-start">
          <BrandLogo />
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-[430px] md:max-w-md mx-auto px-3 py-4 overflow-x-hidden flex flex-col justify-center gap-3">
        <PWAInstallBannerCard />

        <div className="bg-white dark:bg-[#1C1C20] text-[#111827] dark:text-zinc-100 rounded-xl p-3 shadow-lg border border-zinc-200/80 dark:border-zinc-800">
          {/* Segmented Mode Switch */}
          <div className="grid grid-cols-2 gap-1 p-1 bg-zinc-100 dark:bg-zinc-900 rounded-lg mb-3">
            <button
              type="button"
              onClick={() => {
                setModo('login');
                setErro('');
              }}
              className={`py-2 px-2 text-xs font-semibold rounded-md flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
                modo === 'login'
                  ? 'bg-white dark:bg-zinc-800 text-[#111827] dark:text-white shadow-sm'
                  : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200'
              }`}
            >
              <LogIn className="w-3.5 h-3.5 shrink-0" />
              <span>Entrar</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setModo('primeiro_acesso');
                setErro('');
              }}
              className={`py-2 px-2 text-xs font-semibold rounded-md flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
                modo === 'primeiro_acesso'
                  ? 'bg-white dark:bg-zinc-800 text-[#111827] dark:text-white shadow-sm'
                  : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5 shrink-0" />
              <span>Primeiro Acesso</span>
            </button>
          </div>

          {erro && (
            <div className="mb-3 rounded-lg bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 px-3 py-2 text-xs text-red-700 dark:text-red-300">
              {erro}
            </div>
          )}

          {modo === 'login' ? (
            <form onSubmit={handleSubmitLogin} className="space-y-3">
              <div>
                <h1 className="text-sm font-bold text-[#111827] dark:text-white">
                  Acesso do Colaborador
                </h1>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Informe seu e-mail e senha para registrar o ponto.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Unidade selecionada
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {([
                    { value: 'Recife', label: 'Recife' },
                    { value: 'Jaboatão', label: 'Jaboatão' },
                    { value: 'Ambas', label: 'Ambas' },
                  ] as { value: Lotacao; label: string }[]).map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setUnidadeLogin(opt.value)}
                      className={`py-2 px-2 rounded-lg text-xs font-semibold border transition-colors cursor-pointer flex items-center justify-center gap-1 ${
                        unidadeLogin === opt.value
                          ? 'border-[#DC2626] bg-red-50 dark:bg-red-950/30 text-[#DC2626]'
                          : 'border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300'
                      }`}
                    >
                      <MapPin className="w-3.5 h-3.5 shrink-0" />
                      <span>{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  E-mail
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    value={emailLogin}
                    onChange={(e) => setEmailLogin(e.target.value)}
                    placeholder="colaborador@hellcife.com.br"
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-[#111827] dark:text-white focus:outline-none focus:border-[#DC2626]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Senha
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPassLogin ? 'text' : 'password'}
                    required
                    value={senhaLogin}
                    onChange={(e) => setSenhaLogin(e.target.value)}
                    placeholder="Sua senha"
                    className="w-full pl-9 pr-9 py-2 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-[#111827] dark:text-white focus:outline-none focus:border-[#DC2626]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassLogin((v) => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 cursor-pointer"
                    aria-label="Mostrar senha"
                  >
                    {showPassLogin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 px-4 rounded-lg bg-[#DC2626] hover:bg-red-700 text-white text-xs font-bold tracking-wide transition-colors cursor-pointer min-h-[44px]"
              >
                ENTRAR NO SISTEMA
              </button>

              {colaboradores.length === 0 && (
                <p className="text-xs text-center text-zinc-500 dark:text-zinc-400">
                  Nenhum colaborador cadastrado ainda. Toque em{' '}
                  <button
                    type="button"
                    onClick={() => setModo('primeiro_acesso')}
                    className="font-semibold text-[#DC2626] underline cursor-pointer"
                  >
                    Primeiro Acesso
                  </button>
                  .
                </p>
              )}
            </form>
          ) : (
            <form onSubmit={handleSubmitCadastro} className="space-y-2.5">
              <div>
                <h1 className="text-sm font-bold text-[#111827] dark:text-white">
                  Primeiro Acesso · Cadastro Inicial
                </h1>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Preencha seus dados para criar seu acesso de Colaborador.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Nome Completo
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    placeholder="Nome completo"
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-[#111827] dark:text-white focus:outline-none focus:border-[#DC2626]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  E-mail
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="email@empresa.com.br"
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-[#111827] dark:text-white focus:outline-none focus:border-[#DC2626]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Senha
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPassCadastro ? 'text' : 'password'}
                    required
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    placeholder="Crie uma senha"
                    className="w-full pl-9 pr-9 py-2 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-[#111827] dark:text-white focus:outline-none focus:border-[#DC2626]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassCadastro((v) => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 cursor-pointer"
                    aria-label="Mostrar senha"
                  >
                    {showPassCadastro ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Função / Cargo
                </label>
                <div className="relative">
                  <Briefcase className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={funcao}
                    onChange={(e) => setFuncao(e.target.value)}
                    placeholder="Ex.: Vendedor, Estoque, Gerência"
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-[#111827] dark:text-white focus:outline-none focus:border-[#DC2626]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Lotação
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {([
                    { value: 'Recife', label: 'Recife' },
                    { value: 'Jaboatão', label: 'Jaboatão' },
                    { value: 'Ambas', label: 'Ambas' },
                  ] as { value: Lotacao; label: string }[]).map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setLotacao(opt.value)}
                      className={`py-2 px-2 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                        lotacao === opt.value
                          ? 'border-[#DC2626] bg-red-50 dark:bg-red-950/30 text-[#DC2626]'
                          : 'border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                  {lotacao === 'Ambas'
                    ? 'Ambas: o colaborador atua nas duas unidades (Recife e Jaboatão).'
                    : `Unidade fixa: ${lotacao}.`}
                </p>
              </div>

              <button
                type="submit"
                disabled={salvandoCadastro}
                className="w-full py-2.5 px-4 rounded-lg bg-[#DC2626] hover:bg-red-700 text-white text-xs font-bold tracking-wide transition-colors cursor-pointer min-h-[44px] disabled:opacity-60"
              >
                {salvandoCadastro ? 'SALVANDO NO SUPABASE...' : 'CONCLUIR CADASTRO E ENTRAR'}
              </button>
            </form>
          )}
        </div>
      </main>
    </div>
  );
};
