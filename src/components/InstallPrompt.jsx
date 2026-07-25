import React, { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';

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
  const isSafari = /safari/i.test(ua) && !/crios|fxios|edgios/i.test(ua);

  if (isIOS && isSafari) return 'ios-safari';
  if (isIOS) return 'ios-other';
  if (isAndroid && isSamsung) return 'samsung-android';
  if (isAndroid && isChrome) return 'chrome-android';
  if (isAndroid) return 'android';
  return 'desktop';
}

function getInstallTitle(platform) {
  if (platform.startsWith('ios')) return 'Install on iPhone/iPad';
  if (platform.includes('android')) return 'Install on Android';
  return 'Install Orario';
}

function getInstallSteps(platform, hasNativePrompt) {
  if (hasNativePrompt) {
    return [
      'Tap Install App below.',
      'Confirm the browser install popup.',
      'Open Orario from your home screen/app drawer.',
    ];
  }

  if (platform === 'ios-safari') {
    return [
      'Tap the Share button in Safari.',
      'Scroll and tap Add to Home Screen.',
      'Tap Add. Open Orario from your home screen.',
    ];
  }

  if (platform === 'ios-other') {
    return [
      'For the most reliable install, open this page in Safari.',
      'Tap Share in Safari, then Add to Home Screen.',
      'Tap Add. Open Orario from your home screen.',
    ];
  }

  if (platform === 'samsung-android') {
    return [
      'Open the Samsung Internet menu.',
      'Tap Add page to or Install app.',
      'Choose Home screen/apps and confirm.',
    ];
  }

  if (platform === 'chrome-android') {
    return [
      'Wait until the page fully loads, then open Chrome menu ⋮.',
      'Tap Install app. If you only see Create shortcut, refresh once and try again.',
      'Confirm install and open Orario from your app drawer.',
    ];
  }

  if (platform === 'android') {
    return [
      'Open your browser menu.',
      'Choose Install app or Add to Home screen if available.',
      'Confirm and open Orario from your home screen.',
    ];
  }

  return [
    'Open your browser menu.',
    'Choose Install Orario or Install this site if available.',
    'Launch Orario from your apps or desktop shortcut.',
  ];
}

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [visible, setVisible] = useState(false);
  const [platform, setPlatform] = useState('desktop');
  const [installError, setInstallError] = useState('');

  useEffect(() => {
    if (isStandaloneApp()) return undefined;

    const detectedPlatform = getInstallPlatform();
    setPlatform(detectedPlatform);

    let cancelled = false;
    const fallbackTimer = window.setTimeout(() => {
      if (!cancelled && !isStandaloneApp()) setVisible(true);
    }, detectedPlatform.startsWith('ios') ? 600 : 1400);

    const handleBeforeInstallPrompt = (event) => {
      if (cancelled || isStandaloneApp()) return;

      event.preventDefault();
      window.clearTimeout(fallbackTimer);
      setDeferredPrompt(event);
      setInstallError('');
      setVisible(true);
    };

    const handleAppInstalled = () => {
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

    const hideIfInstalled = () => {
      if (isStandaloneApp()) setVisible(false);
    };

    const standaloneQuery = window.matchMedia?.('(display-mode: standalone)');
    const fullscreenQuery = window.matchMedia?.('(display-mode: fullscreen)');

    standaloneQuery?.addEventListener?.('change', hideIfInstalled);
    fullscreenQuery?.addEventListener?.('change', hideIfInstalled);
    window.addEventListener('focus', hideIfInstalled);
    window.addEventListener('visibilitychange', hideIfInstalled);

    return () => {
      standaloneQuery?.removeEventListener?.('change', hideIfInstalled);
      fullscreenQuery?.removeEventListener?.('change', hideIfInstalled);
      window.removeEventListener('focus', hideIfInstalled);
      window.removeEventListener('visibilitychange', hideIfInstalled);
    };
  }, [visible]);

  const install = async () => {
    if (!deferredPrompt) return;

    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;

      if (choice?.outcome === 'accepted') {
        setVisible(false);
      } else {
        setInstallError('Install was cancelled. You can also use the browser menu to install Orario.');
      }
    } catch (error) {
      console.error('Install prompt failed', error);
      setInstallError('Install popup could not open. Use the browser menu steps below.');
    } finally {
      setDeferredPrompt(null);
    }
  };

  if (!visible || isStandaloneApp()) return null;

  const hasNativeInstallPrompt = Boolean(deferredPrompt);
  const steps = getInstallSteps(platform, hasNativeInstallPrompt);

  return (
    <div
      className="fixed bottom-[92px] left-4 right-4 z-[60] md:left-1/2 md:-translate-x-1/2 md:max-w-md"
      role="dialog"
      aria-label="Install Orario"
    >
      <div className="voxel-card p-4 flex flex-col gap-3 bg-surface-container">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-body-md font-bold text-on-surface">{getInstallTitle(platform)}</p>
            <p className="text-label-sm text-on-surface-variant mt-1 leading-5">
              Install Orario for standalone launch, offline support, and faster attendance tracking.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setVisible(false)}
            className="shrink-0 w-8 h-8 border-2 border-outline bg-surface-container-lowest flex items-center justify-center"
            aria-label="Hide install prompt"
          >
            <X size={16} />
          </button>
        </div>

        <ol className="flex flex-col gap-1.5 text-label-sm text-on-surface-variant list-decimal pl-5 leading-5">
          {steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>

        {installError && (
          <p className="text-[10px] text-error font-bold leading-4">{installError}</p>
        )}

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
