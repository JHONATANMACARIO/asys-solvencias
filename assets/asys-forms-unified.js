/**
 * ASYS Forms - Implementación Unificada V4.2
 * ===========================================
 * 
 * Versión canónica que reemplaza asys-forms.js y asys-forms-sharepoint.js
 * 
 * Características:
 * - Soporte para DDHH, Líder y Workforce
 * - Configuración de webhooks externa (webhook-config.js)
 * - Sin dependencia de localStorage para validación de casos
 * - Validación de datos en frontend (backend es fuente de verdad)
 * - Utilidades compartidas (formateo, lookup, generación de IDs)
 * - Protección anti-DEMO en modo producción (v4.2+)
 * 
 * IMPORTANTE: Requiere que los siguientes scripts se carguen antes:
 * - assets/colaboradores.js
 * - assets/webhook-config.js
 * 
 * MODO PRODUCCIÓN:
 * Para activar validaciones anti-DEMO, definir:
 *   window.ASYS_PRODUCTION_MODE = true;
 * antes de cargar este script.
 */

(function() {
  'use strict';

  // ============================================
  // CONSTANTES Y CONFIGURACIÓN
  // ============================================
  
  const FORM_TYPES = {
    REGISTRO_DDHH: {
      webhookKey: 'REGISTRO_DDHH',
      casePrefix: 'BAJA',
      responsePrefix: 'RESPONSE_ID_DDHH',
      canCreateCase: true
    },
    SOLVENCIA_LIDER: {
      webhookKey: 'SOLVENCIA_LIDER',
      casePrefix: 'LIDER',
      responsePrefix: 'RESPONSE_ID_LIDER',
      canCreateCase: false  // Solo puede responder a casos existentes
    },
    SOLVENCIA_WORKFORCE: {
      webhookKey: 'SOLVENCIA_WORKFORCE',
      casePrefix: 'WF',
      responsePrefix: 'RESPONSE_ID_WORKFORCE',
      canCreateCase: false  // Solo puede responder a casos existentes
    }
  };

  // ============================================
  // ESTADO GLOBAL
  // ============================================
  
  let currentFormType = null;
  let currentEmployee = null;
  let currentScreen = 'landing';

  // ============================================
  // UTILIDADES - EMPLEADOS
  // ============================================
  
  const employees = Array.isArray(window.ASYS_COLABORADORES) ? window.ASYS_COLABORADORES : [];
  const employeesByCode = new Map(
    employees.map(emp => [normalizeCode(emp.CODIGO_EMPLEADO), emp])
  );

  function normalizeCode(code) {
    return String(code || '').trim().toUpperCase();
  }

  function findEmployee(code) {
    const employee = employeesByCode.get(normalizeCode(code));
    if (!employee) return null;
    
    // Solo retornar si está activo
    const estado = String(employee.ESTADO_COLABORADOR || '').toUpperCase();
    if (estado !== 'ACTIVO') return null;
    
    // PRODUCCIÓN: Bloquear datos DEMO (códigos DEMO-*, emails @example.invalid)
    if (window.ASYS_PRODUCTION_MODE === true) {
      const codigo = String(employee.CODIGO_EMPLEADO || '').toUpperCase();
      const email = String(employee.CORREO_COLABORADOR || '').toLowerCase();
      
      if (codigo.startsWith('DEMO-')) {
        console.warn(`[ASYS] Código DEMO bloqueado en modo producción: ${codigo}`);
        return null;
      }
      
      if (email.includes('example.invalid')) {
        console.warn(`[ASYS] Email DEMO bloqueado en modo producción: ${email}`);
        return null;
      }
    }
    
    return employee;
  }

  function loadEmployeeCodes() {
    const datalist = document.getElementById('employeeCodes');
    if (!datalist) return;

    datalist.innerHTML = '';
    employees.forEach(emp => {
      const option = document.createElement('option');
      option.value = emp.CODIGO_EMPLEADO;
      option.textContent = `${emp.CODIGO_EMPLEADO} — ${emp.NOMBRE_COMPLETO}`;
      datalist.appendChild(option);
    });
  }

  function populateEmployeeData(employee) {
    if (!employee) return;
    
    currentEmployee = employee;
    
    // Poblar campos editables
    document.querySelectorAll('[data-employee-field]').forEach(field => {
      const fieldName = field.getAttribute('data-employee-field');
      if (employee[fieldName] !== undefined) {
        let value = employee[fieldName];
        
        // Formatear fechas para input type="date"
        if (field.type === 'date' && value && typeof value === 'string' && value.includes('T')) {
          value = value.split('T')[0];
        }
        
        field.value = value;
        field.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });

    // Poblar campos de solo lectura
    document.querySelectorAll('[data-employee-text]').forEach(elem => {
      const fieldName = elem.getAttribute('data-employee-text');
      if (employee[fieldName] !== undefined) {
        elem.textContent = employee[fieldName] || '—';
      }
    });

    // Trigger evento personalizado
    document.dispatchEvent(new CustomEvent('asys:employee-loaded', { detail: employee }));
  }

  // ============================================
  // UTILIDADES - FORMATEO
  // ============================================
  
  function formatDate(value) {
    if (!value) return '—';
    const raw = String(value).slice(0, 10);
    const [year, month, day] = raw.split('-').map(Number);
    if (!year || !month || !day) return raw;
    
    return new Intl.DateTimeFormat('es-GT', { 
      day: '2-digit', 
      month: 'short', 
      year: 'numeric' 
    }).format(new Date(year, month - 1, day));
  }

  function formatMoney(value, currency = 'GTQ') {
    const amount = Number(value || 0);
    const locale = currency === 'CRC' ? 'es-CR' : 'es-GT';
    
    try {
      return new Intl.NumberFormat(locale, { 
        style: 'currency', 
        currency, 
        maximumFractionDigits: 2 
      }).format(amount);
    } catch {
      return `${currency} ${amount.toLocaleString(locale)}`;
    }
  }

  // ============================================
  // UTILIDADES - IDS Y CLAVES
  // ============================================
  
  function generateUniqueId(prefix = 'BAJA') {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 10000);
    return `${prefix}-${timestamp}-${random}`;
  }

  function generateShortGuid() {
    if (window.crypto?.randomUUID) {
      return window.crypto.randomUUID().replaceAll('-', '').slice(0, 8).toUpperCase();
    }
    return Math.random().toString(36).slice(2, 10).toUpperCase().padEnd(8, '0');
  }

  // ============================================
  // VALIDACIÓN DE WEBHOOKS
  // ============================================
  
  function validateWebhookConfig(formType) {
    if (!window.ASYS_WEBHOOK_CONFIG) {
      return {
        valid: false,
        message: 'webhook-config.js no está cargado. Agrega <script src="assets/webhook-config.js"></script> antes de este archivo.'
      };
    }

    const config = FORM_TYPES[formType];
    if (!config) {
      return {
        valid: false,
        message: `Tipo de formulario desconocido: ${formType}`
      };
    }

    const webhookKey = config.webhookKey;
    const url = window.ASYS_WEBHOOK_CONFIG[webhookKey];

    if (!url || url.startsWith('URL_WEBHOOK_') || url.startsWith('PENDIENTE_')) {
      return {
        valid: false,
        message: `Webhook ${webhookKey} no configurado. Consulta webhook-config.example.js para instrucciones.`
      };
    }

    return { valid: true };
  }

  function getWebhookURL(formType) {
    const config = FORM_TYPES[formType];
    if (!config) {
      throw new Error(`Tipo de formulario desconocido: ${formType}`);
    }

    const url = window.ASYS_WEBHOOK_CONFIG[config.webhookKey];
    
    if (!url || url.startsWith('URL_WEBHOOK_') || url.startsWith('PENDIENTE_')) {
      throw new Error(`Webhook ${config.webhookKey} no configurado`);
    }

    return url;
  }

  // ============================================
  // NAVEGACIÓN Y UI
  // ============================================
  
  function showScreen(screenName) {
    document.querySelectorAll('[data-screen]').forEach(s => s.hidden = true);
    const screen = document.querySelector(`[data-screen="${screenName}"]`);
    if (screen) {
      screen.hidden = false;
      currentScreen = screenName;
    }
  }

  function showToast(message, type = 'success') {
    const toast = document.querySelector('[data-toast]');
    if (!toast) return;
    
    const icon = type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ';
    toast.innerHTML = `
      <span class="toast-icon">${icon}</span>
      <div>
        <strong>${type === 'success' ? 'Éxito' : type === 'error' ? 'Error' : 'Info'}</strong>
        <span>${message}</span>
      </div>
    `;
    
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 4000);
  }

  function updateProgress() {
    const form = document.querySelector('form[data-asys-form]');
    const bar = document.querySelector('[data-progress]');
    if (!form || !bar) return;

    const required = Array.from(form.querySelectorAll('[required]')).filter(
      field => field.offsetParent !== null
    );

    let filled = 0;
    required.forEach(field => {
      if (field.type === 'radio' || field.type === 'checkbox') {
        if (form.querySelector(`[name="${CSS.escape(field.name)}"]:checked`)) {
          filled++;
        }
      } else if (field.value.trim() && field.checkValidity()) {
        filled++;
      }
    });

    const progress = required.length > 0 ? Math.round((filled / required.length) * 100) : 0;
    bar.style.width = `${progress}%`;
  }

  // ============================================
  // VALIDACIÓN DE FORMULARIO
  // ============================================
  
  /**
   * Validaciones de negocio específicas
   */
  function validateBusinessRules(form, data) {
    const errors = [];

    // DDHH: Validar fechas
    if (currentFormType === 'REGISTRO_DDHH') {
      const fechaIngreso = data.FECHA_INGRESO;
      const fechaSalida = data.FECHA_SALIDA;

      if (fechaIngreso && fechaSalida) {
        const ingreso = new Date(fechaIngreso);
        const salida = new Date(fechaSalida);

        if (salida < ingreso) {
          errors.push('La fecha de salida no puede ser anterior a la fecha de ingreso.');
        }

        // Validar que la fecha de ingreso no sea futura
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);
        if (ingreso > hoy) {
          errors.push('La fecha de ingreso no puede ser futura.');
        }
      }
    }

    // Validar montos no negativos
    const amountFields = form.querySelectorAll('input[type="number"]');
    amountFields.forEach(field => {
      const value = parseFloat(field.value || 0);
      if (value < 0) {
        const label = field.labels?.[0]?.textContent || field.name;
        errors.push(`El campo "${label}" no puede ser negativo.`);
      }
    });

    // Validar formato de correos (adicional a HTML5)
    const emailFields = form.querySelectorAll('input[type="email"]');
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    emailFields.forEach(field => {
      if (field.value && !emailRegex.test(field.value)) {
        const label = field.labels?.[0]?.textContent || field.name;
        errors.push(`El correo "${label}" no tiene un formato válido.`);
      }

      // Validar que no sean correos de ejemplo (solo en modo producción)
      if (window.ASYS_PRODUCTION_MODE === true && field.value && field.value.includes('example.invalid')) {
        const label = field.labels?.[0]?.textContent || field.name;
        errors.push(`El correo "${label}" no puede ser un correo de ejemplo (example.invalid).`);
      }
    });

    return errors;
  }

  function validateForm(form) {
    let isValid = true;

    // Remover marcas de error previas
    form.querySelectorAll('.invalid, .error').forEach(el => {
      el.classList.remove('invalid', 'error');
    });

    // Validar campos requeridos
    form.querySelectorAll('[required]').forEach(field => {
      if (field.offsetParent === null) return; // Campo oculto

      const isEmpty = field.type === 'radio' || field.type === 'checkbox'
        ? !form.querySelector(`[name="${CSS.escape(field.name)}"]:checked`)
        : !String(field.value || '').trim();

      if (isEmpty || !field.checkValidity()) {
        field.classList.add('invalid', 'error');
        isValid = false;
      }
    });

    // Validar empleado
    const codeInput = document.querySelector('[data-employee-code]');
    if (codeInput) {
      const code = normalizeCode(codeInput.value);
      const employee = findEmployee(code);
      
      if (!employee) {
        codeInput.classList.add('invalid', 'error');
        isValid = false;
      }
    }

    if (!isValid) {
      const firstInvalid = form.querySelector('.invalid');
      if (firstInvalid) {
        firstInvalid.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      showToast('Revisa los campos obligatorios. Hay información inválida o el código no corresponde a un colaborador activo.', 'error');
      return false;
    }

    // Validaciones de negocio
    const formData = new FormData(form);
    const data = {};
    formData.forEach((value, key) => {
      data[key] = value;
    });

    const businessErrors = validateBusinessRules(form, data);
    if (businessErrors.length > 0) {
      const errorList = businessErrors.map(e => `• ${e}`).join('\n');
      showToast(`Errores de validación:\n${errorList}`, 'error');
      return false;
    }

    return true;
  }

  // ============================================
  // CORRELACIÓN POR URL (LÍDER Y WORKFORCE)
  // ============================================
  
  /**
   * Extrae parámetros de la URL para correlación
   * Líder y Workforce reciben enlaces prellenados con:
   * - id_proceso_baja: ID del caso a responder
   * - codigo_empleado: Código del colaborador (validación)
   * - token: Token de seguridad (generado por Power Automate)
   */
  function getURLParams() {
    const params = new URLSearchParams(window.location.search);
    return {
      id_proceso_baja: params.get('id_proceso_baja') || params.get('ID_PROCESO_BAJA') || null,
      codigo_empleado: params.get('codigo_empleado') || params.get('CODIGO_EMPLEADO') || null,
      token: params.get('token') || params.get('TOKEN') || null
    };
  }

  /**
   * Prellenar formulario con datos de URL
   * Solo para Líder y Workforce
   */
  function prefillFromURL() {
    if (currentFormType === 'REGISTRO_DDHH') {
      return; // DDHH no usa prellenado por URL
    }

    const urlParams = getURLParams();

    // Si hay código de empleado en URL, prellenarlo
    if (urlParams.codigo_empleado) {
      const codeInput = document.querySelector('[data-employee-code]');
      if (codeInput) {
        codeInput.value = urlParams.codigo_empleado;
        codeInput.dispatchEvent(new Event('input', { bubbles: true }));
        
        // Buscar y mostrar empleado
        const employee = findEmployee(urlParams.codigo_empleado);
        if (employee) {
          populateEmployeeData(employee);
        }
      }
    }

    // Mostrar información de correlación si está presente
    if (urlParams.id_proceso_baja) {
      const infoDiv = document.createElement('div');
      infoDiv.style.cssText = 'background:#e3f2fd;border-left:4px solid #2196f3;padding:12px;margin:16px 0;font-family:system-ui;font-size:14px;';
      infoDiv.innerHTML = `
        <strong>📋 Caso:</strong> ${urlParams.id_proceso_baja}<br>
        <small style="color:#666;">Tu respuesta será vinculada a este caso.</small>
      `;
      
      const form = document.querySelector('form[data-asys-form]');
      if (form) {
        form.insertBefore(infoDiv, form.firstChild);
      }
    }
  }

  /**
   * Validar que los formularios de respuesta tengan los datos de correlación
   */
  function validateCorrelation() {
    if (currentFormType === 'REGISTRO_DDHH') {
      return { valid: true }; // DDHH no requiere correlación
    }

    const urlParams = getURLParams();

    if (!urlParams.id_proceso_baja) {
      return {
        valid: false,
        message: 'Este formulario requiere un ID de caso. Debes acceder desde el enlace enviado por correo.'
      };
    }

    if (!urlParams.token) {
      return {
        valid: false,
        message: 'Token de seguridad no encontrado. Debes acceder desde el enlace enviado por correo.'
      };
    }

    return { 
      valid: true, 
      id_proceso_baja: urlParams.id_proceso_baja,
      token: urlParams.token 
    };
  }

  // ============================================
  // ENVÍO DE DATOS
  // ============================================
  
  async function sendToWebhook(data, webhookURL) {
    const response = await fetch(webhookURL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorObj;
      
      try {
        errorObj = JSON.parse(errorText);
      } catch {
        errorObj = { message: errorText };
      }

      const detail = String(errorObj.message || errorObj.error?.message || '').trim();
      const message = detail && detail.length < 180 ? `: ${detail}` : '';
      
      throw new Error(`HTTP ${response.status} al enviar al flujo${message}. Revisa la ejecución en Power Automate.`);
    }

    return await response.json();
  }

  async function handleFormSubmit(event) {
    event.preventDefault();

    const form = event.target;

    // Validar correlación (solo Líder y Workforce)
    const correlationValidation = validateCorrelation();
    if (!correlationValidation.valid) {
      showToast(correlationValidation.message, 'error');
      return;
    }

    // Validar formulario
    if (!validateForm(form)) {
      return;
    }

    // Preparar datos del formulario
    const formData = new FormData(form);
    const data = {};

    formData.forEach((value, key) => {
      // Formatear fechas ISO a yyyy-MM-dd
      if (value && value.includes('T') && value.match(/^\d{4}-\d{2}-\d{2}T/)) {
        data[key] = value.split('T')[0];
      } else {
        data[key] = value;
      }
    });

    // Generar IDs según el tipo de formulario
    const config = FORM_TYPES[currentFormType];
    const uniqueId = generateUniqueId(config.casePrefix);

    // Metadatos comunes
    data.CLAVE_IDEMPOTENCIA = generateShortGuid() + '-' + Date.now();
    data.FECHA_CREACION = new Date().toISOString();

    // Metadatos específicos por tipo
    if (currentFormType === 'REGISTRO_DDHH') {
      // DDHH crea el caso
      data.ID_PROCESO_BAJA = uniqueId;
      data.RESPONSE_ID_DDHH = uniqueId;
      data.ESTADO_PROCESO = 'FASE_1_ESPERANDO_RESPUESTAS';
      data.TIPO_REGISTRO = 'DDHH';
      data.LIDER_RECIBIDO = false;
      data.RECIBIDO_DE_LA_FUERZA_LABORAL = false;
      data.CONSOLIDADO = false;
      data.ESTADO_PAGO = 'PENDIENTE';
      data.ESTADO_APROBACION_COMPE = 'PENDIENTE';
      data.ESTADO_APROBACION_BUSINESS = 'PENDIENTE';
      data.INTENTOS_FASE_2 = 0;
      data.INTENTOS_FASE_3 = 0;
      data.INTENTOS_FASE_6 = 0;

      // Intentar obtener usuario de SharePoint
      let spContext = null;
      try {
        if (typeof _spPageContextInfo !== 'undefined') {
          spContext = _spPageContextInfo;
        } else if (window.parent && window.parent !== window && typeof window.parent._spPageContextInfo !== 'undefined') {
          spContext = window.parent._spPageContextInfo;
        }
      } catch (e) {
        spContext = null;
      }

      data.CREADO_POR = spContext?.userEmail || '';

    } else {
      // Líder y Workforce responden a caso existente
      // Obtener ID_PROCESO_BAJA de URL (obligatorio)
      data.ID_PROCESO_BAJA = correlationValidation.id_proceso_baja;
      data.TOKEN_SEGURIDAD = correlationValidation.token;
      data[config.responsePrefix] = uniqueId;
      data.TIPO_REGISTRO = currentFormType === 'SOLVENCIA_LIDER' ? 'LIDER' : 'WORKFORCE';

      // Validar que el código de empleado coincida con el esperado
      const urlParams = getURLParams();
      if (urlParams.codigo_empleado && normalizeCode(data.CODIGO_EMPLEADO) !== normalizeCode(urlParams.codigo_empleado)) {
        showToast('El código de empleado no coincide con el esperado para este caso.', 'error');
        return;
      }
    }

    // Deshabilitar botón de envío
    const submitBtn = form.querySelector('[type="submit"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner"></span>Guardando...';

    try {
      // Obtener webhook URL
      const webhookURL = getWebhookURL(currentFormType);

      // Enviar al webhook
      const result = await sendToWebhook(data, webhookURL);

      console.log('✓ Enviado al webhook:', result);

      showToast(`Registro guardado exitosamente. ID: ${result.itemId || result.id || 'OK'}`, 'success');

      // Limpiar formulario
      form.reset();
      currentEmployee = null;

      // Volver al landing después de 2 segundos
      setTimeout(() => showScreen('landing'), 2000);

    } catch (error) {
      console.error('Error al guardar:', error);
      
      // Mensajes de error específicos
      let errorMessage = error.message;
      
      if (error.message.includes('409')) {
        errorMessage = 'Ya existe una respuesta para este caso. No se permiten respuestas duplicadas.';
      } else if (error.message.includes('404')) {
        errorMessage = 'El caso no existe o ya fue cerrado.';
      } else if (error.message.includes('403') || error.message.includes('401')) {
        errorMessage = 'No tienes permisos para responder a este caso o el token es inválido.';
      } else if (error.message.includes('400')) {
        errorMessage = 'Los datos enviados son inválidos. Verifica todos los campos.';
      }
      
      showToast('Error al guardar: ' + errorMessage, 'error');

    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalText;
    }
  }

  // ============================================
  // EVENTOS
  // ============================================
  
  function setupEventListeners() {
    // Navegación
    document.querySelectorAll('[data-action="start"]').forEach(btn => {
      btn.addEventListener('click', () => showScreen('form'));
    });

    document.querySelectorAll('[data-action="home"]').forEach(btn => {
      btn.addEventListener('click', () => showScreen('landing'));
    });

    // Lookup de empleado
    const codeInput = document.querySelector('[data-employee-code]');
    if (codeInput) {
      codeInput.addEventListener('input', () => {
        const code = normalizeCode(codeInput.value);
        if (code.length >= 3) {
          const employee = findEmployee(code);
          if (employee) {
            populateEmployeeData(employee);
          }
        }
      });

      codeInput.addEventListener('blur', () => {
        const code = normalizeCode(codeInput.value);
        const employee = findEmployee(code);
        codeInput.classList.toggle('invalid', Boolean(code) && !employee);
      });
    }

    // Progress bar
    const form = document.querySelector('form[data-asys-form]');
    if (form) {
      form.addEventListener('submit', handleFormSubmit);

      form.addEventListener('input', updateProgress);
      form.addEventListener('change', updateProgress);
    }
  }

  // ============================================
  // INICIALIZACIÓN
  // ============================================
  
  function init(options = {}) {
    currentFormType = options.type || 'REGISTRO_DDHH';

    // Validar tipo de formulario
    if (!FORM_TYPES[currentFormType]) {
      console.error(`⚠️ Tipo de formulario inválido: ${currentFormType}`);
      return;
    }

    // Validar configuración de webhook
    const validation = validateWebhookConfig(currentFormType);
    if (!validation.valid) {
      console.error('⚠️ Configuración de webhook incompleta:', validation.message);

      // Mostrar advertencia al usuario
      const warning = document.createElement('div');
      warning.style.cssText = 'position:fixed;top:0;left:0;right:0;background:#f44336;color:white;padding:16px;text-align:center;z-index:10000;font-family:system-ui,-apple-system,sans-serif;';
      warning.innerHTML = `<strong>⚠️ Configuración pendiente</strong><br>${validation.message}`;
      document.body.insertBefore(warning, document.body.firstChild);

      // Bloquear botón de envío
      const submitBtn = document.querySelector('[type="submit"]');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.title = 'No se puede enviar: webhook no configurado';
      }

      return;
    }

    // Cargar datos y configurar eventos
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        loadEmployeeCodes();
        prefillFromURL();
        setupEventListeners();
        updateProgress();
      });
    } else {
      loadEmployeeCodes();
      prefillFromURL();
      setupEventListeners();
      updateProgress();
    }

    console.log('✓ ASYS Forms Unified v4.0 inicializado');
    console.log('  Tipo:', currentFormType);
    console.log('  Webhook:', '✓ Configurado');
    console.log('  Empleados:', employees.length);
  }

  // ============================================
  // API PÚBLICA
  // ============================================
  
  window.ASYSForms = {
    init,
    showScreen,
    showToast,
    findEmployee,
    populateEmployeeData,
    formatDate,
    formatMoney,
    version: '4.2.0'
  };

})();
