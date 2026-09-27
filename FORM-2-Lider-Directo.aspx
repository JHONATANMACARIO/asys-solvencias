<%@ Page Language="C#" %>
<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Solvencia del líder · ASYS</title>
  <link rel="stylesheet" href="assets/asys-forms.css">
</head>
<body class="theme-leader">
  <section class="landing landing-brand" data-screen="landing">
    <nav class="landing-nav">
      <div class="brand"><span class="brand-mark"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16v16H4z"/><path d="M8 9h8M8 13h8M8 17h5"/></svg></span><span class="brand-copy">ASYS<small>Solvencias</small></span></div>
    </nav>
    <main class="hero hero-brand">
      <div class="hero-copy">
        <h1>Cierre claro. Información completa. <span>Sin pendientes.</span></h1>
        <p class="hero-lead">Confirma pagos y descuentos pendientes del colaborador antes de avanzar con la liquidación.</p>
        <div class="hero-actions"><button class="btn btn-primary brand-cta" type="button" data-action="start">Revisar solvencia<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M13 6l6 6-6 6"/></svg></button></div>
      </div>
      <div class="hero-visual" aria-hidden="true">
        <div class="orb"></div>
        <article class="product-card product-card-brand"><div class="product-card-top"><span class="product-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 4h16v16H4z"/><path d="M8 9h8M8 13h8M8 17h5"/></svg></span><span class="pill"><span class="pill-dot"></span>Listo</span></div><h2>Solvencia de líder</h2><p>Validación operativa previa a la liquidación.</p><div class="brand-card-accent"><span></span><span></span><span></span></div></article>
      </div>
    </main>
    <footer class="landing-footer"><span>ASYS · Flujo de bajas 2026</span></footer>
  </section>

  <section class="app" data-screen="form" hidden>
    <nav class="app-nav app-nav-clean">
      <div class="brand brand-minimal"><span>ASYS</span></div>
      <button class="btn btn-ghost" type="button" data-action="home">Cerrar</button>
    </nav>
    <div class="progress-wrap"><div class="progress-bar" data-progress></div></div>
    <main class="app-main app-main-clean">
      <header class="form-hero form-hero-clean"><div><h1>Solvencia del colaborador</h1><p>Selecciona al colaborador y registra únicamente sus pagos y descuentos pendientes.</p></div></header>
      <form data-asys-form novalidate>
        <div class="form-layout form-layout-single">
          <div class="form-stack">
            <section class="form-card">
              <header class="card-head"><span class="section-number">01</span><div><h2>Colaborador</h2></div></header>
              <div class="lookup"><input class="control" id="codigo" name="CODIGO_EMPLEADO" data-employee-code list="employeeCodes" placeholder="Ejemplo: DEMO-GT-0001" autocomplete="off" required><datalist id="employeeCodes"></datalist></div>
              <div class="grid employee-fields">
                <div class="field col-6"><label>Nombre del colaborador</label><input class="control" data-employee-field="NOMBRE_COMPLETO" readonly></div>
                <div class="field col-6"><label>Puesto</label><input class="control" data-employee-field="PUESTO" readonly></div>
                <div class="field col-6"><label>País</label><input class="control" data-employee-field="PAIS_NOMBRE" readonly></div>
                <div class="field col-6"><label>Empresa</label><input class="control" data-employee-field="EMPRESA" readonly></div>
              </div>
            </section>

            <section class="form-card">
              <header class="card-head"><span class="section-number">02</span><div><h2>Pagos pendientes</h2></div></header>
              <div class="grid">
                <div class="field col-6"><label for="bonificacionVariable">Bonificación variable <span class="required">*</span></label><div class="input-wrap"><input class="control" type="number" min="0" step="0.01" id="bonificacionVariable" name="BONIFICACION_VARIABLE" value="0" required></div></div>
                <div class="field col-6"><label for="horasExtrasCantidad">Horas extras — cantidad de horas <span class="required">*</span></label><input class="control" type="number" min="0" step="0.25" id="horasExtrasCantidad" name="HORAS_EXTRAS_CANTIDAD" value="0" required></div>
                <div class="field col-12"><label for="horasExtrasFechas">Fechas de horas extras</label><textarea id="horasExtrasFechas" name="HORAS_EXTRAS_FECHAS" placeholder="DD/MM/AAAA - cantidad"></textarea></div>
                <div class="field col-12"><label for="otroPago">Otro pago — detallar</label><textarea id="otroPago" name="OTRO_PAGO"></textarea></div>
              </div>
            </section>

            <section class="form-card">
              <header class="card-head"><span class="section-number">03</span><div><h2>Descuentos pendientes</h2></div></header>
              <div class="grid">
                <div class="field col-12"><label for="ausencias">Ausencias</label><textarea id="ausencias" name="AUSENCIAS"></textarea></div>
                <div class="field col-12"><label for="otrosDescuentos">Otros descuentos</label><textarea id="otrosDescuentos" name="OTROS_DESCUENTOS"></textarea></div>
              </div>
            </section>

            <footer class="form-actions"><button class="btn btn-primary form-submit" type="submit">Guardar solvencia</button></footer>
          </div>
        </div>
      </form>
    </main>
  </section>

  <div class="toast" data-toast><span class="toast-icon">✓</span><div><strong>Listo</strong><span>Solvencia guardada.</span></div></div>
  <script src="../../2.%20SCRIPS/MAESTRO%20DE%20COLABORADORES/colaboradores.js"></script>
  <script src="assets/asys-forms.js"></script>
  <script>ASYSForms.init({ type: 'SOLVENCIA_LIDER', casePrefix: 'LIDER', filePrefix: 'RESPUESTA_LIDER' });</script>
</body>
</html>
