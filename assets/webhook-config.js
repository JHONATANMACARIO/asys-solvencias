window.ASYS_WEBHOOK_CONFIG = {
  REGISTRO_DDHH: "https://defaulteaa593ed6784456594d013056f1192.70.environment.api.powerplatform.com:443/powerautomate/automations/direct/cu/29/workflows/0f26fc7cfcd345b8a6b5e3a943eac420/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=es1Nh3PvynSVKykXp0FG9nV47UoayNxD8Y9sx605OmA",
  SOLVENCIA_LIDER: "https://defaulteaa593ed6784456594d013056f1192.70.environment.api.powerplatform.com:443/powerautomate/automations/direct/cu/06/workflows/1488f2d359dc455aa7ef990520832f9b/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=NBzGMH1FHyupYS6f5T8f7afWMbX8GSqKucPHakA5mVM",
  SOLVENCIA_WORKFORCE: "https://defaulteaa593ed6784456594d013056f1192.70.environment.api.powerplatform.com:443/powerautomate/automations/direct/cu/00/workflows/25fb629e1cf84f0c90278582c2370656/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=ex4V3nPDW8peouTv6NjLSpPwi31Z8zyV_GI1DjdV9kI",
  CONSOLIDACION_FASE1: "URL_WEBHOOK_CONSOLIDACION_FASE1"
};

window.ASYS_WEBHOOK_CONFIG.isValid = function() {
  return ['REGISTRO_DDHH','SOLVENCIA_LIDER','SOLVENCIA_WORKFORCE'].every(k => /^https:\/\/.+api-version=/.test(this[k]));
};
window.ASYS_WEBHOOK_CONFIG.getPendingMessages = function() { return this.isValid() ? [] : ['Configuración de webhooks incompleta']; };
