import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Menu, X } from 'lucide-react';
import {
  AjusteEscala,
  Atestado,
  AvisoEmpresa,
  Colaborador,
  ConfiguracaoEmpresa,
  FechamentoMensal,
  Feriado,
  JornadaTemplate,
  MenuRoute,
  RegistroPonto,
  StatusAtestado,
  Unidade,
  temPermissaoGestao,
} from './types/rh';
import { DEFAULT_CONFIG, DEFAULT_JORNADAS, storage } from './services/storage';
import {
  cloudSync,
  fetchAllCloudData,
  subscribeCloudRealtime,
} from './services/supabaseSync';
import { LoginScreen } from './components/LoginScreen';
import { SidebarMenu } from './components/SidebarMenu';
import { OfflineIndicator } from './components/OfflineIndicator';
import { BrandLogo } from './components/BrandLogo';
import { SplashScreen } from './components/SplashScreen';
import { PontoView } from './components/views/PontoView';
import { EspelhoView } from './components/views/EspelhoView';
import { EscalasView, JornadasView } from './components/views/JornadasEscalasView';
import { BancoHorasView, HorasExtrasView } from './components/views/ExtrasBancoView';
import { HoleriteView } from './components/views/HoleriteView';
import { AtestadosView, InformacoesView } from './components/views/AtestadosInfoView';
import { FechamentoView, RelatorioView, RetribuicaoView } from './components/views/RHViews';
import {
  ColaboradoresCrudView,
  ConfiguracoesView,
  ImportarNotificacoesView,
  LocalizacaoView,
} from './components/views/SistemaViews';
import { CadastroEmpresaView } from './components/views/CadastroEmpresaView';

const ROTAS_VALIDAS: MenuRoute[] = [
  'ponto',
  'espelho',
  'jornadas',
  'escalas',
  'horas-extras',
  'banco-horas',
  'holerite',
  'atestados',
  'informacoes',
  'rh-fechamento',
  'rh-relatorio',
  'rh-retribuicao',
  'sys-colaboradores',
  'sys-empresa',
  'sys-configuracoes',
  'sys-localizacao',
  'sys-importar',
];

function isRotaRestrita(rota: MenuRoute): boolean {
  return rota.startsWith('rh-') || rota.startsWith('sys-');
}

function parseRouteFromLocation(): MenuRoute {
  if (typeof window === 'undefined') return 'ponto';
  const hashSlug = window.location.hash.replace(/^#\/?/, '').trim();
  if (ROTAS_VALIDAS.includes(hashSlug as MenuRoute)) {
    return hashSlug as MenuRoute;
  }
  const pathSlug = window.location.pathname.replace(/^\/+|\/+$/g, '').trim();
  if (ROTAS_VALIDAS.includes(pathSlug as MenuRoute)) {
    return pathSlug as MenuRoute;
  }
  return 'ponto';
}

export default function App() {
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [pontos, setPontos] = useState<RegistroPonto[]>([]);
  const [atestados, setAtestados] = useState<Atestado[]>([]);
  const [ajustes, setAjustes] = useState<AjusteEscala[]>([]);
  const [fechamentos, setFechamentos] = useState<FechamentoMensal[]>([]);
  const [feriados, setFeriados] = useState<Feriado[]>([]);
  const [jornadas, setJornadas] = useState<JornadaTemplate[]>(DEFAULT_JORNADAS);
  const [avisos, setAvisos] = useState<AvisoEmpresa[]>([]);
  const [config, setConfig] = useState<ConfiguracaoEmpresa>(DEFAULT_CONFIG);
  const [session, setSession] = useState<{ colaboradorId: string; unidadeAtiva: Unidade } | null>(
    () => storage.getSession()
  );
  const [darkMode, setDarkMode] = useState<boolean>(() => storage.getDarkMode());

  const [menuOpen, setMenuOpen] = useState(false);
  const [activeRoute, setActiveRoute] = useState<MenuRoute>(() => parseRouteFromLocation());
  const [carregandoInicial, setCarregandoInicial] = useState(true);
  const [splashVisivel, setSplashVisivel] = useState(true);
  const [splashSaindo, setSplashSaindo] = useState(false);
  const [erroBanco, setErroBanco] = useState<string | null>(null);

  useEffect(() => {
    const fadeTimer = setTimeout(() => setSplashSaindo(true), 1500);
    const hideTimer = setTimeout(() => setSplashVisivel(false), 2000);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(hideTimer);
    };
  }, []);

  const sincronizarNuvem = useCallback(async (ehInicial = false) => {
    try {
      const { snapshot, errorMessage } = await fetchAllCloudData();
      setColaboradores(snapshot.colaboradores);
      setPontos(snapshot.pontos);
      setAtestados(snapshot.atestados);
      setAjustes(snapshot.ajustes);
      setFechamentos(snapshot.fechamentos);
      setFeriados(snapshot.feriados);
      setJornadas(snapshot.jornadas);
      setAvisos(snapshot.avisos);
      setConfig(snapshot.config);
      if (errorMessage) {
        setErroBanco(errorMessage);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao consultar dados no Supabase.';
      setErroBanco(msg);
    } finally {
      if (ehInicial) {
        setCarregandoInicial(false);
      }
    }
  }, []);

  useEffect(() => {
    void sincronizarNuvem(true);
    const unsub = subscribeCloudRealtime(() => {
      void sincronizarNuvem(false);
    });
    const handleOnline = () => {
      void sincronizarNuvem(false);
    };
    window.addEventListener('online', handleOnline);
    return () => {
      unsub();
      window.removeEventListener('online', handleOnline);
    };
  }, [sincronizarNuvem]);

  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    storage.saveDarkMode(darkMode);
  }, [darkMode]);

  const colaboradorAtual = useMemo(() => {
    if (!session) return null;
    return colaboradores.find((c) => c.id === session.colaboradorId && c.ativo) || null;
  }, [session, colaboradores]);

  useEffect(() => {
    if (!carregandoInicial && session && !colaboradorAtual) {
      setSession(null);
      storage.saveSession(null);
    }
  }, [carregandoInicial, session, colaboradorAtual]);

  const isGestorAtual = useMemo(
    () => (colaboradorAtual ? temPermissaoGestao(colaboradorAtual.funcao) : false),
    [colaboradorAtual]
  );

  const navegarParaRota = (rota: MenuRoute) => {
    const rotaDestino: MenuRoute = !isGestorAtual && isRotaRestrita(rota) ? 'ponto' : rota;
    setActiveRoute(rotaDestino);
    if (typeof window !== 'undefined') {
      const targetHash = `#${rotaDestino}`;
      if (window.location.hash !== targetHash) {
        window.history.replaceState(null, '', `/${targetHash}`);
      }
    }
  };

  useEffect(() => {
    const sincronizarRotaUrl = () => {
      const rotaUrl = parseRouteFromLocation();
      if (colaboradorAtual && !isGestorAtual && isRotaRestrita(rotaUrl)) {
        setActiveRoute('ponto');
        window.history.replaceState(null, '', '/#ponto');
        return;
      }
      setActiveRoute(rotaUrl);
    };

    window.addEventListener('hashchange', sincronizarRotaUrl);
    window.addEventListener('popstate', sincronizarRotaUrl);
    return () => {
      window.removeEventListener('hashchange', sincronizarRotaUrl);
      window.removeEventListener('popstate', sincronizarRotaUrl);
    };
  }, [colaboradorAtual, isGestorAtual]);

  useEffect(() => {
    if (!colaboradorAtual) return;
    if (!isGestorAtual && isRotaRestrita(activeRoute)) {
      setActiveRoute('ponto');
      if (typeof window !== 'undefined') {
        window.history.replaceState(null, '', '/#ponto');
      }
    } else if (typeof window !== 'undefined') {
      const targetHash = `#${activeRoute}`;
      if (window.location.hash !== targetHash || window.location.pathname !== '/') {
        window.history.replaceState(null, '', `/${targetHash}`);
      }
    }
  }, [colaboradorAtual, isGestorAtual, activeRoute]);

  const unidadeAtiva: Unidade = useMemo(() => {
    if (!colaboradorAtual) return 'Recife';
    if (colaboradorAtual.lotacao === 'Ambas') {
      return session?.unidadeAtiva || 'Recife';
    }
    return colaboradorAtual.lotacao;
  }, [colaboradorAtual, session]);

  const jornadaAtual = useMemo(() => {
    if (!colaboradorAtual) return jornadas[0];
    return jornadas.find((j) => j.id === colaboradorAtual.jornadaId) || jornadas[0];
  }, [colaboradorAtual, jornadas]);

  const handleLogin = (colab: Colaborador, unidade: Unidade) => {
    const novaSession = { colaboradorId: colab.id, unidadeAtiva: unidade };
    setSession(novaSession);
    storage.saveSession(novaSession);
    setActiveRoute('ponto');
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', '/#ponto');
    }
  };

  const executarGravacao = async (acao: () => Promise<void>): Promise<boolean> => {
    setErroBanco(null);
    try {
      await acao();
      return true;
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Erro desconhecido ao gravar dados no Supabase.';
      setErroBanco(msg);
      return false;
    }
  };

  const handlePrimeiroAcesso = async (novoColab: Colaborador, unidade: Unidade): Promise<boolean> => {
    const ok = await executarGravacao(() => cloudSync.insertColaborador(novoColab));
    if (!ok) return false;
    setColaboradores((prev) => [...prev, novoColab]);
    handleLogin(novoColab, unidade);
    return true;
  };

  const handleLogout = () => {
    setSession(null);
    storage.saveSession(null);
    setMenuOpen(false);
    setActiveRoute('ponto');
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', '/#ponto');
    }
  };

  const handleRegistrarPonto = async (reg: RegistroPonto): Promise<boolean> => {
    const ok = await executarGravacao(() => cloudSync.insertPonto(reg));
    if (!ok) return false;
    setPontos((prev) => [...prev, reg]);
    return true;
  };

  const handleAdicionarAtestado = async (novo: Atestado): Promise<boolean> => {
    const ok = await executarGravacao(() => cloudSync.insertAtestado(novo));
    if (!ok) return false;
    setAtestados((prev) => [novo, ...prev]);
    return true;
  };

  const handleAtualizarAtestado = async (id: string, status: StatusAtestado): Promise<boolean> => {
    const ok = await executarGravacao(() => cloudSync.updateAtestadoStatus(id, status));
    if (!ok) return false;
    setAtestados((prev) => prev.map((a) => (a.id === id ? { ...a, status } : a)));
    return true;
  };

  const handleSalvarAjuste = async (ajuste: AjusteEscala): Promise<boolean> => {
    const ok = await executarGravacao(() => cloudSync.upsertAjuste(ajuste));
    if (!ok) return false;
    setAjustes((prev) => [
      ...prev.filter((a) => !(a.colaboradorId === ajuste.colaboradorId && a.data === ajuste.data)),
      ajuste,
    ]);
    return true;
  };

  const handleRemoverAjuste = async (id: string): Promise<boolean> => {
    const ok = await executarGravacao(() => cloudSync.deleteAjuste(id));
    if (!ok) return false;
    setAjustes((prev) => prev.filter((a) => a.id !== id));
    return true;
  };

  const handleAlternarFechamento = async (
    mes: string,
    unidade: 'Todas' | Unidade
  ): Promise<boolean> => {
    const existe = fechamentos.some((f) => f.mes === mes && f.unidade === unidade);
    const novoFechamento: FechamentoMensal | undefined = existe
      ? undefined
      : {
          mes,
          unidade,
          fechadoEm: new Date().toISOString(),
          fechadoPor: colaboradorAtual?.nome || 'RH',
        };
    const ok = await executarGravacao(() =>
      cloudSync.toggleFechamento(mes, unidade, novoFechamento)
    );
    if (!ok) return false;
    if (existe) {
      setFechamentos((prev) => prev.filter((f) => !(f.mes === mes && f.unidade === unidade)));
    } else if (novoFechamento) {
      setFechamentos((prev) => [...prev, novoFechamento]);
    }
    return true;
  };

  const handleSalvarColaborador = async (colab: Colaborador): Promise<boolean> => {
    const ok = await executarGravacao(() => cloudSync.upsertColaborador(colab));
    if (!ok) return false;
    setColaboradores((prev) => {
      const existe = prev.some((c) => c.id === colab.id);
      return existe ? prev.map((c) => (c.id === colab.id ? colab : c)) : [...prev, colab];
    });
    return true;
  };

  const handleAlternarAtivoColaborador = async (id: string): Promise<boolean> => {
    const atual = colaboradores.find((c) => c.id === id);
    const novoAtivo = atual ? !atual.ativo : false;
    const ok = await executarGravacao(() => cloudSync.toggleColaboradorAtivo(id, novoAtivo));
    if (!ok) return false;
    setColaboradores((prev) => prev.map((c) => (c.id === id ? { ...c, ativo: novoAtivo } : c)));
    return true;
  };

  const handleImportarColaboradores = async (novos: Colaborador[]): Promise<boolean> => {
    const ok = await executarGravacao(() => cloudSync.insertColaboradoresBatch(novos));
    if (!ok) return false;
    setColaboradores((prev) => [...prev, ...novos]);
    return true;
  };

  const handleSalvarConfig = async (cfg: ConfiguracaoEmpresa): Promise<boolean> => {
    const ok = await executarGravacao(() => cloudSync.saveConfig(cfg));
    if (!ok) return false;
    setConfig(cfg);
    return true;
  };

  const handleSalvarFeriados = async (list: Feriado[]): Promise<boolean> => {
    const anteriores = feriados;
    const ok = await executarGravacao(() => cloudSync.syncFeriados(anteriores, list));
    if (!ok) return false;
    setFeriados(list);
    return true;
  };

  const handleAdicionarAviso = async (aviso: AvisoEmpresa): Promise<boolean> => {
    const ok = await executarGravacao(() => cloudSync.insertAviso(aviso));
    if (!ok) return false;
    setAvisos((prev) => [aviso, ...prev]);
    return true;
  };

  const bannerErroSupabase = erroBanco ? (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[60] w-[calc(100%-24px)] max-w-[390px] rounded-xl bg-red-600 text-white px-3 py-2.5 shadow-2xl border border-red-400/50 flex items-start gap-2 text-xs no-print">
      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <div className="font-bold">Erro de Banco de Dados (Supabase)</div>
        <div className="text-[11px] text-red-50 break-words leading-snug mt-0.5">
          {erroBanco}
        </div>
      </div>
      <button
        type="button"
        onClick={() => setErroBanco(null)}
        className="p-1 rounded-md hover:bg-red-700 cursor-pointer shrink-0"
        aria-label="Fechar notificação de erro"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  ) : null;

  const splashOverlay = splashVisivel ? <SplashScreen fadingOut={splashSaindo} /> : null;

  if (carregandoInicial) {
    return (
      <>
        <div className="min-h-screen bg-[#09090B] text-zinc-100 flex flex-col items-center justify-center px-4">
          <BrandLogo />
          <p className="mt-4 text-xs text-zinc-400">Conectando ao Supabase...</p>
        </div>
        {splashOverlay}
      </>
    );
  }

  if (!colaboradorAtual) {
    return (
      <>
        <LoginScreen
          colaboradores={colaboradores}
          defaultUnidade="Recife"
          onLogin={handleLogin}
          onPrimeiroAcesso={handlePrimeiroAcesso}
        />
        {bannerErroSupabase}
        <OfflineIndicator />
        {splashOverlay}
      </>
    );
  }

  const isGestor = isGestorAtual;

  const rotaSegura: MenuRoute =
    !isGestor && isRotaRestrita(activeRoute) ? 'ponto' : activeRoute;

  return (
    <div className="min-h-screen bg-[#121214] text-zinc-100 flex flex-col">
      {/* Cabeçalho Superior (#09090B) */}
      <header className="sticky top-0 z-30 bg-[#09090B] border-b border-zinc-800/80 no-print">
        <div className="w-full max-w-[410px] mx-auto px-3 py-2.5 grid grid-cols-[40px_1fr_40px] items-center">
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            className="p-2 -ml-1.5 rounded-lg text-zinc-200 hover:bg-zinc-800 cursor-pointer min-h-[40px] min-w-[40px] flex items-center justify-center"
            aria-label="Abrir menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          <button
            type="button"
            onClick={() => navegarParaRota('ponto')}
            className="cursor-pointer flex items-center justify-center"
          >
            <BrandLogo />
          </button>

          <div aria-hidden="true" />
        </div>
      </header>

      {/* Conteúdo Principal Compacto (max-w-[410px]) */}
      <main className="flex-1 w-full max-w-[410px] mx-auto px-3 py-3 overflow-x-hidden print-only-full">
        {rotaSegura === 'ponto' && (
          <PontoView
            colaborador={colaboradorAtual}
            unidadeAtiva={unidadeAtiva}
            pontos={pontos}
            jornada={jornadaAtual}
            ajustes={ajustes}
            feriados={feriados}
            atestados={atestados}
            config={config}
            onRegistrarPonto={handleRegistrarPonto}
          />
        )}

        {rotaSegura === 'espelho' && (
          <EspelhoView
            colaborador={colaboradorAtual}
            unidadeAtiva={unidadeAtiva}
            pontos={pontos}
            jornada={jornadaAtual}
            ajustes={ajustes}
            feriados={feriados}
            atestados={atestados}
            config={config}
          />
        )}

        {rotaSegura === 'jornadas' && (
          <JornadasView colaborador={colaboradorAtual} jornada={jornadaAtual} />
        )}

        {rotaSegura === 'escalas' && (
          <EscalasView
            colaborador={colaboradorAtual}
            unidadeAtiva={unidadeAtiva}
            pontos={pontos}
            jornada={jornadaAtual}
            ajustes={ajustes}
            feriados={feriados}
            atestados={atestados}
            config={config}
          />
        )}

        {rotaSegura === 'horas-extras' && (
          <HorasExtrasView
            colaborador={colaboradorAtual}
            unidadeAtiva={unidadeAtiva}
            pontos={pontos}
            jornada={jornadaAtual}
            ajustes={ajustes}
            feriados={feriados}
            atestados={atestados}
            fechamentos={fechamentos}
            config={config}
          />
        )}

        {rotaSegura === 'banco-horas' && (
          <BancoHorasView
            colaborador={colaboradorAtual}
            unidadeAtiva={unidadeAtiva}
            pontos={pontos}
            jornada={jornadaAtual}
            ajustes={ajustes}
            feriados={feriados}
            atestados={atestados}
            fechamentos={fechamentos}
            config={config}
          />
        )}

        {rotaSegura === 'holerite' && (
          <HoleriteView
            colaborador={colaboradorAtual}
            unidadeAtiva={unidadeAtiva}
            pontos={pontos}
            jornada={jornadaAtual}
            ajustes={ajustes}
            feriados={feriados}
            atestados={atestados}
            config={config}
          />
        )}

        {rotaSegura === 'atestados' && (
          <AtestadosView
            colaborador={colaboradorAtual}
            atestados={atestados}
            onAdicionarAtestado={handleAdicionarAtestado}
          />
        )}

        {rotaSegura === 'informacoes' && (
          <InformacoesView
            colaborador={colaboradorAtual}
            unidadeAtiva={unidadeAtiva}
            avisos={avisos}
            onAdicionarAviso={handleAdicionarAviso}
          />
        )}

        {rotaSegura === 'rh-fechamento' && isGestor && (
          <FechamentoView
            colaboradorAtual={colaboradorAtual}
            colaboradores={colaboradores}
            unidadeAtiva={unidadeAtiva}
            pontos={pontos}
            jornadas={jornadas}
            ajustes={ajustes}
            feriados={feriados}
            atestados={atestados}
            fechamentos={fechamentos}
            config={config}
            onAtualizarAtestado={handleAtualizarAtestado}
            onSalvarAjuste={handleSalvarAjuste}
            onRemoverAjuste={handleRemoverAjuste}
            onAlternarFechamento={handleAlternarFechamento}
          />
        )}

        {rotaSegura === 'rh-relatorio' && isGestor && (
          <RelatorioView
            colaboradorAtual={colaboradorAtual}
            colaboradores={colaboradores}
            unidadeAtiva={unidadeAtiva}
            pontos={pontos}
            jornadas={jornadas}
            ajustes={ajustes}
            feriados={feriados}
            atestados={atestados}
            fechamentos={fechamentos}
            config={config}
          />
        )}

        {rotaSegura === 'rh-retribuicao' && isGestor && (
          <RetribuicaoView
            colaboradorAtual={colaboradorAtual}
            colaboradores={colaboradores}
            unidadeAtiva={unidadeAtiva}
            pontos={pontos}
            jornadas={jornadas}
            ajustes={ajustes}
            feriados={feriados}
            atestados={atestados}
            fechamentos={fechamentos}
            config={config}
          />
        )}

        {rotaSegura === 'sys-colaboradores' && isGestor && (
          <ColaboradoresCrudView
            colaboradores={colaboradores}
            jornadas={jornadas}
            onSalvarColaborador={handleSalvarColaborador}
            onAlternarAtivo={handleAlternarAtivoColaborador}
          />
        )}

        {rotaSegura === 'sys-empresa' && isGestor && (
          <CadastroEmpresaView config={config} onSalvarConfig={handleSalvarConfig} />
        )}

        {rotaSegura === 'sys-configuracoes' && isGestor && (
          <ConfiguracoesView
            config={config}
            feriados={feriados}
            onSalvarConfig={handleSalvarConfig}
            onSalvarFeriados={handleSalvarFeriados}
          />
        )}

        {rotaSegura === 'sys-localizacao' && isGestor && (
          <LocalizacaoView config={config} onSalvarConfig={handleSalvarConfig} />
        )}

        {rotaSegura === 'sys-importar' && isGestor && (
          <ImportarNotificacoesView
            colaboradores={colaboradores}
            config={config}
            onImportarColaboradores={handleImportarColaboradores}
            onSalvarConfig={handleSalvarConfig}
          />
        )}
      </main>

      <SidebarMenu
        isOpen={menuOpen}
        onClose={() => setMenuOpen(false)}
        activeRoute={rotaSegura}
        onNavigate={navegarParaRota}
        colaborador={colaboradorAtual}
        darkMode={darkMode}
        onToggleDarkMode={() => setDarkMode((v) => !v)}
        onLogout={handleLogout}
      />

      {bannerErroSupabase}
      <OfflineIndicator />
      {splashOverlay}
    </div>
  );
}
