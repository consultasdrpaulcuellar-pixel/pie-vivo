/*
  Panel profesional — prototipo.
  Con sesión profesional muestra todos los pacientes desde Supabase;
  sin sesión, solo los controles guardados en este dispositivo.
*/
(function () {
  'use strict';
  const C = window.PV_CONTENIDO;
  const D = window.PV_DATOS;
  const N = window.PV_NUBE;
  const panel = document.getElementById('panel');
  const acceso = document.getElementById('acceso');

  let usuario = null;       // profesional con sesión, o null (modo local)
  let pacientes = [];
  let estadoLocal = null;
  let mensajeAcceso = '';

  const NIVEL = {
    prioritario: { texto: 'Aviso prioritario', simbolo: '▲' },
    revisar: { texto: 'Para revisar', simbolo: '●' }
  };
  const ACCIONES = ['Sin acción necesaria', 'Contactar al paciente', 'Citar a consulta', 'Derivar a otra especialidad'];

  const escapar = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };

  function etiquetaNivel(nivel) {
    if (!nivel) return '<span class="etiqueta ok">✓ Sin avisos</span>';
    return '<span class="etiqueta ' + nivel + '">' + NIVEL[nivel].simbolo + ' ' + NIVEL[nivel].texto + '</span>';
  }

  function quien(control) {
    const r = control.realizadoPor;
    return r.tipo === 'cuidador' ? 'Con ayuda: ' + r.nombre.toLowerCase() : 'Paciente';
  }

  const textoOpcion = function (pregunta, valor) {
    const o = pregunta.opciones.find(function (x) { return x.valor === valor; });
    return o ? o.texto : '—';
  };

  const fotosTomadas = function (control) {
    return C.fotos.filter(function (f) { return control.fotos[f.id] === 'ok'; }).length;
  };

  const recientesPrimero = function (p) { return p.controles.slice().reverse(); };
  const ultimoDe = function (p) { return p.controles[p.controles.length - 1] || null; };
  const buscarPaciente = function (id) { return pacientes.find(function (p) { return p.id === id; }); };
  const sinDatos = function () {
    return '<div class="tarjeta"><p style="margin:0">Todavía no hay controles. ' +
      (usuario ? 'Cuando un paciente envíe uno desde la App, aparece acá.' : 'Abrí la <a href="index.html">App del paciente</a> o ingresá como profesional.') + '</p></div>';
  };

  // --- Datos ---
  async function cargar() {
    usuario = await N.sesionProfesional().catch(function () { return null; });
    if (usuario) {
      try {
        pacientes = await N.leerTodo();
      } catch (e) {
        pacientes = [];
        mensajeAcceso = 'No pudimos leer los datos. Revisá la conexión y tocá “Actualizar”.';
      }
      return;
    }
    estadoLocal = D.leer();
    pacientes = estadoLocal.basal ? [{
      id: 'local', nombre: estadoLocal.nombre, basal: estadoLocal.basal,
      consentimiento: estadoLocal.consentimiento, controles: estadoLocal.controles
    }] : [];
  }

  function pintarAcceso() {
    document.getElementById('origen-datos').textContent = usuario ? 'Prototipo · datos de prueba en la nube' : 'Prototipo · datos de este dispositivo';
    const aviso = mensajeAcceso ? '<span class="mensaje-acceso" role="status">' + escapar(mensajeAcceso) + '</span>' : '';
    if (usuario) {
      acceso.innerHTML = '<div class="acceso"><span>Sesión: <strong>' + escapar(usuario.email) + '</strong> · ' + pacientes.length + ' paciente(s)</span>' +
        (pacientes.length ? '' : '<span class="suave">Si tu correo no está habilitado como profesional, no vas a ver datos.</span>') + aviso +
        '<span class="acceso-botones"><button class="btn secundario" id="actualizar">Actualizar</button><button class="btn secundario" id="salir">Salir</button></span></div>';
    } else if (N.disponible) {
      acceso.innerHTML = '<form class="acceso" id="form-acceso"><label for="correo" style="margin:0">Ingreso profesional</label>' +
        '<input id="correo" type="email" autocomplete="email" placeholder="correo habilitado" required>' +
        '<button class="btn" type="submit">Enviarme el enlace</button>' +
        (aviso || '<span class="suave">Sin ingresar se ven solo los controles de este dispositivo.</span>') + '</form>';
    } else {
      acceso.innerHTML = '<div class="acceso"><span class="suave">Sin conexión con el servidor: se muestran solo los controles de este dispositivo.</span></div>';
    }
  }

  // Resumen por plantilla. En el PMV lo redacta la IA a partir de estos mismos datos.
  function resumen(p, control) {
    const previos = p.controles.filter(function (c) { return c.fecha < control.fecha; });
    const cambios = [], dudas = [];
    C.preguntas.forEach(function (pregunta) {
      const v = control.respuestas[pregunta.id];
      if (v === 'si') {
        const antes = previos.filter(function (c) { return c.respuestas[pregunta.id] === 'si'; }).length;
        cambios.push(pregunta.etiqueta.toLowerCase() + (previos.length
          ? (antes ? ' (también en ' + antes + ' de los ' + previos.length + ' controles previos)' : ' (primera vez en ' + previos.length + ' controles previos)')
          : ''));
      } else if (v === 'ns') dudas.push(pregunta.etiqueta.toLowerCase());
    });
    const partes = ['Control del ' + D.fechaLarga(control.fecha) + ', realizado por ' +
      (control.realizadoPor.tipo === 'cuidador' ? 'cuidador (' + control.realizadoPor.nombre.toLowerCase() + ')' : 'el propio paciente') + '.'];
    partes.push(cambios.length ? 'Informa: ' + cambios.join('; ') + '.' : 'No informa cambios en las ' + C.preguntas.length + ' preguntas.');
    if (dudas.length) partes.push('Respondió “no estoy seguro” en: ' + dudas.join(', ') + '.');
    partes.push('Fotos: ' + fotosTomadas(control) + ' de ' + C.fotos.length + '.');
    return partes.join(' ');
  }

  // --- Avisos ---
  function vistaAvisos() {
    let html = '<h1>Avisos para revisión</h1>' +
      '<p class="suave">Un aviso indica que una respuesta cumple un criterio de revisión. No confirma una lesión, y la falta de avisos no descarta complicaciones.</p>';
    if (!pacientes.length) return html + sinDatos();

    const pendientes = [], revisados = [];
    pacientes.forEach(function (p) {
      p.controles.forEach(function (c) {
        if (c.avisos.length && !c.revision) pendientes.push({ p: p, c: c });
        if (c.revision && !c.ejemplo) revisados.push({ p: p, c: c });
      });
      const ultimo = ultimoDe(p);
      if (ultimo && D.diasDesde(ultimo.fecha) >= C.frecuencia.avisarSinControlDias) {
        html += '<article class="tarjeta revisar"><header>' + etiquetaNivel('revisar') + '<strong>' + escapar(p.nombre) +
          '</strong></header><p>Sin controles desde ' + D.fechaRelativa(ultimo.fecha) + ' (umbral: ' + C.frecuencia.avisarSinControlDias +
          ' días). <a href="#paciente/' + p.id + '">Ver paciente</a></p></article>';
      }
    });
    pendientes.sort(function (a, b) {
      const na = D.nivelMaximo(a.c.avisos) === 'prioritario' ? 0 : 1, nb = D.nivelMaximo(b.c.avisos) === 'prioritario' ? 0 : 1;
      return na - nb || (a.c.fecha < b.c.fecha ? 1 : -1);
    });
    revisados.sort(function (a, b) { return a.c.fecha < b.c.fecha ? 1 : -1; });

    if (!pendientes.length) html += '<div class="tarjeta"><p style="margin:0">No hay avisos pendientes.</p></div>';
    pendientes.forEach(function (x) {
      const nivel = D.nivelMaximo(x.c.avisos);
      html += '<article class="tarjeta ' + nivel + '"><header>' + etiquetaNivel(nivel) +
        '<strong>' + escapar(x.p.nombre) + '</strong><span class="suave">' + D.fechaLarga(x.c.fecha) + ' · ' + escapar(quien(x.c)) + '</span></header>' +
        '<ul>' + x.c.avisos.map(function (a) { return '<li>' + escapar(a.texto) + '</li>'; }).join('') + '</ul>' +
        '<a class="btn" href="#control/' + x.p.id + '/' + x.c.id + '">Abrir control</a></article>';
    });

    if (revisados.length) {
      html += '<h2>Revisados</h2>';
      revisados.slice(0, 8).forEach(function (x) {
        html += '<article class="tarjeta"><header><span class="etiqueta neutra">Revisado</span><strong>' + escapar(x.p.nombre) +
          '</strong><span class="suave">' + D.fechaLarga(x.c.fecha) + '</span></header><p style="margin:0">' + escapar(x.c.revision.accion) +
          (x.c.revision.nota ? ' — ' + escapar(x.c.revision.nota) : '') + ' · <a href="#control/' + x.p.id + '/' + x.c.id + '">Ver</a></p></article>';
      });
    }
    return html;
  }

  // --- Pacientes ---
  function vistaPacientes() {
    if (!pacientes.length) return '<h1>Pacientes</h1>' + sinDatos();
    const filas = pacientes.map(function (p) {
      const ultimo = ultimoDe(p);
      const abiertos = p.controles.filter(function (c) { return c.avisos.length && !c.revision; });
      const nivel = abiertos.some(function (c) { return D.nivelMaximo(c.avisos) === 'prioritario'; }) ? 'prioritario' : (abiertos.length ? 'revisar' : null);
      return '<tr><td><a href="#paciente/' + p.id + '"><strong>' + escapar(p.nombre) + '</strong></a></td><td>' +
        p.controles.filter(function (c) { return !c.ejemplo; }).length + '</td><td>' + (ultimo ? D.fechaRelativa(ultimo.fecha) : '—') +
        '</td><td>' + etiquetaNivel(nivel) + (abiertos.length ? ' ' + abiertos.length + ' sin revisar' : '') + '</td></tr>';
    }).join('');
    return '<h1>Pacientes</h1><p class="suave">Datos de prueba. Cada dispositivo que usa la App aparece como un paciente.</p>' +
      '<div class="tabla-caja"><table><thead><tr><th>Paciente</th><th>Controles</th><th>Último control</th><th>Estado</th></tr></thead><tbody>' + filas + '</tbody></table></div>';
  }

  function vistaPaciente(id) {
    const p = buscarPaciente(id);
    if (!p) return '<h1>Paciente no encontrado</h1><p><a href="#pacientes">Volver a pacientes</a></p>';

    const basal = C.basal.preguntas.map(function (pregunta) {
      return '<dt>' + escapar(pregunta.etiqueta) + '</dt><dd>' + escapar(textoOpcion(pregunta, (p.basal.respuestas || {})[pregunta.id])) + '</dd>';
    }).join('');
    const reales = p.controles.filter(function (c) { return !c.ejemplo; });
    const conAyuda = reales.filter(function (c) { return c.realizadoPor.tipo === 'cuidador'; }).length;
    const ultimo = ultimoDe(p);

    const cabeceras = C.preguntas.map(function (pregunta) { return '<th>' + escapar(pregunta.etiqueta) + '</th>'; }).join('');
    const filas = recientesPrimero(p).map(function (c) {
      const celdas = C.preguntas.map(function (pregunta) {
        const v = c.respuestas[pregunta.id];
        const clase = v === 'si' ? 'resp-si' : v === 'ns' ? 'resp-ns' : 'resp-no';
        return '<td class="resp"><span class="' + clase + '">' + (v === 'si' ? 'Sí' : v === 'ns' ? '?' : 'No') + '</span></td>';
      }).join('');
      const estadoControl = c.revision ? '<span class="etiqueta neutra">Revisado</span>' : etiquetaNivel(D.nivelMaximo(c.avisos));
      return '<tr><td><a href="#control/' + p.id + '/' + c.id + '">' + D.fechaCorta(c.fecha) + '</a>' + (c.ejemplo ? ' <span class="suave">(ejemplo)</span>' : '') + '</td>' +
        celdas + '<td>' + fotosTomadas(c) + '/' + C.fotos.length + '</td><td>' + escapar(quien(c)) + '</td><td>' + estadoControl + '</td></tr>';
    }).join('');

    return (pacientes.length > 1 ? '<p><a href="#pacientes">← Pacientes</a></p>' : '') + '<h1>' + escapar(p.nombre) + '</h1><p class="suave">Datos de prueba · frecuencia indicada: cada ' +
      C.frecuencia.diasEntreControles + ' día(s)</p>' +
      '<div class="dos-columnas">' +
      '<section class="tarjeta"><h3 style="margin-top:0">Registro inicial (línea basal) · ' + D.fechaCorta(p.basal.fecha) + '</h3><dl>' + basal + '</dl></section>' +
      '<section class="tarjeta"><h3 style="margin-top:0">Uso</h3><dl>' +
      '<dt>Controles enviados</dt><dd>' + reales.length + '</dd>' +
      '<dt>Hechos con ayuda</dt><dd>' + conAyuda + '</dd>' +
      '<dt>Último control</dt><dd>' + (ultimo ? D.fechaRelativa(ultimo.fecha) : '—') + '</dd>' +
      '<dt>Consentimiento</dt><dd>' + escapar((p.consentimiento || {}).version || '—') + '</dd>' +
      '</dl></section></div>' +
      '<h2>Historial de controles</h2>' +
      (p.controles.length
        ? '<div class="tabla-caja"><table><thead><tr><th>Fecha</th>' + cabeceras + '<th>Fotos</th><th>Hecho por</th><th>Estado</th></tr></thead><tbody>' + filas + '</tbody></table></div>'
        : '<div class="tarjeta"><p style="margin:0">Todavía no envió controles.</p></div>');
  }

  // --- Control ---
  function vistaControl(pacienteId, id, compararId) {
    const p = buscarPaciente(pacienteId);
    const control = p && p.controles.find(function (c) { return c.id === id; });
    if (!control) return '<h1>Control no encontrado</h1><p><a href="#pacientes">Volver a pacientes</a></p>';

    const otros = recientesPrimero(p).filter(function (c) { return c.id !== id; });
    const anterior = otros.find(function (c) { return c.fecha < control.fecha; });
    const comparar = otros.find(function (c) { return c.id === compararId; }) || anterior || null;

    const respuestas = C.preguntas.map(function (pregunta) {
      const v = control.respuestas[pregunta.id];
      const clase = v === 'si' ? 'resp-si' : v === 'ns' ? 'resp-ns' : 'resp-no';
      return '<dt>' + escapar(pregunta.texto) + '</dt><dd><span class="' + clase + '">' + escapar(textoOpcion(pregunta, v)) + '</span></dd>';
    }).join('');

    const avisos = control.avisos.length
      ? '<ul>' + control.avisos.map(function (a) { return '<li>' + etiquetaNivel(a.nivel) + ' ' + escapar(a.texto) + '</li>'; }).join('') + '</ul>'
      : '<p>' + etiquetaNivel(null) + ' Ninguna respuesta cumple un criterio de revisión.</p>';

    const opcionesComparar = otros.map(function (c) {
      return '<option value="' + c.id + '"' + (comparar && c.id === comparar.id ? ' selected' : '') + '>' + D.fechaCorta(c.fecha) + (c.ejemplo ? ' (ejemplo)' : '') + '</option>';
    }).join('');

    const cajaFoto = function (c, f) {
      return '<div class="foto" data-paciente="' + p.id + '" data-control="' + c.id + '" data-foto="' + f.id + '" data-estado="' + (c.fotos[f.id] || '') + '"></div>';
    };
    const pares = C.fotos.map(function (f) {
      return '<section><h3>' + escapar(f.titulo) + '</h3><div class="par">' +
        '<figure>' + cajaFoto(control, f) + '<figcaption>' + D.fechaCorta(control.fecha) + ' (este control)</figcaption></figure>' +
        (comparar ? '<figure>' + cajaFoto(comparar, f) + '<figcaption>' + D.fechaCorta(comparar.fecha) + '</figcaption></figure>' : '') +
        '</div></section>';
    }).join('');

    const revision = control.revision
      ? '<p><span class="etiqueta neutra">Revisado</span> ' + D.fechaLarga(control.revision.fecha) +
        (control.revision.por ? ' · ' + escapar(control.revision.por) : '') + '</p><p><strong>' + escapar(control.revision.accion) + '</strong>' +
        (control.revision.nota ? '<br>' + escapar(control.revision.nota) : '') + '</p>'
      : '<form id="form-revision"><label for="accion">Acción clínica</label><select id="accion">' +
        ACCIONES.map(function (a) { return '<option>' + a + '</option>'; }).join('') + '</select>' +
        '<label for="nota">Nota (opcional)</label><textarea id="nota"></textarea>' +
        '<p style="margin-top:.75rem"><button class="btn" type="submit">Marcar como revisado</button></p></form>';

    return '<p><a href="#paciente/' + p.id + '">← ' + escapar(p.nombre) + '</a></p>' +
      '<h1>Control del ' + D.fechaLarga(control.fecha) + '</h1>' +
      '<p class="suave">' + escapar(quien(control)) + (control.ejemplo ? ' · dato de ejemplo' : '') + '</p>' +
      '<div class="dos-columnas">' +
      '<section class="tarjeta"><h3 style="margin-top:0">Avisos</h3>' + avisos +
      '<h3>Resumen</h3><p class="resumen">' + escapar(resumen(p, control)) + '</p>' +
      '<p class="nota-proto">Resumen generado por plantilla. En el PMV lo redacta la IA con estos mismos datos; los avisos siempre salen de las reglas.</p></section>' +
      '<section class="tarjeta"><h3 style="margin-top:0">Respuestas</h3><dl>' + respuestas + '</dl></section>' +
      '</div>' +
      '<h2>Fotografías</h2>' +
      (otros.length ? '<label for="comparar" style="margin-top:0">Comparar con el control del</label><select id="comparar" style="max-width:16rem;margin-bottom:.9rem">' + opcionesComparar + '</select>' : '') +
      '<div class="comparacion">' + pares + '</div>' +
      '<h2>Revisión profesional</h2><section class="tarjeta">' + revision + '</section>';
  }

  function cargarFotos() {
    panel.querySelectorAll('.foto').forEach(function (caja) {
      if (caja.dataset.estado !== 'ok') { caja.innerHTML = '<span>Sin foto</span>'; return; }
      const d = caja.dataset;
      const origen = usuario ? N.urlFoto(d.paciente, d.control, d.foto) : D.leerFoto(d.control, d.foto);
      origen.then(function (url) {
        caja.innerHTML = url ? '<img src="' + url + '" alt="">' : '<span>Foto no disponible</span>';
      });
    });
  }

  // --- Contenido clínico ---
  function vistaContenido() {
    const chipAviso = function (o) {
      return '<span class="etiqueta ' + (o.aviso || 'neutra') + '">' + escapar(o.texto) + ' → ' + (o.aviso ? NIVEL[o.aviso].texto.toLowerCase() : 'sin aviso') + '</span>';
    };
    const chip = function (o) { return '<span class="etiqueta neutra">' + escapar(o.texto) + '</span>'; };
    const lista = function (items) { return '<ul>' + items.map(function (t) { return '<li>' + escapar(t) + '</li>'; }).join('') + '</ul>'; };
    const bloquePreguntas = function (preguntas, conAvisos) {
      return preguntas.map(function (p, i) {
        return '<div class="contenido-item"><span class="suave">' + (i + 1) + '. ' + escapar(p.etiqueta) + '</span>' +
          '<div class="texto">' + escapar(p.texto) + '</div>' + (p.ayuda ? '<div class="suave">Ayuda: ' + escapar(p.ayuda) + '</div>' : '') +
          '<div class="opciones">' + p.opciones.map(conAvisos ? chipAviso : chip).join('') + '</div></div>';
      }).join('');
    };
    const contactos = C.ayuda.contactos.map(function (c) { return c.texto + ': ' + (c.telefono || c.pendiente); });

    return '<h1>Contenido clínico para revisión</h1>' +
      '<p class="suave">Versión ' + escapar(C.version) + '. Todo lo que sigue es un borrador: se cambia en un solo archivo y la App se ajusta sola.</p>' +
      '<p class="no-imprimir"><button class="btn secundario" id="imprimir">Imprimir o guardar como PDF</button></p>' +

      '<section class="tarjeta"><h2 style="margin-top:0">1. Preguntas del control y avisos</h2>' + bloquePreguntas(C.preguntas, true) + '</section>' +

      '<section class="tarjeta"><h2 style="margin-top:0">2. Reglas adicionales</h2><ul>' +
      '<li>' + C.reglas.combinacion.minimoRespuestasSi + ' o más respuestas “Sí” en un mismo control → ' + NIVEL[C.reglas.combinacion.aviso].texto.toLowerCase() + '.</li>' +
      '<li>Falta alguna foto → ' + NIVEL[C.reglas.fotoFaltante.aviso].texto.toLowerCase() + '.</li>' +
      '<li>Sin controles durante ' + C.frecuencia.avisarSinControlDias + ' días → aviso por ausencia.</li>' +
      '<li>Frecuencia esperada: un control cada ' + C.frecuencia.diasEntreControles + ' día(s).</li></ul></section>' +

      '<section class="tarjeta"><h2 style="margin-top:0">3. Fotografías</h2>' +
      C.fotos.map(function (f, i) { return '<div class="contenido-item"><div class="texto">' + (i + 1) + '. ' + escapar(f.titulo) + '</div><div class="suave">Guía: ' + escapar(f.guia) + '</div></div>'; }).join('') + '</section>' +

      '<section class="tarjeta"><h2 style="margin-top:0">4. Registro inicial (línea basal)</h2><p class="suave">' + escapar(C.basal.intro) + '</p>' + bloquePreguntas(C.basal.preguntas, false) + '</section>' +

      '<section class="tarjeta"><h2 style="margin-top:0">5. Señales de alarma y contacto</h2><p><strong>' + escapar(C.ayuda.alarmaTitulo) + '</strong></p>' +
      lista(C.ayuda.senales) + '<p>' + escapar(C.ayuda.alarmaAccion) + '</p>' + lista(contactos) +
      '<p><strong>Mensaje al enviar:</strong> ' + escapar(C.confirmacion.texto) + ' ' + escapar(C.confirmacion.advertencia) + '</p></section>' +

      '<section class="tarjeta"><h2 style="margin-top:0">6. Consentimiento (' + escapar(C.consentimiento.version) + ')</h2>' + lista(C.consentimiento.puntos) + '</section>' +

      '<section class="tarjeta"><h2 style="margin-top:0">7. Decisiones pendientes del equipo clínico</h2>' + lista([
        'Texto y cantidad definitiva de preguntas (el Concept Note lista seis temas; los diseños mostraban cinco).',
        'Qué respuestas generan aviso y con qué nivel.',
        'Frecuencia de controles y días sin control que disparan el aviso por ausencia.',
        'Vistas fotográficas requeridas y si se agrega una foto de zona específica.',
        'Señales de alarma que se muestran al paciente.',
        'Quién revisa los avisos, en qué horario, en qué plazo y por qué vía se contacta al paciente.',
        'Teléfonos del equipo y de emergencias.',
        'Preguntas de la línea basal y si las completa el paciente o el profesional en la consulta.'
      ]) + '</section>';
  }

  // --- Navegación ---
  const SECCIONES = ['avisos', 'pacientes', 'paciente', 'control', 'contenido'];
  const partesRuta = function () { return location.hash.replace(/^#/, '').split('/'); };

  function pintar() {
    const partes = partesRuta();
    const seccion = SECCIONES.indexOf(partes[0]) >= 0 ? partes[0] : 'avisos';
    const pestana = seccion === 'paciente' || seccion === 'control' ? 'pacientes' : seccion;
    document.querySelectorAll('.pestanas a').forEach(function (a) { a.classList.toggle('activa', a.dataset.pestana === pestana); });
    pintarAcceso();
    if (seccion === 'avisos') panel.innerHTML = vistaAvisos();
    if (seccion === 'pacientes') panel.innerHTML = pacientes.length === 1 ? vistaPaciente(pacientes[0].id) : vistaPacientes();
    if (seccion === 'paciente') panel.innerHTML = vistaPaciente(partes[1]);
    if (seccion === 'contenido') panel.innerHTML = vistaContenido();
    if (seccion === 'control') { panel.innerHTML = vistaControl(partes[1], partes[2], partes[3]); cargarFotos(); }
    window.scrollTo(0, 0);
  }

  const recargar = function () { return cargar().then(pintar); };

  panel.addEventListener('change', function (e) {
    const partes = partesRuta();
    if (e.target.id === 'comparar') location.hash = 'control/' + partes[1] + '/' + partes[2] + '/' + e.target.value;
  });

  panel.addEventListener('submit', function (e) {
    if (e.target.id !== 'form-revision') return;
    e.preventDefault();
    const partes = partesRuta();
    const revision = {
      fecha: new Date().toISOString(),
      accion: document.getElementById('accion').value,
      nota: document.getElementById('nota').value.trim()
    };
    if (usuario) {
      revision.por = usuario.email;
      N.guardarRevision(partes[1], partes[2], revision).then(function (r) {
        if (r.error) mensajeAcceso = 'No se pudo guardar la revisión. Probá de nuevo.';
        recargar();
      });
    } else {
      estadoLocal.controles.find(function (c) { return c.id === partes[2]; }).revision = revision;
      D.guardar(estadoLocal);
      recargar();
    }
  });

  panel.addEventListener('click', function (e) {
    if (e.target.id === 'imprimir') window.print();
  });

  acceso.addEventListener('click', function (e) {
    if (e.target.id === 'actualizar') { mensajeAcceso = ''; recargar(); }
    if (e.target.id === 'salir') N.salirProfesional().then(function () { mensajeAcceso = ''; recargar(); });
  });

  acceso.addEventListener('submit', function (e) {
    e.preventDefault();
    const correo = document.getElementById('correo').value.trim().toLowerCase();
    if (!correo) return;
    mensajeAcceso = 'Enviando…';
    pintarAcceso();
    N.pedirEnlace(correo).then(function (r) {
      mensajeAcceso = r.error
        ? 'No pudimos enviar el enlace (' + r.error.message + ').'
        : 'Te enviamos un enlace a ' + correo + '. Abrilo en este mismo dispositivo.';
      pintarAcceso();
    });
  });

  window.addEventListener('hashchange', pintar);
  recargar();
})();
