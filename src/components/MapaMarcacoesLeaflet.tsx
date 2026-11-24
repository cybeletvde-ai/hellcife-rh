import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin } from 'lucide-react';
import { ConfiguracaoEmpresa, RegistroPonto, TipoMarcacao, Unidade } from '../types/rh';

export interface MarcacaoMapaItem {
  ponto: RegistroPonto;
  colaboradorNome: string;
  colaboradorFuncao: string;
  localLabel: string;
  status: 'Confirmada' | 'Atrasado' | 'Fora do local';
}

interface MapaMarcacoesLeafletProps {
  marcacoes: MarcacaoMapaItem[];
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

function getNomeLojaMapa(unidade: Unidade): string {
  return unidade === 'Recife'
    ? 'Loja Caxangá - Recife'
    : 'Av. Bernardo Vieira de Melo - Jaboatão';
}

function createPinIcon(colorHex: string, labelText: string): L.DivIcon {
  return L.divIcon({
    className: 'hellcife-map-pin',
    html: `
      <div style="display:flex;flex-direction:column;align-items:center;transform:translate(-50%,-100%);">
        <div style="width:28px;height:28px;border-radius:9999px;background:${colorHex};border:2.5px solid #FFFFFF;box-shadow:0 3px 10px rgba(0,0,0,0.45);display:flex;align-items:center;justify-content:center;color:#FFFFFF;font-weight:800;font-size:10px;font-family:monospace;">
          ${escapeHtml(labelText)}
        </div>
        <div style="width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-top:7px solid ${colorHex};margin-top:-1px;"></div>
      </div>
    `,
    iconSize: [28, 36],
    iconAnchor: [0, 0],
    popupAnchor: [0, -34],
  });
}

function createStoreIcon(): L.DivIcon {
  return L.divIcon({
    className: 'hellcife-store-pin',
    html: `
      <div style="transform:translate(-50%,-50%);background:#09090B;color:#FFFFFF;border:2px solid #DC2626;border-radius:6px;padding:2px 6px;font-size:10px;font-weight:700;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,0.4);">
        Loja
      </div>
    `,
    iconSize: [38, 22],
    iconAnchor: [0, 0],
    popupAnchor: [0, -14],
  });
}

export const MapaMarcacoesLeaflet: React.FC<MapaMarcacoesLeafletProps> = ({
  marcacoes,
  config,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    // Centralizado na Região Metropolitana do Recife
    const map = L.map(containerRef.current, {
      center: [-8.095, -34.905],
      zoom: 11,
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
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const group = layerGroupRef.current;
    if (!map || !group) return;

    group.clearLayers();

    // Cerca eletrônica e pino de referência das lojas (Recife e Jaboatão)
    const lojas: Unidade[] = ['Recife', 'Jaboatão'];
    lojas.forEach((un) => {
      const loc = config.localizacoes[un];
      if (!loc || !Number.isFinite(loc.latitude) || !Number.isFinite(loc.longitude)) return;

      L.circle([loc.latitude, loc.longitude], {
        radius: loc.raioMetros || 250,
        color: '#DC2626',
        weight: 1.5,
        dashArray: '4 4',
        fillColor: '#DC2626',
        fillOpacity: 0.08,
      }).addTo(group);

      const storeMarker = L.marker([loc.latitude, loc.longitude], {
        icon: createStoreIcon(),
      });
      storeMarker.bindPopup(
        `<div style="font-family:sans-serif;font-size:12px;line-height:1.4;min-width:170px;">
          <div style="font-weight:700;color:#09090B;">${escapeHtml(getNomeLojaMapa(un))}</div>
          <div style="color:#474A51;font-size:11px;margin-top:2px;">${escapeHtml(loc.endereco || loc.nomeLoja)}</div>
          <div style="color:#DC2626;font-size:11px;font-weight:600;margin-top:3px;">Raio permitido: ${loc.raioMetros}m</div>
        </div>`
      );
      storeMarker.addTo(group);
    });

    // Marcadores exatos das batidas do dia
    const coordsUsadas = new Map<string, number>();
    const boundsPoints: L.LatLngExpression[] = [];

    marcacoes.forEach((item) => {
      const { ponto, colaboradorNome, colaboradorFuncao, localLabel, status } = item;
      if (
        ponto.latitude === null ||
        ponto.longitude === null ||
        !Number.isFinite(ponto.latitude) ||
        !Number.isFinite(ponto.longitude)
      ) {
        return;
      }

      const key = `${ponto.latitude.toFixed(5)},${ponto.longitude.toFixed(5)}`;
      const ocorrencia = coordsUsadas.get(key) ?? 0;
      coordsUsadas.set(key, ocorrencia + 1);

      // Pequeno deslocamento em espiral apenas quando múltiplos pinos ocupam a mesma coordenada exata
      let lat = ponto.latitude;
      let lng = ponto.longitude;
      if (ocorrencia > 0) {
        const angle = ocorrencia * 1.3;
        const offset = 0.00009 * Math.ceil(ocorrencia / 2);
        lat += Math.sin(angle) * offset;
        lng += Math.cos(angle) * offset;
      }

      const colorHex =
        status === 'Fora do local'
          ? '#DC2626'
          : status === 'Atrasado'
            ? '#D97706'
            : '#059669';

      const sigla =
        ponto.tipo === 'entrada'
          ? 'E1'
          : ponto.tipo === 'saida_almoco'
            ? 'S1'
            : ponto.tipo === 'retorno_almoco'
              ? 'E2'
              : 'S2';

      const marker = L.marker([lat, lng], {
        icon: createPinIcon(colorHex, sigla),
      });

      const statusBg =
        status === 'Fora do local'
          ? '#FEE2E2;color:#B91C1C'
          : status === 'Atrasado'
            ? '#FEF3C7;color:#B45309'
            : '#D1FAE5;color:#047857';

      marker.bindPopup(
        `<div style="font-family:sans-serif;font-size:12px;line-height:1.45;min-width:190px;">
          <div style="font-weight:700;color:#09090B;font-size:13px;">${escapeHtml(colaboradorNome)}</div>
          <div style="color:#474A51;font-size:11px;margin-bottom:4px;">${escapeHtml(colaboradorFuncao)}</div>
          <div style="display:flex;justify-content:space-between;gap:8px;border-top:1px solid #E5E7EB;padding-top:4px;margin-top:4px;">
            <span style="color:#52525B;">Horário:</span>
            <strong style="font-family:monospace;color:#09090B;">${escapeHtml(ponto.hora.slice(0, 8))}</strong>
          </div>
          <div style="display:flex;justify-content:space-between;gap:8px;">
            <span style="color:#52525B;">Batida:</span>
            <strong style="color:#09090B;">${escapeHtml(LABELS_TIPO[ponto.tipo])}</strong>
          </div>
          <div style="display:flex;justify-content:space-between;gap:8px;">
            <span style="color:#52525B;">Unidade:</span>
            <strong style="color:#09090B;">${escapeHtml(localLabel)}</strong>
          </div>
          ${
            ponto.distanciaMetros !== null
              ? `<div style="display:flex;justify-content:space-between;gap:8px;">
                  <span style="color:#52525B;">Distância GPS:</span>
                  <strong style="color:#09090B;">${ponto.distanciaMetros}m</strong>
                </div>`
              : ''
          }
          <div style="margin-top:6px;">
            <span style="display:inline-block;padding:2px 7px;border-radius:9999px;font-size:10px;font-weight:700;background:${statusBg};">
              ${escapeHtml(status)}
            </span>
          </div>
        </div>`
      );

      marker.addTo(group);
      boundsPoints.push([lat, lng]);
    });

    if (boundsPoints.length === 1) {
      map.setView(boundsPoints[0], 15, { animate: false });
    } else if (boundsPoints.length > 1) {
      const bounds = L.latLngBounds(boundsPoints);
      map.fitBounds(bounds, { padding: [45, 45], maxZoom: 15, animate: false });
    } else {
      map.setView([-8.095, -34.905], 11, { animate: false });
    }
  }, [marcacoes, config]);

  const comCoordenadas = marcacoes.filter(
    (m) =>
      m.ponto.latitude !== null &&
      m.ponto.longitude !== null &&
      Number.isFinite(m.ponto.latitude) &&
      Number.isFinite(m.ponto.longitude)
  ).length;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-[#DC2626] shrink-0" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-200">
            Localização das marcações
          </h3>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-[11px] text-zinc-500 dark:text-zinc-400">
          <span className="inline-flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 inline-block" />
            Confirmada
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-600 inline-block" />
            Atrasado
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-[#DC2626] inline-block" />
            Fora do local
          </span>
          <span className="font-mono font-semibold text-zinc-700 dark:text-zinc-300">
            {comCoordenadas} {comCoordenadas === 1 ? 'pino GPS' : 'pinos GPS'}
          </span>
        </div>
      </div>

      <div className="relative rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900">
        <div
          ref={containerRef}
          className="h-[300px] sm:h-[340px] w-full z-0"
          aria-label="Mapa interativo de localização das marcações na Região Metropolitana do Recife"
        />
        {comCoordenadas === 0 && (
          <div className="pointer-events-none absolute bottom-2.5 left-1/2 -translate-x-1/2 z-[400] px-3 py-1.5 rounded-lg bg-[#09090B]/85 text-white text-[11px] font-medium shadow-md border border-zinc-700/80 whitespace-nowrap">
            Nenhuma coordenada GPS registada para os filtros desta data · Região Metropolitana do Recife
          </div>
        )}
      </div>
    </div>
  );
};
