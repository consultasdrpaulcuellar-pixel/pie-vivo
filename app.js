/* App del paciente — prototipo navegable. El contenido sale de contenido.js y los datos de datos.js. */
(function () {
  'use strict';
  const C = window.PV_CONTENIDO;
  const D = window.PV_DATOS;
  const N = window.PV_NUBE;
  const app = document.getElementById('app');

  let estado = D.leer();
  let camara = null;        // MediaStream activo
  let fotoTemporal = null;  // foto tomada que todavía no se confirmó

  const ICONOS = {
    luz: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8"/></svg>',
    telefono: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M11 18h2"/></svg>',
    personas: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="7" r="3.2"/><circle cx="5" cy="9.5" r="2.3"/><circle cx="19" cy="9.5" r="2.3"/><path d="M6.5 20v-3.5a5.5 5.5 0 0 1 11 0V20zM1 20v-2.8a4 4 0 0 1 4.6-3.9A7.4 7.4 0 0 0 4.6 17v3zM23 20v-2.8a4 4 0 0 0-4.6-3.9 7.4 7.4 0 0 1 1 3.7v3z"/></svg>',
    camara: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M9 4 7.5 6H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-3.5L15 4zm3 4.5a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9zm0 2a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z"/></svg>',
    lista: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h4"/></svg>',
    reloj: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 12.5l5 5 10-11"/></svg>',
    alerta: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm-1.2 5h2.4v7h-2.4zm1.2 8.6a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3z"/></svg>'
  };

  const escapar = function (s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };

  const partesRuta = function () { return location.hash.replace(/^#\/?/, '').split('/').filter(Boolean); };

  function ir(ruta) {
    if (location.hash === '#/' + ruta) pintar();
    else location.hash = '#/' + ruta;
  }

  function guardar() { D.guardar(estado); }

  // --- Envío al equipo ---
  function textoEnvio() {
    if (!estado.controles.some(function (c) { return !c.ejemplo; })) return '';
    return N.pendientes(estado).length
      ? 'Guardado en este teléfono. Se envía al equipo cuando haya conexión.'
      : '✓ Enviado al equipo de salud.';
  }

  function estadoEnvio() {
    return '<p class="estado-envio" id="estado-envio" aria-live="polite">' + escapar(textoEnvio()) + '</p>';
  }

  function sincronizar() {
    N.sincronizar(estado, guardar).then(function () {
      const el = document.getElementById('estado-envio');
      if (el) el.textContent = textoEnvio();
    });
  }

  // --- Piezas comunes ---
  function cabecera(volver) {
    return '<header class="cabecera">' +
      (volver ? '<a class="volver-arriba" href="#/' + volver + '"><span aria-hidden="true">←</span> Volver</a>' : '') +
      '<img class="logo" src="img/logo.png" alt="Pie Vivo by Dr. Paul Cuéllar">' +
      '</header>';
  }

  function progreso(etiqueta, actual, total) {
    let tramos = '';
    for (let i = 1; i <= total; i++) tramos += '<i class="' + (i <= actual ? 'hecho' : '') + '"></i>';
    return '<p class="paso">' + etiqueta + ' ' + actual + ' de ' + total + '</p>' +
      '<div class="barra" role="progressbar" aria-valuemin="1" aria-valuemax="' + total + '" aria-valuenow="' + actual + '">' + tramos + '</div>';
  }

  function advertencia(html) {
    return '<div class="advertencia">' + ICONOS.alerta + '<div>' + html + '</div></div>';
  }

  function piePrototipo() {
    return '<footer class="pie-proto">Prototipo · datos de ejemplo · textos clínicos pendientes de revisión<br>' +
      '<a href="#/prototipo">Opciones del prototipo</a></footer>';
  }

  function pantallaPregunta(p, elegida, accion, volver, encabezado) {
    const opciones = p.opciones.map(function (o) {
      return '<button class="btn opcion' + (o.valor === elegida ? ' elegida' : '') + '" data-accion="' + accion +
        '" data-valor="' + escapar(o.valor) + '">' + escapar(o.texto) + '</button>';
    }).join('');
    return cabecera(volver) + encabezado +
      '<div class="cuerpo">' +
      '<h1 class="pregunta" tabindex="-1">' + escapar(p.texto) + '</h1>' +
      (p.ayuda ? '<p class="ayuda-pregunta">' + escapar(p.ayuda) + '</p>' : '') +
      '<div class="opciones">' + opciones + '</div>' +
      '<div class="acciones"><a class="btn secundario" href="#/' + volver + '">Volver</a></div>' +
      '</div>';
  }

  // --- Primer uso: bienvenida, consentimiento y línea basal ---
  const vistas = {};

  vistas.bienvenida = function () {
    return cabecera() + '<div class="cuerpo">' +
      '<h1 tabindex="-1">Te damos la bienvenida</h1>' +
      '<p class="bajada">Pie Vivo te acompaña a cuidar tus pies entre una consulta y la otra.</p>' +
      '<form class="cuerpo" data-form="nombre" novalidate>' +
      '<label class="campo-etiqueta" for="nombre">¿Cómo te llamás?</label>' +
      '<input class="campo" id="nombre" name="nombre" type="text" autocomplete="given-name" autocapitalize="words" maxlength="40" value="' + escapar(estado.nombre || '') + '">' +
      '<p class="campo-error" id="nombre-error" role="alert" hidden>Escribí tu nombre para empezar.</p>' +
      '<div class="acciones"><button class="btn" type="submit">Empezar</button></div>' +
      '</form></div>' + piePrototipo();
  };

  vistas.consentimiento = function () {
    const puntos = C.consentimiento.puntos.map(function (t) { return '<li>' + escapar(t) + '</li>'; }).join('');
    return cabecera('bienvenida') + '<div class="cuerpo">' +
      '<h1 tabindex="-1">' + escapar(C.consentimiento.titulo) + '</h1>' +
      '<ul class="lista">' + puntos + '</ul>' +
      '<p class="nota-proto">Texto de consentimiento en borrador: requiere revisión legal y del comité que corresponda.</p>' +
      '<div class="acciones">' +
      '<button class="btn" data-accion="consentir">Acepto</button>' +
      '<a class="btn secundario" href="#/sin-consentimiento">No acepto</a>' +
      '</div></div>';
  };

  vistas['sin-consentimiento'] = function () {
    return cabecera('consentimiento') + '<div class="cuerpo">' +
      '<h1 tabindex="-1">Está bien</h1>' +
      '<p class="bajada">Sin tu aceptación no guardamos nada. Si tenés dudas, hablalo con tu equipo de salud.</p>' +
      '<div class="acciones"><a class="btn secundario" href="#/consentimiento">Volver</a></div>' +
      '</div>';
  };

  vistas.basal = function (arg) {
    const total = C.basal.preguntas.length;
    const n = Math.min(Math.max(parseInt(arg, 10) || 1, 1), total);
    const p = C.basal.preguntas[n - 1];
    const respuestas = estado.basalBorrador || {};
    const intro = n === 1 ? '<p class="suave centro" style="margin-top:.75rem">' + escapar(C.basal.intro) + '</p>' : '';
    return pantallaPregunta(p, respuestas[p.id], 'responder-basal', n > 1 ? 'basal/' + (n - 1) : 'consentimiento',
      progreso(C.basal.titulo + ':', n, total) + intro);
  };

  // --- Flujo del control ---
  vistas.inicio = function () {
    const ultimo = D.ultimoControl(estado);
    const hechoHoy = ultimo && D.diasDesde(ultimo.fecha) === 0;
    const principal = estado.borrador
      ? '<button class="btn" data-accion="continuar">Continuar mi control</button>'
      : '<a class="btn" href="#/preparacion">' + (hechoHoy ? 'Hacer otro control' : 'Hacer mi control') + '</a>';
    return cabecera() + '<div class="cuerpo">' +
      '<h1 tabindex="-1">Hola, ' + escapar(estado.nombre) + '</h1>' +
      '<p class="bajada">¿Cómo están tus pies hoy?</p>' +
      '<img class="ilustracion" src="img/isotipo.png" alt="">' +
      (hechoHoy ? '<p class="hecho-hoy">✓ Ya hiciste tu control de hoy</p>' : '') +
      '<div class="acciones">' + principal +
      '<a class="btn secundario" href="#/ayuda">Necesito ayuda</a></div>' +
      (ultimo ? '<p class="ultimo">' + ICONOS.reloj + ' Último control: ' + D.fechaRelativa(ultimo.fecha) + '</p>' : '') +
      estadoEnvio() +
      '</div>' + piePrototipo();
  };

  vistas.preparacion = function () {
    const pasos = C.preparacion.pasos.map(function (p) {
      return '<li><span class="icono">' + ICONOS[p.icono] + '</span><span>' + escapar(p.texto) + '</span></li>';
    }).join('');
    return cabecera('inicio') + '<div class="cuerpo">' +
      '<h1 tabindex="-1">' + escapar(C.preparacion.titulo) + '</h1>' +
      '<ul class="pasos">' + pasos + '</ul>' +
      '<div class="acciones">' +
      '<button class="btn" data-accion="comenzar">Comenzar</button>' +
      '<a class="btn secundario" href="#/cuidador">Me ayuda un cuidador</a>' +
      '</div></div>';
  };

  vistas.cuidador = function () {
    const botones = C.cuidadores.map(function (nombre) {
      return '<button class="btn opcion" data-accion="comenzar" data-cuidador="' + escapar(nombre) + '">' + escapar(nombre) + '</button>';
    }).join('');
    return cabecera('preparacion') + '<div class="cuerpo">' +
      '<h1 class="pregunta" tabindex="-1">¿Quién te ayuda hoy?</h1>' +
      '<div class="opciones">' + botones + '</div>' +
      '<p class="nota-proto">En el PMV cada cuidador entra con su propia cuenta, autorizada por el paciente, y queda registrado quién hizo el control.</p>' +
      '<div class="acciones"><a class="btn secundario" href="#/preparacion">Volver</a></div>' +
      '</div>';
  };

  vistas.pregunta = function (arg) {
    const total = C.preguntas.length;
    const n = Math.min(Math.max(parseInt(arg, 10) || 1, 1), total);
    const p = C.preguntas[n - 1];
    const b = estado.borrador;
    const volver = b.corrigiendo ? 'revision' : (n > 1 ? 'pregunta/' + (n - 1) : 'preparacion');
    return pantallaPregunta(p, b.respuestas[p.id], 'responder', volver, progreso('Pregunta', n, total));
  };

  vistas.foto = function (arg) {
    const total = C.fotos.length;
    const n = Math.min(Math.max(parseInt(arg, 10) || 1, 1), total);
    const f = C.fotos[n - 1];
    const volver = estado.borrador.corrigiendo ? 'revision' : (n > 1 ? 'foto/' + (n - 1) : 'pregunta/' + C.preguntas.length);
    return cabecera(volver) + progreso('Foto', n, total) +
      '<div class="cuerpo">' +
      '<h1 class="titulo-foto" tabindex="-1">' + escapar(f.titulo) + '</h1>' +
      '<p class="guia-foto" id="guia-foto">' + escapar(f.guia) + '</p>' +
      '<div class="visor" id="visor"></div>' +
      '<div class="acciones" id="acciones-foto"></div>' +
      '</div>';
  };

  vistas.revision = function () {
    const b = estado.borrador;
    const filas = C.preguntas.map(function (p, i) {
      const opcion = p.opciones.find(function (o) { return o.valor === b.respuestas[p.id]; });
      return '<div class="fila"><div class="dato"><small>' + escapar(p.etiqueta) + '</small><strong>' +
        (opcion ? escapar(opcion.texto) : 'Sin responder') + '</strong></div>' +
        '<button class="cambiar" data-accion="corregir" data-ruta="pregunta/' + (i + 1) + '">Cambiar</button></div>';
    }).join('');
    const tomadas = C.fotos.filter(function (f) { return b.fotos[f.id] === 'ok'; }).length;
    const miniaturas = C.fotos.map(function (f, i) {
      return '<button data-accion="corregir" data-ruta="foto/' + (i + 1) + '" data-foto="' + f.id + '" aria-label="' +
        escapar(f.titulo) + ': ' + (b.fotos[f.id] === 'ok' ? 'cambiar foto' : 'falta la foto') + '">Falta</button>';
    }).join('');
    const faltan = C.preguntas.some(function (p) { return !b.respuestas[p.id]; });
    return cabecera('foto/' + C.fotos.length) + '<div class="cuerpo">' +
      '<h1 tabindex="-1">Revisá tu control</h1>' +
      '<p class="centro suave">Antes de enviarlo, podés corregirlo.</p>' +
      '<section class="tarjeta"><h2>' + ICONOS.lista + ' Respuestas</h2>' + filas + '</section>' +
      '<section class="tarjeta"><h2>' + ICONOS.camara + ' Fotos: ' + tomadas + ' de ' + C.fotos.length + '</h2>' +
      '<p class="suave" style="margin:0">Tocá una foto para repetirla.</p>' +
      '<div class="miniaturas">' + miniaturas + '</div></section>' +
      '<div class="acciones">' +
      (faltan ? '<p class="centro">Te falta responder alguna pregunta. Tocá “Cambiar”.</p>'
        : '<button class="btn" data-accion="enviar">Enviar control</button>') +
      '<a class="btn secundario" href="#/foto/' + C.fotos.length + '">Volver</a>' +
      '</div></div>';
  };

  vistas.enviado = function () {
    return cabecera() + '<div class="cuerpo">' +
      '<div class="exito">' + ICONOS.check + '</div>' +
      '<h1 tabindex="-1">' + escapar(C.confirmacion.titulo) + '</h1>' +
      '<p class="bajada">' + escapar(C.confirmacion.texto) + '</p>' +
      estadoEnvio() +
      advertencia(escapar(C.confirmacion.advertencia)) +
      '<div class="acciones">' +
      '<a class="btn" href="#/inicio">Volver al inicio</a>' +
      '<a class="btn secundario" href="#/ayuda">Contactar al equipo</a>' +
      '</div></div>' + piePrototipo();
  };

  vistas.ayuda = function () {
    const A = C.ayuda;
    const senales = A.senales.map(function (s) { return '<li>' + escapar(s) + '</li>'; }).join('');
    const contactos = A.contactos.map(function (c) {
      return c.telefono
        ? '<a class="btn" href="tel:' + escapar(c.telefono) + '">' + escapar(c.texto) + '</a>'
        : '<button class="btn" disabled style="opacity:.55">' + escapar(c.texto) + '</button><p class="pendiente">' + escapar(c.pendiente) + '</p>';
    }).join('');
    const uso = A.uso.map(function (s) { return '<li>' + escapar(s) + '</li>'; }).join('');
    return cabecera() + '<div class="cuerpo">' +
      '<h1 tabindex="-1">' + escapar(A.titulo) + '</h1>' +
      advertencia(escapar(A.alarmaTitulo) + '<ul>' + senales + '</ul>' + escapar(A.alarmaAccion)) +
      '<div class="acciones" style="margin-top:0">' + contactos + '</div>' +
      '<h2>' + escapar(A.usoTitulo) + '</h2><ul class="lista">' + uso + '</ul>' +
      '<div class="acciones"><button class="btn secundario" data-accion="atras">Volver</button></div>' +
      '</div>';
  };

  vistas.prototipo = function (arg) {
    if (arg === 'reiniciar') {
      return cabecera('prototipo') + '<div class="cuerpo">' +
        '<h1 tabindex="-1">¿Reiniciar el prototipo?</h1>' +
        '<p class="bajada">Se borran los controles y las fotos guardados en este dispositivo.</p>' +
        '<div class="acciones"><button class="btn" data-accion="reiniciar">Sí, reiniciar</button>' +
        '<a class="btn secundario" href="#/prototipo">No, volver</a></div></div>';
    }
    return cabecera('inicio') + '<div class="cuerpo">' +
      '<h1 tabindex="-1">Opciones del prototipo</h1>' +
      '<p class="centro suave">Contenido ' + escapar(C.version) + '. Los controles se guardan en este dispositivo y se envían al panel del equipo. Usar solo datos de prueba.</p>' +
      '<div class="acciones" style="margin-top:0">' +
      '<a class="btn" href="panel.html">Ver panel profesional</a>' +
      '<a class="btn secundario" href="panel.html#contenido">Ver contenido clínico</a>' +
      '<a class="btn secundario" href="#/prototipo/reiniciar">Reiniciar prototipo</a>' +
      '</div>' +
      '<div class="acciones"><a class="btn secundario" href="#/inicio">Volver</a></div>' +
      '</div>';
  };

  // --- Cámara ---
  const MARCO = '<div class="marco" aria-hidden="true"><b></b><b></b><b></b><b></b></div>';

  function detenerCamara() {
    if (camara) camara.getTracks().forEach(function (t) { t.stop(); });
    camara = null;
  }

  function accionesFoto(html) {
    const caja = document.getElementById('acciones-foto');
    if (caja) caja.innerHTML = html;
  }

  const OMITIR = '<button class="btn discreto" data-accion="omitir-foto">No puedo tomar esta foto</button>';

  function prepararFoto() {
    const visor = document.getElementById('visor');
    if (!visor) return;
    if (fotoTemporal) return mostrarConfirmacion();

    document.getElementById('guia-foto').textContent = fotoActual().guia;
    visor.innerHTML = '<video playsinline muted autoplay></video>' + MARCO;
    accionesFoto('<button class="btn" data-accion="tomar-foto">' + ICONOS.camara + ' Tomar foto</button>' +
      '<a class="btn secundario" href="#/ayuda">Necesito ayuda</a>' + OMITIR);

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return sinCamara();
    navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1440 } }
    }).then(function (flujo) {
      // Si la persona ya salió de esta pantalla, no dejamos la cámara encendida.
      if (!document.body.contains(visor)) return flujo.getTracks().forEach(function (t) { t.stop(); });
      camara = flujo;
      visor.querySelector('video').srcObject = flujo;
    }).catch(sinCamara);
  }

  function sinCamara() {
    const visor = document.getElementById('visor');
    if (!visor) return;
    visor.innerHTML = '<div class="mensaje">No pudimos abrir la cámara desde acá.<br>Usá el botón de abajo.</div>';
    accionesFoto('<label class="btn">' + ICONOS.camara + ' Abrir la cámara' +
      '<input type="file" accept="image/*" capture="environment" id="archivo-foto" hidden></label>' +
      '<button class="btn secundario" data-accion="foto-ejemplo">Usar una foto de ejemplo</button>' + OMITIR);
  }

  function mostrarConfirmacion() {
    detenerCamara();
    document.getElementById('guia-foto').textContent = '¿Se ve bien todo el pie?';
    document.getElementById('visor').innerHTML = '<img src="' + fotoTemporal + '" alt="Foto que acabás de tomar">';
    accionesFoto('<button class="btn" data-accion="usar-foto">Usar esta foto</button>' +
      '<button class="btn secundario" data-accion="repetir-foto">Repetir foto</button>');
  }

  function numeroFoto() { return Math.min(Math.max(parseInt(partesRuta()[1], 10) || 1, 1), C.fotos.length); }
  function fotoActual() { return C.fotos[numeroFoto() - 1]; }

  // Recorta lo mismo que se ve dentro del visor, para que la guía y la foto coincidan.
  function capturar(video, visor) {
    const vw = video.videoWidth, vh = video.videoHeight;
    if (!vw || !vh) return null;
    const proporcion = visor.clientWidth / visor.clientHeight;
    let ancho = vw, alto = vh;
    if (vw / vh > proporcion) ancho = vh * proporcion; else alto = vw / proporcion;
    return dibujar(video, (vw - ancho) / 2, (vh - alto) / 2, ancho, alto);
  }

  function dibujar(fuente, x, y, ancho, alto) {
    const escala = Math.min(1, 1280 / Math.max(ancho, alto));
    const lienzo = document.createElement('canvas');
    lienzo.width = Math.round(ancho * escala);
    lienzo.height = Math.round(alto * escala);
    lienzo.getContext('2d').drawImage(fuente, x, y, ancho, alto, 0, 0, lienzo.width, lienzo.height);
    return lienzo.toDataURL('image/jpeg', 0.8);
  }

  function leerArchivo(archivo) {
    const lector = new FileReader();
    lector.onload = function () {
      const imagen = new Image();
      imagen.onload = function () {
        fotoTemporal = dibujar(imagen, 0, 0, imagen.naturalWidth, imagen.naturalHeight);
        mostrarConfirmacion();
      };
      imagen.src = lector.result;
    };
    lector.readAsDataURL(archivo);
  }

  function fotoDeEjemplo() {
    const lienzo = document.createElement('canvas');
    lienzo.width = 640; lienzo.height = 800;
    const ctx = lienzo.getContext('2d');
    const fondo = ctx.createLinearGradient(0, 0, 640, 800);
    fondo.addColorStop(0, '#D9C7AE'); fondo.addColorStop(1, '#B89F82');
    ctx.fillStyle = fondo; ctx.fillRect(0, 0, 640, 800);
    ctx.fillStyle = 'rgba(20,33,43,.75)'; ctx.textAlign = 'center';
    ctx.font = '600 34px system-ui, sans-serif';
    ctx.fillText('Foto de ejemplo', 320, 380);
    ctx.font = '26px system-ui, sans-serif';
    ctx.fillText(fotoActual().titulo, 320, 430);
    ctx.fillText(new Date().toLocaleString('es-AR'), 320, 475);
    return lienzo.toDataURL('image/jpeg', 0.8);
  }

  function despuesDeFoto() {
    fotoTemporal = null;
    const n = numeroFoto();
    if (estado.borrador.corrigiendo || n >= C.fotos.length) {
      estado.borrador.corrigiendo = false;
      guardar();
      ir('revision');
    } else {
      ir('foto/' + (n + 1));
    }
  }

  function cargarMiniaturas() {
    const b = estado.borrador;
    app.querySelectorAll('.miniaturas button').forEach(function (boton) {
      const id = boton.dataset.foto;
      if (b.fotos[id] !== 'ok') return;
      D.leerFoto(b.id, id).then(function (dataUrl) {
        if (dataUrl) boton.innerHTML = '<img src="' + dataUrl + '" alt="">';
      });
    });
  }

  // --- Acciones ---
  const acciones = {
    consentir: function () {
      estado.consentimiento = { version: C.consentimiento.version, fecha: new Date().toISOString() };
      guardar();
      ir('basal/1');
    },

    'responder-basal': function (el) {
      const total = C.basal.preguntas.length;
      const n = Math.min(parseInt(partesRuta()[1], 10) || 1, total);
      estado.basalBorrador = estado.basalBorrador || {};
      estado.basalBorrador[C.basal.preguntas[n - 1].id] = el.dataset.valor;
      if (n < total) { guardar(); return ir('basal/' + (n + 1)); }
      estado.basal = { fecha: new Date().toISOString(), respuestas: estado.basalBorrador };
      delete estado.basalBorrador;
      D.sembrarEjemplos(estado);
      guardar();
      ir('inicio');
    },

    comenzar: function (el) {
      const cuidador = el.dataset.cuidador;
      estado.borrador = {
        id: window.crypto && crypto.randomUUID ? crypto.randomUUID() : 'c-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8),
        respuestas: {},
        fotos: {},
        realizadoPor: cuidador ? { tipo: 'cuidador', nombre: cuidador } : { tipo: 'paciente', nombre: estado.nombre },
        corrigiendo: false
      };
      guardar();
      ir('pregunta/1');
    },

    continuar: function () {
      const b = estado.borrador;
      b.corrigiendo = false;
      guardar();
      const pregunta = C.preguntas.findIndex(function (p) { return !b.respuestas[p.id]; });
      if (pregunta >= 0) return ir('pregunta/' + (pregunta + 1));
      const foto = C.fotos.findIndex(function (f) { return !b.fotos[f.id]; });
      ir(foto >= 0 ? 'foto/' + (foto + 1) : 'revision');
    },

    responder: function (el) {
      const b = estado.borrador;
      const n = Math.min(parseInt(partesRuta()[1], 10) || 1, C.preguntas.length);
      b.respuestas[C.preguntas[n - 1].id] = el.dataset.valor;
      const destino = b.corrigiendo ? 'revision' : (n < C.preguntas.length ? 'pregunta/' + (n + 1) : 'foto/1');
      b.corrigiendo = false;
      guardar();
      ir(destino);
    },

    corregir: function (el) {
      estado.borrador.corrigiendo = true;
      guardar();
      ir(el.dataset.ruta);
    },

    'tomar-foto': function () {
      const visor = document.getElementById('visor');
      const video = visor.querySelector('video');
      const foto = video && capturar(video, visor);
      if (!foto) return sinCamara();
      fotoTemporal = foto;
      mostrarConfirmacion();
    },

    'foto-ejemplo': function () { fotoTemporal = fotoDeEjemplo(); mostrarConfirmacion(); },

    'repetir-foto': function () { fotoTemporal = null; prepararFoto(); },

    'usar-foto': function () {
      const b = estado.borrador, id = fotoActual().id;
      D.guardarFoto(b.id, id, fotoTemporal).then(function () {
        b.fotos[id] = 'ok';
        guardar();
        despuesDeFoto();
      }).catch(function () {
        document.getElementById('guia-foto').textContent = 'No pudimos guardar la foto. Probá repetirla.';
      });
    },

    'omitir-foto': function () {
      const b = estado.borrador, id = fotoActual().id;
      b.fotos[id] = 'omitida';
      guardar();
      D.borrarFoto(b.id, id);
      despuesDeFoto();
    },

    enviar: function () {
      const b = estado.borrador;
      const control = {
        id: b.id,
        fecha: new Date().toISOString(),
        respuestas: b.respuestas,
        fotos: b.fotos,
        realizadoPor: b.realizadoPor,
        revision: null
      };
      control.avisos = D.evaluar(control);
      estado.controles.push(control);
      estado.borrador = null;
      guardar();
      ir('enviado');
      sincronizar();
    },

    atras: function () { if (history.length > 1) history.back(); else ir('inicio'); },

    reiniciar: function () {
      N.olvidarPaciente().then(D.reiniciar).then(function () { estado = D.leer(); ir('bienvenida'); });
    }
  };

  app.addEventListener('click', function (e) {
    const el = e.target.closest('[data-accion]');
    if (el && acciones[el.dataset.accion]) acciones[el.dataset.accion](el);
  });

  app.addEventListener('submit', function (e) {
    if (e.target.dataset.form !== 'nombre') return;
    e.preventDefault();
    const campo = document.getElementById('nombre');
    const nombre = campo.value.trim();
    if (!nombre) {
      document.getElementById('nombre-error').hidden = false;
      return campo.focus();
    }
    estado.nombre = nombre;
    guardar();
    ir('consentimiento');
  });

  app.addEventListener('change', function (e) {
    if (e.target.id === 'archivo-foto' && e.target.files[0]) leerArchivo(e.target.files[0]);
  });

  // --- Navegación ---
  const SIN_REGISTRO = ['bienvenida', 'consentimiento', 'sin-consentimiento', 'ayuda', 'prototipo'];
  let fotoVisible = null;

  function pintar() {
    detenerCamara();
    const partes = partesRuta();
    const nombre = vistas[partes[0]] ? partes[0] : 'inicio';

    if (!estado.nombre && nombre !== 'bienvenida' && nombre !== 'prototipo') return ir('bienvenida');
    if (!estado.consentimiento && SIN_REGISTRO.indexOf(nombre) < 0) return ir('bienvenida');
    if (estado.consentimiento && !estado.basal && nombre !== 'basal' && SIN_REGISTRO.indexOf(nombre) < 0) return ir('basal/1');
    if (['pregunta', 'foto', 'revision'].indexOf(nombre) >= 0 && !estado.borrador) return ir('inicio');

    // Una foto sin confirmar solo vale para la pantalla en la que se tomó.
    const clave = nombre === 'foto' ? partes[1] : null;
    if (clave !== fotoVisible) fotoTemporal = null;
    fotoVisible = clave;

    if (nombre === 'revision') estado.borrador.corrigiendo = false;

    app.innerHTML = vistas[nombre](partes[1]);
    window.scrollTo(0, 0);
    const titulo = app.querySelector('h1');
    if (titulo) titulo.focus({ preventScroll: true });

    if (nombre === 'foto') prepararFoto();
    if (nombre === 'revision') cargarMiniaturas();
  }

  window.addEventListener('hashchange', pintar);
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) detenerCamara();
    else if (partesRuta()[0] === 'foto' && !fotoTemporal) prepararFoto();
  });

  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    navigator.serviceWorker.register('sw.js').catch(function () {});
  }

  window.addEventListener('online', sincronizar);

  pintar();
  sincronizar();
})();
