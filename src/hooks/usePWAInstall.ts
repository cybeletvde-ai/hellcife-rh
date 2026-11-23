import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

let globalDeferredPrompt: BeforeInstallPromptEvent | null = null;
let globalAppInstalled = false;
const listeners = new Set<() => void>();

function notifyListeners() {
  listeners.forEach((cb) => cb());
}

function checkIsStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const nav = window.navigator as unknown as { standalone?: boolean };
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    nav.standalone === true ||
    document.referrer.includes('android-app://')
  );
}

function detectDeviceFlags(): { isIOS: boolean; isMobile: boolean } {
  if (typeof window === 'undefined') return { isIOS: false, isMobile: false };
  const ua = window.navigator.userAgent || '';
  const nav = window.navigator as unknown as {
    maxTouchPoints?: number;
    userAgentData?: { mobile?: boolean };
  };

  const isIOS =
    /iphone|ipad|ipod/i.test(ua) ||
    (/macintosh/i.test(ua) && (nav.maxTouchPoints ?? 0) > 1);

  const isAndroid = /android/i.test(ua);
  const isMobileUA = /webos|blackberry|iemobile|opera mini|mobile/i.test(ua);
  const isCoarseSmall =
    window.matchMedia('(pointer: coarse)').matches && window.innerWidth <= 1024;

  const isMobile =
    isIOS ||
    isAndroid ||
    isMobileUA ||
    nav.userAgentData?.mobile === true ||
    isCoarseSmall;

  return { isIOS, isMobile };
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e: Event) => {
    e.preventDefault();
    globalDeferredPrompt = e as BeforeInstallPromptEvent;
    notifyListeners();
  });

  window.addEventListener('appinstalled', () => {
    globalAppInstalled = true;
    globalDeferredPrompt = null;
    notifyListeners();
  });
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(
    () => globalDeferredPrompt
  );
  const [isInstalled, setIsInstalled] = useState<boolean>(
    () => globalAppInstalled || checkIsStandalone()
  );
  const [{ isIOS, isMobile }, setDeviceFlags] = useState(() => detectDeviceFlags());

  useEffect(() => {
    const syncState = () => {
      setDeferredPrompt(globalDeferredPrompt);
      setIsInstalled(globalAppInstalled || checkIsStandalone());
      setDeviceFlags(detectDeviceFlags());
    };

    syncState();
    listeners.add(syncState);

    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    const handleMediaChange = () => syncState();
    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', handleMediaChange);
    }
    window.addEventListener('resize', handleMediaChange);

    return () => {
      listeners.delete(syncState);
      if (typeof mediaQuery.removeEventListener === 'function') {
        mediaQuery.removeEventListener('change', handleMediaChange);
      }
      window.removeEventListener('resize', handleMediaChange);
    };
  }, []);

  const install = async () => {
    const promptEvent = globalDeferredPrompt || deferredPrompt;
    if (!promptEvent) return false;
    await promptEvent.prompt();
    const { outcome } = await promptEvent.userChoice;
    if (outcome === 'accepted') {
      globalAppInstalled = true;
      globalDeferredPrompt = null;
      notifyListeners();
      return true;
    }
    return false;
  };

  return {
    isInstallable: !!deferredPrompt,
    isInstalled,
    isIOS,
    isMobile,
    install,
  };
}
