import React, { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';

const DISMISS_KEY = 'orario_install_dismissed';

function safelyGetStorage(key) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safelySetStorage(key, value) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Storage can fail in private mode or restricted browsers. Ignore safely.
  }
}

function isStandaloneApp() {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    window.matchMedia?.('(display-mode: fullscreen)').matches ||
    window.navigator.standalone === true ||
    document.referrer.startsWith('android-app://')
  );
}

function getInstallPlatform() {
  const ua = window.navigator.userAgent || '';
  const platform = window.navigator.platform || '';
  const isIOS = /iphone|ipad|ipod/i.test(ua) || (platform === 'MacIntel' && window.navigator.maxTouchPoints > 1);
  const isAndroid = /android/i.test(ua);
  const isSamsung = /samsungbrowser/i.test(ua);
  const isChrome = /chrome|crios/i.test(ua) && !/edg|opr|samsungbrowser/i.test(ua);

  if (isIOS) return 'ios';
  if (isAndroid && isSamsung) return 'samsung-android';
  if (isAndroid && isChrome) return 'chrome-android';
  if (isAndroid) return 'android';
  return 'desktop';
}

function getInstructions(platform) {
  if (platform === 'ios') {
    return 'On iPhone/iPad: tap Share, then Add to Home Screen. iOS does not support the automatic install popup.';
  }

  if (platform === 'samsung-android') {
    return 'On Samsung Internet: open the browser menu, then tap Add page to or Install app. If install is unavailable, refresh after the page fully loads.';
  }

  if (platform === 'chrome-android') {
    return 'On Android Chrome: tap Install App if shown. If Chrome only shows Create shortcut, refresh once after the page fully loads and try the Chrome menu again.';
  }

  if (platform === 'android') {
    return 'On Android: use your browser menu and choose Install app or Add to Home screen if available.';
  }

  return 'Use your browser menu to install Orario if your browser supports PWAs.';
}

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [visible, setVisible] = useState(false);
  const [platform, setPlatform] = useState('desktop');
  const [installError, setInstallError] = useState('');

  useEffect(() => {
    if (isStandaloneApp()) return undefined;

    const dismissed = safelyGetStorage(DISMISS_KEY) === '1' || safelyGetStorage('attendease_install_dismissed') === '1';
    if (dismissed) return undefined;

    const detectedPlatform = getInstallPlatform();
    setPlatform(detectedPlatform);

    let cancelled = false;
    let fallbackTimer = null;

    const showFallbackPrompt = () => {
      if (cancelled || isStandaloneApp()) return;
      setVisible(true);
    };

    // iOS never fires beforeinstallprompt. Some Android browsers also do not.
    fallbackTimer = window.setTimeout(showFallbackPrompt, detectedPlatform === 'ios' ? 700 : 2200);

    const handleBeforeInstallPrompt = (event) => {
      if (cancelled || isStandaloneApp()) return;

      event.preventDefault();
      window.clearTimeout(fallbackTimer);
      setDeferredPrompt(event);
      setInstallError('');
      setVisible(true);
    };

    const handleAppInstalled = () => {
      safelySetStorage(DISMISS_KEY, '1');
      setVisible(false);
      setDeferredPrompt(null);
      setInstallError('');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      cancelled = true;
      window.clearTimeout(fallbackTimer);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  useEffect(() => {
    if (!visible) return undefined;

    const media = window.matchMedia?.('(display-mode: standalone)');
    const hideIfStandalone = () => {
      if (isStandaloneApp()) setVisible(false);
    };

    media?.addEventListener?.('change', hideIfStandalone);
    window.addEventListener('visibilitychange', hideIfStandalone);
    window.addEventListener('focus', hideIfStandalone);

    return () => {
      media?.removeEventListener?.('change', hideIfStandalone);
      window.removeEventListener('visibilitychange', hideIfStandalone);
      window.removeEventListener('focus', hideIfStandalone);
    };
  }, [visible]);

  const dismiss = () => {
    safelySetStorage(DISMISS_KEY, '1');
    setVisible(false);
    setInstallError('');
  };

  const install = async () => {
    if (!deferredPrompt) return;

    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;

      if (choice?.outcome === 'accepted') {
        safelySetStorage(DISMISS_KEY, '1');
        setVisible(false);
      }
    } catch (error) {
      console.error('Install prompt failed', error);
      setInstallError('Install popup could not open. Use your browser menu to install Orario.');
    } finally {
      setDeferredPrompt(null);
    }
  };

  if (!visible || isStandaloneApp()) return null;

  const hasNativeInstallPrompt = Boolean(deferredPrompt);

  return (
    <div
      className="fixed bottom-[92px] left-4 right-4 z-[60] md:left-1/2 md:-translate-x-1/2 md:max-w-md"
      role="dialog"
      aria-label="Install Orario"
    >
      <div className="voxel-card p-4 flex flex-col gap-3 bg-surface-container">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-body-md font-bold text-on-surface">Install Orario</p>
            <p className="text-label-sm text-on-surface-variant mt-1 leading-5">
              {hasNativeInstallPrompt
                ? 'Install Orario as an app for standalone launch, offline support, and faster attendance tracking.'
                : getInstructions(platform)}
            </p>
            {installError && (
              <p className="text-[10px] text-error font-bold mt-2 leading-4">{installError}</p>
            )}
          </div>
          <button
            type="button"
            onClick={dismiss}
            className="shrink-0 w-8 h-8 border-2 border-outline bg-surface-container-lowest flex items-center justify-center"
            aria-label="Dismiss install prompt"
          >
            <X size={16} />
          </button>
        </div>

        {hasNativeInstallPrompt ? (
          <button
            type="button"
            onClick={install}
            className="voxel-btn-primary flex items-center justify-center gap-2 w-full"
          >
            <Download size={18} />
            Install App
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setVisible(false)}
            className="voxel-btn-secondary flex items-center justify-center gap-2 w-full"
          >
            Got It
          </button>
        )}
      </div>
    </div>
  );
}
