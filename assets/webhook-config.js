window.ASYS_WEBHOOK_CONFIG = {
  REGISTRO_DDHH: "https://defaulteaa593ed6784456594d013056f1192.70.environment.api.powerplatform.com:443/powerautomate/automations/direct/cu/29/workflows/0f26fc7cfcd345b8a6b5e3a943eac420/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=es1Nh3PvynSVKykXp0FG9nV47UoayNxD8Y9sx605OmA",
  SOLVENCIA_LIDER: "https://defaulteaa593ed6784456594d013056f1192.70.environment.api.powerplatform.com:443/powerautomate/automations/direct/cu/04/workflows/a53a66dad7584e449899102e705cda81/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=gvfzTVYNJ1tT33UoEhPS4fxXOioXbO50eSNEnESUAz8",
  SOLVENCIA_WORKFORCE: "https://defaulteaa593ed6784456594d013056f1192.70.environment.api.powerplatform.com:443/powerautomate/automations/direct/cu/13/workflows/5d79623c0a144131ac32bb67d7135019/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=QnZaCDdGuqbsx9u1JTmgJZTwsRWq_VB0UdYoSeBqOTc",
  CONSOLIDACION_FASE1: "URL_WEBHOOK_CONSOLIDACION_FASE1"
};

window.ASYS_WEBHOOK_CONFIG.isValid = function() {
  return ['REGISTRO_DDHH','SOLVENCIA_LIDER','SOLVENCIA_WORKFORCE'].every(k => /^https:\/\/.+sig=/.test(this[k]));
};
window.ASYS_WEBHOOK_CONFIG.getPendingMessages = function() { return this.isValid() ? [] : ['Configuración de webhooks incompleta']; };
