import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  Clock,
  Fingerprint,
  Lock,
  MapPin,
  Printer,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  X,
} from 'lucide-react';
import {
  AjusteEscala,
  Atestado,
  Colaborador,
  ConfiguracaoEmpresa,
  Feriado,
  JornadaTemplate,
  RegistroPonto,
  TipoMarcacao,
  Unidade,
  getDadosEmpresaUnidade,
} from '../../types/rh';
import { haversineDistanceMeters, sha256Hex } from '../../services/storage';
import {
  fetchOfficialRecifeClock,
  formatRecifeDateTimeBR,
  getEstimatedRecifeClock,
  syncOfficialRecifeOffset,
} from '../../services/serverTime';
import {
  calcularDiaPonto,
  calcularEspelhoMensal,
  formatBRL,
  formatDateBR,
  formatMinutesToHHMM,
} from '../../utils/cltCalculations';
import { SelfieCaptureModal } from '../SelfieCaptureModal';
import { MapaIndividualColaboradorLeaflet } from '../MapaIndividualColaboradorLeaflet';

interface PontoViewProps {
  colaborador: Colaborador;
  unidadeAtiva: Unidade;
  pontos: RegistroPonto[];
  jornada: JornadaTemplate;
  ajustes: AjusteEscala[];
  feriados: Feriado[];
  atestados: Atestado[];
  config: ConfiguracaoEmpresa;
  onRegistrarPonto: (registro: RegistroPonto) => Promise<RegistroPonto | null>;
}

const ORDEM_MARCACOES: { tipo: TipoMarcacao; sigla: 'E1' | 'S1' | 'E2' | 'S2'; label: string }[] = [
  { tipo: 'entrada', sigla: 'E1', label: 'Entrada' },
  { tipo: 'saida_almoco', sigla: 'S1', label: 'Saída Almoço' },
  { tipo: 'retorno_almoco', sigla: 'E2', label: 'Retorno Almoço' },
  { tipo: 'saida', sigla: 'S2', label: 'Saída' },
];

export const PontoView: React.FC<PontoViewProps> = ({
  colaborador,
  unidadeAtiva,
  pontos,
  jornada,
  ajustes,
  feriados,
  atestados,
  config,
  onRegistrarPonto,
}) => {
  const [selfieVisualizacao, setSelfieVisualizacao] = useState<{
    label: string;
    hora: string;
    unidade: Unidade;
    src: string;
  } | null>(null);
  const [serverClock, setServerClock] = useState(() => getEstimatedRecifeClock());
  const [gpsStatus, setGpsStatus] = useState<
    'verificando' | 'verificada' | 'fora_raio' | 'indisponivel'
  >('verificando');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [distancia, setDistancia] = useState<number | null>(null);
  const [unidadeGps, setUnidadeGps] = useState<Unidade>(
    colaborador.lotacao === 'Ambas' ? unidadeAtiva : colaborador.lotacao
  );
  const [raioPermitido, setRaioPermitido] = useState<number>(
    colaborador.lotacao === 'Ambas'
      ? config.localizacoes[unidadeAtiva].raioMetros
      : config.localizacoes[colaborador.lotacao].raioMetros
  );
  const [selfieModalAberto, setSelfieModalAberto] = useState(false);
  const [registrando, setRegistrando] = useState(false);
  const [comprovanteAtivo, setComprovanteAtivo] = useState<RegistroPonto | null>(null);

  // Sincronização contínua do relógio oficial America/Recife (imune ao relógio do telemóvel)
  useEffect(() => {
    void syncOfficialRecifeOffset(true).then(() => {
      setServerClock(getEstimatedRecifeClock());
    });

    const tickId = setInterval(() => {
      setServerClock(getEstimatedRecifeClock());
    }, 1000);

    const resyncId = setInterval(() => {
      void syncOfficialRecifeOffset(true).then(() => {
        setServerClock(getEstimatedRecifeClock());
      });
    }, 30000);

    return () => {
      clearInterval(tickId);
      clearInterval(resyncId);
    };
  }, []);

  const avaliarPosicaoGPS = useCallback(
    (lat: number, lng: number) => {
      setCoords({ lat, lng });

      if (colaborador.lotacao === 'Ambas') {
        const locRec = config.localizacoes.Recife;
        const locJab = config.localizacoes['Jaboatão'];
        const distRec = haversineDistanceMeters(lat, lng, locRec.latitude, locRec.longitude);
        const distJab = haversineDistanceMeters(lat, lng, locJab.latitude, locJab.longitude);
        const dentroRec = distRec <= locRec.raioMetros;
        const dentroJab = distJab <= locJab.raioMetros;

        if (dentroRec && (!dentroJab || distRec <= distJab)) {
          setDistancia(distRec);
          setUnidadeGps('Recife');
          setRaioPermitido(locRec.raioMetros);
          setGpsStatus('verificada');
          return { permitido: true, unidade: 'Recife' as Unidade, dist: distRec };
        }
        if (dentroJab) {
          setDistancia(distJab);
          setUnidadeGps('Jaboatão');
          setRaioPermitido(locJab.raioMetros);
          setGpsStatus('verificada');
          return { permitido: true, unidade: 'Jaboatão' as Unidade, dist: distJab };
        }

        const maisProxima = distRec <= distJab ? locRec : locJab;
        const distMin = Math.min(distRec, distJab);
        setDistancia(distMin);
        setUnidadeGps(maisProxima.unidade);
        setRaioPermitido(maisProxima.raioMetros);
        setGpsStatus('fora_raio');
        return { permitido: false, unidade: maisProxima.unidade, dist: distMin };
      }

      const locUnidade = config.localizacoes[colaborador.lotacao];
      const dist = haversineDistanceMeters(lat, lng, locUnidade.latitude, locUnidade.longitude);
      setDistancia(dist);
      setUnidadeGps(colaborador.lotacao);
      setRaioPermitido(locUnidade.raioMetros);
      const permitido = dist <= locUnidade.raioMetros;
      setGpsStatus(permitido ? 'verificada' : 'fora_raio');
      return { permitido, unidade: colaborador.lotacao, dist };
    },
    [colaborador.lotacao, config.localizacoes]
  );

  const verificarGPS = useCallback(
    (forceFresh = false): Promise<boolean> => {
      setGpsStatus('verificando');

      if (!navigator.geolocation) {
        setGpsStatus('indisponivel');
        setCoords(null);
        setDistancia(null);
        return Promise.resolve(false);
      }

      return new Promise((resolve) => {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const res = avaliarPosicaoGPS(pos.coords.latitude, pos.coords.longitude);
            resolve(res.permitido);
          },
          () => {
            setGpsStatus('indisponivel');
            setCoords(null);
            setDistancia(null);
            resolve(false);
          },
          {
            enableHighAccuracy: true,
            timeout: 8000,
            maximumAge: forceFresh ? 0 : 10000,
          }
        );
      });
    },
    [avaliarPosicaoGPS]
  );

  useEffect(() => {
    void verificarGPS(true);
    let watchId: number | null = null;
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          avaliarPosicaoGPS(pos.coords.latitude, pos.coords.longitude);
        },
        () => {
          // Fallback tratado pela checagem periódica verificarGPS
        },
        {
          enableHighAccuracy: true,
          maximumAge: 5000,
          timeout: 10000,
        }
      );
    }
    const gpsPoll = setInterval(() => {
      void verificarGPS(false);
    }, 20000);
    return () => {
      if (watchId !== null && typeof navigator !== 'undefined' && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchId);
      }
      clearInterval(gpsPoll);
    };
  }, [verificarGPS, avaliarPosicaoGPS]);

  const hojeStr = serverClock.data;
  const mesAtual = serverClock.data.slice(0, 7);

  const pontosHoje = useMemo(
    () =>
      pontos
        .filter((p) => p.colaboradorId === colaborador.id && p.data === hojeStr)
        .sort((a, b) => a.hora.localeCompare(b.hora)),
    [pontos, colaborador.id, hojeStr]
  );

  const mapaHoje = useMemo(() => {
    const map: Partial<Record<TipoMarcacao, RegistroPonto>> = {};
    for (const p of pontosHoje) {
      map[p.tipo] = p;
    }
    return map;
  }, [pontosHoje]);

  const proximaMarcacao = useMemo(() => {
    return ORDEM_MARCACOES.find((m) => !mapaHoje[m.tipo]) || null;
  }, [mapaHoje]);

  const diaHojeCalculado = useMemo(() => {
    const ajusteHoje = ajustes.find(
      (a) => a.colaboradorId === colaborador.id && a.data === hojeStr
    );
    const atestadosAprov = atestados.filter(
      (a) => a.colaboradorId === colaborador.id && a.status === 'Aprovado'
    );
    return calcularDiaPonto(
      colaborador,
      hojeStr,
      jornada,
      pontosHoje,
      ajusteHoje,
      feriados,
      atestadosAprov,
      config,
      unidadeAtiva,
      serverClock.dateObj
    );
  }, [
    colaborador,
    hojeStr,
    jornada,
    pontosHoje,
    ajustes,
    feriados,
    atestados,
    config,
    unidadeAtiva,
    serverClock.dateObj,
  ]);

  const resumoMes = useMemo(
    () =>
      calcularEspelhoMensal(
        colaborador,
        mesAtual,
        jornada,
        pontos,
        ajustes,
        feriados,
        atestados,
        config,
        unidadeAtiva
      ),
    [colaborador, mesAtual, jornada, pontos, ajustes, feriados, atestados, config, unidadeAtiva]
  );

  const horasTrabalhadasHojeMin = useMemo(() => {
    if (diaHojeCalculado.minutosTrabalhados > 0) return diaHojeCalculado.minutosTrabalhados;
    const ent = mapaHoje.entrada;
    if (ent && !mapaHoje.saida) {
      const [h, m] = ent.hora.split(':').map(Number);
      const entMin = h * 60 + m;
      const [nh, nm] = serverClock.hora.split(':').map(Number);
      const nowMin = nh * 60 + nm;
      if (mapaHoje.saida_almoco && !mapaHoje.retorno_almoco) {
        const [ha, ma] = mapaHoje.saida_almoco.hora.split(':').map(Number);
        return Math.max(0, ha * 60 + ma - entMin);
      }
      if (mapaHoje.saida_almoco && mapaHoje.retorno_almoco) {
        const [ha, ma] = mapaHoje.saida_almoco.hora.split(':').map(Number);
        const [hr, mr] = mapaHoje.retorno_almoco.hora.split(':').map(Number);
        return Math.max(0, ha * 60 + ma - entMin + (nowMin - (hr * 60 + mr)));
      }
      return Math.max(0, nowMin - entMin);
    }
    return 0;
  }, [diaHojeCalculado.minutosTrabalhados, mapaHoje, serverClock.hora]);

  const horasExtrasMesMin = resumoMes.totalMinExtrasGeral;
  const vtMesAcumulado = resumoMes.diasTrabalhados * colaborador.vtDiario;
  const vaMesAcumulado = resumoMes.diasTrabalhados * colaborador.vaDiario;

  const horaFormatada = serverClock.hora;
  const dataExtenso = serverClock.dateObj.toLocaleDateString('pt-BR', {
    timeZone: 'America/Recife',
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  const gpsBloqueado = gpsStatus !== 'verificada';

  const handleIniciarBatida = async () => {
    if (!proximaMarcacao || registrando || gpsBloqueado) return;
    setRegistrando(true);
    try {
      const aindaDentro = await verificarGPS(true);
      if (!aindaDentro) return;
      setSelfieModalAberto(true);
    } finally {
      setRegistrando(false);
    }
  };

  const handleConfirmarBatidaComSelfie = async (selfieDataUrl: string) => {
    if (!proximaMarcacao || registrando || gpsStatus !== 'verificada') return;
    setRegistrando(true);
    try {
      const oficial = await fetchOfficialRecifeClock();
      const unidadePunch: Unidade =
        colaborador.lotacao === 'Ambas' ? unidadeGps : colaborador.lotacao;
      const empresaPunch = getDadosEmpresaUnidade(config, unidadePunch);
      const nsr = Math.floor(oficial.dateObj.getTime() / 1000) % 1000000;
      const payload = `${nsr}|${empresaPunch.cnpj || config.cnpj}|${colaborador.id}|${oficial.data}|${oficial.hora}|${unidadePunch}|${proximaMarcacao.tipo}|GPS:${coords?.lat.toFixed(5)},${coords?.lng.toFixed(5)}`;
      const hashComprovante = await sha256Hex(payload);

      const novo: RegistroPonto = {
        id: `pt-${Date.now()}`,
        nsr,
        colaboradorId: colaborador.id,
        unidade: unidadePunch,
        data: oficial.data,
        hora: oficial.hora,
        timestamp: oficial.iso,
        tipo: proximaMarcacao.tipo,
        latitude: coords?.lat ?? null,
        longitude: coords?.lng ?? null,
        distanciaMetros: distancia,
        localizacaoVerificada: true,
        selfieDataUrl,
        origemRegistro: 'colaborador_gps',
        hashComprovante,
      };

      const gravado = await onRegistrarPonto(novo);
      if (gravado) {
        setSelfieModalAberto(false);
        setComprovanteAtivo(gravado);
      }
    } finally {
      setRegistrando(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* Cartão Principal: Relógio Oficial + Cerca GPS + Botão REGISTRAR PONTO */}
      <section className="bg-white dark:bg-[#1C1C20] text-[#111827] dark:text-zinc-100 rounded-xl p-3 md:p-4 shadow-sm border border-zinc-200/80 dark:border-zinc-800">
        <div className="flex items-start justify-between gap-2 mb-2.5">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 truncate">
              {dataExtenso}
            </p>
            <h1 className="text-sm font-bold text-[#111827] dark:text-white truncate">
              Olá, {colaborador.nome.split(' ')[0]}
            </h1>
          </div>
          <div className="text-right shrink-0">
            <div className="font-mono tabular-nums text-xl font-bold tracking-tight text-[#111827] dark:text-white leading-none">
              {horaFormatada}
            </div>
            <div className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-0.5">
              Horário Oficial · America/Recife
            </div>
            <div className="mt-1 inline-block px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-[11px] font-semibold text-zinc-700 dark:text-zinc-200">
              Lotação: {colaborador.lotacao}
            </div>
          </div>
        </div>

        {/* Status Cerca Eletrônica GPS */}
        <div
          className={`flex items-center justify-between gap-2 py-2 px-2.5 rounded-lg border mb-2.5 ${
            gpsStatus === 'verificada'
              ? 'bg-emerald-50/70 dark:bg-emerald-950/25 border-emerald-200 dark:border-emerald-900/60'
              : gpsStatus === 'verificando'
                ? 'bg-zinc-50 dark:bg-zinc-900/90 border-zinc-200/70 dark:border-zinc-800'
                : 'bg-red-50 dark:bg-red-950/40 border-red-300 dark:border-red-900/80'
          }`}
        >
          <div className="flex items-center gap-1.5 min-w-0">
            {gpsStatus === 'verificada' ? (
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : gpsStatus === 'verificando' ? (
              <MapPin className="w-4 h-4 text-zinc-400 shrink-0" />
            ) : (
              <ShieldAlert className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />
            )}
            <span className="text-xs font-medium truncate">
              {gpsStatus === 'verificada' &&
                `Dentro do raio (${distancia ?? 0}m / máx. ${raioPermitido}m · Loja ${unidadeGps})`}
              {gpsStatus === 'verificando' && 'Verificando cerca eletrónica GPS...'}
              {gpsStatus === 'fora_raio' &&
                `Fora do perímetro da loja ${unidadeGps} (${distancia ?? 0}m · máx. ${raioPermitido}m)`}
              {gpsStatus === 'indisponivel' && 'GPS desativado ou sem permissão no navegador'}
            </span>
          </div>
          <button
            type="button"
            onClick={() => void verificarGPS(true)}
            className="p-1 rounded-md text-zinc-500 hover:text-[#111827] dark:hover:text-white hover:bg-zinc-200/70 dark:hover:bg-zinc-800 cursor-pointer shrink-0"
            title="Atualizar GPS"
            aria-label="Atualizar GPS"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Alerta Vermelho Obrigatório de Bloqueio Antifraude */}
        {(gpsStatus === 'fora_raio' || gpsStatus === 'indisponivel') && (
          <div className="mb-3 p-2.5 rounded-lg bg-red-600 text-white text-xs font-semibold flex items-start gap-2 shadow-sm">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <p className="leading-snug">
              {gpsStatus === 'fora_raio'
                ? `Acesso bloqueado: Você está a ${distancia ?? 0}m da unidade ${unidadeGps}. É obrigatório estar dentro da loja para registar o ponto.`
                : 'Acesso bloqueado: O GPS do dispositivo está desativado ou sem permissão no navegador. É obrigatório estar dentro da loja para registar o ponto.'}
            </p>
          </div>
        )}

        {/* Botão Principal REGISTRAR PONTO (Bloqueado fora do GPS) */}
        {proximaMarcacao ? (
          <button
            type="button"
            onClick={() => void handleIniciarBatida()}
            disabled={registrando || gpsBloqueado}
            className={`w-full py-3 px-4 rounded-xl font-bold text-sm tracking-wide flex items-center justify-center gap-2 transition-all shadow-sm min-h-[48px] ${
              gpsBloqueado
                ? 'bg-zinc-300 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-500 cursor-not-allowed'
                : 'bg-[#DC2626] hover:bg-red-700 active:scale-[0.99] text-white cursor-pointer'
            } disabled:opacity-75`}
          >
            {gpsBloqueado ? (
              <Lock className="w-4 h-4 shrink-0" />
            ) : (
              <Fingerprint className="w-5 h-5 shrink-0" />
            )}
            <span>
              {registrando
                ? 'VALIDANDO...'
                : gpsStatus === 'verificando'
                  ? 'AGUARDANDO GPS...'
                  : gpsBloqueado
                    ? 'PONTO BLOQUEADO FORA DA LOJA'
                    : `REGISTRAR PONTO · ${proximaMarcacao.label.toUpperCase()}`}
            </span>
          </button>
        ) : (
          <div className="w-full py-2.5 px-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 text-emerald-800 dark:text-emerald-300 text-xs font-semibold flex items-center justify-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>Todas as marcações de hoje foram registradas</span>
          </div>
        )}
      </section>

      {/* Visão Individual Exclusiva: Minhas Marcações e Localização Hoje */}
      <section className="bg-white dark:bg-[#1C1C20] text-[#111827] dark:text-zinc-100 rounded-xl p-3 md:p-4 shadow-sm border border-zinc-200/80 dark:border-zinc-800 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <h2 className="text-xs sm:text-sm font-bold text-[#111827] dark:text-white truncate">
              Minhas Marcações e Localização Hoje
            </h2>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/40 text-emerald-700 dark:text-emerald-400 text-[10px] font-bold shrink-0">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
              </span>
              Ao vivo
            </span>
          </div>
          <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
            {formatDateBR(hojeStr)} · Portaria MTP 671/2021
          </span>
        </div>

        <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {ORDEM_MARCACOES.map((item) => {
            const reg = mapaHoje[item.tipo];
            const isNext = proximaMarcacao?.tipo === item.tipo;
            const statusReg = reg
              ? reg.origemRegistro === 'manual_gestor'
                ? 'Manual · Gestão'
                : reg.localizacaoVerificada
                  ? 'Confirmada'
                  : 'Fora do local'
              : null;

            return (
              <div key={item.tipo} className="py-2.5 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                      reg
                        ? 'bg-[#DC2626] text-white'
                        : isNext
                          ? 'border-2 border-[#DC2626] text-[#DC2626]'
                          : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400'
                    }`}
                  >
                    {item.sigla}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-semibold truncate">{item.label}</span>
                      {statusReg && (
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            statusReg === 'Confirmada'
                              ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                              : statusReg === 'Manual · Gestão'
                                ? 'bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200'
                                : 'bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300'
                          }`}
                        >
                          {statusReg}
                        </span>
                      )}
                    </div>
                    {reg ? (
                      <div className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
                        Loja {reg.unidade} ·{' '}
                        {reg.origemRegistro === 'manual_gestor'
                          ? `Lançado por ${reg.registradoPor || 'Gestão'}`
                          : reg.localizacaoVerificada
                            ? `GPS ${reg.distanciaMetros ?? 0}m`
                            : 'GPS fora do perímetro'}
                      </div>
                    ) : (
                      <div className="text-[11px] text-zinc-400 dark:text-zinc-500">
                        {isNext ? 'Próxima marcação prevista' : 'Aguardando registro'}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {reg?.selfieDataUrl && (
                    <button
                      type="button"
                      onClick={() =>
                        setSelfieVisualizacao({
                          label: `${item.sigla} · ${item.label}`,
                          hora: reg.hora.slice(0, 5),
                          unidade: reg.unidade,
                          src: reg.selfieDataUrl!,
                        })
                      }
                      className="w-8 h-8 rounded-lg overflow-hidden border border-zinc-200 dark:border-zinc-700 hover:opacity-90 cursor-pointer shrink-0"
                      title="Ver selfie capturada"
                      aria-label={`Ver selfie de ${item.label}`}
                    >
                      <img
                        src={reg.selfieDataUrl}
                        alt={`Selfie ${item.label}`}
                        className="w-full h-full object-cover"
                      />
                    </button>
                  )}
                  <span
                    className={`font-mono tabular-nums text-xs font-semibold ${
                      reg ? 'text-[#111827] dark:text-white' : 'text-zinc-400'
                    }`}
                  >
                    {reg ? reg.hora.slice(0, 5) : '—:—'}
                  </span>
                  {reg && (
                    <button
                      type="button"
                      onClick={() => setComprovanteAtivo(reg)}
                      className="text-[11px] font-semibold text-[#DC2626] hover:underline cursor-pointer"
                    >
                      Recibo
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Mapa Individual em Tempo Real (GPS atual + Loja(s) da lotação + Batidas próprias de hoje) */}
        <MapaIndividualColaboradorLeaflet
          colaborador={colaborador}
          coords={coords}
          gpsStatus={gpsStatus}
          distanciaAtual={distancia}
          pontosHoje={pontosHoje}
          config={config}
        />
      </section>

      {/* Grade responsiva dos 4 mini-cartões */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        <div className="bg-white dark:bg-[#1C1C20] text-[#111827] dark:text-zinc-100 rounded-xl p-3 shadow-sm border border-zinc-200/80 dark:border-zinc-800">
          <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400 mb-1">
            <span className="text-[11px] font-semibold truncate">Horas trabalhadas</span>
            <Clock className="w-3.5 h-3.5 shrink-0 text-[#DC2626]" />
          </div>
          <div className="font-mono tabular-nums text-base font-bold">
            {formatMinutesToHHMM(horasTrabalhadasHojeMin)}
          </div>
          <div className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
            Mês: {formatMinutesToHHMM(resumoMes.totalMinTrabalhados)}
          </div>
        </div>

        <div className="bg-white dark:bg-[#1C1C20] text-[#111827] dark:text-zinc-100 rounded-xl p-3 shadow-sm border border-zinc-200/80 dark:border-zinc-800">
          <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400 mb-1">
            <span className="text-[11px] font-semibold truncate">Horas extras</span>
            <Fingerprint className="w-3.5 h-3.5 shrink-0 text-[#DC2626]" />
          </div>
          <div className="font-mono tabular-nums text-base font-bold">
            {formatMinutesToHHMM(horasExtrasMesMin)}
          </div>
          <div className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
            Liquidação mensal
          </div>
        </div>

        <div className="bg-white dark:bg-[#1C1C20] text-[#111827] dark:text-zinc-100 rounded-xl p-3 shadow-sm border border-zinc-200/80 dark:border-zinc-800">
          <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400 mb-1">
            <span className="text-[11px] font-semibold truncate">Vale-transporte</span>
          </div>
          <div className="font-mono tabular-nums text-base font-bold">
            {formatBRL(vtMesAcumulado)}
          </div>
          <div className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
            {formatBRL(colaborador.vtDiario)}/dia · {resumoMes.diasTrabalhados}d
          </div>
        </div>

        <div className="bg-white dark:bg-[#1C1C20] text-[#111827] dark:text-zinc-100 rounded-xl p-3 shadow-sm border border-zinc-200/80 dark:border-zinc-800">
          <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400 mb-1">
            <span className="text-[11px] font-semibold truncate">Vale-alimentação</span>
          </div>
          <div className="font-mono tabular-nums text-base font-bold">
            {formatBRL(vaMesAcumulado)}
          </div>
          <div className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
            {formatBRL(colaborador.vaDiario)}/dia · {resumoMes.diasTrabalhados}d
          </div>
        </div>
      </section>

      {/* Modal Obrigatório de Selfie Antifraude */}
      <SelfieCaptureModal
        isOpen={selfieModalAberto}
        unidade={colaborador.lotacao === 'Ambas' ? unidadeGps : colaborador.lotacao}
        tipoLabel={proximaMarcacao?.label || 'Ponto'}
        distanciaMetros={distancia}
        salvando={registrando}
        onCancel={() => setSelfieModalAberto(false)}
        onConfirm={handleConfirmarBatidaComSelfie}
      />

      {/* Modal Comprovante Eletrônico Portaria MTP 671/2021 */}
      {comprovanteAtivo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3">
          <div className="w-full max-w-[390px] max-h-[92vh] overflow-y-auto rounded-xl bg-white dark:bg-[#1C1C20] text-[#111827] dark:text-zinc-100 p-4 shadow-2xl border border-zinc-200 dark:border-zinc-800 print-card">
            <div className="flex items-center justify-between mb-2 no-print">
              <h3 className="text-sm font-bold">Comprovante Eletrônico</h3>
              <button
                type="button"
                onClick={() => setComprovanteAtivo(null)}
                className="p-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
                aria-label="Fechar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {(() => {
              const empresaRecibo = getDadosEmpresaUnidade(config, comprovanteAtivo.unidade);
              const enderecoRecibo = [
                empresaRecibo.logradouro &&
                  `${empresaRecibo.logradouro}${empresaRecibo.numero ? `, ${empresaRecibo.numero}` : ''}`,
                empresaRecibo.complemento,
                empresaRecibo.bairro,
                empresaRecibo.cidade &&
                  `${empresaRecibo.cidade}${empresaRecibo.uf ? `/${empresaRecibo.uf}` : ''}`,
                empresaRecibo.cep && `CEP ${empresaRecibo.cep}`,
              ]
                .filter(Boolean)
                .join(' · ');

              return (
                <div className="rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-dashed border-zinc-300 dark:border-zinc-700 p-3 text-xs space-y-1.5 font-mono">
                  <div className="text-center font-bold text-[11px] uppercase border-b border-dashed border-zinc-300 dark:border-zinc-700 pb-1.5">
                    Comprovante de Registro de Ponto
                    <br />
                    Portaria MTP nº 671/2021
                  </div>

                  {comprovanteAtivo.selfieDataUrl && (
                    <div className="flex items-center gap-2.5 py-1.5 border-b border-dashed border-zinc-300 dark:border-zinc-700">
                      <img
                        src={comprovanteAtivo.selfieDataUrl}
                        alt="Selfie de auditoria"
                        className="w-14 h-14 rounded-lg object-cover border border-zinc-300 dark:border-zinc-700 shrink-0"
                      />
                      <div className="text-[10px] text-zinc-600 dark:text-zinc-300 leading-tight">
                        <div className="font-bold flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
                          <Camera className="w-3 h-3" />
                          <span>Validação Visual Confirmada</span>
                        </div>
                        <div className="mt-0.5">
                          Anexada para auditoria de presença (anti-empréstimo).
                        </div>
                      </div>
                    </div>
                  )}

                  <div>
                    <span className="text-zinc-500">Empregador:</span> {empresaRecibo.razaoSocial}
                  </div>
                  {empresaRecibo.nomeFantasia && (
                    <div>
                      <span className="text-zinc-500">Fantasia:</span> {empresaRecibo.nomeFantasia}
                    </div>
                  )}
                  <div>
                    <span className="text-zinc-500">CNPJ:</span> {empresaRecibo.cnpj}
                    {empresaRecibo.inscricaoEstadual
                      ? ` · IE: ${empresaRecibo.inscricaoEstadual}`
                      : ''}
                  </div>
                  {enderecoRecibo && (
                    <div>
                      <span className="text-zinc-500">Local:</span> {enderecoRecibo}
                    </div>
                  )}
                  <div>
                    <span className="text-zinc-500">Unidade do Registo:</span>{' '}
                    {comprovanteAtivo.unidade} (Lotação: {colaborador.lotacao})
                  </div>
                  <div>
                    <span className="text-zinc-500">Colaborador:</span> {colaborador.nome}
                  </div>
                  {colaborador.cpf && (
                    <div>
                      <span className="text-zinc-500">CPF:</span> {colaborador.cpf}
                    </div>
                  )}
                  <div className="pt-1 border-t border-dashed border-zinc-300 dark:border-zinc-700 flex justify-between">
                    <span>NSR: #{comprovanteAtivo.nsr}</span>
                    <span>
                      {formatDateBR(comprovanteAtivo.data)} {comprovanteAtivo.hora}
                    </span>
                  </div>
                  {comprovanteAtivo.criadoEmServidor && (
                    <div className="text-[10px] text-zinc-600 dark:text-zinc-400">
                      <span className="text-zinc-500">Servidor (America/Recife):</span>{' '}
                      {formatRecifeDateTimeBR(comprovanteAtivo.criadoEmServidor)}
                    </div>
                  )}
                  <div>
                    <span className="text-zinc-500">Tipo:</span>{' '}
                    {ORDEM_MARCACOES.find((m) => m.tipo === comprovanteAtivo.tipo)?.label}
                  </div>
                  <div>
                    <span className="text-zinc-500">GPS:</span>{' '}
                    {comprovanteAtivo.latitude !== null
                      ? `${comprovanteAtivo.latitude.toFixed(5)}, ${comprovanteAtivo.longitude?.toFixed(5)} (${comprovanteAtivo.distanciaMetros ?? 0}m)`
                      : comprovanteAtivo.origemRegistro === 'manual_gestor'
                        ? 'Lançamento / Deslocamento via Gestão'
                        : 'Não informado'}
                  </div>
                  {comprovanteAtivo.registradoPor && (
                    <div>
                      <span className="text-zinc-500">Registrado por:</span>{' '}
                      {comprovanteAtivo.registradoPor}
                    </div>
                  )}
                  {comprovanteAtivo.justificativaDeslocamento && (
                    <div>
                      <span className="text-zinc-500">Justificativa:</span>{' '}
                      {comprovanteAtivo.justificativaDeslocamento}
                    </div>
                  )}
                  <div className="break-all text-[10px] text-zinc-500 pt-1">
                    SHA-256: {comprovanteAtivo.hashComprovante}
                  </div>
                </div>
              );
            })()}

            <div className="mt-3 flex gap-2 no-print">
              <button
                type="button"
                onClick={() => window.print()}
                className="flex-1 py-2 px-3 rounded-lg bg-zinc-900 dark:bg-zinc-800 text-white text-xs font-semibold flex items-center justify-center gap-1.5 hover:bg-zinc-800 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Imprimir / PDF</span>
              </button>
              <button
                type="button"
                onClick={() => setComprovanteAtivo(null)}
                className="flex-1 py-2 px-3 rounded-lg bg-[#DC2626] text-white text-xs font-semibold hover:bg-red-700 cursor-pointer"
              >
                Concluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Visualização da Selfie Própria */}
      {selfieVisualizacao && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3">
          <div className="w-full max-w-[360px] rounded-xl bg-white dark:bg-[#1C1C20] text-[#111827] dark:text-zinc-100 p-4 shadow-2xl border border-zinc-200 dark:border-zinc-800 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="text-sm font-bold truncate">{selfieVisualizacao.label}</h3>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  {selfieVisualizacao.hora} · Loja {selfieVisualizacao.unidade}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelfieVisualizacao(null)}
                className="p-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
                aria-label="Fechar selfie"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <img
              src={selfieVisualizacao.src}
              alt={selfieVisualizacao.label}
              className="w-full aspect-square object-cover rounded-xl border border-zinc-200 dark:border-zinc-700"
            />
          </div>
        </div>
      )}
    </div>
  );
};
