import React, { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';

const DISMISS_KEY = 'orario_install_dismissed';

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true;

    if (isStandalone || localStorage.getItem(DISMISS_KEY) === '1' || localStorage.getItem('attendease_install_dismissed') === '1') {
      return undefined;
    }

    const handleBeforeInstallPrompt = (event) => {
      event.preventDefault();
      setDeferredPrompt(event);
      setVisible(true);
    };

    const handleAppInstalled = () => {
      setVisible(false);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, '1');
    setVisible(false);
  };

  const install = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      setVisible(false);
    }

    setDeferredPrompt(null);
  };

  if (!visible) return null;

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
            <p className="text-label-sm text-on-surface-variant mt-1">
              Add to your home screen for offline access, fullscreen launch, and faster attendance tracking.
            </p>
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
        <button
          type="button"
          onClick={install}
          className="voxel-btn-primary flex items-center justify-center gap-2 w-full"
        >
          <Download size={18} />
          Install App
        </button>
      </div>
    </div>
  );
}
