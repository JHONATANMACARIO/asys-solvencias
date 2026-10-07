/**
 * ASYS · Formularios Fase 1 (DDHH, Líder, Workforce)
 *
 * Requiere, en este orden:
 *   assets/colaboradores.js   -> window.ASYS_COLABORADORES
 *   assets/catalogos.js       -> window.ASYS_CATALOGOS (opcional)
 *   assets/entorno-loader.js  -> window.ASYS_PRODUCTION_MODE
 *   assets/webhook-config.js  -> window.ASYS_WEBHOOK_CONFIG
 */
(function () {
  'use strict';

  const VERSION = '4.3.0';

  const FORM_TYPES = {
    REGISTRO_DDHH: { webhookKey: 'REGISTRO_DDHH', casePrefix: 'BAJA', responseKey: 'RESPONSE_ID_DDHH', label: 'Registro DDHH' },
    SOLVENCIA_LIDER: { webhookKey: 'SOLVENCIA_LIDER', casePrefix: 'LIDER', responseKey: 'RESPONSE_ID_LIDER', label: 'Solvencia del líder' },
    SOLVENCIA_WORKFORCE: { webhookKey: 'SOLVENCIA_WORKFORCE', casePrefix: 'WF', responseKey: 'RESPONSE_ID_WORKFORCE', label: 'Solvencia Workforce' }
  };

  let currentFormType = null;
  let currentEmployee = null;
  let submitting = false;

  // ------------------------------------------------------------------
  // Maestro de colaboradores
  // ------------------------------------------------------------------
  const employees = Array.isArray(window.ASYS_COLABORADORES) ? window.ASYS_COLABORADORES : [];
  const byLookupKey = new Map();
  const byCode = new Map();
  const searchIndex = [];
  employees.forEach((emp) => {
    const code = normalizeCode(emp.CODIGO_EMPLEADO);
    if (!code) return;
    byLookupKey.set(normalizeCode(emp.CLAVE_BUSQUEDA || emp.CODIGO_EMPLEADO), emp);
    if (!byCode.has(code)) byCode.set(code, []);
    byCode.get(code).push(emp);
    searchIndex.push({
      emp,
      text: normalizeSearch([emp.CODIGO_EMPLEADO, emp.NOMBRE_COMPLETO, emp.PAIS_NOMBRE, emp.EMPRESA].filter(Boolean).join(' '))
    });
  });

  function normalizeCode(value) {
    return String(value ?? '').trim().replace(/\s+/g, ' ').toUpperCase();
  }

  function normalizeSearch(value) {
    return normalizeCode(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  function isAllowed(emp) {
    if (!emp) return false;
    if (String(emp.ESTADO_COLABORADOR || '').toUpperCase() === 'INACTIVO') return false;
    if (window.ASYS_PRODUCTION_MODE === true) {
      if (String(emp.CODIGO_EMPLEADO || '').toUpperCase().startsWith('DEMO-')) return false;
      if (String(emp.CORREO_COLABORADOR || '').toLowerCase().includes('example.invalid')) return false;
    }
    return true;
  }

  /** Todas las personas que coinciden con lo escrito (clave exacta o código). */
  function findCandidates(value) {
    const key = normalizeCode(value);
    if (!key) return [];
    const exact = byLookupKey.get(key);
    if (exact) return isAllowed(exact) ? [exact] : [];
    const codePart = key.split('|')[0].trim();
    return (byCode.get(codePart) || []).filter(isAllowed);
  }

  /** Búsqueda parcial rápida por código, nombre, país o empresa. */
  function findSuggestions(value) {
    const terms = normalizeSearch(value).split(' ').filter(Boolean);
    if (!terms.length || normalizeSearch(value).length < 2) return [];
    const matches = [];
    for (const entry of searchIndex) {
      if (isAllowed(entry.emp) && terms.every((term) => entry.text.includes(term))) matches.push(entry.emp);
    }
    return matches.sort((a, b) => {
      const activeA = String(a.ESTADO_COLABORADOR).toUpperCase() === 'ACTIVO' ? 0 : 1;
      const activeB = String(b.ESTADO_COLABORADOR).toUpperCase() === 'ACTIVO' ? 0 : 1;
      return activeA - activeB || String(a.NOMBRE_COMPLETO).localeCompare(String(b.NOMBRE_COMPLETO), 'es');
    });
  }

  /** Devuelve la persona sólo si la búsqueda es inequívoca. */
  function findEmployee(value) {
    const matches = findCandidates(value);
    return matches.length === 1 ? matches[0] : null;
  }

  // ------------------------------------------------------------------
  // Utilidades
  // ------------------------------------------------------------------
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  function formatDate(value) {
    if (!value) return '—';
    const [y, m, d] = String(value).slice(0, 10).split('-').map(Number);
    if (!y || !m || !d) return String(value);
    return new Intl.DateTimeFormat('es-GT', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(y, m - 1, d));
  }

  function formatMoney(value, currency = 'GTQ') {
    const amount = Number(value || 0);
    const locale = currency === 'CRC' ? 'es-CR' : 'es-GT';
    try {
      return new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: 2 }).format(amount);
    } catch {
      return `${currency} ${amount.toLocaleString(locale)}`;
    }
  }

  function shortGuid() {
    if (window.crypto?.randomUUID) return window.crypto.randomUUID().replaceAll('-', '').slice(0, 8).toUpperCase();
    return Math.random().toString(36).slice(2, 10).toUpperCase().padEnd(8, '0');
  }

  function uniqueId(prefix) {
    return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  }

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  // ------------------------------------------------------------------
  // Mensajes en pantalla
  // ------------------------------------------------------------------
  let toastTimer = null;
  function showToast(message, type = 'info') {
    const toast = $('[data-toast]');
    if (!toast) return;
    toast.className = `toast ${type}`;
    toast.textContent = '';
    const title = document.createElement('strong');
    title.textContent = type === 'error' ? 'Revisa esto' : type === 'success' ? 'Listo' : 'Aviso';
    const body = document.createElement('span');
    body.textContent = message;
    toast.append(title, body);
    void toast.offsetWidth;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), type === 'error' ? 7000 : 4000);
  }

  function showBanner(title, message, variant = 'warn') {
    const host = $('[data-banner]');
    if (!host) return;
    const box = document.createElement('div');
    box.className = variant === 'info' ? 'banner banner-info' : 'banner';
    const strong = document.createElement('strong');
    strong.textContent = title;
    const text = document.createElement('span');
    text.textContent = message;
    box.append(strong, text);
    host.appendChild(box);
  }

  function showScreen(name) {
    const target = $(`[data-screen="${name}"]`);
    if (!target) return;
    $$('[data-screen]').forEach((el) => { el.hidden = el !== target; });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ------------------------------------------------------------------
  // Webhooks
  // ------------------------------------------------------------------
  function webhookURL(formType) {
    const cfg = FORM_TYPES[formType];
    const url = cfg && window.ASYS_WEBHOOK_CONFIG ? window.ASYS_WEBHOOK_CONFIG[cfg.webhookKey] : null;
    if (!url || typeof url !== 'string' || !url.startsWith('https://')) return null;
    return url;
  }

  async function sendToWebhook(data, url) {
    let response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
    } catch {
      const error = new Error('No se pudo conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.');
      error.status = 0;
      throw error;
    }
    const text = await response.text();
    let body = {};
    try { body = text ? JSON.parse(text) : {}; } catch { body = { mensaje: text }; }
    if (!response.ok || body.ok === false) {
      const error = new Error(String(body.mensaje || body.message || body.error?.message || '').slice(0, 200));
      error.status = response.status;
      throw error;
    }
    return body;
  }

  function friendlyError(error) {
    switch (error.status) {
      case 0: return error.message;
      case 400: return error.message || 'Algún dato no es válido. Revisa el formulario.';
      case 401:
      case 403: return 'El enlace no es válido o ya venció. Usa el enlace que llegó por correo.';
      case 404: return 'El caso no existe o ya fue cerrado.';
      case 409: return error.message || 'Ya existe un registro para este colaborador.';
      default: return 'El servidor no pudo guardar el registro. Inténtalo de nuevo en unos minutos.';
    }
  }

  // ------------------------------------------------------------------
  // Colaborador: búsqueda y llenado
  // ------------------------------------------------------------------
  function setLookupStatus(text, kind = '') {
    const el = $('[data-lookup-status]');
    if (!el) return;
    el.textContent = text;
    el.className = `lookup-status ${kind}`.trim();
  }

  function clearMatches() {
    const host = $('[data-lookup-matches]');
    if (host) host.textContent = '';
  }

  function ensureOption(select, value) {
    if (!value) return;
    const exists = Array.from(select.options).some((opt) => opt.value === value || opt.text === value);
    if (!exists) {
      const opt = document.createElement('option');
      opt.textContent = value;
      select.appendChild(opt);
    }
  }

  function populateEmployeeData(emp) {
    currentEmployee = emp || null;
    $$('[data-employee-field]').forEach((field) => {
      const key = field.getAttribute('data-employee-field');
      let value = emp ? (emp[key] ?? '') : '';
      if (field.type === 'date' && typeof value === 'string') value = value.slice(0, 10);
      // Para correos editables, no borres lo que la persona ya escribió si el maestro viene vacío.
      if (emp && !value && !field.readOnly && field.type === 'email') return;
      if (field.tagName === 'SELECT') ensureOption(field, value);
      field.value = value;
      field.classList.remove('invalid');
    });
    $$('[data-employee-text]').forEach((el) => {
      const key = el.getAttribute('data-employee-text');
      el.textContent = emp ? (emp[key] || '') : '';
    });
    if (emp) document.dispatchEvent(new CustomEvent('asys:employee-loaded', { detail: emp }));
  }

  function selectEmployee(emp) {
    const input = $('[data-employee-code]');
    clearMatches();
    populateEmployeeData(emp);
    if (input) {
      input.value = emp.CODIGO_EMPLEADO;
      input.classList.remove('invalid');
      lastLookupKey = normalizeCode(emp.CODIGO_EMPLEADO);
    }
    const historico = String(emp.ESTADO_COLABORADOR || '').toUpperCase() === 'HISTORICO';
    setLookupStatus(`${emp.NOMBRE_COMPLETO} · ${emp.PAIS_NOMBRE || ''}${historico ? ' · ya no aparece en el HC más reciente' : ''}`, 'ok');
  }

  function showMatches(matches) {
    const host = $('[data-lookup-matches]');
    if (!host) return;
    host.textContent = '';
    matches.slice(0, 12).forEach((emp) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      const name = document.createElement('span');
      name.textContent = emp.NOMBRE_COMPLETO;
      const meta = document.createElement('small');
      meta.textContent = [emp.PAIS_NOMBRE, emp.EMPRESA, emp.PUESTO].filter(Boolean).join(' · ');
      btn.append(name, meta);
      btn.addEventListener('click', () => selectEmployee(emp));
      host.appendChild(btn);
    });
  }

  // Evita reprocesar el mismo valor: al hacer clic en una opción, el campo pierde el foco
  // y dispara "change"; si se redibujaran las opciones, el clic se perdería.
  let lastLookupKey = null;

  function handleLookupInput(final = false) {
    const input = $('[data-employee-code]');
    if (!input) return;
    const value = input.value;
    const key = normalizeCode(value);
    if (key === lastLookupKey && !(final && !key)) {
      if (final && key && !currentEmployee && !findCandidates(value).length) input.classList.add('invalid');
      return;
    }
    lastLookupKey = key;

    // Si cambió el código, el colaborador cargado ya no aplica.
    if (currentEmployee && key !== normalizeCode(currentEmployee.CODIGO_EMPLEADO) &&
        key !== normalizeCode(currentEmployee.CLAVE_BUSQUEDA)) {
      populateEmployeeData(null);
    }

    clearMatches();
    if (!key) { setLookupStatus(''); return; }

    const matches = findCandidates(value);
    if (matches.length === 1) { selectEmployee(matches[0]); return; }
    if (matches.length > 1) {
      setLookupStatus(`Hay ${matches.length} personas con el código ${key.split('|')[0].trim()}. Elige la correcta:`);
      showMatches(matches);
      return;
    }

    const suggestions = findSuggestions(value);
    if (suggestions.length) {
      const shown = Math.min(suggestions.length, 12);
      setLookupStatus(`${suggestions.length} coincidencia${suggestions.length === 1 ? '' : 's'}; mostrando ${shown}.`);
      showMatches(suggestions);
      return;
    }

    if (final || key.length >= 4) {
      setLookupStatus('No se encontró ese código en el maestro.', 'error');
      if (final) input.classList.add('invalid');
    } else {
      setLookupStatus('');
    }
  }

  function loadDatalists() {
    // No se crean miles de <option> al iniciar. Las sugerencias se dibujan sólo cuando el usuario escribe.
    const codes = $('#employeeCodes');
    if (codes) codes.replaceChildren();

    const wf = $('#workforceEmails');
    if (wf) {
      const fromCatalog = window.ASYS_CATALOGOS?.WORKFORCE_CORREOS || [];
      const fromMaster = employees.map((emp) => emp.ANALISTA_WF_CORREO);
      const emails = [...new Set([...fromCatalog, ...fromMaster]
        .map((v) => String(v || '').trim().toLowerCase())
        .filter((v) => EMAIL_RE.test(v)))].sort();
      wf.replaceChildren(...emails.map((email) => {
        const opt = document.createElement('option');
        opt.value = email;
        return opt;
      }));
      const hint = wf.parentElement?.querySelector('.hint');
      if (hint) {
        hint.textContent = emails.length
          ? `Hay ${emails.length} ${emails.length === 1 ? 'opción disponible' : 'opciones disponibles'}; también puedes escribir otro correo.`
          : 'Todavía no hay un catálogo oficial cargado; escribe el correo de Workforce.';
      }
    }
  }

  // ------------------------------------------------------------------
  // Correlación (Líder y Workforce llegan desde el enlace del correo)
  // ------------------------------------------------------------------
  function getURLParams() {
    const p = new URLSearchParams(window.location.search);
    return {
      id_proceso_baja: p.get('id_proceso_baja') || p.get('ID_PROCESO_BAJA') || p.get('id') || null,
      codigo_empleado: p.get('codigo_empleado') || p.get('CODIGO_EMPLEADO') || p.get('codigo') || null,
      token: p.get('token') || p.get('TOKEN') || null
    };
  }

  function validateCorrelation() {
    if (currentFormType === 'REGISTRO_DDHH') return { valid: true };
    const params = getURLParams();
    if (!params.id_proceso_baja || !params.token) {
      return { valid: false, message: 'Abre este formulario desde el enlace que llegó por correo; el enlace trae el número de caso.' };
    }
    return { valid: true, id_proceso_baja: params.id_proceso_baja, token: params.token };
  }

  function prefillFromURL() {
    if (currentFormType === 'REGISTRO_DDHH') return;
    const params = getURLParams();
    if (params.codigo_empleado) {
      const input = $('[data-employee-code]');
      if (input) {
        input.value = params.codigo_empleado;
        handleLookupInput(true);
      }
    }
    if (params.id_proceso_baja) {
      showBanner('Caso ' + params.id_proceso_baja, 'Tu respuesta quedará vinculada a este caso.', 'info');
    }
  }

  // ------------------------------------------------------------------
  // Validación
  // ------------------------------------------------------------------
  function collectData(form) {
    const data = {};
    new FormData(form).forEach((value, key) => {
      const v = typeof value === 'string' ? value.trim() : value;
      data[key] = /^\d{4}-\d{2}-\d{2}T/.test(v) ? v.slice(0, 10) : v;
    });
    return data;
  }

  function labelOf(field) {
    return (field.labels?.[0]?.textContent || field.name || '').replace('*', '').trim();
  }

  function validateBusinessRules(form, data) {
    const errors = [];
    if (currentFormType === 'REGISTRO_DDHH') {
      const today = new Date().toISOString().slice(0, 10);
      if (data.FECHA_INGRESO && data.FECHA_SALIDA && data.FECHA_SALIDA < data.FECHA_INGRESO) {
        errors.push('La fecha de salida no puede ser anterior a la fecha de ingreso.');
      }
      if (data.FECHA_INGRESO && data.FECHA_INGRESO > today) {
        errors.push('La fecha de ingreso no puede ser futura.');
      }
    }
    $$('input[type="number"]', form).forEach((field) => {
      if (field.value !== '' && Number(field.value) < 0) errors.push(`"${labelOf(field)}" no puede ser negativo.`);
    });
    $$('input[type="email"]', form).forEach((field) => {
      const v = field.value.trim();
      if (v && !EMAIL_RE.test(v)) errors.push(`"${labelOf(field)}" no tiene un formato de correo válido.`);
      if (v && window.ASYS_PRODUCTION_MODE === true && v.includes('example.invalid')) {
        errors.push(`"${labelOf(field)}" no puede ser un correo de ejemplo.`);
      }
    });
    return errors;
  }

  function validateForm(form) {
    $$('.invalid', form).forEach((el) => el.classList.remove('invalid'));
    const missing = [];

    $$('[required]', form).forEach((field) => {
      if (field.disabled) return;
      if (!String(field.value || '').trim() || !field.checkValidity()) {
        field.classList.add('invalid');
        missing.push(labelOf(field));
      }
    });

    const codeInput = $('[data-employee-code]', form);
    if (codeInput && (!currentEmployee || normalizeCode(codeInput.value) !== normalizeCode(currentEmployee.CODIGO_EMPLEADO))) {
      const resolved = findEmployee(codeInput.value);
      if (resolved) {
        selectEmployee(resolved);
      } else {
        codeInput.classList.add('invalid');
        if (!missing.includes(labelOf(codeInput))) missing.unshift(labelOf(codeInput));
      }
    }

    if (missing.length) {
      $('.invalid', form)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      showToast(`Completa: ${missing.slice(0, 4).join(', ')}${missing.length > 4 ? '…' : ''}`, 'error');
      return false;
    }

    const errors = validateBusinessRules(form, collectData(form));
    if (errors.length) {
      showToast(errors.join('\n'), 'error');
      return false;
    }
    return true;
  }

  // ------------------------------------------------------------------
  // Envío
  // ------------------------------------------------------------------
  function buildPayload(form, correlation) {
    const cfg = FORM_TYPES[currentFormType];
    const data = collectData(form);
    data.CODIGO_EMPLEADO = currentEmployee.CODIGO_EMPLEADO;
    data.CLAVE_IDEMPOTENCIA = `${shortGuid()}-${Date.now()}`;
    data.FECHA_CREACION = new Date().toISOString();

    if (currentFormType === 'REGISTRO_DDHH') {
      const id = uniqueId(cfg.casePrefix);
      Object.assign(data, {
        ID_PROCESO_BAJA: id,
        RESPONSE_ID_DDHH: id,
        ESTADO_PROCESO: 'FASE_1_ESPERANDO_RESPUESTAS',
        TIPO_REGISTRO: 'DDHH',
        LIDER_RECIBIDO: false,
        WORKFORCE_RECIBIDO: false,
        // Nombre que ya recibía el flujo DDHH en producción; se conserva por compatibilidad.
        RECIBIDO_DE_LA_FUERZA_LABORAL: false,
        CONSOLIDADO: false,
        ESTADO_PAGO: 'PENDIENTE',
        ESTADO_APROBACION_COMPE: 'PENDIENTE',
        ESTADO_APROBACION_BUSINESS: 'PENDIENTE',
        INTENTOS_FASE_2: 0,
        INTENTOS_FASE_3: 0,
        INTENTOS_FASE_6: 0
      });
      let sp = null;
      try {
        sp = typeof _spPageContextInfo !== 'undefined' ? _spPageContextInfo : window.parent?._spPageContextInfo || null;
      } catch { sp = null; }
      data.CREADO_POR = sp?.userEmail || '';
    } else {
      data.ID_PROCESO_BAJA = correlation.id_proceso_baja;
      data.TOKEN_SEGURIDAD = correlation.token;
      data[cfg.responseKey] = uniqueId(cfg.casePrefix);
      data.TIPO_REGISTRO = currentFormType === 'SOLVENCIA_LIDER' ? 'LIDER' : 'WORKFORCE';
    }
    return data;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (submitting) return;
    const form = event.currentTarget;

    const url = webhookURL(currentFormType);
    if (!url) {
      showToast('Este formulario todavía no está conectado al flujo. Avísale al administrador.', 'error');
      return;
    }
    const correlation = validateCorrelation();
    if (!correlation.valid) { showToast(correlation.message, 'error'); return; }
    if (!validateForm(form)) return;

    if (currentFormType !== 'REGISTRO_DDHH') {
      const expected = getURLParams().codigo_empleado;
      if (expected && normalizeCode(expected) !== normalizeCode(currentEmployee.CODIGO_EMPLEADO)) {
        showToast('El código no corresponde al colaborador de este caso.', 'error');
        return;
      }
    }

    const payload = buildPayload(form, correlation);
    const button = $('[type="submit"]', form);
    const original = button.innerHTML;
    submitting = true;
    button.disabled = true;
    button.innerHTML = '<span class="spinner" aria-hidden="true"></span>Guardando…';

    try {
      const result = await sendToWebhook(payload, url);
      const id = result.idProcesoBaja || result.ID_PROCESO_BAJA || result.itemId || result.id || payload.ID_PROCESO_BAJA;
      const idEl = $('[data-result-id]');
      if (idEl) idEl.textContent = id;
      resetForm(form);
      $('[data-toast]')?.classList.remove('show');
      showScreen('result');
    } catch (error) {
      console.error('[ASYS] Error al guardar', error.status, error.message);
      showToast(friendlyError(error), 'error');
    } finally {
      submitting = false;
      button.disabled = !webhookURL(currentFormType);
      button.innerHTML = original;
    }
  }

  // form.reset() dispara el evento "reset", que llama a clearState().
  function resetForm(form) {
    form.reset();
  }

  function clearState(form) {
    lastLookupKey = null;
    populateEmployeeData(null);
    clearMatches();
    setLookupStatus('');
    $$('.invalid', form).forEach((el) => el.classList.remove('invalid'));
  }

  // ------------------------------------------------------------------
  // Inicio
  // ------------------------------------------------------------------
  function updateSectionStates() {
    $$('.form-card').forEach((card) => {
      const required = $$('[required]', card).filter((field) => !field.disabled);
      const complete = required.length > 0 && required.every((field) => {
        if (field.matches('[data-employee-code]')) return Boolean(currentEmployee);
        return String(field.value || '').trim() && field.checkValidity();
      });
      card.classList.toggle('is-complete', complete);
    });
  }

  function updateProgress() {
    const form = $('form[data-asys-form]');
    const bar = $('[data-progress]');
    if (!form || !bar) return;
    const required = $$('[required]', form).filter((field) => !field.disabled && field.offsetParent !== null);
    const complete = required.filter((field) => String(field.value || '').trim() && field.checkValidity()).length;
    const progress = required.length ? Math.round((complete / required.length) * 100) : 0;
    bar.style.width = `${progress}%`;
    bar.setAttribute('aria-valuenow', String(progress));
    const label = $('[data-progress-label]');
    if (label) label.textContent = `${progress}% completado`;
    updateSectionStates();
  }

  function bindEvents() {
    const form = $('form[data-asys-form]');
    const input = $('[data-employee-code]');

    $$('[data-action="start"]').forEach((btn) => btn.addEventListener('click', () => {
      showScreen('form');
      $('[data-employee-code]')?.focus();
    }));
    $$('[data-action="home"]').forEach((btn) => btn.addEventListener('click', () => showScreen('landing')));

    if (input) {
      let lookupTimer = null;
      input.addEventListener('input', () => {
        clearTimeout(lookupTimer);
        lookupTimer = setTimeout(() => handleLookupInput(false), 70);
      });
      input.addEventListener('change', () => {
        clearTimeout(lookupTimer);
        handleLookupInput(true);
      });
    }
    if (form) {
      form.addEventListener('submit', handleSubmit);
      form.addEventListener('input', updateProgress);
      form.addEventListener('change', updateProgress);
      // Se espera un ciclo para que el navegador termine de restaurar los valores por defecto.
      form.addEventListener('reset', () => setTimeout(() => { clearState(form); updateProgress(); }, 0));
    }
    $$('[data-action="new"]').forEach((btn) => btn.addEventListener('click', () => {
      showScreen('form');
      $('[data-employee-code]')?.focus();
    }));
  }

  function start() {
    loadDatalists();
    bindEvents();
    prefillFromURL();
    $$('[data-employee-field]').forEach((field) => {
      if (!field.labels?.length && !field.hasAttribute('aria-label')) {
        field.setAttribute('aria-label', field.getAttribute('data-employee-field').replaceAll('_', ' ').toLowerCase());
      }
    });
    const progressBar = $('[data-progress]');
    if (progressBar) {
      progressBar.setAttribute('role', 'progressbar');
      progressBar.setAttribute('aria-label', 'Progreso del formulario');
      progressBar.setAttribute('aria-valuemin', '0');
      progressBar.setAttribute('aria-valuemax', '100');
    }
    updateProgress();

    if (!employees.length) {
      showBanner('Maestro no cargado', 'No se encontró la lista de colaboradores (assets/colaboradores.js).');
    }
    if (!webhookURL(currentFormType)) {
      showBanner('Formulario sin conexión', 'Puedes revisar los datos, pero no se podrá guardar hasta configurar el flujo.');
      const button = $('form[data-asys-form] [type="submit"]');
      if (button) button.disabled = true;
    } else if (currentFormType !== 'REGISTRO_DDHH' && !validateCorrelation().valid) {
      showBanner('Falta el enlace del caso', 'Abre este formulario desde el correo que recibiste; así queda vinculado al caso correcto.');
    }
  }

  function init(options = {}) {
    currentFormType = options.type || 'REGISTRO_DDHH';
    if (!FORM_TYPES[currentFormType]) {
      console.error('[ASYS] Tipo de formulario inválido:', currentFormType);
      return;
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
    else start();
  }

  window.ASYSForms = {
    init,
    showScreen,
    showToast,
    findEmployee,
    findCandidates,
    findSuggestions,
    populateEmployeeData,
    formatDate,
    formatMoney,
    version: VERSION
  };
})();
