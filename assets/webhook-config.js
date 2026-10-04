/**
 * ASYS — Configuración de Webhooks Power Automate
 * ================================================
 * 
 * ARCHIVO ACTIVO CON MARCADORES DE SEGURIDAD
 * 
 * Este archivo contiene marcadores en lugar de URLs reales para evitar
 * exponer las firmas de seguridad (sig=...) en el control de versiones.
 * 
 * Para configurar las URLs reales:
 * 1. Consulta webhook-config.example.js para instrucciones completas
 * 2. Obtén las URLs de los triggers HTTP en Power Automate
 * 3. Reemplaza los marcadores URL_WEBHOOK_* por las URLs reales
 * 4. NO versiones este archivo con URLs reales
 * 
 * IMPORTANTE: Si este archivo contenía URLs reales anteriormente,
 * esas URLs deben rotarse en Power Automate por seguridad.
 */

window.ASYS_WEBHOOK_CONFIG = {
  REGISTRO_DDHH:       "URL_WEBHOOK_REGISTRO_DDHH",
  SOLVENCIA_LIDER:     "URL_WEBHOOK_SOLVENCIA_LIDER",
  SOLVENCIA_WORKFORCE: "URL_WEBHOOK_SOLVENCIA_WORKFORCE",
  CONSOLIDACION_FASE1: "URL_WEBHOOK_CONSOLIDACION_FASE1"
};

/**
 * Validación de configuración
 */
window.ASYS_WEBHOOK_CONFIG.isValid = function() {
  const required = ['REGISTRO_DDHH', 'SOLVENCIA_LIDER', 'SOLVENCIA_WORKFORCE'];
  for (const key of required) {
    const url = this[key];
    if (!url || url.startsWith('URL_WEBHOOK_') || url.startsWith('PENDIENTE_')) {
      return false;
    }
  }
  return true;
};

window.ASYS_WEBHOOK_CONFIG.getPendingMessages = function() {
  const messages = [];
  const checks = {
    'REGISTRO_DDHH': 'Registro DDHH (F1.1)',
    'SOLVENCIA_LIDER': 'Solvencia Líder (F1.2-L)',
    'SOLVENCIA_WORKFORCE': 'Solvencia Workforce (F1.2-WF)'
  };
  
  for (const [key, label] of Object.entries(checks)) {
    const url = this[key];
    if (!url || url.startsWith('URL_WEBHOOK_') || url.startsWith('PENDIENTE_')) {
      messages.push(`- ${label}: no configurado`);
    }
  }
  
  return messages;
};
