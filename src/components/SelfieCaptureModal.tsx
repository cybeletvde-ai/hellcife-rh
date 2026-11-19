import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Camera, Check, RefreshCw, ShieldCheck, X } from 'lucide-react';
import { Unidade } from '../types/rh';

interface SelfieCaptureModalProps {
  isOpen: boolean;
  unidade: Unidade;
  tipoLabel: string;
  distanciaMetros: number | null;
  salvando: boolean;
  onCancel: () => void;
  onConfirm: (selfieDataUrl: string) => Promise<void> | void;
}

export const SelfieCaptureModal: React.FC<SelfieCaptureModalProps> = ({
  isOpen,
  unidade,
  tipoLabel,
  distanciaMetros,
  salvando,
  onCancel,
  onConfirm,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [erroCamera, setErroCamera] = useState<string | null>(null);
  const [iniciando, setIniciando] = useState(true);
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);

  const pararCamera = () => {
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) {
        track.stop();
      }
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const iniciarCamera = async () => {
    pararCamera();
    setErroCamera(null);
    setIniciando(true);
    setFotoPreview(null);

    if (
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices ||
      !navigator.mediaDevices.getUserMedia
    ) {
      setErroCamera(
        'Câmara frontal indisponível neste navegador/dispositivo. A validação visual por selfie é obrigatória para registar o ponto.'
      );
      setIniciando(false);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'user' },
          width: { ideal: 480 },
          height: { ideal: 480 },
        },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => undefined);
      }
      setIniciando(false);
    } catch {
      setErroCamera(
        'Permissão da câmara frontal negada ou bloqueada. Ative a câmara para concluir a validação visual antifraude.'
      );
      setIniciando(false);
    }
  };

  useEffect(() => {
    if (!isOpen) {
      pararCamera();
      return;
    }
    void iniciarCamera();
    return () => {
      pararCamera();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen) return null;

  const capturarSelfie = () => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0 || video.videoHeight === 0) return;

    const targetSize = 300;
    const canvas = document.createElement('canvas');
    canvas.width = targetSize;
    canvas.height = targetSize;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Recorte central quadrado e espelhado (selfie natural), comprimido em baixa resolução
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    const side = Math.min(vw, vh);
    const sx = Math.floor((vw - side) / 2);
    const sy = Math.floor((vh - side) / 2);

    ctx.save();
    ctx.translate(targetSize, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, sx, sy, side, side, 0, 0, targetSize, targetSize);
    ctx.restore();

    const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.55);
    setFotoPreview(compressedDataUrl);
    pararCamera();
  };

  const handleConfirmar = async () => {
    if (!fotoPreview || salvando) return;
    await onConfirm(fotoPreview);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-3 no-print">
      <div className="w-full max-w-[380px] rounded-xl bg-white dark:bg-[#1C1C20] text-[#111827] dark:text-zinc-100 p-4 shadow-2xl border border-zinc-200 dark:border-zinc-800 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Camera className="w-4 h-4 text-[#DC2626] shrink-0" />
            <h3 className="text-sm font-bold truncate">Validação Visual por Selfie</h3>
          </div>
          <button
            type="button"
            disabled={salvando}
            onClick={() => {
              pararCamera();
              onCancel();
            }}
            className="p-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer disabled:opacity-40"
            aria-label="Cancelar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/60 text-[11px] text-emerald-800 dark:text-emerald-300">
          <span className="flex items-center gap-1.5 font-semibold truncate">
            <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
            <span>
              {unidade} ({distanciaMetros ?? 0}m) · {tipoLabel}
            </span>
          </span>
          <span className="font-mono text-[10px] shrink-0">Antifraude</span>
        </div>

        {erroCamera ? (
          <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300 space-y-2">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <p>{erroCamera}</p>
            </div>
            <button
              type="button"
              onClick={() => void iniciarCamera()}
              className="w-full py-2 px-3 rounded-lg bg-[#DC2626] hover:bg-red-700 text-white font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Tentar Ativar Câmara Novamente</span>
            </button>
          </div>
        ) : (
          <div className="relative w-full aspect-square max-h-[280px] mx-auto rounded-xl overflow-hidden bg-zinc-950 border border-zinc-800 flex items-center justify-center">
            {fotoPreview ? (
              <img
                src={fotoPreview}
                alt="Prévia da selfie de validação"
                className="w-full h-full object-cover"
              />
            ) : (
              <>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover scale-x-[-1]"
                />
                {iniciando && (
                  <div className="absolute inset-0 bg-zinc-950/80 flex items-center justify-center text-xs text-zinc-300">
                    Iniciando câmara frontal...
                  </div>
                )}
                <div
                  className="pointer-events-none absolute inset-6 rounded-full border-2 border-dashed border-white/40"
                  aria-hidden="true"
                />
              </>
            )}
          </div>
        )}

        <p className="text-[11px] text-zinc-500 dark:text-zinc-400 text-center">
          {fotoPreview
            ? 'Confira se o seu rosto está nítido antes de confirmar a marcação.'
            : 'Enquadre o seu rosto no centro para vincular a selfie ao comprovativo.'}
        </p>

        {!erroCamera && (
          <div className="grid grid-cols-2 gap-2">
            {fotoPreview ? (
              <>
                <button
                  type="button"
                  disabled={salvando}
                  onClick={() => void iniciarCamera()}
                  className="py-2.5 px-3 rounded-lg bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Tirar Outra</span>
                </button>
                <button
                  type="button"
                  disabled={salvando}
                  onClick={() => void handleConfirmar()}
                  className="py-2.5 px-3 rounded-lg bg-[#DC2626] hover:bg-red-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>{salvando ? 'Gravando...' : 'Confirmar Ponto'}</span>
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => {
                    pararCamera();
                    onCancel();
                  }}
                  className="py-2.5 px-3 rounded-lg bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-xs font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={iniciando}
                  onClick={capturarSelfie}
                  className="py-2.5 px-3 rounded-lg bg-[#DC2626] hover:bg-red-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>Capturar Selfie</span>
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
