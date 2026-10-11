/* Panel profesional — prototipo. Lee los mismos datos locales que la App del paciente. */
(function () {
  'use strict';
  const C = window.PV_CONTENIDO;
  const D = window.PV_DATOS;
  const panel = document.getElementById('panel');
  let estado = D.leer();

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

  const recientesPrimero = function () { return estado.controles.slice().reverse(); };

  // Resumen por plantilla. En el PMV lo redacta la IA a partir de estos mismos datos.
  function resumen(control) {
    const previos = estado.controles.filter(function (c) { return c.fecha < control.fecha; });
    const cambios = [], dudas = [];
    C.preguntas.forEach(function (p) {
      const v = control.respuestas[p.id];
      if (v === 'si') {
        const antes = previos.filter(function (c) { return c.respuestas[p.id] === 'si'; }).length;
        cambios.push(p.etiqueta.toLowerCase() + (previos.length
          ? (antes ? ' (también en ' + antes + ' de los ' + previos.length + ' controles previos)' : ' (primera vez en ' + previos.length + ' controles previos)')
          : ''));
      } else if (v === 'ns') dudas.push(p.etiqueta.toLowerCase());
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
    const pendientes = estado.controles.filter(function (c) { return c.avisos.length && !c.revision; })
      .sort(function (a, b) {
        const na = D.nivelMaximo(a.avisos) === 'prioritario' ? 0 : 1, nb = D.nivelMaximo(b.avisos) === 'prioritario' ? 0 : 1;
        return na - nb || (a.fecha < b.fecha ? 1 : -1);
      });
    const revisados = recientesPrimero().filter(function (c) { return c.revision && !c.ejemplo; }).slice(0, 5);
    const ultimo = D.ultimoControl(estado);
    let html = '<h1>Avisos para revisión</h1>' +
      '<p class="suave">Un aviso indica que una respuesta cumple un criterio de revisión. No confirma una lesión, y la falta de avisos no descarta complicaciones.</p>';

    if (!estado.basal) {
      return html + '<div class="tarjeta"><p>Todavía no hay datos. Abrí la <a href="index.html">App del paciente</a> y completá el primer uso.</p></div>';
    }

    if (ultimo && D.diasDesde(ultimo.fecha) >= C.frecuencia.avisarSinControlDias) {
      html += '<article class="tarjeta revisar"><header>' + etiquetaNivel('revisar') + '<strong>' + escapar(estado.nombre) +
        '</strong></header><p>Sin controles desde ' + D.fechaRelativa(ultimo.fecha) + ' (umbral: ' + C.frecuencia.avisarSinControlDias + ' días).</p></article>';
    }

    if (!pendientes.length) html += '<div class="tarjeta"><p style="margin:0">No hay avisos pendientes.</p></div>';
    pendientes.forEach(function (c) {
      const nivel = D.nivelMaximo(c.avisos);
      html += '<article class="tarjeta ' + nivel + '"><header>' + etiquetaNivel(nivel) +
        '<strong>' + escapar(estado.nombre) + '</strong><span class="suave">' + D.fechaLarga(c.fecha) + ' · ' + escapar(quien(c)) + '</span></header>' +
        '<ul>' + c.avisos.map(function (a) { return '<li>' + escapar(a.texto) + '</li>'; }).join('') + '</ul>' +
        '<a class="btn" href="#control/' + c.id + '">Abrir control</a></article>';
    });

    if (revisados.length) {
      html += '<h2>Revisados</h2>';
      revisados.forEach(function (c) {
        html += '<article class="tarjeta"><header><span class="etiqueta neutra">Revisado</span><strong>' + escapar(estado.nombre) +
          '</strong><span class="suave">' + D.fechaLarga(c.fecha) + '</span></header><p style="margin:0">' + escapar(c.revision.accion) +
          (c.revision.nota ? ' — ' + escapar(c.revision.nota) : '') + ' · <a href="#control/' + c.id + '">Ver</a></p></article>';
      });
    }
    return html;
  }

  // --- Paciente ---
  function vistaPaciente() {
    if (!estado.basal) return '<h1>Paciente</h1><div class="tarjeta"><p>Todavía no hay datos. Abrí la <a href="index.html">App del paciente</a>.</p></div>';

    const basal = C.basal.preguntas.map(function (p) {
      return '<dt>' + escapar(p.etiqueta) + '</dt><dd>' + escapar(textoOpcion(p, estado.basal.respuestas[p.id])) + '</dd>';
    }).join('');
    const reales = estado.controles.filter(function (c) { return !c.ejemplo; });
    const porCuidador = reales.filter(function (c) { return c.realizadoPor.tipo === 'cuidador'; }).length;

    const cabeceras = C.preguntas.map(function (p) { return '<th>' + escapar(p.etiqueta) + '</th>'; }).join('');
    const filas = recientesPrimero().map(function (c) {
      const celdas = C.preguntas.map(function (p) {
        const v = c.respuestas[p.id];
        const clase = v === 'si' ? 'resp-si' : v === 'ns' ? 'resp-ns' : 'resp-no';
        return '<td class="resp"><span class="' + clase + '">' + (v === 'si' ? 'Sí' : v === 'ns' ? '?' : 'No') + '</span></td>';
      }).join('');
      const estadoControl = c.revision ? '<span class="etiqueta neutra">Revisado</span>' : etiquetaNivel(D.nivelMaximo(c.avisos));
      return '<tr><td><a href="#control/' + c.id + '">' + D.fechaCorta(c.fecha) + '</a>' + (c.ejemplo ? ' <span class="suave">(ejemplo)</span>' : '') + '</td>' +
        celdas + '<td>' + fotosTomadas(c) + '/' + C.fotos.length + '</td><td>' + escapar(quien(c)) + '</td><td>' + estadoControl + '</td></tr>';
    }).join('');

    return '<h1>' + escapar(estado.nombre) + '</h1><p class="suave">Paciente de ejemplo · frecuencia indicada: cada ' +
      C.frecuencia.diasEntreControles + ' día(s)</p>' +
      '<div class="dos-columnas">' +
      '<section class="tarjeta"><h3 style="margin-top:0">Línea basal · ' + D.fechaCorta(estado.basal.fecha) + '</h3><dl>' + basal + '</dl></section>' +
      '<section class="tarjeta"><h3 style="margin-top:0">Uso</h3><dl>' +
      '<dt>Controles enviados (sin ejemplos)</dt><dd>' + reales.length + '</dd>' +
      '<dt>Hechos por cuidador</dt><dd>' + porCuidador + '</dd>' +
      '<dt>Último control</dt><dd>' + (D.ultimoControl(estado) ? D.fechaRelativa(D.ultimoControl(estado).fecha) : '—') + '</dd>' +
      '<dt>Consentimiento</dt><dd>' + escapar(estado.consentimiento.version) + '</dd>' +
      '</dl></section></div>' +
      '<h2>Historial de controles</h2>' +
      '<div class="tabla-caja"><table><thead><tr><th>Fecha</th>' + cabeceras + '<th>Fotos</th><th>Hecho por</th><th>Estado</th></tr></thead><tbody>' + filas + '</tbody></table></div>';
  }

  // --- Control ---
  function vistaControl(id, compararId) {
    const control = estado.controles.find(function (c) { return c.id === id; });
    if (!control) return '<h1>Control no encontrado</h1><p><a href="#paciente">Volver al paciente</a></p>';

    const otros = recientesPrimero().filter(function (c) { return c.id !== id; });
    const anterior = otros.find(function (c) { return c.fecha < control.fecha; });
    const comparar = otros.find(function (c) { return c.id === compararId; }) || anterior || null;

    const respuestas = C.preguntas.map(function (p) {
      const v = control.respuestas[p.id];
      const clase = v === 'si' ? 'resp-si' : v === 'ns' ? 'resp-ns' : 'resp-no';
      return '<dt>' + escapar(p.texto) + '</dt><dd><span class="' + clase + '">' + escapar(textoOpcion(p, v)) + '</span></dd>';
    }).join('');

    const avisos = control.avisos.length
      ? '<ul>' + control.avisos.map(function (a) { return '<li>' + etiquetaNivel(a.nivel) + ' ' + escapar(a.texto) + '</li>'; }).join('') + '</ul>'
      : '<p>' + etiquetaNivel(null) + ' Ninguna respuesta cumple un criterio de revisión.</p>';

    const opcionesComparar = otros.map(function (c) {
      return '<option value="' + c.id + '"' + (comparar && c.id === comparar.id ? ' selected' : '') + '>' + D.fechaCorta(c.fecha) + (c.ejemplo ? ' (ejemplo)' : '') + '</option>';
    }).join('');

    const pares = C.fotos.map(function (f) {
      return '<section><h3>' + escapar(f.titulo) + '</h3><div class="par">' +
        '<figure><div class="foto" data-control="' + control.id + '" data-foto="' + f.id + '" data-estado="' + (control.fotos[f.id] || '') + '"></div><figcaption>' + D.fechaCorta(control.fecha) + ' (este control)</figcaption></figure>' +
        (comparar ? '<figure><div class="foto" data-control="' + comparar.id + '" data-foto="' + f.id + '" data-estado="' + (comparar.fotos[f.id] || '') + '"></div><figcaption>' + D.fechaCorta(comparar.fecha) + '</figcaption></figure>' : '') +
        '</div></section>';
    }).join('');

    const revision = control.revision
      ? '<p><span class="etiqueta neutra">Revisado</span> ' + D.fechaLarga(control.revision.fecha) + '</p><p><strong>' + escapar(control.revision.accion) + '</strong>' +
        (control.revision.nota ? '<br>' + escapar(control.revision.nota) : '') + '</p>'
      : '<form id="form-revision"><label for="accion">Acción clínica</label><select id="accion">' +
        ACCIONES.map(function (a) { return '<option>' + a + '</option>'; }).join('') + '</select>' +
        '<label for="nota">Nota (opcional)</label><textarea id="nota"></textarea>' +
        '<p style="margin-top:.75rem"><button class="btn" type="submit">Marcar como revisado</button></p></form>';

    return '<p><a href="#paciente">← ' + escapar(estado.nombre) + '</a></p>' +
      '<h1>Control del ' + D.fechaLarga(control.fecha) + '</h1>' +
      '<p class="suave">' + escapar(quien(control)) + (control.ejemplo ? ' · dato de ejemplo' : '') + '</p>' +
      '<div class="dos-columnas">' +
      '<section class="tarjeta"><h3 style="margin-top:0">Avisos</h3>' + avisos +
      '<h3>Resumen</h3><p class="resumen">' + escapar(resumen(control)) + '</p>' +
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
      D.leerFoto(caja.dataset.control, caja.dataset.foto).then(function (dataUrl) {
        caja.innerHTML = dataUrl ? '<img src="' + dataUrl + '" alt="">' : '<span>Foto de ejemplo no disponible</span>';
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

      '<section class="tarjeta"><h2 style="margin-top:0">4. Línea basal</h2><p class="suave">' + escapar(C.basal.intro) + '</p>' + bloquePreguntas(C.basal.preguntas, false) + '</section>' +

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
  function pintar() {
    estado = D.leer();
    const partes = location.hash.replace(/^#/, '').split('/');
    const seccion = ['avisos', 'paciente', 'control', 'contenido'].indexOf(partes[0]) >= 0 ? partes[0] : 'avisos';
    document.querySelectorAll('.pestanas a').forEach(function (a) {
      a.classList.toggle('activa', a.dataset.pestana === (seccion === 'control' ? 'paciente' : seccion));
    });
    if (seccion === 'avisos') panel.innerHTML = vistaAvisos();
    if (seccion === 'paciente') panel.innerHTML = vistaPaciente();
    if (seccion === 'contenido') panel.innerHTML = vistaContenido();
    if (seccion === 'control') { panel.innerHTML = vistaControl(partes[1], partes[2]); cargarFotos(); }
    window.scrollTo(0, 0);
  }

  panel.addEventListener('change', function (e) {
    if (e.target.id === 'comparar') location.hash = 'control/' + location.hash.split('/')[1] + '/' + e.target.value;
  });

  panel.addEventListener('submit', function (e) {
    if (e.target.id !== 'form-revision') return;
    e.preventDefault();
    const control = estado.controles.find(function (c) { return c.id === location.hash.split('/')[1]; });
    control.revision = {
      fecha: new Date().toISOString(),
      accion: document.getElementById('accion').value,
      nota: document.getElementById('nota').value.trim()
    };
    D.guardar(estado);
    pintar();
  });

  panel.addEventListener('click', function (e) {
    if (e.target.id === 'imprimir') window.print();
  });

  window.addEventListener('hashchange', pintar);
  pintar();
})();
