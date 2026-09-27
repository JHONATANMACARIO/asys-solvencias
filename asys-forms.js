(() => {
  "use strict";

  const employees = Array.isArray(window.ASYS_COLABORADORES) ? window.ASYS_COLABORADORES : [];
  const meta = window.ASYS_COLABORADORES_META || { total: employees.length, source: "Sin fuente", generatedAt: null };
  const CASES_KEY = "ASYS_FASE1_CASES_V1";
  const OPEN_STATUSES = new Set(["FASE_1_ESPERANDO_RESPUESTAS", "FASE_1_LISTA_PARA_CONSOLIDAR"]);

  const byCode = new Map(
    employees.map((employee) => [String(employee.CODIGO_EMPLEADO || "").trim().toUpperCase(), employee])
  );

  const qs = (selector, root = document) => root.querySelector(selector);
  const qsa = (selector, root = document) => [...root.querySelectorAll(selector)];
  let currentCaseId = null;
  let currentCaseCode = null;

  const icons = {
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="m5 12 4 4L19 6"/></svg>',
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
  };

  function normalizeCode(value) {
    return String(value || "").trim().toUpperCase();
  }

  function findEmployee(code) {
    const employee = byCode.get(normalizeCode(code)) || null;
    if (!employee) return null;
    return String(employee.ESTADO_COLABORADOR || "").toUpperCase() === "ACTIVO" ? employee : null;
  }

  function formatDate(value) {
    if (!value) return "—";
    const raw = String(value).slice(0, 10);
    const [year, month, day] = raw.split("-").map(Number);
    if (!year || !month || !day) return raw;
    return new Intl.DateTimeFormat("es-GT", { day: "2-digit", month: "short", year: "numeric" })
      .format(new Date(year, month - 1, day));
  }

  function formatMoney(value, currency = "GTQ") {
    const amount = Number(value || 0);
    const locale = currency === "CRC" ? "es-CR" : "es-GT";
    try {
      return new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 2 }).format(amount);
    } catch {
      return `${currency} ${amount.toLocaleString(locale)}`;
    }
  }

  function fourthThursday(from = new Date()) {
    let year = from.getFullYear();
    let month = from.getMonth();
    for (let offset = 0; offset < 4; offset += 1) {
      let count = 0;
      const days = new Date(year, month + 1, 0).getDate();
      for (let day = 1; day <= days; day += 1) {
        const candidate = new Date(year, month, day);
        if (candidate.getDay() === 4) {
          count += 1;
          if (count === 4 && candidate > from) return candidate;
        }
      }
      month += 1;
      if (month > 11) { month = 0; year += 1; }
    }
    return null;
  }

  function timestamp() {
    const now = new Date();
    return [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, "0"),
      String(now.getDate()).padStart(2, "0"),
      String(now.getHours()).padStart(2, "0"),
      String(now.getMinutes()).padStart(2, "0"),
      String(now.getSeconds()).padStart(2, "0"),
    ].join("");
  }

  function shortGuid() {
    if (window.crypto?.randomUUID) return window.crypto.randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase();
    return Math.random().toString(36).slice(2, 10).toUpperCase().padEnd(8, "0");
  }

  let sessionGuid = null;
  function getSessionIdempotencyKey(reset = false) {
    if (!sessionGuid || reset) {
      if (window.crypto?.randomUUID) {
        sessionGuid = window.crypto.randomUUID().toUpperCase();
      } else {
        sessionGuid = (shortGuid() + shortGuid() + shortGuid() + shortGuid()).slice(0, 32).toUpperCase();
      }
    }
    return sessionGuid;
  }

  function makeCaseId(employee = {}) {
    const country = String(employee.PAIS_CODIGO || employee.PAIS_NOMBRE || "XX")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^A-Za-z]/g, "")
      .slice(0, 3)
      .toUpperCase() || "XX";
    const code = normalizeCode(employee.CODIGO_EMPLEADO || "SIN-CODIGO").replace(/[^A-Z0-9-]/g, "");
    return `BAJA-${country}-${code}-${timestamp()}-${shortGuid()}`;
  }

  function readCases() {
    try {
      const parsed = JSON.parse(localStorage.getItem(CASES_KEY) || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function writeCases(cases) {
    localStorage.setItem(CASES_KEY, JSON.stringify(cases));
  }

  function findOpenCases(code) {
    const normalized = normalizeCode(code);
    return readCases()
      .filter((item) => normalizeCode(item.CODIGO_EMPLEADO) === normalized && OPEN_STATUSES.has(item.ESTADO_PROCESO))
      .sort((a, b) => String(b.ULTIMA_ACTUALIZACION || "").localeCompare(String(a.ULTIMA_ACTUALIZACION || "")));
  }

  function findOpenCase(code) {
    const matches = findOpenCases(code);
    return matches.length === 1 ? matches[0] : null;
  }

  function queryValue(name) {
    return new URLSearchParams(window.location.search).get(name) || "";
  }

  function resetCaseContext() {
    currentCaseId = null;
    currentCaseCode = null;
  }

  function resolveCaseId(config, employee) {
    const code = normalizeCode(employee?.CODIGO_EMPLEADO);
    if (!code) throw new Error("No se pudo identificar al colaborador activo.");

    const openCases = findOpenCases(code);
    if (openCases.length > 1) {
      throw new Error(`Existen ${openCases.length} casos abiertos para ${code}. DDHH debe corregir la duplicidad antes de continuar.`);
    }

    if (config.type === "DDHH_REGISTRO_BAJA") {
      if (openCases.length === 1) {
        throw new Error(`Ya existe un caso abierto para ${code}: ${openCases[0].ID_PROCESO_BAJA}.`);
      }
      currentCaseId = makeCaseId(employee);
      currentCaseCode = code;
      return currentCaseId;
    }

    if (openCases.length !== 1) return null;
    const openCase = openCases[0];
    const queryId = queryValue("id").trim();
    if (queryId && queryId !== openCase.ID_PROCESO_BAJA) {
      throw new Error("El enlace no corresponde al único caso abierto de este colaborador.");
    }
    if (currentCaseId && (currentCaseId !== openCase.ID_PROCESO_BAJA || currentCaseCode !== code)) {
      throw new Error("El contexto del formulario pertenece a otro caso o colaborador.");
    }

    currentCaseId = openCase.ID_PROCESO_BAJA;
    currentCaseCode = code;
    return currentCaseId;
  }

  function setSourceIndicators() {
    qsa("[data-source-total]").forEach((node) => { node.textContent = String(meta.total ?? employees.length); });
    qsa("[data-source-name]").forEach((node) => { node.textContent = meta.source || "MAESTRO_COLABORADORES.xlsx"; });
    qsa("[data-source-date]").forEach((node) => {
      node.textContent = meta.generatedAt ? formatDate(meta.generatedAt) : "Sin sincronizar";
    });

    const datalist = qs("#employeeCodes");
    if (datalist) {
      datalist.innerHTML = employees
        .filter((employee) => String(employee.ESTADO_COLABORADOR).toUpperCase() === "ACTIVO")
        .map((employee) => `<option value="${escapeHtml(employee.CODIGO_EMPLEADO)}">${escapeHtml(employee.NOMBRE_COMPLETO)}</option>`)
        .join("");
    }
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function fillEmployee(employee) {
    qsa("[data-employee-field]").forEach((input) => {
      const key = input.dataset.employeeField;
      let value = employee?.[key] ?? "";
      if (key === "FECHA_INGRESO" && input.type !== "date") value = formatDate(value);
      if (key === "SALARIO_BASE") value = formatMoney(value, employee?.MONEDA);
      input.value = value;
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });

    qsa("[data-employee-text]").forEach((node) => {
      const key = node.dataset.employeeText;
      let value = employee?.[key] ?? "—";
      if (key === "FECHA_INGRESO") value = formatDate(value);
      if (key === "SALARIO_BASE") value = formatMoney(value, employee?.MONEDA);
      node.textContent = value || "—";
    });

    document.dispatchEvent(new CustomEvent("asys:employee", { detail: employee }));
    updateSummary();
  }

  let lastLookedUpCode = null;
  function lookupFromInput(force = false) {
    const codeInput = qs("[data-employee-code]");
    if (!codeInput) return null;
    const code = normalizeCode(codeInput.value);
    codeInput.value = code;
    const employee = findEmployee(code);
    if (code && (code !== lastLookedUpCode || force)) {
      lastLookedUpCode = code;
      fillEmployee(employee);
    }
    codeInput.classList.toggle("invalid", Boolean(code) && !employee);
    return employee;
  }

  function showForm() {
    const landing = qs("[data-screen='landing']");
    const app = qs("[data-screen='form']");
    if (landing) landing.hidden = true;
    if (app) app.hidden = false;
    window.scrollTo({ top: 0, behavior: "smooth" });
    updateProgress();
  }

  function showLanding() {
    const landing = qs("[data-screen='landing']");
    const app = qs("[data-screen='form']");
    if (landing) landing.hidden = false;
    if (app) app.hidden = true;
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function updateProgress() {
    const form = qs("form[data-asys-form]");
    const bar = qs("[data-progress]");
    if (!form || !bar) return;
    const required = qsa("[required]", form).filter((field) => field.offsetParent !== null);
    const groups = new Set();
    let complete = 0;
    required.forEach((field) => {
      if (field.type === "radio" || field.type === "checkbox") {
        const key = field.name;
        if (groups.has(key)) return;
        groups.add(key);
        if (qs(`[name="${CSS.escape(key)}"]:checked`, form)) complete += 1;
      } else if (String(field.value || "").trim() && field.checkValidity()) {
        complete += 1;
      }
    });
    const denominator = required.filter((field) => !["radio", "checkbox"].includes(field.type)).length + groups.size;
    bar.style.width = `${denominator ? Math.round((complete / denominator) * 100) : 0}%`;
  }

  function updateSummary() {
    qsa("[data-summary-from]").forEach((node) => {
      const source = qs(`#${node.dataset.summaryFrom}`) || qs(`[name="${node.dataset.summaryFrom}"]:checked`);
      let value = source?.value || "—";
      if (source?.type === "date") value = formatDate(value);
      node.textContent = value || "—";
    });
  }

  function formToObject(form) {
    const data = {};
    new FormData(form).forEach((value, key) => {
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        data[key] = Array.isArray(data[key]) ? [...data[key], value] : [data[key], value];
      } else {
        data[key] = value;
      }
    });
    return data;
  }

  function downloadJson(payload, filePrefix) {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${filePrefix}_${payload.CODIGO_EMPLEADO || "SIN-CODIGO"}_${payload.ID_PROCESO_BAJA}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  function showToast(title, message) {
    const toast = qs("[data-toast]");
    if (!toast) return;
    const titleNode = qs("strong", toast);
    const messageNode = qs("div span", toast);
    if (titleNode) titleNode.textContent = title;
    if (messageNode) messageNode.textContent = message;
    toast.classList.add("visible");
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.remove("visible"), 4500);
  }

  function validateForm(form) {
    let valid = true;
    qsa(".invalid", form).forEach((field) => field.classList.remove("invalid"));
    qsa("[required]", form).forEach((field) => {
      if (field.offsetParent === null) return;
      const empty = field.type === "radio" || field.type === "checkbox"
        ? !qs(`[name="${CSS.escape(field.name)}"]:checked`, form)
        : !String(field.value || "").trim();
      if (empty || (!empty && !field.checkValidity())) {
        field.classList.add("invalid");
        valid = false;
      }
    });
    const employee = lookupFromInput();
    if (!employee) valid = false;
    if (!valid) {
      qs(".invalid", form)?.scrollIntoView({ behavior: "smooth", block: "center" });
      showToast("Revisa los campos obligatorios", "Hay información inválida o el código no corresponde a un colaborador activo.");
    }
    return valid;
  }

  function responseSlot(type) {
    if (type === "DDHH_REGISTRO_BAJA") return "DDHH";
    if (type === "SOLVENCIA_LIDER") return "LIDER";
    if (type === "SOLVENCIA_WORKFORCE") return "WORKFORCE";
    return type;
  }

  function upsertCase(payload, config) {
    const cases = readCases();
    const code = normalizeCode(payload.CODIGO_EMPLEADO);
    const slot = responseSlot(config.type);
    let index = cases.findIndex((item) => item.ID_PROCESO_BAJA === payload.ID_PROCESO_BAJA);
    const now = new Date().toISOString();

    if (index < 0) {
      if (slot !== "DDHH") {
        throw new Error("Líder y Workforce no pueden crear casos; primero debe responder DDHH.");
      }
      const conflicts = findOpenCases(code);
      if (conflicts.length > 0) {
        throw new Error(`Ya existe un caso abierto para ${code}.`);
      }
      cases.push({
        ID_PROCESO_BAJA: payload.ID_PROCESO_BAJA,
        CODIGO_EMPLEADO: code,
        ESTADO_PROCESO: "FASE_1_ESPERANDO_RESPUESTAS",
        DDHH_RECIBIDO: false,
        LIDER_RECIBIDO: false,
        WORKFORCE_RECIBIDO: false,
        CONSOLIDADO: false,
        FECHA_CREACION: now,
        ULTIMA_ACTUALIZACION: now,
        RESPUESTAS: {},
      });
      index = cases.length - 1;
    }

    const item = cases[index];
    if (normalizeCode(item.CODIGO_EMPLEADO) !== code) {
      throw new Error("El ID_PROCESO_BAJA pertenece a otro colaborador.");
    }
    if (!OPEN_STATUSES.has(item.ESTADO_PROCESO)) {
      throw new Error("El caso ya no está abierto para recibir respuestas.");
    }

    item.RESPUESTAS = item.RESPUESTAS || {};
    if (item.RESPUESTAS[slot]) {
      throw new Error(`El caso ya contiene una respuesta de ${slot}.`);
    }
    item.RESPUESTAS[slot] = payload;
    item.CODIGO_EMPLEADO = code;
    item.DATOS_MAESTRO = payload.DATOS_MAESTRO;
    item.ULTIMA_ACTUALIZACION = now;
    if (slot === "DDHH") item.DDHH_RECIBIDO = true;
    if (slot === "LIDER") item.LIDER_RECIBIDO = true;
    if (slot === "WORKFORCE") item.WORKFORCE_RECIBIDO = true;

    if (item.LIDER_RECIBIDO && item.WORKFORCE_RECIBIDO && item.DDHH_RECIBIDO) {
      item.ESTADO_PROCESO = "FASE_1_LISTA_PARA_CONSOLIDAR";
      const consolidated = {
        ID_PROCESO_BAJA: item.ID_PROCESO_BAJA,
        CODIGO_EMPLEADO: item.CODIGO_EMPLEADO,
        ESTADO_PROCESO: "FASE_1_COMPLETADA",
        FECHA_CONSOLIDACION: now,
        DATOS_MAESTRO: item.DATOS_MAESTRO,
        DDHH: item.RESPUESTAS.DDHH,
        LIDER: item.RESPUESTAS.LIDER,
        WORKFORCE: item.RESPUESTAS.WORKFORCE,
      };
      localStorage.setItem(`ASYS_FASE1_CONSOLIDADO_${item.ID_PROCESO_BAJA}`, JSON.stringify(consolidated));
      item.CONSOLIDADO = true;
      item.ESTADO_PROCESO = "FASE_1_COMPLETADA";
      item.FECHA_CONSOLIDACION = now;
      // El webhook F1.3 se dispara desde submit(), que sí es asíncrona.
      // upsertCase() debe permanecer síncrona para que la correlación local
      // pueda reutilizarse en el navegador y en el validador Node.
    }

    cases[index] = item;
    writeCases(cases);
    return item;
  }

  function buildLocalLinks(caseId, code) {
    const leader = new URL("FORM-2-Lider-Directo.html", window.location.href);
    const workforce = new URL("FORM-3-Workforce.html", window.location.href);
    [leader, workforce].forEach((url) => {
      url.searchParams.set("id", caseId);
      url.searchParams.set("codigo", code);
      url.searchParams.set("autostart", "1");
    });
    return { leader: leader.href, workforce: workforce.href };
  }

  function showCaseActions(caseItem) {
    qs("[data-case-actions]")?.remove();
    const links = buildLocalLinks(caseItem.ID_PROCESO_BAJA, caseItem.CODIGO_EMPLEADO);
    const overlay = document.createElement("div");
    overlay.className = "case-actions-overlay";
    overlay.dataset.caseActions = "true";
    overlay.innerHTML = `
      <section class="case-actions" role="dialog" aria-modal="true" aria-labelledby="case-actions-title">
        <button class="case-actions-close" type="button" aria-label="Cerrar">×</button>
        <span class="case-actions-icon">${icons.check}</span>
        <h2 id="case-actions-title">Registro preparado</h2>
        <p>Continúa con las dos solvencias. Ambos enlaces conservan el mismo caso y código.</p>
        <div class="case-actions-buttons">
          <a class="btn btn-primary" href="${escapeHtml(links.leader)}" target="_blank" rel="noopener">Abrir formulario del Líder</a>
          <a class="btn btn-secondary" href="${escapeHtml(links.workforce)}" target="_blank" rel="noopener">Abrir formulario de Workforce</a>
        </div>
      </section>`;
    document.body.appendChild(overlay);
    qs(".case-actions-close", overlay)?.addEventListener("click", () => overlay.remove());
    overlay.addEventListener("click", (event) => { if (event.target === overlay) overlay.remove(); });
  }

  async function dispatchConsolidationWebhook(caseItem) {
    const webhooks = window.ASYS_WEBHOOK_CONFIG || {};
    const url = webhooks["CONSOLIDACION_FASE1"] || null;
    if (!url || url.startsWith("PEGAR_URL_") || url.startsWith("PENDIENTE_")) {
      return { success: true, simulated: true };
    }
    const payload = {
      ID_PROCESO_BAJA: caseItem.ID_PROCESO_BAJA,
      CODIGO_EMPLEADO: caseItem.CODIGO_EMPLEADO,
      NOMBRE_COMPLETO: caseItem.DATOS_MAESTRO?.NOMBRE_COMPLETO || "",
      PAIS_NOMBRE: caseItem.DATOS_MAESTRO?.PAIS_NOMBRE || "",
      EMPRESA: caseItem.DATOS_MAESTRO?.EMPRESA || "",
      LIDER_RECIBIDO: true,
      WORKFORCE_RECIBIDO: true,
      ESTADO_PROCESO: "FASE_1_COMPLETADA",
      FECHA_CONSOLIDACION: caseItem.FECHA_CONSOLIDACION || new Date().toISOString(),
      DATOS_DDHH: caseItem.RESPUESTAS?.DDHH || {},
      DATOS_LIDER: caseItem.RESPUESTAS?.LIDER || {},
      DATOS_WORKFORCE: caseItem.RESPUESTAS?.WORKFORCE || {}
    };
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      return { success: res.ok, status: res.status };
    } catch (err) {
      console.warn("[ASYS] F1.3 Consolidacion webhook error:", err.message);
      return { success: false, error: err.message };
    }
  }

  function buildDDHHPayload(form, employee) {
    const formData = new FormData(form);
    const getVal = (name) => String(formData.get(name) || "").trim();
    const getNum = (name) => {
      const v = parseFloat(formData.get(name));
      return isNaN(v) ? 0 : v;
    };

    return {
      "TIPO_FORMULARIO": "REGISTRO_DDHH",
      "CLAVE_IDEMPOTENCIA": getSessionIdempotencyKey(false),
      "PAIS_NOMBRE": getVal("PAIS_NOMBRE"),
      "EMPRESA": getVal("EMPRESA"),
      "DEPARTAMENTO": getVal("DEPARTAMENTO") || employee?.DEPARTAMENTO || "",
      "CODIGO_EMPLEADO": normalizeCode(getVal("CODIGO_EMPLEADO") || employee?.CODIGO_EMPLEADO || ""),
      "NOMBRE_COMPLETO": getVal("NOMBRE_COMPLETO") || employee?.NOMBRE_COMPLETO || "",
      "PUESTO": getVal("PUESTO") || employee?.PUESTO || "",
      "FECHA_INGRESO": getVal("FECHA_INGRESO") || employee?.FECHA_INGRESO || "",
      "FECHA_SALIDA": getVal("FECHA_SALIDA"),
      "MOTIVO_SALIDA": getVal("MOTIVO_SALIDA"),
      "VACACIONES_MONTO": getNum("VACACIONES_MONTO"),
      "CAFETERIA_MONTO": getNum("CAFETERIA_MONTO"),
      "OTROS_MONTO": getNum("OTROS_MONTO"),
      "CORREO_LIDER": getVal("CORREO_LIDER") || employee?.LIDER_CORREO || "",
      "CORREO_WORKFORCE": getVal("CORREO_WORKFORCE") || employee?.ANALISTA_WF_CORREO || "",
      "SOLICITANTE_NOMBRE": getVal("SOLICITANTE_NOMBRE"),
      "SOLICITANTE_CORREO": getVal("SOLICITANTE_CORREO"),
      "FECHA_CAPTURA_DDHH": new Date().toISOString()
    };
  }

  async function submitFormToWebhook(payload, config) {
    const webhooks = window.ASYS_WEBHOOK_CONFIG || {};
    const webhookKey = config.type; // REGISTRO_DDHH
    const webhookUrl = webhooks[webhookKey] || webhooks["DDHH_REGISTRO_BAJA"] || null;

    if (!webhookUrl || webhookUrl.startsWith("PEGAR_URL_") || webhookUrl.startsWith("PENDIENTE_")) {
      console.error(`[ASYS Webhook] URL no configurada para ${webhookKey}`);
      return {
        success: false,
        blocked: true,
        error: `La URL del webhook '${webhookKey}' no está configurada en assets/webhook-config.js. Envío bloqueado.`
      };
    }

    try {
      const res = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=UTF-8" },
        body: JSON.stringify(payload)
      });

      let data = null;
      try {
        data = await res.json();
      } catch {
        data = null;
      }

      if (!res.ok) {
        console.warn(`[ASYS Webhook] HTTP ${res.status}:`, data);
        return { success: false, status: res.status, data, error: data?.mensaje || `HTTP ${res.status}` };
      }

      return { success: true, status: res.status, data };
    } catch (err) {
      console.error("[ASYS Webhook] Error de red:", err);
      return { success: false, status: 0, error: err.message || "Error de conexión de red" };
    }
  }

  async function submit(form, config) {
    if (!validateForm(form)) return;
    const submitBtn = qs("button[type='submit']", form);
    if (submitBtn) { submitBtn.disabled = true; submitBtn.style.opacity = "0.6"; }

    const employee = findEmployee(qs("[data-employee-code]")?.value);
    const isDDHH = config.type === "REGISTRO_DDHH" || config.type === "DDHH_REGISTRO_BAJA" || config.casePrefix === "DDHH" || config.casePrefix === "BAJA";

    // 1. Construir el payload canónico plano
    let payload;
    if (isDDHH) {
      payload = buildDDHHPayload(form, employee);
    } else {
      let caseId;
      try {
        caseId = resolveCaseId(config, employee);
      } catch (error) {
        showToast("No se puede correlacionar el caso", error.message);
        if (submitBtn) { submitBtn.disabled = false; submitBtn.style.opacity = "1"; }
        return;
      }
      payload = {
        ID_PROCESO_BAJA: caseId,
        TOKEN_SEGURIDAD: queryValue("token") || shortGuid(),
        TIPO_FORMULARIO: config.type,
        FECHA_CAPTURA: new Date().toISOString(),
        CODIGO_EMPLEADO: employee?.CODIGO_EMPLEADO || "",
        DATOS_MAESTRO: employee,
        RESPUESTAS: formToObject(form),
        FUENTE_MAESTRO: meta,
      };
    }

    // 2. Envío único por Webhook HTTP (CORS simple request: text/plain)
    const webhookResult = await submitFormToWebhook(payload, config);

    if (webhookResult.blocked) {
      showToast("Envío bloqueado", webhookResult.error);
      if (submitBtn) { submitBtn.disabled = false; submitBtn.style.opacity = "1"; }
      return;
    }

    if (webhookResult.success) {
      const serverId = webhookResult.data?.idProcesoBaja || webhookResult.data?.ID_PROCESO_BAJA;
    if (!serverId) {
      if (submitBtn) { submitBtn.disabled = false; submitBtn.style.opacity = "1"; }
      showToast("Error en respuesta del servidor", "El servidor no devolvió idProcesoBaja. No se puede confirmar el registro.");
      return;
    }
      const serverMsg = webhookResult.data?.mensaje || "Solicitud registrada correctamente";

      // Guardar borrador local en localStorage solo como respaldo
      try {
        localStorage.setItem(`ASYS_BAJA_${serverId}_DRAFT`, JSON.stringify(payload));
      } catch (e) {}

      showToast("Solicitud registrada con éxito", `${serverMsg} (ID: ${serverId})`);
      
      // Renovar CLAVE_IDEMPOTENCIA para el siguiente registro distinto
      getSessionIdempotencyKey(true);

      if (isDDHH) {
        showCaseActions({ ID_PROCESO_BAJA: serverId, CODIGO_EMPLEADO: payload.CODIGO_EMPLEADO });
      }
    } else {
      // Manejo estricto de respuestas según Tarea 9
      const status = webhookResult.status;
      const errorMsg = webhookResult.data?.mensaje || webhookResult.error || "No se pudo registrar la solicitud en SharePoint.";

      if (status === 409) {
        showToast("Caso duplicado (409)", errorMsg);
      } else if (status === 400) {
        showToast("Datos inválidos (400)", errorMsg);
      } else {
        showToast("Error de servidor / Red", `${errorMsg} Tu información se conserva; puedes volver a presionar Guardar registro para reintentar.`);
      }
      // NOTA: NO renovamos sessionGuid en error para que el próximo clic reintente con la MISMA CLAVE_IDEMPOTENCIA
    }

    if (submitBtn) { submitBtn.disabled = false; submitBtn.style.opacity = "1"; }
  }

  function initConditionals() {
    qsa("[data-toggle-target]").forEach((field) => {
      const update = () => {
        const target = qs(field.dataset.toggleTarget);
        if (!target) return;
        const expected = field.dataset.toggleValue ?? "SI";
        const active = field.checked && field.value === expected;
        target.hidden = !active;
        qsa("[data-required-when-visible]", target).forEach((input) => { input.required = active; });
        updateProgress();
      };
      field.addEventListener("change", update);
      update();
    });
  }

  function init(config = {}) {
    resetCaseContext();
    getSessionIdempotencyKey(true); // Generar GUID al cargar formulario
    setSourceIndicators();
    qsa("[data-case-id]").forEach((node) => { node.textContent = "Pendiente"; });

    const paymentDate = fourthThursday();
    qsa("[data-fourth-thursday]").forEach((node) => {
      node.textContent = paymentDate ? formatDate(paymentDate.toISOString()) : "No calculado";
      if ("value" in node) node.value = paymentDate ? paymentDate.toISOString().slice(0, 10) : "";
    });

    qsa("[data-action='start']").forEach((button) => button.addEventListener("click", () => {
      getSessionIdempotencyKey(true);
      showForm();
    }));
    qsa("[data-action='home']").forEach((button) => button.addEventListener("click", () => {
      getSessionIdempotencyKey(true);
      showLanding();
    }));

    const codeInput = qs("[data-employee-code]");
    if (codeInput) {
      codeInput.addEventListener("change", () => lookupFromInput(true));
      codeInput.addEventListener("blur", () => lookupFromInput(false));
      codeInput.addEventListener("input", () => {
        codeInput.value = normalizeCode(codeInput.value);
        if (findEmployee(codeInput.value)) lookupFromInput(true);
      });
      const queryCode = normalizeCode(queryValue("codigo"));
      if (queryCode) {
        codeInput.value = queryCode;
        lookupFromInput(true);
      }
    }

    initConditionals();
    const form = qs("form[data-asys-form]");
    if (form) {
      form.addEventListener("input", () => { updateProgress(); updateSummary(); });
      form.addEventListener("change", () => { updateProgress(); updateSummary(); });
      form.addEventListener("submit", (event) => {
        event.preventDefault();
        submit(form, config);
      });
    }

    if (queryValue("autostart") === "1") showForm();
    updateProgress();
    updateSummary();
  }

  window.ASYSForms = {
    init,
    normalizeCode,
    findEmployee,
    readCases,
    writeCases,
    findOpenCases,
    findOpenCase,
    makeCaseId,
    resolveCaseId,
    resetCaseContext,
    responseSlot,
    upsertCase,
    buildLocalLinks,
    formatMoney,
    formatDate,
    fourthThursday,
    showToast,
    updateSummary,
    escapeHtml,
    meta,
    employees,
    icons,
    buildDDHHPayload,
    getSessionIdempotencyKey,
    submitFormToWebhook,
  };
})();
