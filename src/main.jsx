import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { registerSW } from 'virtual:pwa-register'

import { StatusBar, Style } from '@capacitor/status-bar';
import { Capacitor } from '@capacitor/core';

registerSW({ immediate: true });

if (Capacitor.isNativePlatform()) {
  StatusBar.setOverlaysWebView({
    overlay: true,
  });

  StatusBar.setStyle({
    style: Style.Dark,
  });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)