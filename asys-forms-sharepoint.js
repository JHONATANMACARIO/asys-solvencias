/**
 * ASYS Forms - Versión Webhook HTTP Público
 * ===========================================
 * Envía datos a Power Automate webhook HTTP → SharePoint
 * ✓ Funciona desde CUALQUIER ubicación (file://, http://, https://)
 * ✓ NO requiere login en SharePoint
 * ✓ Permite que CUALQUIERA llene el formulario
 */

window.ASYSForms = (function() {
  'use strict';

  // ============================================
  // CONFIGURACIÓN WEBHOOK
  // ============================================
  
  // ✅ URL del webhook configurada y funcionando
  const WEBHOOK_URL = 'https://defaulteaa593ed6784456594d013056f1192.70.environment.api.powerplatform.com:443/powerautomate/automations/direct/cu/29/workflows/0f26fc7cfcd345b8a6b5e3a943eac420/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=es1Nh3PvynSVKykXp0FG9nV47UoayNxD8Y9sx605OmA';
  // URL del flujo webhook Power Automate - FASE 1 DDHH (FUNCIONANDO)
  
  const WEBHOOK_CONFIG = {
    // Enviar datos al webhook de Power Automate
    sendToWebhook: async function(itemData) {
      if (!WEBHOOK_URL) {
        throw new Error('⚠️ Debes configurar la URL del webhook en asys-forms-sharepoint.js');
      }
      
      const response = await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(itemData)
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
  };

  // ============================================
  // ESTADO Y NAVEGACIÓN
  // ============================================
  let currentScreen = 'landing';
  let formType = '';
  let currentEmployee = null;

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

  // ============================================
  // MAESTRO DE COLABORADORES
  // ============================================
  function loadEmployeeCodes() {
    if (!window.ASYS_COLABORADORES) {
      console.warn('Maestro de colaboradores no cargado');
      return;
    }

    const datalist = document.getElementById('employeeCodes');
    if (!datalist) return;

    datalist.innerHTML = '';
    window.ASYS_COLABORADORES.forEach(emp => {
      const option = document.createElement('option');
      option.value = emp.CODIGO_EMPLEADO;
      option.textContent = `${emp.CODIGO_EMPLEADO} — ${emp.NOMBRE_COMPLETO}`;
      datalist.appendChild(option);
    });
  }

  function findEmployee(codigo) {
    if (!window.ASYS_COLABORADORES) return null;
    return window.ASYS_COLABORADORES.find(
      emp => emp.CODIGO_EMPLEADO.toUpperCase() === codigo.toUpperCase()
    );
  }

  function populateEmployeeData(employee) {
    if (!employee) return;
    
    currentEmployee = employee;
    
    document.querySelectorAll('[data-employee-field]').forEach(field => {
      const fieldName = field.getAttribute('data-employee-field');
      if (employee[fieldName] !== undefined) {
        let value = employee[fieldName];
        
        // Si es un campo de fecha y el valor tiene formato ISO, extraer solo yyyy-MM-dd
        if (field.type === 'date' && value && typeof value === 'string' && value.includes('T')) {
          value = value.split('T')[0];
        }
        
        field.value = value;
      }
    });

    document.querySelectorAll('[data-employee-text]').forEach(elem => {
      const fieldName = elem.getAttribute('data-employee-text');
      if (employee[fieldName] !== undefined) {
        elem.textContent = employee[fieldName];
      }
    });
  }

  // ============================================
  // VALIDACIÓN Y ENVÍO
  // ============================================
  function validateForm(form) {
    const requiredFields = form.querySelectorAll('[required]');
    let isValid = true;
    
    requiredFields.forEach(field => {
      if (!field.value.trim()) {
        field.classList.add('error');
        isValid = false;
      } else {
        field.classList.remove('error');
      }
    });
    
    return isValid;
  }

  async function handleFormSubmit(event) {
    event.preventDefault();
    
    const form = event.target;
    
    if (!validateForm(form)) {
      showToast('Por favor completa todos los campos requeridos', 'error');
      return;
    }

    const formData = new FormData(form);
    const data = {};
    
    formData.forEach((value, key) => {
      // Formatear fechas: si el valor contiene 'T' y es una fecha, extraer solo yyyy-MM-dd
      if (value && value.includes('T') && value.match(/^\d{4}-\d{2}-\d{2}T/)) {
        data[key] = value.split('T')[0]; // Solo la parte de fecha
      } else {
        data[key] = value;
      }
    });

    // Generar IDs únicos (timestamp + random)
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 10000);
    const uniqueId = `BAJA-${timestamp}-${random}`;
    
    // Agregar metadatos requeridos por el trigger
    data.ID_PROCESO_BAJA = uniqueId;
    data.RESPONSE_ID_DDHH = uniqueId;
    data.CLAVE_IDEMPOTENCIA = uniqueId;
    data.ESTADO_PROCESO = 'FASE_1_ESPERANDO_RESPUESTAS';
    data.TIPO_REGISTRO = 'DDHH';
    data.LIDER_RECIBIDO = false;
    data.RECIBIDO_DE_LA_FUERZA_LABORAL = false;
    data.CONSOLIDADO = false;
    data.ESTADO_PAGO = 'PENDIENTE';
    data.INTENTOS_FASE_2 = 0;
    data.INTENTOS_FASE_3 = 0;
    data.INTENTOS_FASE_6 = 0;
    data.ESTADO_APROBACION_COMPE = 'PENDIENTE';
    data.ESTADO_APROBACION_BUSINESS = 'PENDIENTE';
    
    // Obtener el correo del usuario actual desde SharePoint.
    // El formulario puede ejecutarse dentro de un iframe, por eso
    // también revisamos el contexto de la ventana principal.
    let spContext = null;
    try {
      if (typeof _spPageContextInfo !== 'undefined') {
        spContext = _spPageContextInfo;
      } else if (
        window.parent &&
        window.parent !== window &&
        typeof window.parent._spPageContextInfo !== 'undefined'
      ) {
        spContext = window.parent._spPageContextInfo;
      }
    } catch (contextError) {
      spContext = null;
    }

    // Si SharePoint no expone el usuario, dejamos vacío para que el flujo
    // aplique su respaldo válido; nunca usamos un dominio ficticio.
    data.CREADO_POR = spContext && spContext.userEmail
      ? spContext.userEmail
      : '';
    
    // Timestamp
    data.FECHA_CREACION = new Date().toISOString();

    // Botón de envío
    const submitBtn = form.querySelector('[type="submit"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner"></span>Guardando...';

    try {
      // ENVIAR AL WEBHOOK (que escribirá en SharePoint)
      const result = await WEBHOOK_CONFIG.sendToWebhook(data);
      
      console.log('✓ Enviado al webhook:', result);
      
      showToast('Registro guardado exitosamente. ID: ' + result.itemId, 'success');
      
      // Limpiar formulario
      form.reset();
      currentEmployee = null;
      
      // Volver al landing después de 2 segundos
      setTimeout(() => showScreen('landing'), 2000);
      
    } catch (error) {
      console.error('Error al guardar:', error);
      showToast('Error al guardar: ' + error.message, 'error');
      
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
    const codigoInput = document.getElementById('codigo');
    if (codigoInput) {
      codigoInput.addEventListener('input', (e) => {
        const codigo = e.target.value.trim();
        if (codigo.length >= 3) {
          const employee = findEmployee(codigo);
          if (employee) {
            populateEmployeeData(employee);
          }
        }
      });
    }

    // Submit del formulario
    const form = document.querySelector('[data-asys-form]');
    if (form) {
      form.addEventListener('submit', handleFormSubmit);
    }

    // Progress bar (simple)
    const form2 = document.querySelector('[data-asys-form]');
    if (form2) {
      const inputs = form2.querySelectorAll('input[required], select[required]');
      inputs.forEach(input => {
        input.addEventListener('change', () => {
          const filled = Array.from(inputs).filter(i => i.value.trim()).length;
          const progress = (filled / inputs.length) * 100;
          const bar = document.querySelector('[data-progress]');
          if (bar) {
            bar.style.width = progress + '%';
          }
        });
      });
    }
  }

  // ============================================
  // INICIALIZACIÓN
  // ============================================
  function init(options = {}) {
    formType = options.type || 'REGISTRO_DDHH';
    
    // Esperar a que DOM esté listo
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        loadEmployeeCodes();
        setupEventListeners();
      });
    } else {
      loadEmployeeCodes();
      setupEventListeners();
    }
    
    console.log('✓ ASYS Forms inicializado (Webhook HTTP Público)');
    console.log('  Tipo:', formType);
    console.log('  Webhook:', WEBHOOK_URL === 'PEGAR_URL_AQUI' ? '⚠️ NO CONFIGURADO' : '✓ Configurado');
  }

  // ============================================
  // API PÚBLICA
  // ============================================
  return {
    init: init,
    showScreen: showScreen,
    showToast: showToast,
    findEmployee: findEmployee,
    populateEmployeeData: populateEmployeeData,
    version: '3.0.0-webhook-public'
  };
})();

// Auto-inicializar si se especificó en el HTML
if (document.currentScript && document.currentScript.dataset.autoInit) {
  ASYSForms.init();
}
