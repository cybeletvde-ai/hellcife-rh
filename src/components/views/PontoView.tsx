import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  Fingerprint,
  MapPin,
  Printer,
  RefreshCw,
  ShieldCheck,
  AlertTriangle,
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
  calcularDiaPonto,
  calcularEspelhoMensal,
  formatBRL,
  formatDateBR,
  formatMinutesToHHMM,
  getCurrentMonthStr,
  getTodayStr,
} from '../../utils/cltCalculations';

interface PontoViewProps {
  colaborador: Colaborador;
  unidadeAtiva: Unidade;
  pontos: RegistroPonto[];
  jornada: JornadaTemplate;
  ajustes: AjusteEscala[];
  feriados: Feriado[];
  atestados: Atestado[];
  config: ConfiguracaoEmpresa;
  onRegistrarPonto: (registro: RegistroPonto) => Promise<boolean>;
}

const ORDEM_MARCACOES: { tipo: TipoMarcacao; label: string }[] = [
  { tipo: 'entrada', label: 'Entrada' },
  { tipo: 'saida_almoco', label: 'Saída Almoço' },
  { tipo: 'retorno_almoco', label: 'Retorno Almoço' },
  { tipo: 'saida', label: 'Saída' },
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
  const [agora, setAgora] = useState(() => new Date());
  const [gpsStatus, setGpsStatus] = useState<'verificando' | 'verificada' | 'fora_raio' | 'indisponivel'>('verificando');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [distancia, setDistancia] = useState<number | null>(null);
  const [unidadeGps, setUnidadeGps] = useState<Unidade>(unidadeAtiva);
  const [registrando, setRegistrando] = useState(false);
  const [comprovanteAtivo, setComprovanteAtivo] = useState<RegistroPonto | null>(null);

  useEffect(() => {
    const id = setInterval(() => setAgora(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const verificarGPS = () => {
    setGpsStatus('verificando');

    if (!navigator.geolocation) {
      setGpsStatus('indisponivel');
      setCoords(null);
      setDistancia(null);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setCoords({ lat, lng });

        if (colaborador.lotacao === 'Ambas') {
          const locRec = config.localizacoes.Recife;
          const locJab = config.localizacoes['Jaboatão'];
          const distRec = haversineDistanceMeters(lat, lng, locRec.latitude, locRec.longitude);
          const distJab = haversineDistanceMeters(lat, lng, locJab.latitude, locJab.longitude);
          const maisProxima = distRec <= distJab ? locRec : locJab;
          const distMin = Math.min(distRec, distJab);
          setDistancia(distMin);
          setUnidadeGps(maisProxima.unidade);
          setGpsStatus(distMin <= maisProxima.raioMetros ? 'verificada' : 'fora_raio');
        } else {
          const locUnidade = config.localizacoes[colaborador.lotacao];
          const dist = haversineDistanceMeters(lat, lng, locUnidade.latitude, locUnidade.longitude);
          setDistancia(dist);
          setUnidadeGps(colaborador.lotacao);
          setGpsStatus(dist <= locUnidade.raioMetros ? 'verificada' : 'fora_raio');
        }
      },
      () => {
        setGpsStatus('indisponivel');
        setCoords(null);
        setDistancia(null);
      },
      { enableHighAccuracy: true, timeout: 6000, maximumAge: 15000 }
    );
  };

  useEffect(() => {
    verificarGPS();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [colaborador.lotacao, unidadeAtiva, config.localizacoes]);

  const hojeStr = getTodayStr();
  const mesAtual = getCurrentMonthStr();

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
      agora
    );
  }, [colaborador, hojeStr, jornada, pontosHoje, ajustes, feriados, atestados, config, unidadeAtiva, agora]);

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
      const nowMin = agora.getHours() * 60 + agora.getMinutes();
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
  }, [diaHojeCalculado.minutosTrabalhados, mapaHoje, agora]);

  const horasExtrasMesMin = resumoMes.totalMinExtrasGeral;
  const vtMesAcumulado = resumoMes.diasTrabalhados * colaborador.vtDiario;
  const vaMesAcumulado = resumoMes.diasTrabalhados * colaborador.vaDiario;

  const horaFormatada = agora.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const dataExtenso = agora.toLocaleDateString('pt-BR', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  const handleBaterPonto = async () => {
    if (!proximaMarcacao || registrando) return;
    setRegistrando(true);
    try {
      const now = new Date();
      const dataStr = getTodayStr();
      const horaStr = now.toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      });
      const unidadePunch: Unidade =
        colaborador.lotacao === 'Ambas' ? unidadeGps : colaborador.lotacao;
      const empresaPunch = getDadosEmpresaUnidade(config, unidadePunch);
      const nsr = Math.floor(Date.now() / 1000) % 1000000;
      const payload = `${nsr}|${empresaPunch.cnpj || config.cnpj}|${colaborador.id}|${dataStr}|${horaStr}|${unidadePunch}|${proximaMarcacao.tipo}`;
      const hashComprovante = await sha256Hex(payload);

      const novo: RegistroPonto = {
        id: `pt-${Date.now()}`,
        nsr,
        colaboradorId: colaborador.id,
        unidade: unidadePunch,
        data: dataStr,
        hora: horaStr,
        timestamp: now.toISOString(),
        tipo: proximaMarcacao.tipo,
        latitude: coords?.lat ?? null,
        longitude: coords?.lng ?? null,
        distanciaMetros: distancia,
        localizacaoVerificada: gpsStatus === 'verificada',
        hashComprovante,
      };

      const ok = await onRegistrarPonto(novo);
      if (ok) {
        setComprovanteAtivo(novo);
      }
    } finally {
      setRegistrando(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* Cartão Principal: Relógio + GPS + Botão REGISTRAR PONTO */}
      <section className="bg-white dark:bg-[#1C1C20] text-[#111827] dark:text-zinc-100 rounded-xl p-3 shadow-sm border border-zinc-200/80 dark:border-zinc-800">
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
            <div className="mt-1 inline-block px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-[11px] font-semibold text-zinc-700 dark:text-zinc-200">
              Lotação: {colaborador.lotacao}
            </div>
          </div>
        </div>

        {/* Status GPS */}
        <div className="flex items-center justify-between gap-2 py-2 px-2.5 rounded-lg bg-zinc-50 dark:bg-zinc-900/90 border border-zinc-200/70 dark:border-zinc-800 mb-3">
          <div className="flex items-center gap-1.5 min-w-0">
            {gpsStatus === 'verificada' ? (
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : gpsStatus === 'verificando' ? (
              <MapPin className="w-4 h-4 text-zinc-400 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            )}
            <span className="text-xs font-medium truncate">
              {gpsStatus === 'verificada' &&
                `Localização verificada (${distancia ?? 0}m da loja)`}
              {gpsStatus === 'verificando' && 'Verificando localização GPS...'}
              {gpsStatus === 'fora_raio' &&
                `Fora do raio permitido (${distancia ?? 0}m)`}
              {gpsStatus === 'indisponivel' &&
                'GPS indisponível ou sem permissão'}
            </span>
          </div>
          <button
            type="button"
            onClick={verificarGPS}
            className="p-1 rounded-md text-zinc-500 hover:text-[#111827] dark:hover:text-white hover:bg-zinc-200/70 dark:hover:bg-zinc-800 cursor-pointer shrink-0"
            title="Atualizar GPS"
            aria-label="Atualizar GPS"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Botão Principal REGISTRAR PONTO */}
        {proximaMarcacao ? (
          <button
            type="button"
            onClick={handleBaterPonto}
            disabled={registrando}
            className="w-full py-3 px-4 rounded-xl bg-[#DC2626] hover:bg-red-700 active:scale-[0.99] text-white font-bold text-sm tracking-wide flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm min-h-[48px] disabled:opacity-60"
          >
            <Fingerprint className="w-5 h-5 shrink-0" />
            <span>
              {registrando ? 'REGISTRANDO...' : `REGISTRAR PONTO · ${proximaMarcacao.label.toUpperCase()}`}
            </span>
          </button>
        ) : (
          <div className="w-full py-2.5 px-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 text-emerald-800 dark:text-emerald-300 text-xs font-semibold flex items-center justify-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>Todas as marcações de hoje foram registradas</span>
          </div>
        )}
      </section>

      {/* Linha do Tempo: Marcações de Hoje */}
      <section className="bg-white dark:bg-[#1C1C20] text-[#111827] dark:text-zinc-100 rounded-xl p-3 shadow-sm border border-zinc-200/80 dark:border-zinc-800">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Marcações de Hoje
          </h2>
          <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
            Portaria MTP 671/2021
          </span>
        </div>

        <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {ORDEM_MARCACOES.map((item, idx) => {
            const reg = mapaHoje[item.tipo];
            const isNext = proximaMarcacao?.tipo === item.tipo;
            return (
              <div key={item.tipo} className="py-2 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 ${
                      reg
                        ? 'bg-[#DC2626] text-white'
                        : isNext
                          ? 'border-2 border-[#DC2626] text-[#DC2626]'
                          : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400'
                    }`}
                  >
                    {idx + 1}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold truncate">{item.label}</div>
                    {reg && (
                      <div className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
                        {colaborador.lotacao === 'Ambas' ? 'Ambas' : reg.unidade} ·{' '}
                        {reg.localizacaoVerificada ? 'GPS verificado' : 'GPS pendente'}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
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
      </section>

      {/* Grade 2x2 de 4 mini-cartões compactos */}
      <section className="grid grid-cols-2 gap-2.5">
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

      {/* Modal Comprovante Eletrônico Portaria MTP 671/2021 */}
      {comprovanteAtivo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3">
          <div className="w-full max-w-[380px] rounded-xl bg-white dark:bg-[#1C1C20] text-[#111827] dark:text-zinc-100 p-4 shadow-2xl border border-zinc-200 dark:border-zinc-800 print-card">
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
                    {empresaRecibo.inscricaoEstadual ? ` · IE: ${empresaRecibo.inscricaoEstadual}` : ''}
                  </div>
                  {enderecoRecibo && (
                    <div>
                      <span className="text-zinc-500">Local:</span> {enderecoRecibo}
                    </div>
                  )}
                  {(empresaRecibo.telefone || empresaRecibo.email) && (
                    <div>
                      <span className="text-zinc-500">Contato:</span>{' '}
                      {[empresaRecibo.telefone, empresaRecibo.email].filter(Boolean).join(' · ')}
                    </div>
                  )}
                  <div>
                    <span className="text-zinc-500">Lotação:</span>{' '}
                    {colaborador.lotacao === 'Ambas' ? 'Ambas' : comprovanteAtivo.unidade}
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
              <div>
                <span className="text-zinc-500">Tipo:</span>{' '}
                {ORDEM_MARCACOES.find((m) => m.tipo === comprovanteAtivo.tipo)?.label}
              </div>
              <div>
                <span className="text-zinc-500">GPS:</span>{' '}
                {comprovanteAtivo.latitude !== null
                  ? `${comprovanteAtivo.latitude.toFixed(5)}, ${comprovanteAtivo.longitude?.toFixed(5)} (${comprovanteAtivo.distanciaMetros ?? 0}m)`
                  : 'Não informado'}
              </div>
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
    </div>
  );
};
