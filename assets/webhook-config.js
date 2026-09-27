/**
 * ASYS — Configuración de Webhooks Power Automate (Sprint 1)
 * ==========================================================
 * Para habilitar el envío real desde el formulario HTML:
 * 1. Crea y guarda el flujo 'FASE1-S1-Registro-DDHH-HTML-a-SharePoint'.
 * 2. Copia la URL del trigger HTTP 'Cuando se recibe una solicitud HTTP'.
 * 3. Sustituye 'PEGAR_URL_WEBHOOK_REGISTRO_DDHH' por dicha URL.
 */
window.ASYS_WEBHOOK_CONFIG = {
  REGISTRO_DDHH:       "https://defaulteaa593ed6784456594d013056f1192.70.environment.api.powerplatform.com:443/powerautomate/automations/direct/cu/29/workflows/0f26fc7cfcd345b8a6b5e3a943eac420/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=es1Nh3PvynSVKykXp0FG9nV47UoayNxD8Y9sx605OmA",
  SOLVENCIA_LIDER:     "PENDIENTE_SPRINT_2",
  SOLVENCIA_WORKFORCE: "PENDIENTE_SPRINT_3"
};
