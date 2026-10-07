/**
 * ASYS · Cargador de entorno v1.1.0
 *
 * En GitHub/Apache carga assets/entorno.json.
 * Al abrir el HTML directamente (file://), usa DEVELOPMENT sin intentar XHR,
 * porque Chrome bloquea archivos locales por CORS. Ese modo local no altera
 * la configuración de webhooks, que se carga en webhook-config.js.
 */
(function () {
  'use strict';

  const ENTORNO_PATH = 'assets/entorno.json';
  const LOCAL_DEFAULTS = Object.freeze({
    version: 'local-defaults',
    environment: 'DEVELOPMENT',
    frontend: {
      productionMode: false,
      antiDEMO: { enabled: false },
      webhooks: { requireExternalConfig: true }
    }
  });

  window.ASYS_ENTORNO_CONFIG = null;
  window.ASYS_ENTORNO_LOADED = false;
  window.ASYS_ENTORNO_ERROR = null;

  function applyConfig(config) {
    window.ASYS_ENTORNO_CONFIG = config;
    window.ASYS_ENTORNO_LOADED = true;
    window.ASYS_ENTORNO_ERROR = null;
    window.ASYS_PRODUCTION_MODE = config?.frontend?.productionMode === true;
    window.ASYS_ANTI_DEMO_ENABLED = config?.frontend?.antiDEMO?.enabled === true;
    return config;
  }

  function useLocalDefaults() {
    const config = applyConfig(LOCAL_DEFAULTS);
    console.info('[ENTORNO] Archivo local: modo DEVELOPMENT aplicado sin solicitud de red.');
    return config;
  }

  function loadEntornoSync() {
    if (window.location.protocol === 'file:') return useLocalDefaults();

    try {
      const xhr = new XMLHttpRequest();
      xhr.open('GET', ENTORNO_PATH, false);
      xhr.send(null);
      if (xhr.status !== 200) throw new Error(`HTTP ${xhr.status}`);
      const config = applyConfig(JSON.parse(xhr.responseText));
      console.info(`[ENTORNO] ${config.environment || 'DEVELOPMENT'} · configuración cargada.`);
      return config;
    } catch (error) {
      window.ASYS_ENTORNO_ERROR = String(error?.message || error);
      window.ASYS_PRODUCTION_MODE = false;
      window.ASYS_ANTI_DEMO_ENABLED = false;
      console.warn('[ENTORNO] No se pudo cargar entorno.json; se usa DEVELOPMENT.');
      return null;
    }
  }

  window.loadEntornoAsync = async function () {
    if (window.location.protocol === 'file:') return useLocalDefaults();
    try {
      const response = await fetch(ENTORNO_PATH, { cache: 'no-cache' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return applyConfig(await response.json());
    } catch (error) {
      window.ASYS_ENTORNO_ERROR = String(error?.message || error);
      console.warn('[ENTORNO] No se pudo cargar entorno.json de forma asíncrona.');
      return null;
    }
  };

  window.getEntornoConfig = function (configPath, defaultValue = null) {
    let value = window.ASYS_ENTORNO_CONFIG;
    for (const part of String(configPath).split('.')) {
      if (!value || typeof value !== 'object' || !(part in value)) return defaultValue;
      value = value[part];
    }
    return value;
  };

  window.isProduction = () => window.ASYS_PRODUCTION_MODE === true;
  window.isAntiDEMOEnabled = () => window.ASYS_ANTI_DEMO_ENABLED === true;

  loadEntornoSync();
})();

window.ASYS_ENTORNO_LOADER_VERSION = '1.1.0';
