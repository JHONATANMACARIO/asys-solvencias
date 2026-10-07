/**
 * ENTORNO LOADER v1.0
 * ===================
 * Carga configuración centralizada desde .kiro-config/entorno.json
 * 
 * USO:
 * 1. Incluir ANTES de asys-forms-unified.js:
 *    <script src="assets/entorno-loader.js"></script>
 * 
 * 2. Esperar a que se cargue:
 *    window.ASYS_ENTORNO_CONFIG contiene la configuración
 * 
 * 3. Las variables se exponen automáticamente:
 *    - window.ASYS_PRODUCTION_MODE (boolean)
 *    - window.ASYS_ANTI_DEMO_ENABLED (boolean)
 *    - window.ASYS_WEBHOOK_CONFIG (object - si existe webhook-config.js)
 */

(function() {
  'use strict';

  // Se resuelve desde los HTML publicados en la raíz de GitHub Pages.
  // Solo contiene configuración pública; nunca deben incluirse secretos.
  const ENTORNO_PATH = 'assets/entorno.json';
  
  // Estado de carga
  window.ASYS_ENTORNO_CONFIG = null;
  window.ASYS_ENTORNO_LOADED = false;
  window.ASYS_ENTORNO_ERROR = null;

  /**
   * Carga síncrona de entorno.json
   * NOTA: XMLHttpRequest síncrono está deprecado pero es necesario
   * para garantizar que la config esté disponible antes de init()
   */
  function loadEntornoSync() {
    try {
      const xhr = new XMLHttpRequest();
      xhr.open('GET', ENTORNO_PATH, false); // false = síncrono
      xhr.send(null);
      
      if (xhr.status === 200) {
        const config = JSON.parse(xhr.responseText);
        window.ASYS_ENTORNO_CONFIG = config;
        window.ASYS_ENTORNO_LOADED = true;
        
        // Exponer variables críticas
        window.ASYS_PRODUCTION_MODE = config.frontend?.productionMode || false;
        window.ASYS_ANTI_DEMO_ENABLED = config.frontend?.antiDEMO?.enabled || false;
        
        console.log('[ENTORNO] Configuración cargada:', {
          version: config.version,
          environment: config.environment,
          productionMode: window.ASYS_PRODUCTION_MODE,
          antiDEMO: window.ASYS_ANTI_DEMO_ENABLED
        });
        
        return config;
      } else {
        throw new Error(`HTTP ${xhr.status}: ${xhr.statusText}`);
      }
    } catch (error) {
      window.ASYS_ENTORNO_ERROR = error.message;
      console.error('[ENTORNO] Error cargando configuración:', error);
      
      // Fallback seguro
      window.ASYS_PRODUCTION_MODE = false;
      window.ASYS_ANTI_DEMO_ENABLED = false;
      
      console.warn('[ENTORNO] Usando valores por defecto (DEVELOPMENT)');
      return null;
    }
  }

  /**
   * Carga asíncrona de entorno.json (alternativa moderna)
   * Para usarse con async/await en scripts futuros
   */
  window.loadEntornoAsync = async function() {
    try {
      const response = await fetch(ENTORNO_PATH);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const config = await response.json();
      window.ASYS_ENTORNO_CONFIG = config;
      window.ASYS_ENTORNO_LOADED = true;
      
      window.ASYS_PRODUCTION_MODE = config.frontend?.productionMode || false;
      window.ASYS_ANTI_DEMO_ENABLED = config.frontend?.antiDEMO?.enabled || false;
      
      console.log('[ENTORNO] Configuración cargada (async):', {
        version: config.version,
        environment: config.environment
      });
      
      return config;
    } catch (error) {
      window.ASYS_ENTORNO_ERROR = error.message;
      console.error('[ENTORNO] Error cargando configuración (async):', error);
      return null;
    }
  };

  /**
   * Helper: Obtener valor de configuración con path notation
   * Ejemplo: getConfig('powerAutomate.variables.MAX_OPEN_CASES_PER_EMPLOYEE')
   */
  window.getEntornoConfig = function(path, defaultValue = null) {
    if (!window.ASYS_ENTORNO_CONFIG) {
      console.warn('[ENTORNO] Configuración no cargada, retornando default');
      return defaultValue;
    }
    
    const parts = path.split('.');
    let value = window.ASYS_ENTORNO_CONFIG;
    
    for (const part of parts) {
      if (value && typeof value === 'object' && part in value) {
        value = value[part];
      } else {
        return defaultValue;
      }
    }
    
    return value;
  };

  /**
   * Helper: Verificar si estamos en modo producción
   */
  window.isProduction = function() {
    return window.ASYS_PRODUCTION_MODE === true;
  };

  /**
   * Helper: Verificar si anti-DEMO está habilitado
   */
  window.isAntiDEMOEnabled = function() {
    return window.ASYS_ANTI_DEMO_ENABLED === true;
  };

  // Cargar configuración inmediatamente al cargar el script
  loadEntornoSync();

  // Si webhook-config.js existe, validar contra entorno.json
  if (typeof window.ASYS_WEBHOOK_CONFIG !== 'undefined') {
    const requireExternal = getEntornoConfig('frontend.webhooks.requireExternalConfig', false);
    if (!requireExternal) {
      console.warn('[ENTORNO] webhook-config.js cargado pero requireExternalConfig=false');
    }
  }

})();

// Exponer versión del loader
window.ASYS_ENTORNO_LOADER_VERSION = '1.0.0';
