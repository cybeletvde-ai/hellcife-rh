import React, { useEffect, useMemo, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Crosshair, MapPin } from 'lucide-react';
import {
  Colaborador,
  ConfiguracaoEmpresa,
  LocalizacaoUnidade,
  RegistroPonto,
  TipoMarcacao,
  Unidade,
} from '../types/rh';

interface MapaIndividualColaboradorLeafletProps {
  colaborador: Colaborador;
  coords: { lat: number; lng: number } | null;
  gpsStatus: 'verificando' | 'verificada' | 'fora_raio' | 'indisponivel';
  distanciaAtual: number | null;
  pontosHoje: RegistroPonto[];
  config: ConfiguracaoEmpresa;
}

const LABELS_TIPO: Record<TipoMarcacao, string> = {
  entrada: 'E1 · Entrada',
  saida_almoco: 'S1 · Saída Almoço',
  retorno_almoco: 'E2 · Retorno Almoço',
  saida: 'S2 · Saída',
};

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function getNomeLojaCurto(unidade: Unidade): string {
  return unidade === 'Recife'
    ? 'Loja Caxangá · Recife'
    : 'Av. Bernardo Vieira de Melo · Jaboatão';
}

function createStorePinIcon(unidade: Unidade): L.DivIcon {
  const titulo = unidade === 'Recife' ? 'Loja Recife' : 'Loja Jaboatão';
  return L.divIcon({
    className: 'hellcife-store-pin-individual',
    html: `
      <div style="transform:translate(-50%,-100%);display:flex;flex-direction:column;align-items:center;">
        <div style="background:#09090B;color:#FFFFFF;border:2px solid #DC2626;border-radius:7px;padding:3px 8px;font-size:10px;font-weight:800;white-space:nowrap;box-shadow:0 3px 10px rgba(0,0,0,0.45);">
          ${escapeHtml(titulo)}
        </div>
        <div style="width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-top:6px solid #DC2626;margin-top:-1px;"></div>
      </div>
    `,
    iconSize: [86, 30],
    iconAnchor: [0, 0],
    popupAnchor: [0, -28],
  });
}

function createUserLiveIcon(verificada: boolean): L.DivIcon {
  const cor = verificada ? '#2563EB' : '#DC2626';
  const halo = verificada ? 'rgba(37,99,235,0.28)' : 'rgba(220,38,38,0.28)';
  return L.divIcon({
    className: 'hellcife-user-live-pin',
    html: `
      <div style="transform:translate(-50%,-50%);position:relative;width:28px;height:28px;display:flex;align-items:center;justify-content:center;">
        <div style="position:absolute;inset:0;border-radius:9999px;background:${halo};"></div>
        <div style="width:14px;height:14px;border-radius:9999px;background:${cor};border:2.5px solid #FFFFFF;box-shadow:0 2px 8px rgba(0,0,0,0.45);"></div>
      </div>
    `,
    iconSize: [28, 28],
    iconAnchor: [0, 0],
    popupAnchor: [0, -14],
  });
}

function createPunchPinIcon(sigla: string): L.DivIcon {
  return L.divIcon({
    className: 'hellcife-self-punch-pin',
    html: `
      <div style="display:flex;flex-direction:column;align-items:center;transform:translate(-50%,-100%);">
        <div style="width:26px;height:26px;border-radius:9999px;background:#059669;border:2px solid #FFFFFF;box-shadow:0 3px 8px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;color:#FFFFFF;font-weight:800;font-size:10px;font-family:monospace;">
          ${escapeHtml(sigla)}
        </div>
        <div style="width:0;height:0;border-left:4px solid transparent;border-right:4px solid transparent;border-top:6px solid #059669;margin-top:-1px;"></div>
      </div>
    `,
    iconSize: [26, 34],
    iconAnchor: [0, 0],
    popupAnchor: [0, -32],
  });
}

export const MapaIndividualColaboradorLeaflet: React.FC<
  MapaIndividualColaboradorLeafletProps
> = ({ colaborador, coords, gpsStatus, distanciaAtual, pontosHoje, config }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);
  const hasFittedInitialRef = useRef(false);

  const lojasPermitidas: LocalizacaoUnidade[] = useMemo(() => {
    if (colaborador.lotacao === 'Ambas') {
      return [config.localizacoes.Recife, config.localizacoes['Jaboatão']];
    }
    return [config.localizacoes[colaborador.lotacao]];
  }, [colaborador.lotacao, config.localizacoes]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const firstStore = lojasPermitidas[0];
    const initialCenter: [number, number] = firstStore
      ? [firstStore.latitude, firstStore.longitude]
      : [-8.095, -34.905];

    const map = L.map(containerRef.current, {
      center: initialCenter,
      zoom: 15,
      scrollWheelZoom: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
      maxZoom: 19,
    }).addTo(map);

    const group = L.layerGroup().addTo(map);
    mapRef.current = map;
    layerGroupRef.current = group;

    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 150);

    let resizeObs: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObs = new ResizeObserver(() => {
        map.invalidateSize();
      });
      resizeObs.observe(containerRef.current);
    }

    return () => {
      clearTimeout(timer);
      resizeObs?.disconnect();
      map.remove();
      mapRef.current = null;
      layerGroupRef.current = null;
      hasFittedInitialRef.current = false;
    };
  }, []);

  const calcularBounds = (): L.LatLngExpression[] => {
    const pts: L.LatLngExpression[] = [];
    lojasPermitidas.forEach((loc) => {
      if (Number.isFinite(loc.latitude) && Number.isFinite(loc.longitude)) {
        pts.push([loc.latitude, loc.longitude]);
      }
    });
    if (coords && Number.isFinite(coords.lat) && Number.isFinite(coords.lng)) {
      pts.push([coords.lat, coords.lng]);
    }
    pontosHoje.forEach((p) => {
      if (
        p.latitude !== null &&
        p.longitude !== null &&
        Number.isFinite(p.latitude) &&
        Number.isFinite(p.longitude)
      ) {
        pts.push([p.latitude, p.longitude]);
      }
    });
    return pts;
  };

  useEffect(() => {
    const map = mapRef.current;
    const group = layerGroupRef.current;
    if (!map || !group) return;

    group.clearLayers();

    // 1. Pinos fixos e círculos de raio permitido da(s) loja(s) da lotação do colaborador
    lojasPermitidas.forEach((loc) => {
      if (!Number.isFinite(loc.latitude) || !Number.isFinite(loc.longitude)) return;
      const raio = loc.raioMetros || 100;

      L.circle([loc.latitude, loc.longitude], {
        radius: raio,
        color: '#DC2626',
        weight: 2,
        dashArray: '5 4',
        fillColor: '#DC2626',
        fillOpacity: 0.1,
      }).addTo(group);

      const storeMarker = L.marker([loc.latitude, loc.longitude], {
        icon: createStorePinIcon(loc.unidade),
      });
      storeMarker.bindPopup(
        `<div style="font-family:sans-serif;font-size:12px;line-height:1.45;min-width:170px;">
          <div style="font-weight:700;color:#09090B;">${escapeHtml(getNomeLojaCurto(loc.unidade))}</div>
          <div style="color:#474A51;font-size:11px;margin-top:2px;">${escapeHtml(loc.endereco || loc.nomeLoja)}</div>
          <div style="color:#DC2626;font-size:11px;font-weight:700;margin-top:4px;">Raio permitido: ${raio}m</div>
        </div>`
      );
      storeMarker.addTo(group);
    });

    // 2. Pinos das batidas do próprio colaborador hoje
    const coordsUsadas = new Map<string, number>();
    pontosHoje.forEach((p) => {
      if (
        p.latitude === null ||
        p.longitude === null ||
        !Number.isFinite(p.latitude) ||
        !Number.isFinite(p.longitude)
      ) {
        return;
      }

      const key = `${p.latitude.toFixed(5)},${p.longitude.toFixed(5)}`;
      const ocorrencia = coordsUsadas.get(key) ?? 0;
      coordsUsadas.set(key, ocorrencia + 1);

      let lat = p.latitude;
      let lng = p.longitude;
      if (ocorrencia > 0) {
        const angle = ocorrencia * 1.4;
        const offset = 0.00007 * Math.ceil(ocorrencia / 2);
        lat += Math.sin(angle) * offset;
        lng += Math.cos(angle) * offset;
      }

      const sigla =
        p.tipo === 'entrada'
          ? 'E1'
          : p.tipo === 'saida_almoco'
            ? 'S1'
            : p.tipo === 'retorno_almoco'
              ? 'E2'
              : 'S2';

      const punchMarker = L.marker([lat, lng], {
        icon: createPunchPinIcon(sigla),
      });
      punchMarker.bindPopup(
        `<div style="font-family:sans-serif;font-size:12px;line-height:1.45;min-width:170px;">
          <div style="font-weight:700;color:#09090B;">${escapeHtml(LABELS_TIPO[p.tipo])}</div>
          <div style="color:#047857;font-family:monospace;font-weight:700;margin-top:2px;">${escapeHtml(p.hora.slice(0, 8))}</div>
          <div style="color:#474A51;font-size:11px;margin-top:2px;">${escapeHtml(getNomeLojaCurto(p.unidade))}</div>
          ${
            p.distanciaMetros !== null
              ? `<div style="color:#52525B;font-size:11px;">Distância GPS: ${p.distanciaMetros}m</div>`
              : ''
          }
        </div>`
      );
      punchMarker.addTo(group);
    });

    // 3. Pino da localização GPS atual em tempo real do telemóvel do próprio colaborador
    if (coords && Number.isFinite(coords.lat) && Number.isFinite(coords.lng)) {
      const liveMarker = L.marker([coords.lat, coords.lng], {
        icon: createUserLiveIcon(gpsStatus === 'verificada'),
        zIndexOffset: 500,
      });
      liveMarker.bindPopup(
        `<div style="font-family:sans-serif;font-size:12px;line-height:1.45;min-width:180px;">
          <div style="font-weight:700;color:#09090B;">Sua localização atual (Ao vivo)</div>
          <div style="font-family:monospace;font-size:11px;color:#474A51;margin-top:2px;">${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}</div>
          <div style="font-size:11px;font-weight:700;margin-top:4px;color:${
            gpsStatus === 'verificada' ? '#047857' : '#DC2626'
          };">
            ${
              gpsStatus === 'verificada'
                ? `Dentro do perímetro (${distanciaAtual ?? 0}m)`
                : `Fora do perímetro (${distanciaAtual ?? 0}m)`
            }
          </div>
        </div>`
      );
      liveMarker.addTo(group);
    }

    if (!hasFittedInitialRef.current) {
      const pts = calcularBounds();
      if (pts.length === 1) {
        map.setView(pts[0], 16, { animate: false });
      } else if (pts.length > 1) {
        map.fitBounds(L.latLngBounds(pts), { padding: [40, 40], maxZoom: 16, animate: false });
      }
      hasFittedInitialRef.current = true;
    }
  }, [lojasPermitidas, coords, gpsStatus, distanciaAtual, pontosHoje]);

  const handleCentralizar = () => {
    const map = mapRef.current;
    if (!map) return;
    const pts = calcularBounds();
    if (pts.length === 1) {
      map.setView(pts[0], 16, { animate: true });
    } else if (pts.length > 1) {
      map.fitBounds(L.latLngBounds(pts), { padding: [40, 40], maxZoom: 16, animate: true });
    }
  };

  return (
    <div className="space-y-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <MapPin className="w-3.5 h-3.5 text-[#DC2626] shrink-0" />
          <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-300">
            Sua localização e loja permitida (Ao vivo)
          </span>
        </div>

        <button
          type="button"
          onClick={handleCentralizar}
          className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-zinc-100 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-[11px] font-semibold text-zinc-700 dark:text-zinc-200 cursor-pointer"
        >
          <Crosshair className="w-3 h-3 text-[#DC2626]" />
          <span>Centralizar</span>
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-[11px] text-zinc-500 dark:text-zinc-400">
        <span className="inline-flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full bg-blue-600 inline-block ring-2 ring-blue-300/60" />
          Você agora
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 inline-block" />
          Suas batidas hoje
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-sm bg-[#09090B] border border-[#DC2626] inline-block" />
          Loja permitida ({lojasPermitidas.map((l) => `${l.unidade} · ${l.raioMetros || 100}m`).join(' / ')})
        </span>
      </div>

      <div className="relative rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900">
        <div
          ref={containerRef}
          className="h-[240px] sm:h-[270px] w-full z-0"
          aria-label="Mapa individual em tempo real do colaborador"
        />
        {!coords && (
          <div className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 z-[400] px-2.5 py-1 rounded-md bg-[#09090B]/85 text-white text-[10px] font-medium border border-zinc-700 whitespace-nowrap">
            {gpsStatus === 'verificando'
              ? 'Obtendo sua posição GPS ao vivo...'
              : 'Ative o GPS para visualizar a sua posição atual no mapa'}
          </div>
        )}
      </div>
    </div>
  );
};
