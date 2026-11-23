import React, { useState } from 'react';
import { Download, PlusSquare, Share, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

const DISMISS_STORAGE_KEY = 'hellcife_pwa_banner_dismissed';

export const PWAInstallBannerCard: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, isMobile, install } = usePWAInstall();
  const [dismissed, setDismissed] = useState<boolean>(() => {
    try {
      return typeof window !== 'undefined' && window.sessionStorage.getItem(DISMISS_STORAGE_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [instalando, setInstalando] = useState(false);

  if (!isMobile || isInstalled || dismissed) {
    return null;
  }

  if (!isInstallable && !isIOS) {
    return null;
  }

  const handleClose = () => {
    setDismissed(true);
    try {
      window.sessionStorage.setItem(DISMISS_STORAGE_KEY, '1');
    } catch {
      // ignore storage quota/privacy restrictions
    }
  };

  const handleInstall = async () => {
    if (instalando) return;
    setInstalando(true);
    try {
      await install();
    } finally {
      setInstalando(false);
    }
  };

  return (
    <section
      aria-label="Instalar aplicativo HELLCIFE RH+"
      className="relative rounded-xl bg-gradient-to-br from-[#2D3036] via-[#202227] to-[#16171B] border border-zinc-700/80 border-t-2 border-t-[#DC2626] p-3.5 shadow-xl text-zinc-100"
    >
      <button
        type="button"
        onClick={handleClose}
        aria-label="Fechar aviso de instalação"
        className="absolute top-2.5 right-2.5 p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-700/60 transition-colors cursor-pointer"
      >
        <X className="w-4 h-4" />
      </button>

      <div className="flex items-center gap-3 pr-7">
        <img
          src="/icon-192x192.png"
          alt="Emblema HELLCIFE RH+"
          className="w-11 h-11 rounded-xl object-cover shrink-0 shadow-md ring-1 ring-[#DC2626]/60 bg-[#474A51]"
        />
        <div className="min-w-0">
          <h2 className="text-xs font-extrabold tracking-wide text-white leading-snug">
            Instalar Aplicativo HELLCIFE RH+
          </h2>
          <p className="text-[11px] text-zinc-300 leading-snug mt-0.5">
            {isInstallable
              ? 'Acesso rápido direto pela tela inicial do seu telemóvel.'
              : 'Adicione o aplicativo à tela inicial do seu iPhone ou iPad.'}
          </p>
        </div>
      </div>

      {isInstallable ? (
        <button
          type="button"
          onClick={handleInstall}
          disabled={instalando}
          className="mt-3 w-full py-2.5 px-3 rounded-lg bg-[#DC2626] hover:bg-red-700 active:scale-[0.99] text-white text-xs font-extrabold tracking-wide flex items-center justify-center gap-2 shadow-md shadow-red-950/50 transition-all cursor-pointer min-h-[42px] disabled:opacity-60"
        >
          <Download className="w-4 h-4 shrink-0" />
          <span>{instalando ? 'ABRINDO INSTALAÇÃO...' : 'BAIXAR / INSTALAR APLICATIVO'}</span>
        </button>
      ) : (
        <div className="mt-3 rounded-lg bg-[#121317]/90 border border-zinc-700/70 p-2.5 space-y-2">
          <div className="flex items-start gap-2 text-[11px] text-zinc-200 leading-relaxed">
            <Share className="w-4 h-4 text-[#DC2626] shrink-0 mt-0.5" />
            <p>
              Para instalar no iPhone: toque no ícone{' '}
              <strong className="text-white font-semibold">Partilhar (↑)</strong> na barra inferior e
              escolha{' '}
              <strong className="text-white font-semibold">&apos;Adicionar à Tela de Início&apos;</strong>.
            </p>
          </div>
          <div className="flex items-center flex-wrap gap-1.5 pt-1.5 border-t border-zinc-800/80 text-[11px]">
            <span className="inline-flex items-center gap-1 rounded-md bg-zinc-800/90 px-2 py-1 border border-zinc-700/80 text-white font-semibold">
              <Share className="w-3 h-3 text-[#DC2626]" />
              <span>Partilhar (↑)</span>
            </span>
            <span className="text-zinc-500 font-bold" aria-hidden="true">
              →
            </span>
            <span className="inline-flex items-center gap-1 rounded-md bg-zinc-800/90 px-2 py-1 border border-zinc-700/80 text-white font-semibold">
              <PlusSquare className="w-3 h-3 text-[#DC2626]" />
              <span>Adicionar à Tela de Início</span>
            </span>
          </div>
        </div>
      )}
    </section>
  );
};
