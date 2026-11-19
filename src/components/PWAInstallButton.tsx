import React, { useState } from 'react';
import { Download, Smartphone, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) return null;

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={install}
        className={`flex items-center justify-center gap-2 rounded-lg bg-[#DC2626] text-white font-semibold hover:bg-red-700 transition-colors cursor-pointer whitespace-nowrap ${
          compact ? 'px-2.5 py-1.5 text-xs min-h-[36px]' : 'w-full px-3 py-2 text-xs min-h-[40px]'
        }`}
      >
        <Download className="w-3.5 h-3.5 shrink-0" />
        <span>Instalar App</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          className={`flex items-center justify-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900 text-zinc-100 font-medium hover:bg-zinc-800 transition-colors cursor-pointer whitespace-nowrap ${
            compact ? 'px-2.5 py-1.5 text-xs min-h-[36px]' : 'w-full px-3 py-2 text-xs min-h-[40px]'
          }`}
        >
          <Smartphone className="w-3.5 h-3.5 shrink-0 text-[#DC2626]" />
          <span>Instalar no iOS</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
            <div className="w-full max-w-[360px] rounded-xl bg-white dark:bg-[#1C1C20] p-4 text-[#111827] dark:text-zinc-100 shadow-xl border border-zinc-200 dark:border-zinc-800">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-bold">Instalar HellcifeRH+ no iPhone</h3>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  className="p-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
                  aria-label="Fechar"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed">
                1. Toque no botão <strong>Compartilhar</strong> na barra do Safari.
                <br />
                2. Role para baixo e toque em <strong>Adicionar à Tela de Início</strong>.
              </p>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="mt-4 w-full rounded-lg bg-[#DC2626] py-2 text-xs font-semibold text-white hover:bg-red-700 cursor-pointer"
              >
                Entendi
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
